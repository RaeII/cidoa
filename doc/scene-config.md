---
title: Scene Config
tags:
  - cidoa
  - config
  - defaults
aliases:
  - Configurações
  - Valores Padrão
---

# Scene Config

Arquivos de configuração em `src/scene/config/`.

> [!tip] Regra prática
> Se você quer mudar comportamento inicial **sem alterar lógica**, comece aqui.
> - "Quero prédios mais escuros por padrão" → `buildingConfig.ts`
> - "Quero câmera mais longe" → `citySceneConfig.ts`
> - "Quero sombras com mapa maior" → `shadowConfig.ts`

## Objetivo da Pasta

Guarda valores padrão e configurações base do projeto. Evita "números soltos" espalhados na aplicação.

## Arquivos

### `buildingConfig.ts`

Valores padrão dos prédios:

| Campo | Descrição |
|---|---|
| `color` | Cor inicial dos prédios |
| `roughness` | Roughness inicial |
| `metalness` | Metalness inicial |
| `targetMaxHeight` | Altura alvo do prédio mais alto (padrão: 15) |

> [!note] targetMaxHeight vs maxHeight
> `targetMaxHeight` é definido pelo usuário via input. O prédio mais alto **nunca** ultrapassa `maxHeight` de `citySceneConfig.ts` (cap visual absoluto da cena).

**Funções exportadas:**
- `DEFAULT_BUILDING_SETTINGS`
- `createDefaultBuildingSettings()` — cria novo objeto sem compartilhar referência

---

### `textureConfig.ts`

Valores padrão das texturas PBR das fachadas:

| Campo | Padrão |
|---|---|
| `enabled` | `true` |
| `normalScale` | — |
| `displacementScale` | — |
| `tilingScale` | — |
| `roughnessIntensity` | — |
| `metalnessIntensity` | — |
| `emissiveIntensity` | `0` |
| `clayRender` | `false` |
| `top.*` | Sub-configurações do topo do prédio |

**Funções exportadas:**
- `DEFAULT_TEXTURE_SETTINGS`
- `createDefaultTextureSettings()`

---

### `groundConfig.ts`

Valores padrão do chão:

- Cor inicial
- Roughness e metalness
- Tipo de material (ver [[scene-types#GroundMaterialType]])

**Funções exportadas:**
- `DEFAULT_GROUND_SETTINGS`
- `createDefaultGroundSettings()`

---

### `lightConfig.ts`

Valores padrão das luzes:

- Ambient (cor, intensidade extra)
- Hemisphere (cor do céu, cor do chão, intensidade)
- Directional (distância, elevação, azimute, alvo)

**Funções exportadas:**
- `DEFAULT_LIGHT_SETTINGS`
- `createDefaultLightSettings()`

---

### `shadowConfig.ts`

Valores padrão de sombra:

| Campo | Descrição |
|---|---|
| `enabled` | Sombra começa ligada? |
| `bias` | Bias do shadow map |
| `normalBias` | Normal bias |
| `radius` | Raio de suavização |
| `blurSamples` | Amostras de blur |
| `mapSize` | Resolução do shadow map |
| `camera*` | Parâmetros da câmera ortográfica de sombra |
| `buildingCountWithShadow` | Quantidade de prédios que geram sombra |

---

### `renderDirectionConfig.ts`

Valores padrão dos limites de carregamento de chunks por direção da câmera:

- `forwardDistance`
- `sideDistance`
- `backwardDistance`

> [!note]
> Consumido pelo [[scene-managers|ChunkManager]] (mantido para referência arquitetural).

---

### `blockLayoutConfig.ts`

Valores padrão do layout de quadras:

| Campo | Padrão | Descrição |
|---|---|---|
| `blockSize` | `3` | Prédios por lado (3×3 = 9 slots por quadra) |
| `streetWidth` | `6.0` | Largura das ruas entre quadras em unidades world |
| `towerRatio` | `0.12` | Fração de doações que são torres (12%) |
| `baseHeightCap` | `0.30` | Teto de altura da base urbana (30% de maxSceneHeight) |

**Funções exportadas:**
- `createDefaultBlockLayoutSettings()`

> [!note]
> Esses valores são editáveis em tempo real via inputs no overlay. Ver [[html-components#BuildingHeightInput.tsx]].

---

### `environmentConfig.ts`

Valores padrão do ambiente HDRI:

- `offsetX` — rotação horizontal do skybox
- `offsetY` — deslocamento vertical do horizonte
- `offsetZ` — roll diagonal

---

### `citySceneConfig.ts` ⭐

Configuração mais global da cena. Define a estrutura completa de `CitySceneConfig`.

| Campo | Descrição |
|---|---|
| `chunkSize` | Tamanho de um chunk em unidades world |
| `chunkRadius` | Raio de chunks ao redor da câmera |
| `blockSize` | Tamanho dos blocos de prédios |
| `roadWidth` | Largura das ruas |
| `minHeight` | Altura mínima dos prédios |
| `maxHeight` | Cap visual absoluto (teto de altura; prédios nunca ultrapassam) |
| `maxBuildingsPerChunk` | Limite de prédios por chunk |
| `dprCap` | Limite máximo de device pixel ratio |
| `targetFps` | FPS alvo para resolução dinâmica |
| `minRenderScale` | Escala mínima de render |
| `maxRenderScale` | Escala máxima de render |
| `far` | Far plane da câmera |
| `shadowBuildingCap` | Limite global de prédios com sombra |
| `maxSolarIntensity` | Intensidade solar máxima |
| `sceneBackground` | Cor de fundo da cena (hex) |
| `sceneFogColor` | Cor do fog |
| `sceneFogDensity` | Densidade do FogExp2 |
| `groundSize` | Tamanho do plano do chão |
| `gridDivisions` | Divisões do GridHelper |
| `cameraFov` | Campo de visão da câmera |
| `cameraNear` | Near plane |
| `initialCameraPosition` | Posição inicial `{x, y, z}` |
| `controlTarget` | Target inicial do OrbitControls |
| `controls.*` | Damping, velocidades, limites de zoom/pan/rotate |
| `cubeUpdateIntervalMoving` | Intervalo de update do CubeCamera em movimento |
| `cubeUpdateIntervalStatic` | Intervalo de update do CubeCamera parado |
| `envMapNearDistance` | Raio para usar envMap dinâmico vs HDRI estático |

**Constantes exportadas:**
- `CITY_SCENE_CONFIG` — objeto de configuração global
- `DEFAULT_SCENE_STATS` — estado inicial das métricas

## Diferença entre Configs por Domínio e Config Global

Use os arquivos menores quando a configuração pertencer a um domínio específico:
- `buildingConfig`, `groundConfig`, `lightConfig`, `shadowConfig`, `textureConfig`, `environmentConfig`, `renderDirectionConfig`

Use `citySceneConfig.ts` quando for estrutural da cena inteira (tamanhos, câmera, FPS, fog).

## Tipos Relacionados

- [[scene-types#CitySceneConfig]] — interface TypeScript da config global
- [[scene-types#BuildingSettings]], [[scene-types#TextureSettings]] etc. — contratos dos domínios
