---
title: Texturas de Fachada (manifesto + loader + KTX2)
tags:
  - scene
  - engine
  - textures
aliases:
  - scene-textures
  - facade-textures
  - ktx2
---

# Texturas de Fachada — manifesto + loader + KTX2

Pasta `src/scene/textures/`. Textura de fachada vem do **catálogo do backend** (só o endereço/pasta), assets ficam no front (`src/assets/texture/`). Loading é **lazy + assíncrono + cache**. Formato é o **PNG/JPG fonte**; o `.ktx2` (Basis, comprimido na GPU) é fallback pra pasta sem fonte. Foco: desempenho de carregamento sem perder qualidade de imagem.

> [!info] Plano A
> Backend guarda só o `value` (nome da pasta). Bytes ficam no front, hasheados pelo Vite = cache imutável de graça no host (Cloudflare Pages/Vercel). Zero infra, zero custo. Ver [[customization-api]] e [[personalizacoes]].

## Números

| | Eager PNG/JPG | Lazy PNG/JPG (atual) | Se tudo virasse KTX2 |
|---|---|---|
| Download das texturas | 4946 KB | **só o que a cena usa** | 1140 KB (−77%) |
| VRAM (RGBA8 vs bloco comprimido) | ~48 MB | ~48 MB | ~12 MB |
| Transcoder basis (1× por cliente, cacheado) | — | só se houver `.ktx2` | 636 KB |
| Carga | eager (import estático do topo) | **lazy**, só o que a cena usa | lazy |

## `facadeTextureManifest.ts` (sem THREE)

Descobre as pastas de textura via `import.meta.glob` — **sem import de THREE**, então a página admin consome sem puxar three pro bundle.

- Glob casa **só sufixos usados**: `*_{Color,NormalGL,Roughness,Metalness,Displacement}.{png,jpg,jpeg,ktx2}`. Assim Vite não emite pro dist o que ninguém carrega (`_NormalDX`, preview `.png`). Usa NormalGL (OpenGL), não DX.
- `eager` + `?url` = só as **URLs** (strings hasheadas), não os bytes. Bytes só baixam quando o loader busca a URL.
- **PNG/JPG ganha do `.ktx2` do mesmo mapa.** Basis é lossy e o artefato aparece no normal map (reflexo cintilante na fachada). O `.ktx2` só é usado onde não existe fonte PNG/JPG — rodar o encoder nunca quebra o build, mas também não muda o que a cena carrega enquanto a fonte estiver no repo.
- Parse agrupa por pasta; pasta sem `_Color` é descartada.

Exporta:

| Símbolo | O que é |
|---|---|
| `FACADE_TEXTURE_FOLDERS` | Pastas no repo (fonte da verdade do que existe). `{ folder, label }`. |
| `resolveFacadeFolder(value)` | Normaliza `value` do catálogo (`"texture/Foo"` ou `"Foo"`) → nome da pasta. |
| `getFacadeMapUrls(value)` | URLs dos mapas da pasta, ou `null` se não existe / sem color map. |

## `facadeTextureLoader.ts` (THREE + KTX2 + cache)

```ts
initFacadeTextureLoader(renderer): void
peekFacadeTextureSet(value): FacadeTextureSet | null
loadFacadeTextureSet(value, anisotropy): Promise<FacadeTextureSet | null>
```

- **`initFacadeTextureLoader(renderer)`** — chamado 1× pelo manager. Monta o `KTX2Loader` com `setTranscoderPath(BASE_URL + "basis/")` e `detectSupport(renderer)` (a GPU decide BC7 / ASTC / ETC2). Idempotente.
- **Assíncrono**: `KTX2Loader.load()` não devolve textura na hora (transcode roda em worker). Então o set inteiro é `Promise`. Material sobe sem mapas e recebe os mapas quando chegam — a cena aparece antes das texturas em vez de travar.
- **`peekFacadeTextureSet`** — set já no cache, sem tocar a rede. Evita 1 frame cinza quando o manager é recriado ou quando o usuário volta pra uma textura já vista.
- **Cache por pasta, vida do app**: cada textura carrega 1×, compartilhada entre todos os prédios/materiais. Chamadas concorrentes compartilham a mesma Promise. Trocar textura e voltar reusa — **zero re-download, zero re-upload GPU**.
- Resolve `null` se a pasta sumiu (catálogo aponta pra asset removido) ou se o color map falhou → chamador cai no fallback. Mapas secundários que falham viram `null` no set (não derrubam a textura inteira).

```ts
type FacadeTextureSet = {
  color: THREE.Texture;
  normal: THREE.Texture | null;
  roughness: THREE.Texture | null;
  metalness: THREE.Texture | null;
  displacement: THREE.Texture | null;
};
```

> [!note] ponytail
> Cache global sem LRU/eviction — curated set pequeno. Adicionar eviction só se o número de texturas crescer muito.

## Pipeline KTX2

```bash
npm run textures:ktx2            # só o que mudou
npm run textures:ktx2 -- --force # tudo de novo
```

`scripts/encode-ktx2.mjs`. Encoder é `ktx2-encoder` (WASM do basis_universal) — **sem binário externo**, sem `brew install ktx`. Decoders `pngjs` / `jpeg-js`. Escreve `<mapa>.ktx2` ao lado da fonte, incremental por mtime.

Codec por tipo de mapa:

| Mapa | Codec | Por quê |
|---|---|---|
| `Color` | ETC1S + sRGB | menor download **e** menor VRAM |
| `NormalGL` | UASTC + zstd | bloco ETC1S vira faceta visível; a cena roda `normalScale` alto, que amplifica artefato de normal |
| `Roughness` / `Metalness` / `Displacement` | ETC1S linear | dado, não cor |

Ajustes disponíveis no script:

- `CODEC` — tabela por sufixo. Trocar `uastc: true` → `false` no normal se o download pesar mais que a qualidade vale.
- `ETC1S_ONLY_FOLDERS` — pastas que nunca usam UASTC. `Concrete024_1K-JPG` (topo dos prédios) está nela: visto de cima e de longe, o normal em UASTC dava 1.3 MB — a maior textura do pacote — contra 261 KB em ETC1S.

Detalhes que o pipeline garante:

- **`isYFlip: true`** — `CompressedTexture` do three tem `flipY = false`, `TextureLoader` (PNG/JPG) tem `flipY = true`. Gravar já invertido faz as duas rotas renderizarem igual: trocar de formato não muda a imagem.
- **Verificação por arquivo** — relê o container com `ktx-parse` e falha o script se a cadeia de mipmaps estiver incompleta (minFilter amostraria errado, fachada cintilaria ao longe) ou se a transfer function sRGB não bater com o tipo do mapa.

O transcoder mora em `public/basis/` (`basis_transcoder.js` + `.wasm`, cópia de `three/examples/jsm/libs/basis/`). Baixado 1× por cliente, só quando um `.ktx2` é pedido.

> [!warning] Plugin `drop-ktx2-superseded-by-textures` (vite.config.ts)
> O glob casa fonte **e** `.ktx2`, então o Rollup emitiria as duas pro dist — a perdedora como peso morto (nunca baixada). O plugin remove do bundle todo `.ktx2` que tem PNG/JPG do mesmo nome, e **loga** o que removeu. A condição **tem que espelhar a do manifesto**: invertida, ela apaga justamente o arquivo que o runtime pede → 404 só em produção. Mexeu na prioridade do manifesto, mexa aqui junto.

## Fiação na cena

### Global (cena inteira)

- [[scene-types#TextureSettings|TextureSettings.textureKey]] = `value` do catálogo da textura ativa. Default = `"texture/Facade006_1K-mirrored-PNG"` (= seed).
- [[scene-managers|createDonationManager]]: `peek` no construtor (cache quente = nasce texturizado), senão pede assíncrono. Em `updateTextureSettings`, pasta diferente → `requestGlobalFacadeSet` recarrega, reatribui `facadeSet` e reaplica em todos os materiais de fachada. Um **token** descarta a resolução de uma seleção já superada (clique rápido no seletor).
- Topo (concreto `Concrete024`) **não** entra no catálogo, mas passa pelo mesmo loader — ganha lazy e cache compartilhado de graça. Antes eram 4 imports estáticos (~4 MB baixados sempre).
- Mapas sem contribuição não entram no programa do material: normal/roughness/emissive/displacement são `null` quando sua intensidade/escala é zero. `material.needsUpdate` só é acionado quando a presença de um mapa muda; arrastar intensidade/tiling atualiza uniforms sem recompilar o shader.
- **Nada é descartado no `dispose`**: fachada e topo vêm do cache compartilhado, reusado entre recriações do manager.
- Seletor global: [[html-components#TextureControls.tsx|TextureControls]] lista `catalog.textures` ativas; clicar seta `textureKey`.

### Por edifício

[[scene-types#BuildingCustomization|BuildingCustomization.textureKey]] (`string | null`, `null` = herda a global).

Textura por edifício **não** custa mesh dedicado: cada textura em uso tem o próprio `InstancedMesh` (**grupo de fachada**, ver [[scene-managers#Grupos de fachada]]). Draw calls = nº de texturas, não de prédios.

- Grupo 0 = textura global da cena (`facadeMaterial`). Prédio sem textura própria e sem sorteio fica nele.
- Demais grupos = pool do catálogo (`setFacadeTexturePool`), um material clonado por pasta.
- Textura própria com grupo → o prédio só muda de `InstancedMesh`. Só cai em `customShapeMeshes` a pasta **sem** grupo (fora do pool) — `hasUngroupedFacadeTexture`.
- O set do clone vive num `WeakMap<Material, FacadeTextureSet>` — **não** em `userData`, porque `Material.copy` serializa `userData` com JSON e estouraria com `THREE.Texture` dentro.
- `applyFacadeFolder` (usado por `applyBuildingFacadeTexture` e pelos grupos) é **idempotente**: compara com a pasta já aplicada e sai cedo, então `syncCustomShapes` pode chamar em todo rebuild sem custo. Também guarda contra corrida: se a seleção mudar enquanto baixa, o resultado velho é descartado.
- Trocar a textura **global** refaz os grupos (a pasta global é sempre o grupo 0) + `rebuildInstances()`.
- UI: [[html-components#BuildingCustomizePanel.tsx|BuildingCustomizePanel]], seção **Textura** (opção "Padrão" = `null`).

### Sorteio por edifício

`TextureSettings.randomPerBuilding` (padrão **ligado**, aba **texturas**): prédio **sem** textura escolhida sorteia uma entre **todas as texturas ativas do catálogo**, em vez da cidade inteira usar `textureKey`. Serve pra ver a cidade de teste com variedade real ([[edificios-teste]]).

- Pool = `value` das texturas do catálogo, plumbado do editor até o manager: `facadeTexturePool` → [[three-components|CitySceneCanvas]] → [[scene-hooks|useCityScene]] → `runtime.setFacadeTexturePool` → `donationManager.setFacadeTexturePool`. Toggle desligado = lista vazia = textura global em tudo.
- Sorteio é **determinístico pelo id da doação** (`pickIndex`, ver [[scene-utils#random.ts]]): o mesmo prédio cai sempre na mesma textura — reload, troca de filtro e recriação do runtime não embaralham a cidade.
- Pasta cadastrada no catálogo mas ausente de `src/assets/texture/` é ignorada (o prédio fica na textura global, nunca sem textura).
- Customização do usuário **ganha** do sorteio.

## Admin: cadastradas × não-cadastradas

[[personalizacoes]] compara `FACADE_TEXTURE_FOLDERS` (repo) com as opções do catálogo:

- **Cadastradas** = viram opção do catálogo → usuário seleciona.
- **Não-cadastradas** = pasta no repo sem opção → botão **Cadastrar** cria a opção (`value` = pasta, key = slug). Depois de cadastrada, admin controla (toggle/editar/excluir).

Textura nova no repo = dropar a pasta em `src/assets/texture/`, rodar `npm run textures:ktx2` → aparece como não-cadastrada, sem editar código.
