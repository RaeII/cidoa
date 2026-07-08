# Plano v2 — Edifícios do backend, filtros por cidade/UF/região/ONG, escala 100k+, multiusuário

> Revisão v2: corrige ETag/change-detection cego a UPDATEs, corrige progress bar quebrada por gzip, adiciona `Vary`, alinha módulo às convenções do repo (service layer, `this.query`), e adiciona a dimensão **cidade/UF/região/ONG** ao schema, ao cache e ao front com filtros.

## Contexto (verificado contra o código em 2026-07-07)

Hoje os edifícios nascem no front: `INITIAL_TEST_DONATIONS` (10 valores) em [CitySceneEditor.tsx:39-50](/var/www/cidoa/src/components/CitySceneEditor.tsx#L39-L50) + customização twisted apontando para o id 0 (:52-73), aplicados no mount por [CitySceneCanvas.tsx:80-87](/var/www/cidoa/src/components/three/CitySceneCanvas.tsx#L80-L87). IDs gerados no cliente (`nextId++`). Não existe `src/api/`, axios, proxy Vite, `vite-env.d.ts` nem `setDonations` — tudo é trabalho novo.

Backend (`/var/www/cidoa_back`, Express 5 + pg + Bun) não tem módulo de doações nem nada de cache/ETag/zlib. Restrições verificadas: `MAX_LIMIT=100` (pagination.ts:9), rate limit global 300 req/min/IP (aplicado antes das rotas), sem middleware de compressão, `statement_timeout=10s` via PoolConfig, migrations imutáveis por checksum SHA-256, **`PORT` sem default no `.env`** (precisa ser definido; assumir `3010` e casar com o proxy do front). Sem `pg.types.setTypeParser` — `int8`/`numeric` chegam como **string** (casts no SQL obrigatórios).

Objetivo: front busca doações do backend (axios — pedido explícito), snapshot cacheado + gzip, **filtros por cidade, UF, região e ONG**, 100k+ edifícios, muitos usuários simultâneos sem comprometer o servidor. **Nunca confiar no front** (Parte 4).

## Avaliação crítica — cache

**Problema real.** Sem cache, cada visitante = ~10 queries keyset (100k linhas) + ~3MB de `JSON.stringify`. 100 visitantes simultâneos = ~1.000 queries + ~300MB de serialização → pool saturado, `statement_timeout` estourando. Dado quase-estático e idêntico para todos — caso clássico de snapshot cache.

| Proposta | Veredito | Motivo |
|---|---|---|
| Cache do dataset inteiro | ✅ Adotar | Snapshot em memória, gzip pré-comprimido 1×. DB passa de O(visitantes) para ~1 query leve/30s. |
| Refresher | ✅ `setInterval` in-process | Precedente: `startPoolWatchdog()` ([index.ts:55](/var/www/cidoa_back/src/index.ts#L55)). Cron externo = infra extra, ganho zero. |
| JSON + gzip | ✅ Adotar | `zlib.gzipSync` **1× no build do snapshot**, não por request. 100k tuplas de 4 campos ≈ 3MB raw → ~0,7MB gz. gzipSync bloqueia ~50–100ms por rebuild — aceitável, só roda quando o dado muda. |
| Filtro server-side por request (`?uf=SP`) | ❌ Rejeitar | Cada request filtrada exigiria re-`stringify`+re-gzip do subset → mata o blob pré-comprimido, CPU por visitante volta. |
| Cache combinatório por filtro | ❌ Rejeitar | 5.570 municípios × ONGs × regiões = explosão de memória e de misses. |
| **Filtro client-side sobre snapshot único** | ✅ Adotar | Snapshot carrega `cityId`/`ongId` por doação + lookups de cidades/ONGs. Filtrar 100k em JS = ~5ms, zero rede, zero DB por mudança de filtro. Dado é 100% público — front filtrar não é questão de confiança (ver Parte 4). |
| CDN agora | ⚠️ Preparar, não implementar | Contrato CDN-ready (ETag, `Cache-Control: public`, `Vary`) + `VITE_API_URL` no front. Migrar vira config. |
| Redis | ❌ Rejeitar | 1 blob ~0,7MB; memória do processo basta. Multi-instância: cada uma rebuilda (1 query leve/30s cada). |

**Consequência:** 1 endpoint snapshot (`GET /api/donation/snapshot`), keyset paginado sobrevive só **interno** ao builder. Staleness ≤30s — aceitável (doação manual do front continua local, não persiste).

## Decisões de arquitetura

1. **Snapshot em memória** no módulo donation: `{ raw: Buffer; gz: Buffer; etag: string; total: number }`. Build single-flight (cold start concorrente aguarda a mesma promise). Refresher `setInterval` 30s com change-detection barata; erro no refresh → loga e mantém snapshot anterior (stale > vazio).
2. **Change-detection cobre INSERT, DELETE e UPDATE**: versão = `(total, maxId, lastChange)` onde `lastChange = MAX(updated_at/created_at)` de `donation` + `ong` + `city`. *(v1 usava só `COUNT+MAX(id)` — cego a UPDATE de valor/cidade/ONG: snapshot e ETag ficavam stale para sempre.)* ETag = `W/"2:<total>:<maxId>:<lastChange>"`.
3. **HTTP caching**: `ETag` + `If-None-Match` → `304` (que repete `ETag` + `Cache-Control`, exigência da spec); `Cache-Control: public, max-age=30, stale-while-revalidate=60`; `Content-Encoding: gzip` quando `Accept-Encoding` permite (fallback raw); **`Vary: Accept-Encoding`** (sem isso, proxy/CDN serve gzip a cliente que não aceita); `Content-Length` explícito; **`X-Snapshot-Bytes: <raw.length>`** — com gzip, `ProgressEvent.total` fica 0 e `loaded` conta bytes **descomprimidos**, então % contra `Content-Length` quebra; o header dá o denominador certo.
4. **Formato compacto v2**: `{ v: 2, total, cities: [[id, name, uf]], ongs: [[id, name]], data: [[id, value, cityId, ongId]] }`. Casts `::int`/`::float8` no SQL (driver devolve `int8`/`numeric` como string). `id::int` tem teto em 2^31 — ok até dezenas de milhões, documentar.
5. **Região não vai ao banco**: região = função fixa da UF (27 UFs → 5 regiões, definição geográfica imutável). Mapa constante **no front** (`src/api/regions.ts`); backend nem conhece o conceito.
6. **Camadas seguem a convenção do repo**: `Controller → Service → Database`. O cache/refresher **é** o `donation.service.ts` (v1 propunha `donation.cache.ts` sem service — violava `doc/guias/novo-modulo.md` e o checklist). Leituras via **`this.query`** da classe base `Database` — `readQuery`/readPool não é usado por nenhum módulo e a classe base não o expõe; carga é ~1 query leve/30s, irrelevante para o writePool. `// ponytail: this.query (writePool); migrar p/ readQuery se réplica de leitura for configurada de fato`.
7. **Axios no front** (pedido explícito), `src/api/http.ts`, `baseURL = import.meta.env.VITE_API_URL ?? "/api"`. Proxy Vite `/api` → back em dev.
8. **Replace-all + 1 rebuild único**: novo `setDonations(entries)` no manager. Rebuild de 100k ≈ ~0,5s, atrás de overlay. IDs do backend preservados; `nextId = maxId + 1` mantém doação manual pós-load.
9. **Seed 100k em script standalone dev-only** (migrations são imutáveis e rodam em produção). Seeda `ong` + `city` (27 capitais, código IBGE) + `donation`.
10. **Rota pública de leitura** — precedente: `/api/system/health` e `/metrics` já são públicos. Rate limit global cobre.

## Parte 1 — Backend (`/var/www/cidoa_back`)

### 1.1 Migration `migrations/0002_donation.sql`

```sql
CREATE TABLE IF NOT EXISTS ong (
    id         BIGSERIAL    PRIMARY KEY,
    name       VARCHAR(255) NOT NULL,
    is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);
DROP TRIGGER IF EXISTS trg_ong_set_updated_at ON ong;
CREATE TRIGGER trg_ong_set_updated_at
    BEFORE UPDATE ON ong
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS city (
    id         INT          PRIMARY KEY,   -- código IBGE do município (7 dígitos)
    name       VARCHAR(255) NOT NULL,
    uf         CHAR(2)      NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS donation (
    id         BIGSERIAL     PRIMARY KEY,
    value      NUMERIC(14,2) NOT NULL CHECK (value > 0),
    city_id    INT           NOT NULL REFERENCES city(id),
    ong_id     BIGINT        NOT NULL REFERENCES ong(id),
    is_active  BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_donation_active_id ON donation (id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_donation_city ON donation (city_id);  -- FK: evita seq scan em delete/update de city
CREATE INDEX IF NOT EXISTS idx_donation_ong  ON donation (ong_id);   -- idem p/ ong + queries futuras por ONG
DROP TRIGGER IF EXISTS trg_donation_set_updated_at ON donation;
CREATE TRIGGER trg_donation_set_updated_at
    BEFORE UPDATE ON donation
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

Permissões automáticas (`ALTER DEFAULT PRIVILEGES` do `0000_setup_roles.sql:30-33`); `set_updated_at()` já existe (`0001_initial_user.sql:20-25`). `city` sem `updated_at`/trigger — nome de município não muda; se mudar um dia, novo migration.

### 1.2 Seed dev `scripts/seed-donations.ts` (novo)

Boilerplate de conexão espelhando `scripts/migrate.ts`. Guard `NODE_ENV === "production"` → abort. CLI: `bun run scripts/seed-donations.ts [count=100000]`. Ordem: cidades → ONGs → doações (FKs NOT NULL).

- `city`: array embutido das 27 capitais com código IBGE real (ex.: `[3550308, 'São Paulo', 'SP']`). Produção carregará a lista IBGE completa — nota na doc.
- `ong`: ~20 nomes fake (`INSERT ... ON CONFLICT DO NOTHING`).
- `donation`:

```sql
INSERT INTO donation (value, city_id, ong_id)
SELECT round((random() * random() * 5000 + 10)::numeric, 2),  -- random()² enviesa p/ baixo → skyline realista
       (SELECT id FROM city ORDER BY random() LIMIT 1),        -- ponytail: subquery por linha é lenta p/ 100k;
       (SELECT id FROM ong  ORDER BY random() LIMIT 1)         -- usar arrays pré-carregados + índice random no script
FROM generate_series(1, $1::int)
```

(Implementar a distribuição no script TS: carregar ids de city/ong 1×, gerar batches de INSERT multi-values de 5k — evita 100k subqueries.)

### 1.3 Módulo `src/modules/donation/` (novo — segue `doc/guias/novo-modulo.md`: controller + service + database + `schema/` singular)

**`donation.database.ts`** — `class DonationDatabase extends Database`, tudo via `this.query` (projeção explícita, nunca `SELECT *`):

- `findBatch(afterId, limit)` (uso interno do builder, batches de 10k — protege `statement_timeout=10s`):
  ```sql
  SELECT id::int AS id, value::float8 AS value, city_id::int AS city_id, ong_id::int AS ong_id
  FROM donation WHERE is_active = TRUE AND id > $1 ORDER BY id LIMIT $2
  ```
- `listCities()`: `SELECT id, name, uf FROM city ORDER BY name`
- `listOngs()`: `SELECT id::int AS id, name FROM ong WHERE is_active = TRUE ORDER BY name`
- `getVersion()` (change-detection, 1 roundtrip):
  ```sql
  SELECT
    (SELECT COUNT(*) FROM donation WHERE is_active = TRUE)::int AS total,
    (SELECT COALESCE(MAX(id), 0) FROM donation)::int AS max_id,
    COALESCE((SELECT EXTRACT(EPOCH FROM GREATEST(
        (SELECT MAX(GREATEST(created_at, COALESCE(updated_at, created_at))) FROM donation),
        (SELECT MAX(GREATEST(created_at, COALESCE(updated_at, created_at))) FROM ong),
        (SELECT MAX(created_at) FROM city)
    ))::bigint, 0)) AS last_change
  ```

**`donation.service.ts`** — coração da mudança (service = cache, cumpre a convenção de camadas):

```ts
type Snapshot = { raw: Buffer; gz: Buffer; etag: string; total: number };

getSnapshot(): Promise<Snapshot>   // válido → retorna; senão build single-flight
startSnapshotRefresher(): void     // build inicial + setInterval 30s: getVersion() mudou? rebuild
stopSnapshotRefresher(): void      // clearInterval (chamado no drain)
```

Build: keyset loop (`findBatch` 10k/vez) + `listCities` + `listOngs` → monta `{v: 2, total, cities, ongs, data}` → `JSON.stringify` 1× → `zlib.gzipSync` 1× → `etag = 'W/"2:<total>:<maxId>:<lastChange>"'`. Erro no refresh: `logger.error(...)` (import default de `@/shared/utils/logger`), mantém snapshot anterior.

**`schema/donation.schema.ts`** — schema de resposta p/ Swagger (nunca inline no controller):

```ts
export const donationSnapshotResponseSchema = z.object({
  v: z.number(),
  total: z.number(),
  cities: z.array(z.tuple([z.number(), z.string(), z.string()])),  // [id, name, uf]
  ongs: z.array(z.tuple([z.number(), z.string()])),                // [id, name]
  data: z.array(z.tuple([z.number(), z.number(), z.number(), z.number()])), // [id, value, cityId, ongId]
});
```

**`donation.controller.ts`** — `@Route("/donation")` + `@ApiTags("Doações")`, `@Get("/snapshot")` **sem middleware** (público — precedente `/system/health`), `@ApiResponse(200, "...", donationSnapshotResponseSchema)`, `handleError` no catch:

- `If-None-Match === etag` → `304` com `ETag` + `Cache-Control` repetidos, sem body.
- Headers do 200: `Content-Type: application/json`, `ETag`, `Cache-Control: public, max-age=30, stale-while-revalidate=60`, `Vary: Accept-Encoding`, `X-Snapshot-Bytes: <raw.length>`, `Content-Length` explícito.
- `Accept-Encoding` com gzip → `Content-Encoding: gzip` + `res.end(snapshot.gz)`; senão `res.end(snapshot.raw)`. (Corpo pré-serializado — não `res.json`; desvio deliberado da convenção, documentar na página do módulo.)

### 1.4 Registro e ciclo de vida — [src/index.ts](/var/www/cidoa_back/src/index.ts)

- `DonationController` no array `controllers` (:13-17).
- `startSnapshotRefresher()` junto de `startPoolWatchdog()` (:55); `stopSnapshotRefresher()` no início do `drain()` (:62-66).

### Nota de produção (registrar na doc do módulo)

Contrato CDN-ready: apontar CDN para o backend — `ETag`/`Cache-Control`/`Vary` fazem o edge segurar o blob; origem recebe ~1 request por TTL. `CORS_ORIGINS` do domínio real (default prod = nenhuma origem, fail-closed) e `AUTHORIZATION=1` (boot valida). Carga completa de municípios IBGE via script próprio. Teto conhecido: ~1M doações ≈ 30MB raw / ~7MB gz — aí particionar snapshot ou CDN obrigatório; considerar `zlib.brotliCompressSync` (stdlib, ~25% menor) se payload mobile pesar.

## Parte 2 — Frontend (`/var/www/cidoa`)

### 2.1 Deps e config

- `npm install axios` (única dep nova; pedido explícito).
- `vite.config.ts`: `server: { proxy: { "/api": { target: "http://localhost:3010", changeOrigin: true } } }` — **definir `PORT=3010` no `.env` do back** (hoje está vazio; sem isso o Express sobe em porta aleatória e o proxy quebra).
- Criar `src/vite-env.d.ts` (não existe): `/// <reference types="vite/client" />` + tipo de `VITE_API_URL?: string`.

### 2.2 `src/api/` (novo — camada só de dados, zero Three.js/React)

**`http.ts`** — `axios.create({ baseURL: import.meta.env.VITE_API_URL ?? "/api" })` + normalização de erro (status + mensagem).

**`regions.ts`** — `export const UF_REGION: Record<string, Region>` (27 UFs → `"Norte" | "Nordeste" | "Centro-Oeste" | "Sudeste" | "Sul"`). Front resolve região; backend não conhece.

**`donationApi.ts`**:

```ts
export type DonationRecord = { id: number; value: number; cityId: number; ongId: number };
export type City = { id: number; name: string; uf: string };
export type Ong = { id: number; name: string };
export type DonationDataset = { donations: DonationRecord[]; cities: City[]; ongs: Ong[]; total: number };
export type DonationLoadProgress = { loadedBytes: number; totalBytes: number | null };

export async function fetchDonationSnapshot(opts: {
  signal?: AbortSignal;
  onProgress?: (p: DonationLoadProgress) => void;
}): Promise<DonationDataset>
```

1 GET `/donation/snapshot` com `onDownloadProgress`. **Gotcha gzip**: `totalBytes` vem de `X-Snapshot-Bytes` (lido via `progressEvent.event?.target?.getResponseHeader?.("X-Snapshot-Bytes")` — headers chegam antes do body); `Content-Length` não serve (é o tamanho comprimido; `loaded` conta descomprimido). Sem o header → `totalBytes: null` → overlay mostra MB carregados sem %. Mapeia tuplas → objetos.

### 2.3 Hook `src/components/hooks/useDonations.ts` (novo — hooks vivem em `components/hooks/`, não criar `src/hooks/`)

Separa dados da cena e do editor (pedido explícito de organização):

```ts
export type DonationFilter = { region?: Region; uf?: string; cityId?: number; ongId?: number };
export type DonationsLoadState =
  | { status: "loading"; loadedBytes: number; totalBytes: number | null }
  | { status: "ready"; count: number }
  | { status: "error"; message: string };

export function useDonations(): {
  loadState: DonationsLoadState;
  donations: DonationRecord[];      // JÁ filtrado (useMemo)
  cities: City[]; ongs: Ong[];
  filter: DonationFilter; setFilter(f: DonationFilter): void;
  retry(): void;
}
```

- `useEffect` com `AbortController`: `fetchDonationSnapshot({signal, onProgress})` → guarda dataset completo em ref/state. Catch ignora abort. Dep `reloadKey` (retry). Idempotente sob StrictMode.
- Filtro client-side em `useMemo`: `Map<cityId, City>` construído 1×; predicado AND — `cityId` match direto; senão `uf` via city do registro; senão `region` via `UF_REGION[city.uf]`; `ongId` combinável com qualquer nível. ~5ms p/ 100k.
- Filtro trocado → novo array → editor chama `setDonations` (rebuild ~0,5s no pior caso "limpar filtro"; subsets filtrados são bem menores/rápidos). Doação manual local é descartada ao trocar filtro (replace-all) — comportamento documentado.

### 2.4 Manager — `setDonations` em [createDonationManager.ts](/var/www/cidoa/src/scene/managers/createDonationManager.ts)

Novo método junto de `addDonations` (:1632) + type `DonationManager`:

```ts
setDonations(entries: ReadonlyArray<{ id: number; value: number }>): void
```

- `donations.length = 0`; push com **id do backend**; 1 sort desc por valor (maior → centro da espiral, mesmo sort de :1637).
- `nextId = Math.max(maxIdBackend + 1, nextId)`.
- **Remover acessórios órfãos**: `rooftopMeshes`/`signMeshes`/`edgeLightMeshes`/`hologramMeshes` são keyed por donationId e os `sync*` só **escondem** (`group.visible = false`, ex. :1273) — nunca deletam, porque remoção de doação não existia até agora. `setDonations` precisa iterar esses 4 Maps e fazer dispose+delete de ids ausentes. `customShapeMeshes` já é limpo por `syncCustomShapes` (:1612-1617).
- `growIfNeeded(donations.length)` + `rebuildInstances()` — 1 recriação de mesh, 1 rebuild O(n).
- Cena não precisa de cityId/ongId — filtro acontece antes, no hook; `DonationEntry` não muda.

### 2.5 Runtime / hook / canvas

- [createCitySceneRuntime.ts:423-434](/var/www/cidoa/src/scene/runtime/createCitySceneRuntime.ts#L423-L434): `setDonations(entries)` → manager + `syncTerrainToCity()` + `emitStatsPatch({buildings})` + `markCubeDirty()` (mesmo shape de `addDonations` :429-434).
- [useCityScene.ts:135-141](/var/www/cidoa/src/scene/hooks/useCityScene.ts#L135-L141): `useCallback([])` estável `setDonations`, igual aos existentes.
- [CitySceneCanvas.tsx](/var/www/cidoa/src/components/three/CitySceneCanvas.tsx): `setDonations` no `CitySceneCanvasHandle` (:17-23) e `useImperativeHandle` (:89-93). **Remover** props `initialDonations`/`initialBuildingCustomizations` (:26-27) e o mount effect (:80-87).

### 2.6 Editor — [CitySceneEditor.tsx](/var/www/cidoa/src/components/CitySceneEditor.tsx)

- **Deletar** `INITIAL_TEST_DONATIONS` + customização twisted inicial (:39-73) — aponta pro id 0, inexistente com BIGSERIAL. `buildingCustomizations` inicia `new Map()` (bônus: sem nenhuma customização, `applyInstanceColors` desliga `instanceColor` e sai cedo — guard `hasAnyCustom`, :1234).
- Consome `useDonations()`; `useEffect` sobre `donations`+`status` → `canvasRef.current?.setDonations(donations)`.
- Novo `src/components/html/DonationLoadOverlay.tsx`: card central no padrão visual do repo (`absolute z-.. rounded-lg border border-white/10 bg-black/70 backdrop-blur-md`) — spinner + % quando `totalBytes` disponível (senão MB carregados) + contagem final; erro → mensagem + "Tentar novamente" (`retry`). Fundo `pointer-events-none`. Overlay só sai após `setDonations` retornar → mascara o freeze ~0,5s do rebuild.
- Novo `src/components/html/DonationFilterBar.tsx`: selects Região → UF → Cidade (cascateando: região restringe UFs, UF restringe cidades) + ONG, populados de `cities`/`ongs`/`UF_REGION`. Puro/presentacional, recebe `filter`/`setFilter`/listas por props (mesmo padrão dos outros componentes html).

## Parte 3 — Hardening de perf a 100k (mesma tarefa)

1. **Culling sem Map** — `updateDistanceCulling` (:1921-1935) faz `donationTransforms.get` por instância a cada 0,25s (+1 get nas que mudam de visibilidade, + gets nos loops de acessórios) → 100k lookups/tick, hitches de vários ms. Preencher `Float32Array` paralelos (posX/posZ por índice de instância) no `rebuildInstances`; loop de culling lê arrays. → ~1ms.
2. **Picking por AABB de quadra** — raycast do `InstancedMesh` é O(n) interno do three (itera 100k instâncias), disparado por mousemove coalescido em RAF (`createCitySceneRuntime.ts:191-208`) → hover trava a 100k. Solução simples (sem DDA/grade hasheada da v1 — complexidade desnecessária): no `rebuildInstances`, montar array de ~1,6k AABBs por quadra (`Box3` com min/max XZ da quadra — `blockSpacing = blockFootprint + streetWidth` já computado em :937 — e altura máx. dos prédios dela) + lista de instâncias por quadra. Raycast: `ray.intersectsBox` nos ~1,6k blocos (µs) → `Ray.intersectBox` só nas instâncias dos blocos atingidos (~dezenas). Prédios default são caixas — AABB é hit exato. Custom shapes (poucos) seguem raycaster normal. → <1ms.

Não-problemas verificados (não mexer): `generateSpiralPositions` indexa quadras, não prédios (:110-129); filtro client-side de 100k = ~5ms; rebuild total único ~0,5s atrás do overlay; `camera.far` é sobrescrito por horizonte (`distance + 2`, runtime :404) — clipping continua valendo.

## Parte 4 — Segurança (NUNCA confiar no front)

- **Endpoint aceita zero input** — sem query, params ou body. Nada vindo do cliente é interpretado → superfície de injeção nula. Se um dia houver param server-side: `parseSchema` + schema `.strict()`/`.max()` em `*.schema.ts` (regra `seguranca.md:97-98`), nunca `req.query.x` cru.
- **Filtro no front não é "confiar no front"**: o dataset inteiro já é público no snapshot; o filtro só decide o que **renderizar**. Não existe decisão de autorização delegada ao cliente. Se algum dado deixar de ser público, ele sai do snapshot — nunca "esconder via filtro".
- **Projeção explícita de colunas** no builder (`id, value, city_id, ong_id`) — se a tabela ganhar dados de doador no futuro, snapshot não vaza nada por acidente. Nunca `SELECT *`.
- **Nenhuma escrita neste escopo.** Doação manual do front é local e efêmera. Endpoint de escrita futuro: JWT + Zod + `withTransaction` + `{noRetry: true}` em INSERT.
- **Proteções herdadas**: rate limit global 300 req/min/IP (aplicado antes das rotas), helmet, `json({limit:"1mb"})`, CORS fail-closed em prod, boot falha se `AUTHORIZATION != 1` em prod, `handleError` nunca vaza erro interno, logs nunca contêm params de query.
- **Proxy Vite = DX de dev, não segurança**: elimina CORS em dev e esconde a origem do back só localmente. Em produção: reverse proxy (nginx) servindo front + `/api` same-origin, ou `VITE_API_URL` + `CORS_ORIGINS` estrito. Registrar na doc para ninguém achar que o proxy "protege" algo.

## Parte 5 — Verificação end-to-end

1. Back: `bunx tsc --noEmit` → `bun run scripts/migrate.ts` → `bun run scripts/seed-donations.ts 100000` → testes:
   - `curl -s --compressed :3010/api/donation/snapshot | head -c 300` → `{v: 2, total: 100000, cities: [...], ongs: [...], data: [[1, 42.5, 3550308, 1], ...]}` (números, não strings).
   - `curl -sI -H 'Accept-Encoding: gzip' ...` → `Content-Encoding: gzip`, `ETag`, `Cache-Control`, **`Vary: Accept-Encoding`**, **`X-Snapshot-Bytes`**; ~0,7MB. Sem `Accept-Encoding` → body raw.
   - `curl -s -o /dev/null -w '%{http_code}' -H 'If-None-Match: <etag>' ...` → `304` (e resposta com `ETag` presente).
   - **UPDATE pega o bug da v1**: `UPDATE donation SET value = value + 1 WHERE id = 1` → em ≤30s etag **muda** e snapshot reflete o valor novo.
   - **Carga**: `for i in $(seq 1 50); do curl -s -o /dev/null ... & done; wait` → zero queries novas nos logs durante a rajada; `GET /api/system/metrics` sem saturação de pool.
2. Front: `npm run lint && npm run build`.
3. Fluxo: back `bun dev` (`AUTHORIZATION=0`, `PORT=3010`) + front `npm run dev` → `localhost:5173`:
   - Overlay com progresso até 100.000 prédios; stats `buildings: 100000`; Network: **1** GET (~0,7MB), sem CORS.
   - **Filtros**: selecionar UF → cidade some das não-UF, contagem cai, rebuild rápido; região → agrega UFs; ONG combinada com UF funciona (AND); limpar filtro → 100k de volta (~0,5s atrás do overlay).
   - Espiral com torres no centro; hover fluido ≥50fps (valida Parte 3); clique + customizar funciona (id backend); doação manual local sem colisão de id.
   - StrictMode: refresh não duplica cidade. Backend parado + refresh → overlay de erro + retry funcional.
4. Regressão: `bun run scripts/migrate.ts status` sem divergência de checksum.

## Parte 6 — Documentação (obrigatório pelos 2 CLAUDE.md)

**Back**: criar `doc/modulos/doacoes/doacoes.md` (tabelas ong/city/donation, contrato snapshot v2, cache/refresher/change-detection, ETag/304/Vary, desvio deliberado `res.end(buffer)`, seed, notas de produção CDN/IBGE); linha `GET /api/donation/snapshot` na tabela de endpoints de `doc/index-doc.md`; comando seed em `doc/guias/comandos.md`.

**Front** (caveman mode): `doc/scene/engine/scene-managers.md` (setDonations, AABB picking, culling arrays), `scene-runtime.md`, `scene-hooks.md`, `doc/components/three-components.md` (handle novo, props removidas), `html-components.md` (DonationLoadOverlay, DonationFilterBar), criar `doc/api/donation-api.md` (http/donationApi/regions/useDonations + gotcha do progress gzip) + registrar tudo em `doc/index.md`.

**Sequência**: Parte 1 → 2 → 3 → 5 → 6 (Parte 4 permeia 1 e 2). Acoplamento back↔front só no contrato do snapshot (schema 1.3).
