---
title: Cidoa — Visão Geral
tags:
  - cidoa
  - arquitetura
  - overview
aliases:
  - Documentação Principal
  - Home
---

# Cidoa — Documentação

Cidoa é uma cena 3D de cidade procedural feita com `React 19`, `Three.js`, `TypeScript` e `Vite`. Gera prédios baseados em doações, com texturas PBR, iluminação configurável e sistema de sombras — tudo controlável via painel em tempo real.

> [!abstract] Para quem é essa documentação?
> O objetivo é ajudar um dev júnior a entender por onde a aplicação começa, onde cada responsabilidade fica, em qual arquivo mexer e como os dados saem do React e chegam na cena 3D.

## Visão Geral Rápida

O projeto é dividido em 3 grandes partes:

| Pasta            | Responsabilidade                                                       |
| ---------------- | ---------------------------------------------------------------------- |
| `src/components` | Interface React — editor, painel lateral e canvas                      |
| `src/scene`      | Lógica 3D — tipos, configs, utils, builders, managers, hooks e runtime |
| `doc`    | Documentação da estrutura                                              |

## Estrutura de Arquivos

```text
src/
  App.tsx
  main.tsx
  index.css
  components/
    CitySceneEditor.tsx
    html/
      CityControlPanel.tsx
      BuildingHeightInput.tsx
      BuildingCustomizePanel.tsx
      BuildingControls.tsx
      TextureControls.tsx
      GroundControls.tsx
      SceneLightControls.tsx
      ShadowControls.tsx
      RenderDirectionControls.tsx
      EnvironmentControls.tsx
      PointLightControls.tsx
      PanelIntro.tsx
      controls/
        PanelSection.tsx
        ColorField.tsx
        RangeField.tsx
        NumberField.tsx
        CheckboxField.tsx
        PointLightCard.tsx
    three/
      CitySceneCanvas.tsx
  scene/
    types.ts
    config/
      citySceneConfig.ts
      buildingConfig.ts
      textureConfig.ts
      groundConfig.ts
      lightConfig.ts
      shadowConfig.ts
      renderDirectionConfig.ts
      environmentConfig.ts
      blockLayoutConfig.ts
    builders/
      createLightingRig.ts
      createGroundPlane.ts
      createGridHelper.ts
      createRooftopMesh.ts
      createSignMesh.ts
      createEdgeLightMesh.ts
      createTwistedBuildingMesh.ts
      createOctagonalBuildingMesh.ts
      createSetbackBuildingMesh.ts
      createTaperedBuildingMesh.ts
      createHearstBuildingMesh.ts
      createEmpireBuildingMesh.ts
      createTaipeiBuildingMesh.ts
      createOneTradeBuildingMesh.ts
      createHologramMesh.ts
      loadEnvironment.ts
    managers/
      createDonationManager.ts
      createChunkManager.ts   ← referência arquitetural
      createShadowManager.ts  ← referência arquitetural
    hooks/
      useCityScene.ts
    runtime/
      createCitySceneRuntime.ts
    utils/
      math.ts
      materials.ts
      lighting.ts
      random.ts
      devAssertions.ts
doc/
  index.md
  building-shape-ideas.md
  html-components.md
  three-components.md
  scene-config.md
  scene-types.md
  scene-utils.md
  scene-builders.md
  scene-managers.md
  scene-runtime.md
  scene-hooks.md
```

## Fluxo da Aplicação

### 1. Entrada

- `src/main.tsx` → renderiza React no `#root`
- `src/App.tsx` → renderiza `CitySceneEditor`

### 2. Container Principal

`src/components/CitySceneEditor.tsx` é o componente mais importante do lado React.

Ele guarda todos os estados:

- `buildingSettings`, `textureSettings`, `groundSettings`
- `lightSettings`, `shadowSettings`, `renderDirectionSettings`
- `environmentSettings`, `horizonSettings`, `blockLayoutSettings`
- `sceneStats`, `hoverInfo`
- `showControlPanel` — toggle do painel de configuração (escondido por padrão)
- `selectedBuildingId` — edifício selecionado para personalização
- `buildingCustomizations` — `Map<donationId, BuildingCustomization>` com cor, formato (default/twisted/octagonal/setback/tapered/chrysler/hearst/empire/taipei/one-trade), acessório de topo (holofotes, heliponto, jardim suspenso ou helicóptero com cabine afunilada realista), letreiro, LED de arestas e holograma cyberpunk

E entrega para:

- [[three-components|CitySceneCanvas]] — monta a cena 3D
- [[html-components|CityControlPanel]] — mostra os controles (toggle via botão de engrenagem)
- [[html-components#BuildingCustomizePanel.tsx|BuildingCustomizePanel]] — personalização do edifício selecionado com cor, formato, letreiro, topo, LED e holograma (upload de imagem ou GIF), sem controles de textura
- [[html-components#BuildingHeightInput.tsx|BuildingHeightInput]] — input de doação e layout

Também gerencia:

- Doações via `canvasRef.addDonation(value)` e `canvasRef.addDonations(values)`
- Foco em edifício via `canvasRef.focusOnDonation(id)` e `canvasRef.clearFocus()`
- Personalização via `canvasRef.updateDonationCustomization(id, customization)`

### 3. Canvas 3D

[[three-components|CitySceneCanvas.tsx]] cria um `div` com `ref` e chama o hook [[scene-hooks|useCityScene]], que monta o renderer Three.js dentro do div.

### 4. Painel Lateral

[[html-components|CityControlPanel.tsx]] organiza os componentes do painel em abas. Não conhece Three.js — só atualiza estado React.

### 5. Hook da Cena

[[scene-hooks|useCityScene.ts]] conecta React com Three.js. Cria o runtime uma vez, depois sincroniza mudanças de estado chamando métodos do runtime.

### 6. Runtime da Cena

[[scene-runtime|createCitySceneRuntime.ts]] é o cérebro do Three.js. Orquestra scene, camera, renderer, controls, builders e managers.

## Diagrama de Fluxo

```mermaid
flowchart TD
    A[main.tsx] --> B[App.tsx]
    B --> C[CitySceneEditor]
    C --> D[CitySceneCanvas]
    C --> E[CityControlPanel]
    C --> F[BuildingHeightInput]
    C --> P[BuildingCustomizePanel]
    D --> G[useCityScene]
    G --> H[createCitySceneRuntime]
    H --> I[createLightingRig]
    H --> J[createGroundPlane]
    H --> K[createGridHelper]
    H --> L[loadEnvironment]
    H --> M[createDonationManager]
    M --> N[createRooftopMesh]
    M --> O[createSignMesh]
    M --> Q[createEdgeLightMesh]
    M --> T[createTwistedBuildingMesh]
    M --> U[createOctagonalBuildingMesh]
    M --> V[createSetbackBuildingMesh]
    M --> W[createTaperedBuildingMesh]
    M --> X[createHearstBuildingMesh]
    M --> Y[createEmpireBuildingMesh]
    M --> Z[createTaipeiBuildingMesh]
    M --> OT[createOneTradeBuildingMesh]
    M --> HG[createHologramMesh]
    E --> C
    P --> C
```

## Fluxo de Personalização de Edifícios

```mermaid
flowchart LR
    Click[Clique no edifício] --> Focus[focusOnDonation]
    Focus --> Panel[BuildingCustomizePanel]
    Panel --> |cor| UC[updateCustomization]
    Panel --> |formato| UC
    Panel --> |letreiro| UC
    Panel --> |topo| UC
    Panel --> |holograma| UC
    UC --> Runtime[runtime.updateDonationCustomization]
    Runtime --> DM[donationManager]
    DM --> |cor| IC[instanceColor]
    DM --> |formato twisted| TW[createTwistedBuildingMesh]
    DM --> |formato octagonal| OC[createOctagonalBuildingMesh]
    DM --> |formato setback| SB[createSetbackBuildingMesh]
    DM --> |formato tapered| TP[createTaperedBuildingMesh]
    DM --> |formato chrysler| CH[createChryslerBuildingMesh]
    DM --> |formato hearst| HT[createHearstBuildingMesh]
    DM --> |formato empire| EM[createEmpireBuildingMesh]
    DM --> |formato taipei| TP101[createTaipeiBuildingMesh]
    DM --> |formato one-trade| OT[createOneTradeBuildingMesh]
    DM --> |topo| RM[createRooftopMesh]
    DM --> |sign| SM[createSignMesh]
    DM --> |LED| EL[createEdgeLightMesh]
    DM --> |holograma| HM[createHologramMesh]
```

## Onde Mexer?

| Objetivo                                         | Arquivo                                           |
| ------------------------------------------------ | ------------------------------------------------- |
| Alterar valor padrão dos prédios                 | [[scene-config]]                                  |
| Alterar a UI do painel de configuração           | [[html-components#CityControlPanel.tsx]]          |
| Alterar a UI de personalização de edifício       | [[html-components#BuildingCustomizePanel.tsx]]    |
| Alterar o canvas ou a ligação com o hook         | [[three-components]]                              |
| Alterar fórmulas de luz, clamp ou material       | [[scene-utils]]                                   |
| Alterar criação do chão, grid, luzes ou ambiente | [[scene-builders]]                                |
| Alterar acessórios de topo                       | [[scene-builders#createRooftopMesh.ts]]           |
| Alterar letreiros de fachada (signs)             | [[scene-builders#createSignMesh.ts]]              |
| Alterar LED de arestas                           | [[scene-builders#createEdgeLightMesh.ts]]         |
| Alterar holograma cyberpunk                      | [[scene-builders#createHologramMesh.ts]]          |
| Alterar torre torcida (twisted)                  | [[scene-builders#createTwistedBuildingMesh.ts]]   |
| Alterar torre octogonal (octagonal)              | [[scene-builders#createOctagonalBuildingMesh.ts]] |
| Alterar torre setback (setback)                  | [[scene-builders#createSetbackBuildingMesh.ts]]   |
| Alterar torre afunilada (tapered)                | [[scene-builders#createTaperedBuildingMesh.ts]]   |
| Alterar torre Hearst (hearst)                    | [[scene-builders#createHearstBuildingMesh.ts]]    |
| Alterar torre Empire State (empire)              | [[scene-builders#createEmpireBuildingMesh.ts]]    |
| Alterar torre Taipei 101 (taipei)                | [[scene-builders#createTaipeiBuildingMesh.ts]]    |
| Alterar torre One Trade (one-trade)              | [[scene-builders#createOneTradeBuildingMesh.ts]]  |

| Alterar torre Chrysler (chrysler) | [[scene-builders#createChryslerBuildingMesh.ts]] |
| Alterar geração dos prédios de doação | [[scene-managers]] |
| Alterar o ciclo completo da cena | [[scene-runtime]] |
| Entender o contrato dos dados | [[scene-types]] |
| Entender como React sincroniza com Three.js | [[scene-hooks]] |

## Ordem de Leitura Recomendada

1. `src/App.tsx`
2. `src/components/CitySceneEditor.tsx`
3. [[html-components]]
4. [[three-components]]
5. [[scene-hooks]]
6. [[scene-runtime]]
7. [[scene-managers]]
8. [[scene-builders]]
9. [[scene-config]]
10. [[scene-utils]]

## Ideia Central da Arquitetura

```
React  → estado e interface
Three.js → renderização 3D
config   → valores padrão
types    → contratos
utils    → funções puras
builders → peças isoladas da cena
managers → partes complexas com estado interno
runtime  → orquestra tudo
hooks    → ponte React ↔ runtime
```

> [!tip] Padrões do projeto
>
> - **Factory functions** em vez de classes (`create*()`)
> - **Dispose explícito** — todo recurso Three.js tem cleanup
> - **InstancedMesh** para performance nos prédios
> - **Seeded random** para geração determinística por posição
