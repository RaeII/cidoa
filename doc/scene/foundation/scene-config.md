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

### `terrainConfig.ts`

Valores padrão e constantes estruturais do relevo procedural (ver [[scene-types#TerrainSettings]]). Construído em [[scene-builders#createTerrain.ts]].

**Defaults (`createDefaultTerrainSettings()`):**

| Campo | Padrão | Descrição |
|---|---|---|
| `enabled` | `true` | Relevo começa ligado? |
| `seed` | `4690` | Semente do ruído procedural |
| `segments` | `64` | Resolução da malha (subdivisões por lado) |
| `size` | `700` | Largura do plano em unidades world |
| `height` | `35` | Amplitude do relevo |
| `frequency` | `2` | Escala do ruído base |
| `octaves` | `6` | Camadas de detalhe do fbm |
| `persistence` | `0.5` | Queda de amplitude por oitava |
| `lacunarity` | `2.2` | Ganho de frequência por oitava |
| `ridge` | `1.0` | Peso das cristas (ridge noise) |
| `faults` | `4` | Quantidade de falhas tectônicas |
| `faultStrength` | `4` | Força de cada falha |
| `smooth` | `4` | Iterações de suavização do heightfield |
| `terrace` | `0` | Patamares (0 = desligado) |
| `edge` | `0.3` | Rebaixamento da borda externa (0–1) |
| `wireframe` | `false` | Malha em arame |
| `lowColor` | `"#364e2c"` | Cor dos vales (gradiente baixo) |
| `highColor` | `"#1d2b03"` | Cor dos picos (gradiente alto) |

> [!note] `size`/`segments` viraram settings
> Antes constantes fixas (`TERRAIN_SIZE`/`TERRAIN_SEGMENTS`, **removidas**). Agora vivem em [[scene-types#TerrainSettings]] e são editáveis em tempo real. Trocar `segments` realoca buffers + índice da malha em [[scene-builders#createTerrain.ts]].

**Constantes estruturais:**

| Constante | Valor | Descrição |
|---|---|---|
| `TERRAIN_SEGMENT_OPTIONS` | `[16, 24, 32, 48, 64, 96, 128, 192, 256]` | Opções do select de resolução (`segments`) |
| `TERRAIN_CITY_PADDING` | `30` | Folga plana entre a borda do loteamento e o início do verde. Largo o bastante pra ultrapassar ~1 célula da malha (`size/segments`), senão a interpolação grosseira do relevo sangra verde sobre as quadras de borda |
| `TERRAIN_TRANSITION` | `60` | Largura MÍNIMA do degradê cidade→colinas (cresce com a altura: `max(este, height*3)`) |
| `TERRAIN_GROUND_Y` | `-0.04` | Nível plano do **chão único**, abaixo das ruas (−0.015) com folga. O plano cinza fica escondido no render normal (ver runtime), então não há z-fighting entre os dois |

**Funções exportadas:**
- `DEFAULT_TERRAIN_SETTINGS`
- `createDefaultTerrainSettings()`

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
| `lotColor` | `#5b5048` | Cor dos lotes vazios das quadras (editável na aba **geral** do painel) |
| `sidewalkColor` | `#9a9da3` | Cor do topo da calçada/meio-fio (editável na aba **geral** → seção Calçada) |
| `sidewalkSideColor` | `#55575c` | Cor das laterais da calçada (mais escura, efeito de sombra; aba **geral** → seção Calçada) |
| `sidewalkHeight` | `0.12` | Altura do topo da calçada (degrau acima do chão), editável na aba **geral** → seção Calçada |

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

### `uiVisibilityConfig.ts`

Controla visibilidade dos componentes HTML sobrepostos na tela. Persiste preferência em `localStorage` (chave `cidoa:ui-visibility`).

| Campo | Padrão | Esconde |
|---|---|---|
| `cameraLog` | `true` | Log de posição da câmera (canto inferior esquerdo) |
| `donationInput` | `true` | Input de doação individual |
| `bulkInput` | `true` | Input de geração em lote (mín/máx/qtd) |
| `blockLayoutInput` | `true` | Input de configuração de quadras |

**Funções exportadas:**
- `createDefaultUIVisibilitySettings()` — tudo visível
- `loadUIVisibilitySettings()` — lê `localStorage`, mescla com defaults (campo ausente/inválido cai no default); seguro contra JSON corrompido e `localStorage` bloqueado
- `saveUIVisibilitySettings(settings)` — grava no `localStorage`, falha silenciosa se bloqueado
- `clearUIVisibilitySettings()` — remove a chave (usado pelo botão "Limpar dados salvos")

> [!note]
> Editável em tempo real pela aba **tela** do painel. Ver [[html-components#CityControlPanel.tsx]]. Tipo em [[scene-types#UIVisibilitySettings]].

---

### `scenePersistence.ts`

Persiste a cena inteira em `localStorage` (chave `cidoa:scene`): edifícios criados, personalizações por edifício e todos os settings do painel. Escrita disparada por efeito em [[html-components#CitySceneEditor.tsx]] a cada mudança de estado.

**Formato salvo (`PersistedScene`):**

| Campo | Conteúdo |
|---|---|
| `donations` | `number[]` — valores na ordem de criação |
| `customizations` | `Array<BuildingCustomization \| null>` — **alinhado por índice** com `donations`; `null` = sem personalização |
| `infos` | `Array<DonationInfo \| null>` — **alinhado por índice** com `donations`; dados do [[html-components#`DonationFormModal.tsx`|formulário de doação]] (título, descrição, link, foto, ONG); `null` = prédio sem formulário |
| `settings` | `PersistedSceneSettings` — building, texture, ground, terrain, light, shadow, renderDirection, environment, horizon, blockLayout |

> [!important]
> `customizations` e `infos` casam por **índice**, não por id de runtime: o donation manager renumera ids do zero a cada carga, então índice é a única chave estável entre sessões.

**O que é salvo:** todo edifício criado na sessão — input de doação e formulário de doação (com a `info` dele). Nada de edifício "só de sessão".

**Funções exportadas (cena ativa):**
- `createDefaultPersistedSettings()` — junta todos os `createDefault*Settings()`
- `loadPersistedScene()` — `null` se nada salvo ou JSON corrompido; senão mescla settings recursivamente sobre os defaults (campo novo entra com default, campo removido é descartado) e filtra doações inválidas
- `savePersistedScene(scene)` — grava; se estourar cota, tenta sem `hologramImage` (`withoutHolograms`) e depois sem as fotos das doações (`withoutImages`) antes de desistir — data URLs de imagem sozinhas passam do limite
- `clearPersistedScene()` — remove a chave

> [!note]
> Botão "Limpar dados salvos" na aba **tela** do painel apaga esta chave + `cidoa:ui-visibility` e recarrega a página. Estados nomeados ficam. Ver [[html-components#CityControlPanel.tsx]].

#### Estados nomeados (chave `cidoa:scene-slots`)

Saves da cidade escolhidos pelo usuário. Chave separada da cena ativa, formato `Record<nome, PersistedScene>` — mesmo formato acima, então salvar é só copiar `currentScene`.

| Função | O que faz |
|---|---|
| `listSceneSlots()` | Nomes ordenados (`localeCompare` pt-BR) |
| `saveSceneSlot(name, scene)` | Grava/sobrescreve + marca `name` como ativo. Mesma escada de fallback do autosave (sem hologramas → sem fotos); `false` = cota estourada mesmo assim |
| `deleteSceneSlot(name)` | Remove o nome do record; limpa o ativo se era ele |
| `applySceneSlot(name)` | Copia o estado para `cidoa:scene` + marca ativo. `false` = nome inexistente |
| `getActiveSceneSlot()` | Nome do estado que a cena ativa veio de; `null` = cena não salva em nenhum |

Chave `cidoa:scene-active` guarda só esse rótulo (nome do estado ativo) — alimenta o select de troca rápida e o auto-save antes de trocar. `clearPersistedScene()` apaga junto.

> [!important] Abrir estado = reload
> `applySceneSlot` só troca o conteúdo do storage; quem chama recarrega a página, e o runtime nasce do estado novo no mount. Mesmo caminho do "Limpar dados salvos" — reconstruir o runtime em memória custaria bem mais código. UI em [[html-components#CityControlPanel.tsx]].

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
| `dprCap` | Limite máximo de device pixel ratio (2 = qualidade nativa em retina) |
| `far` | Far plane da câmera |
| `shadowBuildingCap` | Limite global de prédios com sombra |
| `maxSolarIntensity` | Intensidade solar máxima |
| `sceneBackground` | Cor de fundo da cena (hex) |
| `sceneFogColor` | Cor do fog |
| `sceneFogDensity` | Densidade do FogExp2 |
| `groundSize` | Tamanho do plano do chão |
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
