---
title: Scene Utils
tags:
  - cidoa
  - utils
  - funções puras
aliases:
  - Utilitários
  - Utils
---

# Scene Utils

Funções puras e reutilizáveis em `src/scene/utils/`.

> [!abstract] Filosofia
> Um utilitário recebe dados, calcula algo e devolve um resultado. Sem criar UI, sem controlar ciclo de vida da cena.

## Como Saber se Algo Vai para Utils

> [!tip] Regra de ouro
> Se a função pode ser entendida **sem saber onde ela será renderizada**, provavelmente pertence a `utils`.

**Bons exemplos para utils:**
- Fórmula de intensidade solar
- Cálculo do raio de busca
- Mapeamento de tipo de material para valores

**Ruins para utils (pertencem a outras pastas):**
- Montar um `Mesh` → [[scene-builders]]
- Ligar eventos de resize → [[scene-runtime]]
- Controlar cleanup do renderer → [[scene-runtime]]

## Arquivos

### `math.ts`

Funções matemáticas genéricas:

| Função | Descrição |
|---|---|
| `clamp(value, min, max)` | Limita um valor entre mínimo e máximo |
| `getSearchRadius(...)` | Calcula raio de busca de chunks |

Use quando a lógica for matemática e genérica.

---

### `materials.ts`

Mapeamento de material do chão:

| Função | Descrição |
|---|---|
| `getGroundMaterialValues(type)` | Transforma `GroundMaterialType` em valores reais de `roughness` e `metalness` |

**Exemplos:**
- `"matte"` → roughness alto, metalness baixo (fosco)
- `"polished"` → roughness baixo (polido)

Relacionado a: [[scene-types#GroundMaterialType]]

---

### `lighting.ts`

Funções de cálculo de iluminação:

| Função | Descrição |
|---|---|
| `getDirectionalPositionFromAngles(distance, elevation, azimuth)` | Converte ângulos esféricos em posição 3D da luz direcional |
| `getSolarIntensityFromElevation(elevation)` | Calcula intensidade solar baseada na elevação |
| `getDynamicAmbientIntensity(elevation)` | Calcula intensidade ambiente dinâmica |
| `getLightMetrics(settings)` | Deriva métricas de luz a partir de `LightSettings` |

> [!tip]
> Se quiser alterar fórmulas de luz, este é o arquivo certo.

---

### `random.ts`

Utilitários de geração procedural:

| Função | Descrição |
|---|---|
| `fract(x)` | Parte fracionária de um número |
| `seeded(seed)` | Gerador de números pseudoaleatórios por seed |

O [[scene-managers|ChunkManager]] usa essas funções para definir, de forma **determinística por chunk**:
- densidade dos prédios
- altura
- forma
- offsets de posição

> [!note] Por que seeded?
> Com seeds baseadas na posição do chunk, a cidade sempre gera os mesmos prédios nas mesmas posições, mesmo após rebuild.

---

### `devAssertions.ts`

Verificações de desenvolvimento com `console.assert`:

| Função | Descrição |
|---|---|
| `runDevAssertionsOnce()` | Roda uma única vez na criação do runtime |

Ajuda a detectar regressões em utilitários básicos durante o desenvolvimento.
Chamado pelo [[scene-runtime|createCitySceneRuntime]] na inicialização.
