---
title: Scene Types
tags:
  - cidoa
  - typescript
  - tipos
  - contratos
aliases:
  - Tipos
  - Interfaces
  - Contratos
---

# Scene Types

Contratos TypeScript centralizados em `src/scene/types.ts`.

> [!abstract] Objetivo
> Centralizar os tipos usados entre as camadas. Evita duplicação e garante que o TypeScript proteja a comunicação entre React, hook, runtime, builders, managers e configs.

## Tipos de Configuração (Settings)

### `BlockLayoutSettings`

Configurações de layout das quadras de prédios:

```typescript
type BlockLayoutSettings = {
  blockSize: number;    // prédios por lado da quadra (ex: 3 → 3×3 = 9 slots)
  streetWidth: number;  // espaço entre quadras em unidades world (ex: 6.0)
  towerRatio: number;   // fração de doações tratadas como torres (0–1, padrão: 0.12)
  baseHeightCap: number;// teto de altura da base urbana como fração de maxSceneHeight (0–1, padrão: 0.30)
  lotColor: string;     // cor dos lotes vazios das quadras (loteamento esperando edifício)
  sidewalkColor: string; // cor do topo da calçada (meio-fio em volta das quadras)
  sidewalkSideColor: string; // cor das laterais da calçada (mais escura = efeito de sombra/altura)
  sidewalkHeight: number;// altura do topo da calçada (degrau acima do chão), em unidades world
}
```

O sistema de 2 camadas separa as doações em **torres** (top N%) que usam o range completo de altura e **base urbana** (restante) com teto reduzido. Isso cria contraste abrupto entre vizinhos — o efeito visual de uma cidade real.

Editável em tempo real via inputs no overlay superior. `lotColor` (seção **Quadras**), `sidewalkColor`, `sidewalkSideColor` e `sidewalkHeight` (seção **Calçada**) são editáveis pela aba **geral** do [[html-components#CityControlPanel.tsx|CityControlPanel]]. Padrões em `blockLayoutConfig.ts`.

---

### `BuildingSettings`

Configurações visuais dos prédios:

```typescript
type BuildingSettings = {
  color: string;
  roughness: number;
  metalness: number;
  targetMaxHeight: number; // altura alvo do prédio mais alto
}
```

---

### `TextureSettings`

Configurações PBR das texturas de fachada:

```typescript
type TextureSettings = {
  enabled: boolean;
  normalScale: number;
  displacementScale: number;  // relevo visual via displacement map
  tilingScale: number;        // UV repeat
  roughnessIntensity: number;
  metalnessIntensity: number;
  envMapIntensity: number;    // intensidade dos reflexos
  emissiveIntensity: number;  // brilho/glow usando colorMap como emissiveMap
  clayRender: boolean;        // espelhamento nas superfícies
  top: TopTextureSettings;    // configurações específicas do topo
}
```

---

### `TopTextureSettings`

Sub-configurações de textura para o topo dos prédios:

```typescript
type TopTextureSettings = {
  normalScale: number;
  displacementScale: number;
  tilingScale: number;
  roughnessIntensity: number;
  metalnessIntensity: number;
  envMapIntensity: number;
}
```

---

### `GroundSettings`

Configurações do chão:

```typescript
type GroundSettings = {
  color: string;
  roughness: number;
  metalness: number;
  materialType: GroundMaterialType;
}
```

---

### `GroundMaterialType`

Tipos possíveis de material do chão:

```typescript
type GroundMaterialType = "standard" | "matte" | "soft-metal" | "polished"
```

| Tipo | Comportamento |
|---|---|
| `standard` | Material padrão |
| `matte` | Chão fosco (roughness alto) |
| `soft-metal` | Metal suave |
| `polished` | Chão polido (roughness baixo) |

---

### `TerrainSettings`

Relevo procedural ao redor da cidade (partes sem edifício). Estrutura = ruído fbm + cristas + falhas + terraços; cor = gradiente low→high por altura. Mesmos controles do protótipo `terrain.md`.

```typescript
type TerrainSettings = {
  enabled: boolean;
  seed: number;          // semente do ruído procedural
  segments: number;      // resolução da malha (subdivisões por lado)
  size: number;          // largura do plano em unidades world
  height: number;        // amplitude do relevo
  frequency: number;     // escala do ruído base
  octaves: number;       // camadas de detalhe do fbm
  persistence: number;   // queda de amplitude por oitava
  lacunarity: number;    // ganho de frequência por oitava
  ridge: number;         // peso das cristas (ridge noise)
  faults: number;        // quantidade de falhas tectônicas
  faultStrength: number; // força de cada falha
  smooth: number;        // iterações de suavização do heightfield
  terrace: number;       // patamares (0 = desligado)
  edge: number;          // rebaixamento da borda externa (0–1)
  wireframe: boolean;    // malha em arame
  lowColor: string;      // cor dos vales (gradiente baixo)
  highColor: string;     // cor dos picos (gradiente alto)
}
```

Estrutura via **fbm** (`persistence`/`lacunarity`), **ridge noise**, **falhas tectônicas** (`faults`/`faultStrength`), **terraços** e **suavização** (`smooth`); borda externa rebaixada por `edge`; cor por **gradiente** `lowColor`→`highColor` interpolado pela altura. `segments`/`size` controlam resolução e largura da malha (antes eram constantes fixas). Construído em [[scene-builders#createTerrain.ts]], defaults em [[scene-config#terrainConfig.ts]]. Editável pela aba **terreno** do painel.

---

### `LightSettings`

Configurações das luzes da cena:

```typescript
type LightSettings = {
  ambientColor: string;
  ambientExtraIntensity: number;
  hemisphereSkyColor: string;
  hemisphereGroundColor: string;
  hemisphereIntensity: number;
  directionalColor: string;
  directionalDistance: number;
  directionalElevation: number;  // ângulo esférico
  directionalAzimuth: number;    // ângulo esférico
  directionalTargetX: number;
  directionalTargetY: number;
  directionalTargetZ: number;
}
```

---

### `ShadowSettings`

Configurações de sombra:

```typescript
type ShadowSettings = {
  enabled: boolean;
  intensity: number;
  bias: number;
  normalBias: number;
  radius: number;
  blurSamples: number;
  mapSize: number;
  cameraNear: number;
  cameraFar: number;
  cameraLeft: number;
  cameraRight: number;
  cameraTop: number;
  cameraBottom: number;
  buildingCountWithShadow: number;
}
```

---

### `HorizonSettings`

Configurações da silhueta do horizonte e da névoa da cena:

```typescript
type HorizonSettings = {
  color: string;       // cor dos prédios da silhueta
  distance: number;    // distância da câmera até a fileira (padrão: 248)
  fogDensity: number;  // densidade da névoa exponencial (FogExp2, padrão: 0.01)
  fogColor: string;    // cor da névoa (padrão: "#090c11")
}
```

> [!note] Névoa global
> `fogDensity` e `fogColor` controlam o `THREE.FogExp2` da cena inteira. Como os prédios do horizonte têm `fog: true`, a névoa os dissolve progressivamente — quanto maior a densidade, mais apagada fica a silhueta.

---

### `RenderDirectionSettings`

Limites de carregamento de chunks por direção da câmera:

```typescript
type RenderDirectionSettings = {
  forwardDistance: number;
  sideDistance: number;
  backwardDistance: number;
}
```

---

### `EnvironmentSettings`

Configurações do ambiente HDRI/skybox:

```typescript
type EnvironmentSettings = {
  offsetX: number;  // rotação horizontal do skybox
  offsetY: number;  // deslocamento vertical (UV offset do horizonte)
  offsetZ: number;  // roll diagonal
}
```

### `UIVisibilitySettings`

Liga/desliga componentes HTML sobrepostos na tela. Persistido em `localStorage`. Defaults e helpers de load/save em [[scene-config#uiVisibilityConfig.ts]]. Controlado pela aba **tela** do painel.

```typescript
type UIVisibilitySettings = {
  cameraLog: boolean;        // log de posição da câmera (canto inferior esquerdo)
  donationInput: boolean;    // input de doação individual
  bulkInput: boolean;        // input de geração em lote (mín/máx/qtd)
  blockLayoutInput: boolean; // input de configuração de quadras
}
```

## Tipos de Métricas

### `SceneStats`

Métricas enviadas de volta para o React para exibição no painel:

```typescript
type SceneStats = {
  buildings: number;         // prédios ativos na cena
  fpsMode: string;           // modo FPS atual
  chunks: number;            // chunks carregados
  buildingsWithShadow: number;
}
```

## Tipos de Personalização

### `RooftopType`

Tipos de estrutura que podem ser colocados no topo de um edifício:

```typescript
type RooftopType =
  | "none"           // sem estrutura
  | "spotlights"     // 4 holofotes com feixe de luz para cima
  | "helipad"        // heliponto realista com pintura e luzes de perímetro
  | "garden"         // jardim suspenso com deck, vegetação e piscina
  | "helicopter"     // helicóptero leve low-poly realista pousado no topo
```

### `EdgeLightType`

Estilos de iluminação aplicáveis às arestas do edifício:

```typescript
type EdgeLightType =
  | "none"           // sem LED
  | "led"            // 4 arestas verticais (cantos) + 4 arestas no topo formando retângulo
```

### `BuildingShape`

Formato volumétrico do edifício:

```typescript
type BuildingShape =
  | "default"        // caixa padrão renderizada via InstancedMesh
  | "twisted"        // torre torcida (estilo Cayan Tower) — 90° de twist do chão ao topo
  | "octagonal"      // torre com planta octogonal regular
  | "setback"        // torre em patamares recuados
  | "tapered"        // torre afunilada
  | "chrysler"       // torre art déco inspirada no Chrysler Building
  | "hearst"         // torre facetada com diagrid inspirada na Hearst Tower
  | "empire"         // torre art déco inspirada no Empire State Building
  | "taipei"         // torre em módulos empilhados inspirada no Taipei 101
  | "one-trade"      // torre facetada com base chanfrada e pináculo One Trade
```

Quando `buildingShape !== "default"`, a doação é desenhada como um `Mesh` próprio (ver [[scene-builders]]) e pula a alocação no `InstancedMesh`. O manager mantém clones de material (facade + top) por edifício customizado.

### `BuildingCustomization`

Personalização visual de um edifício individual:

```typescript
type BuildingCustomization = {
  color: string;              // cor hex do edifício
  buildingShape: BuildingShape; // formato volumétrico
  tilingScale: number;        // multiplicador de tiling da textura (1.0 = global, 2.0 = texturas 2× menores, etc)
  textureTransform: {
    scaleX: number;           // escala horizontal da textura no edifício
    scaleY: number;           // escala vertical da textura no edifício
    offsetX: number;          // deslocamento horizontal da textura
    offsetY: number;          // deslocamento vertical da textura
  };
  rooftopType: RooftopType;   // acessório de topo ou none
  signText: string;           // texto do letreiro na fachada (vazio = sem letreiro)
  signSides: number;          // quantos lados exibem o letreiro (1–4)
  edgeLightType: EdgeLightType; // LED nas arestas ou none
}
```

Armazenada opcionalmente em cada `DonationEntry`. Cada campo controla um aspecto visual independente:

| Campo | Efeito | Implementação |
|---|---|---|
| `color` | Cor individual do edifício | `InstancedBufferAttribute` (instanceColor) quando o prédio fica no `InstancedMesh`; cor direta no clone do material quando vira mesh próprio |
| `buildingShape` | Formato volumétrico do edifício | `default`: caixa padrão; demais valores usam builders dedicados em [[scene-builders]] |
| `tilingScale` | Multiplicador de tiling da textura aplicado **só nesse edifício** | Faz o prédio sair do `InstancedMesh` (quando ≠ 1.0) e virar `Mesh` próprio com clone de material e uniform `uTilingMultiplier` dedicado |
| `textureTransform` | Ajuste manual da textura aplicado **só nesse edifício** | Faz o prédio sair do `InstancedMesh` quando diferente do padrão e ajusta `scaleX`, `scaleY`, `offsetX`, `offsetY` via uniform dedicado |
| `rooftopType` | Acessório 3D no topo do edifício | `THREE.Group` criado por [[scene-builders#createRooftopMesh.ts\|createRooftopMesh]], posicionado no topo |
| `signText` | Texto da marca/empresa na fachada | `CanvasTexture` + `PlaneGeometry` criados por [[scene-builders#createSignMesh.ts\|createSignMesh]] |
| `signSides` | Em quantas fachadas o letreiro aparece | 1=frente, 2=+trás, 3=+direita, 4=todos os lados |
| `edgeLightType` | LED contornando as arestas do edifício | `THREE.Group` criado por [[scene-builders#createEdgeLightMesh.ts\|createEdgeLightMesh]] (core + halo aditivo) |

Todos gerenciados pelo [[scene-managers|DonationManager]]. A customização é propagada pelo pipeline: `CitySceneEditor` → `CitySceneCanvas` → `useCityScene` → `runtime` → `donationManager.updateDonationCustomization()`.

---

## Tipos de Dados da Cena

### `DonationEntry`

Representa uma doação individual:

```typescript
type DonationEntry = {
  id: number;
  value: number;
  customization?: BuildingCustomization;  // personalização visual opcional
}
```

---

### `ChunkData`

Representa um chunk já criado na cidade (usado no [[scene-managers|ChunkManager]]):

```typescript
type ChunkData = {
  key: string;
  mesh: THREE.InstancedMesh;
  count: number;
  centers: Float32Array;
  heights: Float32Array;
  scales: Float32Array;
}
```

---

### `CameraVisibilityState`

Estado usado para detectar se a câmera mudou o suficiente para exigir nova sincronização de chunks:

```typescript
type CameraVisibilityState = {
  x: number;
  z: number;
  forwardX: number;
  forwardZ: number;
}
```

## Tipo de Infraestrutura

### `CitySceneConfig`

Descreve a estrutura esperada para a config global da cena. Garante consistência de `citySceneConfig.ts`.

Ver campos completos em [[scene-config#citySceneConfig.ts ⭐]].

## Regra Prática

> [!tip]
> Sempre que um dado precisar viajar entre mais de uma camada, ele deve virar um tipo centralizado aqui.

Quando criar um novo tipo:
- Nova seção do painel que sincroniza com o runtime → `types.ts`
- Novo manager que precisa receber nova configuração → `types.ts`
- Novo campo na config global → `types.ts` + `citySceneConfig.ts`
