---
title: Scene Managers
tags:
  - cidoa
  - managers
  - threejs
  - procedural
  - doação
aliases:
  - Managers
  - DonationManager
  - ChunkManager
---

# Scene Managers

Coordenadores de partes da cena com estado interno em `src/scene/managers/`.

## Objetivo da Pasta

Managers cuidam de partes da cena que têm **estado interno** e **comportamento contínuo**. Em vez de colocar toda a lógica procedural dentro do [[scene-runtime|runtime]], o projeto separa as áreas mais complexas aqui.

## Arquivos

### `createDonationManager.ts` ⭐ (Manager Principal)

Manager principal da cena atual. Gerencia os prédios como representações visuais de doações.

**Responsabilidades:**
- Manter a lista de doações (`DonationEntry[]`) ordenada por valor decrescente
- Criar e atualizar um único `InstancedMesh` com capacidade para até 500 prédios
- Posicionar prédios em **espiral quadrada** a partir do centro
- Calcular altura proporcional ao valor máximo
- Carregar e aplicar texturas PBR (cor, normal, roughness, metalness, displacement, emissive)
- Atualizar materiais em tempo real
- Gerenciar envMap dinâmico via cube camera

#### Layout dos Prédios — Sistema de 2 Camadas

Os prédios são separados em **torres** e **base urbana**:

| Camada | Seleção | Range de altura | Posição |
|---|---|---|---|
| **Torres** | Top `towerRatio`% das doações | `minBuildingHeight` → `maxSceneHeight` (range completo) | Slot central de cada quadra, 1 torre por quadra, quadras em espiral |
| **Base urbana** | Restante das doações | `minBuildingHeight` → `baseHeightCap × maxSceneHeight` (teto reduzido) | Shuffle determinístico nos slots restantes de todas as quadras |

Essa separação cria **contraste abrupto** entre torres e vizinhos — o efeito visual de skyline de cidade real, não pirâmide.

**Geometria de uma quadra (blockSize=3):**

```
[ ▪ ][ ▪ ][ ▪ ]
[ ▪ ][ █ ][ ▪ ]   █ = torre (range completo, proporcional ao valor)
[ ▪ ][ ▪ ][ ▪ ]   ▪ = base urbana (teto reduzido, shuffle aleatório)
```

**Cálculo de espaçamento:**
```
blockFootprint = (blockSize - 1) × slotSize
blockSpacing   = blockFootprint + streetWidth
```

**Configurado por [[scene-types#BlockLayoutSettings]] (editável em tempo real):**
- `blockSize` — prédios por lado (padrão: 3 → 9 slots/quadra)
- `streetWidth` — espaço entre quadras (padrão: 6.0)
- `towerRatio` — fração de torres (padrão: 0.12 = 12%)
- `baseHeightCap` — teto da base como fração de maxSceneHeight (padrão: 0.30 = 30%)

A cada nova doação ou mudança de layout, a lista é reordenada e **todas as instâncias são reconstruídas**.

#### Fórmula de Altura

```
height = minBuildingHeight + (valor / maxValor) × (maxSceneHeight - minBuildingHeight)
```

| Constante | Valor | Descrição |
|---|---|---|
| `minBuildingHeight` | `0.5` | Mínimo visual para qualquer doação |
| `maxSceneHeight` | `16` | Cap visual; maior doação sempre alcança esse valor |

> [!tip] Para ajustar os limites
> Edite `DONATION_LAYOUT` em `createDonationManager.ts`.

#### Materiais

O manager usa um único par de materiais para prédios e um material de asfalto para as ruas:

| Material | Tipo | Descrição |
|---|---|---|
| `facadeMaterial` | `MeshPhysicalMaterial` | Textura de fachada com shader triplanar + cube envMap dinâmico |
| `topMaterial` | `MeshPhysicalMaterial` | Textura de concreto para o topo dos prédios |
| `focusFacadeMaterial` | `MeshPhysicalMaterial` | Clone do facadeMaterial para o edifício em destaque (opacidade total quando o instanced mesh fica semitransparente) |
| `focusTopMaterial` | `MeshPhysicalMaterial` | Clone do topMaterial para o edifício em destaque |
| `asphaltMaterial` | `MeshStandardMaterial` | Cor escura (#18191c), roughness 0.92 — usado nas faixas de asfalto entre quadras |
| `sidewalkTopMaterial` | `MeshStandardMaterial` | Cor do topo da calçada (de `blockLayoutSettings.sidewalkColor`, padrão #9a9da3), roughness 0.95 — face superior do meio-fio |
| `sidewalkSideMaterial` | `MeshStandardMaterial` | Cor das laterais da calçada (de `blockLayoutSettings.sidewalkSideColor`, padrão #55575c, mais escura) — dá efeito de sombra p/ enxergar a altura. O `sidewalkGeometry` remapeia os grupos de face (topo → material 0, laterais+base → material 1) |
| `lotMaterial` | `MeshStandardMaterial` | Cor das quadras (de `blockLayoutSettings.lotColor`, padrão #5b5048), roughness 0.98 — tile de lote vazio. `onBeforeCompile` injeta borda escura (`vLotPos`) demarcando cada lote, mantendo luz + sombra |

#### Rede de Estradas (Asfalto)

Como o loteamento tem piso mínimo `r ≥ MIN_LOTEAMENTO_RADIUS` (= 1), há sempre mais de um bloco. `rebuildRoads(r, blockSpacing, streetWidth)` cria faixas de `Mesh` planas que preenchem o espaço entre as quadras:

- **Faixas longitudinais** (correm na direção Z): posicionadas em `x = (bx + 0.5) × blockSpacing` para cada gap entre colunas de blocos
- **Faixas transversais** (correm na direção X): posicionadas em `z = (bz + 0.5) × blockSpacing` para cada gap entre linhas de blocos
- Largura útil da pista = `streetWidth − SIDEWALK_RESERVE` (= `streetWidth − 3.6`) — asfalto estreito; o resto da rua vira calçada
- Comprimento = `2 × r × blockSpacing + blockFootprint` — estende até a **borda externa das quadras mais externas**, pra o asfalto chegar ao final do loteamento (não para nas interseções internas)
- Y = -0.015 (acima do ground plane em -0.03, abaixo dos prédios em 0)
- Cache: se `r`, `blockSpacing` e `streetWidth` não mudaram, `rebuildRoads` retorna imediatamente
- As faixas são recriadas toda vez que `rebuildInstances` muda o anel `r` ou os parâmetros de layout

**Faixa central (tracejado):** cada via tem um plano de `ShaderMaterial` (`dashFS`) que desenha a linha pontilhada amarela no centro. O shader **apaga a faixa nos cruzamentos** (`distInter < interHalf`, `interHalf = roadWidth/2 + 0.15`): via centrada na origem, cruzamentos em `(k+0.5)×blockSpacing` — sem isso a faixa longitudinal e a transversal se cruzariam em X no meio do cruzamento. Uniforms novos: `roadLen`, `blockSpacing`, `interHalf`.

**Calçadas (`rebuildSidewalks`):** moldura de concreto elevada **estreita** em volta de **cada quadra**, no vão entre o lote e o asfalto.

- Calçada ocupa o vão entre a **borda externa dos lotes** (`blockFootprint/2 + (slotSize−0.5)/2`) e a **borda do asfalto** (`blockSpacing/2 − roadWidth/2`) → bem mais estreita que o asfalto e **nunca sobe na quadra**
- `SIDEWALK_GAP` (0.25) = respiro de chão livre entre a borda do lote e a calçada (`innerHalf = lotEdge + SIDEWALK_GAP`); calçada continua encostando no asfalto (meio-fio)
- 4 tiras de `BoxGeometry` por quadra num único `InstancedMesh` (`sidewalkMesh`) — N/S cobrem os cantos (largura total `2×outerHalf`), L/O ficam entre os cantos (`2×innerHalf`)
- As molduras **quebram naturalmente nos cruzamentos** (cantos das quadras), deixando o asfalto perpendicular passar livre — por isso é moldura por-quadra, não tira contínua
- Elevação: topo da calçada vem de `blockLayoutSettings.sidewalkHeight` (padrão 0.12 → degrau ~0.13 acima do asfalto -0.015 e dos lotes -0.012). Fundo fixo em `SIDEWALK_BOTTOM = -0.08` (abaixo do terreno -0.04 p/ não flutuar); espessura do box = `sidewalkHeight − SIDEWALK_BOTTOM`
- Capacidade cresce sob demanda (mesmo padrão dos lotes); `count = 0` quando não cabe calçada (`sidewalkWidth ≤ 0`)
- `receiveShadow` segue `shadowEnabled`; `castShadow = false`; `dispose()` libera `sidewalkGeometry`/`sidewalkTopMaterial`/`sidewalkSideMaterial`

#### Loteamento e Lotes Vazios

Cena nunca fica vazia: o manager sempre desenha um **loteamento** (grade de quadras + asfalto + lotes demarcados), mesmo com 0 doações. Doações preenchem do centro pra fora; lotes vazios somem sob os prédios conforme a cidade cresce.

- **Piso mínimo:** `MIN_LOTEAMENTO_RADIUS` (= 1) força `r ≥ 1` → grade 3×3 de quadras sempre presente. O loteamento cresce além disso quando as doações exigem mais quadras, nunca encolhe abaixo do piso.
- **Render inicial:** `rebuildInstances()` é chamado na criação do manager — o loteamento aparece antes de qualquer doação e já define `cityHalfExtent` pro relevo abrir a zona plana no setup.
- **Coleta de lotes:** no loop de posicionamento, cada bloco guarda `orderedSlots` (ordem usada: ocupados primeiro). Slots além de `occupiedSlots` viram lote vazio — coletados em `emptyLots` (posição world x,z).
- **`rebuildLots(positions)`:** desenha um único `InstancedMesh` (`lotMesh`) de tiles de chão, 1 draw call pra todos os lotes. Cresce a capacidade sob demanda (mesmo padrão do prédio); `count = 0` quando o loteamento está cheio.
- **Tile:** `PlaneGeometry(slotSize − 0.5)` deitado (`rotateX`), em `LOT_Y = -0.012`. O gap de 0.5 entre tiles + a borda do shader = demarcação dos lotes.
- **Sombra:** `lotMesh.receiveShadow` segue `shadowEnabled` (prédios projetam sombra nos lotes vazios).
- **Cor configurável:** `lotColor`, `sidewalkColor` (topo) e `sidewalkSideColor` (laterais) vêm de `blockLayoutSettings`. `updateBlockLayout` aplica direto em `lotMaterial.color` / `sidewalkTopMaterial.color` / `sidewalkSideMaterial.color` (materiais compartilhados → tudo de uma vez) e **só reconstrói** as instâncias quando muda um campo de geometria (`blockSize`, `streetWidth`, `towerRatio`, `towersPerBlock`, `baseHeightCap`) — trocar só a cor não dispara rebuild.
- **Altura da calçada configurável:** `sidewalkHeight` em `blockLayoutSettings`. `updateBlockLayout` faz um **rebuild localizado** só das tiras de calçada (`rebuildSidewalks` com os últimos params de estrada salvos: `lastRoadR`/`lastRoadBlockSpacing`/`lastRoadStreetWidth`) — não mexe nos prédios.
- **Cleanup:** `dispose()` remove `lotMesh` e libera `lotGeometry`/`lotMaterial`.

> [!note] Por que shader triplanar?
> Prédios dentro do mesmo `InstancedMesh` têm alturas diferentes. O shader triplanar garante que a textura de fachada seja aplicada corretamente sem distorção, independente da escala de cada instância.

> [!note] Atributos `aProjPosition` / `aProjNormal`
> O shader não usa `position`/`objectNormal` diretamente — usa atributos customizados `aProjPosition`/`aProjNormal` para selecionar a projeção (XY/ZY/XZ) e calcular o UV. Na geometria default eles são cópias de `position`/`normal` (comportamento idêntico). Na geometria torcida ([[scene-builders#createTwistedBuildingMesh.ts|createTwistedBuildingMesh]]) eles preservam os valores **pré-twist** (axis-aligned), evitando que a normal twisted atravesse a fronteira entre projeções no meio do prédio. Na geometria octogonal ([[scene-builders#createOctagonalBuildingMesh.ts|createOctagonalBuildingMesh]]), as faces diagonais usam normais de projeção cardinalizadas para evitar ambiguidade entre projeções X/Z. Na geometria setback ([[scene-builders#createSetbackBuildingMesh.ts|createSetbackBuildingMesh]]), cada patamar grava normais cardinais/lajes horizontais para manter a textura estável nos recuos. Na geometria Taipei ([[scene-builders#createTaipeiBuildingMesh.ts|createTaipeiBuildingMesh]]) e One Trade ([[scene-builders#createOneTradeBuildingMesh.ts|createOneTradeBuildingMesh]]), módulos chanfrados, bordas e pináculos também gravam esses atributos para manter a textura triplanar do projeto.

#### Métodos Públicos

```typescript
// Doações
addDonation(value: number): void
addDonations(values: number[]): void
getDonationCount(): number
getCityRadius(): number   // meia-extensão world do loteamento (piso r=1, nunca 0); consumido pelo relevo

// Configurações globais
updateBuildingSettings(settings: BuildingSettings): void
updateTextureSettings(settings: TextureSettings): void
updateBlockLayout(settings: BlockLayoutSettings): void

// EnvMap e sombras
setEnvMap(texture: THREE.Texture): void
setShadowEnabled(enabled: boolean): void
beginEnvCapture(): void   // zera envMapIntensity (anti-feedback) + oculta lotes vazios durante captura do CubeCamera
endEnvCapture(): void     // restaura envMapIntensity + reexibe lotes após captura

// Interação
getHoveredValue(event, camera, domElement): number | null       // raycast hover → valor da doação
getClickedDonationId(event, camera, domElement): number | null  // raycast clique → donation ID
getDonationWorldPosition(donationId: number): THREE.Vector3 | null  // posição do topo do edifício

// Foco e personalização
setFocusedDonation(donationId: number | null): void  // destaque visual (semitransparência + mesh isolado)
updateDonationCustomization(donationId: number, customization: BuildingCustomization): void

// Cleanup
dispose(): void
```

> [!note] getCityRadius
> Retorna a meia-extensão (half-extent) world do loteamento: `r * blockSpacing + blockFootprint/2 + slotSize`. Com o piso `MIN_LOTEAMENTO_RADIUS`, nunca é `0` — mesmo sem doações reflete a grade 3×3. O [[scene-runtime|runtime]] consome esse raio (`setCityRadius`) para escavar a zona plana do relevo ([[scene-builders#createTerrain.ts]]).

#### Foco em Edifício (Destaque Visual)

Quando o usuário clica em um edifício, `setFocusedDonation(donationId)` cria um destaque visual:

1. **Instanced mesh** fica semitransparente (`opacity: 0.15`) — toda a cidade some sutilmente
2. **Mesh isolado** (`focusHighlightMesh`) é criado com os materiais de foco (`focusFacadeMaterial` / `focusTopMaterial`) na posição exata do edifício, com opacidade total
3. Se o edifício tem **cor customizada**, os materiais de foco recebem essa cor
4. O `instanceColor` do instanced mesh é limpo durante o foco para usar a opacidade uniforme

Ao chamar `setFocusedDonation(null)`, a opacidade é restaurada a 1.0, o mesh isolado é removido e o `instanceColor` é reaplicado.

---

#### Animação de Entrada (Novo Edifício)

`addDonation` (fluxo de pagamento, tecla `ArrowRight`) dispara `startEntrance(id)` após o `rebuildInstances`. Sem isso o prédio surgia instantâneo — impossível saber qual entrou. O prédio já surge pronto (escala cheia), animando só a posição vertical via `instanceMatrix` (doação nova não tem customização → sempre instanced).

- **Queda com slam** (`tickEntrance`, `ENTRANCE_DURATION = 2.2s`): surge flutuando `ENTRANCE_LIFT = 5` acima da posição final; **levita** com bob leve até 30% do tempo (`HOVER_END`), **cai devagar** até 80% (`SLOW_END`, desce 60% da altura), depois **despenca** acelerando (`k²`, gravidade) até encostar no chão.
- **Poeira de impacto** (`spawnDust` / `tickDust`): ao encostar (`offset ≤ 0.02`, uma vez via flag `landed`), solta um burst de `THREE.Points` (30 partículas, textura radial gerada por canvas — sem asset externo) com velocidade radial + jato pra cima; integra gravidade + arrasto e some em `DUST_DURATION = 0.9s`. `Points` único reusado (1 impacto por vez).
- **Ciclo**: `tickEntrance` e `tickDust` são chamados por `tickAnimations`; `finishEntrance()` assenta o transform final exato. Uma entrada por vez — `startEntrance` encerra a anterior. O bulk (`addDonations`) permanece instantâneo.

---

#### Cores Individuais por Edifício

Quando um edifício recebe uma customização via `updateDonationCustomization`, a cor é armazenada em `DonationEntry.customization` e aplicada via `InstancedBufferAttribute` (instanceColor). Edifícios sem customização usam a cor global do material. O sistema é reativado a cada `rebuildInstances` ou mudança de `BuildingSettings`.

Para edifícios com `buildingShape !== "default"`, a cor é aplicada diretamente nos materiais clonados (sem instanceColor) via `updateCustomShapeColor`.

#### Customizações que exigem Mesh próprio (`needsCustomMesh`)

Algumas personalizações precisam de **estado de material próprio** por edifício e não cabem no `InstancedMesh` (que compartilha um único material). O helper `needsCustomMesh(customization)` define quando uma doação sai do InstancedMesh e passa a ser desenhada como `Mesh` dedicado em `customShapeMeshes`:

- `buildingShape !== "default"` (ex: torre torcida, octogonal, setback, tapered, Chrysler, Hearst, Empire, Taipei ou One Trade)
- `Math.abs(tilingScale - 1) > 0.001` (tiling de textura customizado por edifício)
- `textureTransform` diferente do padrão `{ scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0 }` (ajuste manual de textura por edifício)

Quando a flag transiciona (entra ou sai do `customShapeMeshes`), `updateDonationCustomization` chama `rebuildInstances()` e re-aplica `applyFocus(focusedDonationId)`. Mudanças que não atravessam essa fronteira (ex: ajustar tiling de 2.0 → 2.5 num prédio que já é custom) atualizam direto o uniform `uTilingMultiplier` do material — sem rebuild.

Para cada doação custom, `syncCustomShapes()`:

1. Clona `facadeMaterial`/`topMaterial`.
2. **Re-aplica `applyTriplanarShader` no clone** para que ele tenha seu próprio `uTilingMultiplier` (default 1.0). Sem isso, o clone herdaria o `onBeforeCompile` do original, apontando para o uniform compartilhado.
3. Define cor (`customization.color`), tiling (`customization.tilingScale`) e ajuste manual de textura (`customization.textureTransform`) no clone.
4. Cria o mesh:
   - `shape === "twisted"` → [[scene-builders#createTwistedBuildingMesh.ts|createTwistedBuildingMesh]] (geometria espiralada compartilhada).
   - `shape === "octagonal"` → [[scene-builders#createOctagonalBuildingMesh.ts|createOctagonalBuildingMesh]] (geometria octogonal compartilhada).
   - `shape === "setback"` → [[scene-builders#createSetbackBuildingMesh.ts|createSetbackBuildingMesh]] (geometria em patamares compartilhada).
   - `shape === "tapered"` → [[scene-builders#createTaperedBuildingMesh.ts|createTaperedBuildingMesh]] (geometria afunilada compartilhada).
   - `shape === "chrysler"` → [[scene-builders#createChryslerBuildingMesh.ts|createChryslerBuildingMesh]] (geometria art déco compartilhada).
   - `shape === "hearst"` → [[scene-builders#createHearstBuildingMesh.ts|createHearstBuildingMesh]] (geometria facetada com diagrid compartilhada).
   - `shape === "empire"` → [[scene-builders#createEmpireBuildingMesh.ts|createEmpireBuildingMesh]] (geometria art déco textureless compartilhada).
   - `shape === "taipei"` → [[scene-builders#createTaipeiBuildingMesh.ts|createTaipeiBuildingMesh]] (geometria modular compartilhada inspirada no Taipei 101).
   - `shape === "one-trade"` → [[scene-builders#createOneTradeBuildingMesh.ts|createOneTradeBuildingMesh]] (geometria facetada com base chanfrada e pináculo, usando texturas PBR padrão).
   - `shape === "default"` → `THREE.Mesh(buildingGeometry, [facadeMat, topMat])` (mesma `BoxGeometry` do InstancedMesh).
5. Adiciona à cena, registra em `customShapeMeshes` e seta `userData.donationId`/`userData.donationValue` para suportar raycast.

Pontos de integração:

- Os clones são incluídos em `getAllFacadeMaterials()` / `getAllTopMaterials()` para que `applyTextureToFacade`, `applyTextureToTop`, `updateBuildingSettings`, `setEnvMap`, `beginEnvCapture`/`endEnvCapture` e `setShadowEnabled` propaguem mudanças globais para eles.
- `setFocusedDonation` dim os clones para `0.15` quando outro prédio está focado, mantém em `1.0` se o custom é o focado, e dispensa o `focusHighlightMesh` (o próprio Mesh já é separado).
- `getHoveredValue` / `getClickedDonationId` estendem o raycast para `[mesh, ...customShapeMeshes]` e leem `donationId`/`donationValue` de `userData`.
- O map `donationTransforms: Map<id, {position, scale}>` é a **fonte única** dos transforms lógicos: acessórios (rooftop/sign/edge) usam `readDonationTransform` que lê desse map, então funcionam igual para edifícios custom sem precisar saber se viraram Mesh separado.
- `dispose()` limpa cada clone (`facadeMat.dispose()` + `topMat.dispose()`) e chama `disposeTwistedBuildingSharedResources()` / `disposeOctagonalBuildingSharedResources()` / `disposeSetbackBuildingSharedResources()`.

> [!tip] Adicionando novas customizações de material
> Para uma futura personalização que precise de estado de material próprio (ex: normalScale individual), basta:
> 1. Adicionar o campo em `BuildingCustomization`.
> 2. Estender `needsCustomMesh` para considerar o novo campo.
> 3. Aplicar no clone dentro de `syncCustomShapes` e atualizar via uniform em `updateDonationCustomization`.

#### Acessórios de Topo

Cada edifício pode ter um acessório 3D no topo, como holofotes ou heliponto, gerenciado pelo campo `rooftopType` em `BuildingCustomization`. O manager mantém um `Map<donationId, { group, type }>` com os `THREE.Group` criados por [[scene-builders#createRooftopMesh.ts|createRooftopMesh]].

- **Posicionamento:** após cada `rebuildInstances`, `syncRooftops()` reposiciona todos os grupos no topo dos edifícios correspondentes.
- **Criação/remoção:** `setRooftop(donationId, type)` remove o grupo anterior e cria um novo se `type !== "none"`.
- **Performance:** o lookup do edifício usa `donationIdToInstanceIndex` em vez de `indexOf`, e os transforms temporários são reutilizados nos syncs.
- **Sombras:** `setRooftopMeshShadowEnabled()` respeita apenas meshes sólidos; lentes emissivas e feixes transparentes não entram no shadow map.
- **Cleanup:** no `dispose()`, todos os grupos são removidos e `disposeRooftopSharedResources()` limpa geometrias e materiais compartilhados.

#### Letreiros (Signs)

Cada edifício pode ter um letreiro na fachada com o texto da marca/empresa do doador, gerenciado pelo campo `signText` em `BuildingCustomization`. O manager mantém um `Map<donationId, { group, text }>` com os `THREE.Group` criados por [[scene-builders#createSignMesh.ts|createSignMesh]].

- **Dimensionamento:** o letreiro usa as dimensões reais do edifício (`getBuildingScale`) — largura adaptada a cada fachada, altura consistente em todos os lados.
- **Lados:** `signSides` (1–4) controla em quantas fachadas o letreiro aparece. Cada mudança de texto ou de lados recria o sign completo via `setSign(donationId, text, sides)`.
- **Posicionamento:** `syncSigns()` reposiciona todos os letreiros no centro do edifício após cada `rebuildInstances`.
- **Sombras:** a placa emissiva não projeta sombra; apenas o backing metálico mantém presença física no shadow map.
- **Detecção de mudança:** `updateDonationCustomization` compara `signText` e `signSides` anteriores com os novos valores — recria só se houve mudança.
- **Cleanup:** no `dispose()`, todos os sign meshes são removidos com `disposeSignMesh()`.

#### LED de Arestas

Cada edifício pode ter um efeito de **LED nas arestas** (4 arestas verticais nos cantos + 4 arestas no topo formando retângulo), gerenciado pelos campos `edgeLightType` e `edgeLightColor` em `BuildingCustomization`. O manager mantém um `Map<donationId, { group, type, color }>` com os `THREE.Group` criados por [[scene-builders#createEdgeLightMesh.ts|createEdgeLightMesh]].

- **Posicionamento:** o grupo é colocado na **base** do edifício (`donationY − scale.y/2`); meshes internos cobrem de `y=0` (chão) até `y=height` (topo) com lift de `0.05` no topo para evitar conflito com `helipad`/`spotlights`.
- **Reconstrução em rebuild:** ao contrário de rooftop/sign, `syncEdgeLights()` **reconstrói** todos os grupos existentes a cada `rebuildInstances`. Isso é necessário porque novas doações alteram a altura dos edifícios — a geometria do LED depende de `width`, `depth` **e** `height`.
- **Mudança de cor sem rebuild:** quando apenas a cor muda (drag do color picker), `setEdgeLightColor(donationId, color)` chama `updateEdgeLightMeshColor` que mexe diretamente nos materiais clonados — sem destruir nada. Mudança de `type` (none ↔ led) sim reconstrói tudo via `setEdgeLight`.
- **Sombras:** LEDs nunca projetam nem recebem sombra (são emissivos/aditivos). `setEdgeLightMeshShadowEnabled` é chamada por consistência, mas todas as `userData` de sombra ficam `false`.
- **Cleanup:** no `dispose()`, todos os edge light meshes são removidos com `disposeEdgeLightMesh()` (libera materiais clonados) e `disposeEdgeLightSharedResources()` libera a `BoxGeometry` compartilhada do módulo.

---

### `createChunkManager.ts` _(referência arquitetural)_

> [!warning] Não usado pelo runtime principal
> Mantido no repositório como referência da arquitetura de cidade procedural infinita.

**Responsabilidades originais:**
- Criar `InstancedMesh` por chunk
- Gerar prédios proceduralmente com [[scene-utils#random.ts|seeded random]]
- Decidir quais chunks devem existir perto da câmera
- Remover chunks distantes
- Alternar materiais near/far por chunk com base em `envMapNearDistance`

---

### `createShadowManager.ts` _(referência arquitetural)_

> [!warning] Não usado pelo runtime principal
> Mantido no repositório como referência para seleção de candidatos de sombra.

**Responsabilidade original:** escolher os prédios mais próximos da câmera para gerar sombra, limitando o custo do shadow map.

## Quando Mexer em Managers

Mexa aqui quando o problema for **comportamental**:

| Objetivo | Onde mexer |
|---|---|
| Mudar layout dos prédios de doação | `createDonationManager.ts` → `DONATION_LAYOUT` |
| Alterar fórmula de altura proporcional | `createDonationManager.ts` |
| Aumentar limite máximo de doações | `createDonationManager.ts` → `DONATION_LAYOUT` |
| Alterar cor/material do asfalto | `createDonationManager.ts` → `asphaltMaterial` |
| Alterar largura do asfalto vs. calçada | `createDonationManager.ts` → `SIDEWALK_RESERVE` |
| Alterar calçada (cor, altura via UI) | aba **geral** → seção Calçada → `blockLayoutSettings.sidewalkColor` / `sidewalkHeight` |
| Alterar geometria/posição da calçada | `createDonationManager.ts` → `rebuildSidewalks` / `SIDEWALK_GAP` / `SIDEWALK_BOTTOM` |
| Alterar faixa central / tracejado / cruzamentos | `createDonationManager.ts` → `dashFS` (`interHalf`) |
| Alterar lotes vazios (cor, borda, tamanho) | `createDonationManager.ts` → `lotMaterial` / `rebuildLots` |
| Alterar tamanho mínimo do loteamento | `createDonationManager.ts` → `MIN_LOTEAMENTO_RADIUS` |
| Problema de valores padrão (altura máx, tamanho) | [[scene-config]] |
| Fórmula matemática pequena | [[scene-utils]] |
