---
title: Scene Builders
tags:
  - cidoa
  - builders
  - threejs
  - factory
aliases:
  - Builders
  - Construtores de Cena
---

# Scene Builders

Factory functions que criam partes isoladas da cena 3D em `src/scene/builders/`.

## Objetivo da Pasta

Builders criam peças específicas da cena. O [[scene-runtime|runtime]] não precisa saber todos os detalhes de criação — cada builder monta, atualiza e destrói sua peça.

**Padrão de retorno:** cada builder retorna um objeto com métodos `update`, `dispose` e métodos específicos como `setPosition`.

> [!important] Dispose obrigatório
> Todo builder deve expor `dispose()` e limpar geometria, material e recursos Three.js para evitar memory leaks.

## Arquivos

### `createGroundPlane.ts`

Cria o chão da cidade.

**Responsabilidades:**
- Criar geometria e material do chão
- Aplicar valores derivados do tipo de material via [[scene-utils#materials.ts|getGroundMaterialValues]]
- Mover o chão junto com a câmera (no loop de animação)
- Limpar geometria e material no `dispose`

**Quando mexer aqui:**
- Trocar o tipo de `Mesh` do chão
- Mudar como o chão atualiza material
- Mudar como o chão acompanha a câmera

> [!note] Coexiste com o relevo
> O plano cinza é o chão da cidade (segue a câmera, y=-0.03). O [[scene-builders#createTerrain.ts|relevo verde]] fica ao redor, fixo na origem, e mergulha **sob** este plano perto da cidade.

---

### `createTerrain.ts`

Cria o relevo procedural (colinas verdes) ao redor da cidade — partes sem edifício. Port completo do protótipo `terrain.md`. Fixo na origem, **não** segue a câmera. É o **chão único** da cena quando ligado (ver callout abaixo).

**Responsabilidades:**
- Gerar heightfield via pipeline completa do `terrain.md`: `mulberry32` (semente das falhas), `valueNoise`/`fbm` com `persistence`/`lacunarity` como **params** (não mais constantes), **ridge noise**, **falhas tectônicas** (linhas via degrau `tanh`), **edge falloff** (`smoothstep` rebaixa borda externa por `edge`), **terraços** e `smoothHeightField` (N passes = `smooth`)
- Resolução (`segments`) e largura (`size`) **dinâmicas**: trocar `segments` realoca buffers de posição/cor + índice da malha; `update()` regenera o heightfield com os settings atuais
- **Chão único, sem cruzar o plano:** zona plana ao nível `TERRAIN_GROUND_Y` (−0.02), logo ACIMA do plano cinza (−0.03) e ABAIXO das ruas (−0.015). O relevo nunca cruza o plano → **sem z-fighting**, e as ruas continuam visíveis
- **Encaixe suave na cidade (degradê):** a **amplitude** das colinas (`amp`) sobe de 0 (borda da cidade) a 1 (longe) — as colinas nascem do plano, não batem numa parede. `band = max(TERRAIN_TRANSITION, height*3)` (degradê mais longo pra relevo mais alto), `ramp = smootherstep(dw, inner, inner+band)` (quintic, derivada zero nas pontas), `amp = ramp²` (toe extra-suave). Altura final = `TERRAIN_GROUND_Y + relevo*amp`
- **Contorno irregular (sem anel circular):** `dw` é a distância radial **perturbada** por ruído de mundo por vértice (`edgeWarp` ∈ [-1,1], fbm 4 octaves, lobo ~110u). Assimétrico: recua bastante pra fora (`outwardCap = band*0.5`, baías) e cutuca pouco pra dentro (`inwardCap = padding*0.6`, limite pra não invadir a cidade). Sem isso o contorno cidade→relevo é um círculo perfeito (padrão artificial)
- **Cor por vértice:** base = cinza do chão da cidade (`baseColor`, sincronizada com [[scene-types#GroundSettings]] via `setGroundColor`) **perto** → `lowColor` (planícies verdes) **longe**, fade pela mesma distância ondulada `dw`; sobe pro `highColor` conforme o relevo cresce (`hv = relevo/range`)
- `wireframe` alterna `material.wireframe`
- `BufferGeometry` indexada com `vertexColors`; recomputa normais/bounding só quando posições mudam (recolor puro pula normais)

**Retorna:** `TerrainRig` com `mesh`, `update`, `setCityRadius`, `setGroundColor`, `dispose`.

> [!important] Chão único = sem z-fighting
> O relevo é o **único chão visível** quando ligado: plano cinza na cidade → colinas verdes fora, numa malha contínua. O [[scene-runtime|runtime]] **esconde o plano cinza** (`groundPlane.mesh.visible = false`) no render normal — duas superfícies cinza quase paralelas (terreno em −0.04 e o plano que segue a câmera em −0.03) brigavam por profundidade e **piscavam conforme a câmera mexe**, principalmente em ângulos rasos. Sem o plano no render, sobra só o terreno → sem z-fighting. O plano **reaparece só na captura do envMap** (piso neutro do reflexo dos edifícios). Quando o relevo está desligado, o plano volta a ser o chão normal.

> [!important] `update()` é debounced (60ms)
> Arrastar um slider dispara muitos `update()` por segundo. Regenerar o heightfield (até 256² vértices) a cada tick travaria a UI — por isso `update()` é **debounced em 60ms**.

**Constantes** (em [[scene-config#terrainConfig.ts|terrainConfig.ts]]): `TERRAIN_SEGMENT_OPTIONS` (`[64,96,128,192,256]`, opções do select de resolução), `TERRAIN_CITY_PADDING`, `TERRAIN_TRANSITION` (largura MÍNIMA do degradê, cresce com a altura), `TERRAIN_GROUND_Y` (−0.02, nível plano do chão único). `size`/`segments` são campos de [[scene-types#TerrainSettings]].

> [!important] Não aparece no reflexo dos edifícios
> O [[scene-runtime|runtime]] esconde `terrainRig.mesh` (`visible=false`) durante a captura do cube envMap. Sem isso, o verde do relevo vazaria nas fachadas refletivas. O plano cinza embaixo ainda entra no reflexo (chão neutro).

> [!note] Colinas recuam quando a cidade cresce
> O runtime chama `setCityRadius(donationManager.getCityRadius())` a cada doação/mudança de quadra. Raio maior → zona plana maior → anel de colinas recua. `setCityRadius` só recalcula a malha quando o raio muda de fato (ganho de anel).

**Quando mexer aqui:**
- Ajustar a pipeline do ruído (fbm/ridge/falhas/terraços/suavização)
- Mudar como `segments`/`size` realocam a malha ou a largura da rampa de transição
- Trocar o esquema de cores (hoje base do chão → gradiente verde de 2 paradas)
- Ajustar o debounce de `update()`

---

### `createLightingRig.ts`

Cria e atualiza a luz da cena.

**Responsabilidades:**
- Criar `AmbientLight` (cor + intensidade via [[scene-utils#lighting.ts|getLightMetrics]])
- Atualizar cor e intensidade no `update(lightSettings)`
- Remover a luz no `dispose`

**Retorna:** objeto `LightingRig` com `ambient`, `update` e `dispose`.

> [!note] Só ambient + IBL
> Iluminação da cena = `AmbientLight` + `scene.environment` (PMREM do HDRI). **Não há DirectionalLight nem sombras** — campos `directional*`/`hemisphere*` de [[scene-types#LightSettings]] alimentam apenas as métricas exibidas no painel (`getLightMetrics`).

**Quando mexer aqui:**
- Adicionar novo tipo de luz (pré-requisito pra reintroduzir sombras)
- Alterar como a intensidade ambiente é calculada

---

### `loadEnvironment.ts`

Carrega e configura o ambiente HDRI/skybox.

**Responsabilidades:**
- Carregar textura HDRI de `src/assets/environment/DaySkyHDRI040B_4K_TONEMAPPED.jpg`
- Cachear imagem (2.9MB) no Cache API do browser via `resolveEnvUrl` → 2ª visita lê do cache local, sem rede
- Criar esfera invertida como background (permite offset UV uniforme em todas as direções)
- Gerar `PMREMGenerator` para `scene.environment` (iluminação PBR dos prédios)
- Expor `updateSettings` para rotacionar/deslocar o skybox
- Expor `updatePosition` para seguir a câmera
- Limpar meshes, geometria e material no `dispose`

**Retorna:** objeto `EnvironmentUpdater` com métodos `updateSettings`, `updatePosition` e `dispose`.

> [!note] Técnica da esfera invertida
> Usar `THREE.BackSide` em uma `SphereGeometry` grande permite deslocar o horizonte via `texture.offset.y` de forma uniforme em todas as direções — ao contrário de `scene.background` com equirectangular direta.

> [!tip] Cache persistente
> `resolveEnvUrl` abre cache `cidoa-env-v1`, grava blob na 1ª visita, devolve object URL nas seguintes (revogado após decode). Fallback: URL original se Cache API ausente ou fetch falhar. Imagem fica em `src/assets` (não `public/`) — Vite content-hasheia o nome, ideal pra cache-bust HTTP. **Bump versão do cache se trocar a imagem.**

> [!note] Sem `texture.needsUpdate` no updateSettings
> `offset`/rotação são uniforms — `needsUpdate = true` re-enviava a textura 4K inteira à GPU a cada movimento de slider. Removido.

**Quando mexer aqui:**
- Trocar o arquivo HDRI (bump `ENV_CACHE_NAME` pra invalidar cache antigo)
- Alterar como o skybox responde ao offset de ambiente
- Mudar a geração do `scene.environment`

---

### `createHorizonSilhouette.ts`

Fileira fake de 260 prédios (`InstancedMesh` de `BoxGeometry` + `MeshBasicMaterial`) que segue a câmera à distância configurada — fecha o horizonte sem custo de cidade real. `frustumCulled = false` (posicionada relativa à câmera).

> [!note] Skip com câmera parada
> `update(camera)` só reescreve as 260 matrizes de instância (+ upload de buffer) quando o `cameraShift` derivado de posição/yaw mudou. Câmera parada = zero trabalho por frame.

---

### `createHologramMesh.ts`

Holograma cyberpunk acima do prédio: 1 plano + `ShaderMaterial` (uTime, aberração cromática, glitch). Suporta imagem estática e GIF animado (`ImageDecoder` → frames em canvas).

> [!note] Cap de resolução de GIF
> Canvas do GIF limitado a **512px** no maior lado — GIF grande viraria upload de textura gigante a cada frame. `tickHologram` só roda para hologramas visíveis (culling por distância do manager).

### `createRooftopMesh.ts`

Factory para acessórios de topo dos edifícios. Chamado pelo [[scene-managers|DonationManager]] quando o usuário personaliza um edifício via [[html-components#BuildingCustomizePanel.tsx|BuildingCustomizePanel]].

**Opção disponível:**

| Tipo | Geometria | Materiais | Descrição |
|---|---|---|---|
| `spotlights` | `CylinderGeometry` × 3 + `CircleGeometry` × 1 compartilhadas pelo módulo | `SPOTLIGHT_HOUSING_MATERIAL` + `SPOTLIGHT_LENS_MATERIAL` + `SPOTLIGHT_BEAM_MATERIAL` compartilhados | 4 holofotes nos cantos (±0.35, ±0.35) — base (0.08r) + corpo cônico (0.04–0.07r, 0.12h) + lente emissiva amarela + feixe cônico (0.22r, 10.0h) com vertex alpha gradiente (opaco na fonte, desvanece no topo via curva quadrática). Não cria luzes reais por edifício. |
| `helipad` | `CylinderGeometry`, `TorusGeometry`, `RingGeometry`, `BoxGeometry` e pequenos cilindros compartilhados | Materiais de concreto escuro, aro metálico, pintura branca e lentes verdes emissivas | Heliponto proporcional ao topo do edifício, com base circular baixa, aro metálico, anel externo pintado, “H” central limpo, 12 luzes verdes de perímetro e escotilha técnica discreta. Não cria luzes reais por edifício. |
| `garden` | `BoxGeometry`, `CylinderGeometry`, `SphereGeometry`, `PlaneGeometry` e instancing para vegetação | Materiais compartilhados de deck, solo, vegetação, água, madeira e luzes quentes | Jardim suspenso proporcional ao topo com deck, canteiros, piscina, banco, pérgola, arbustos, pequenas árvores e guarda-corpo. |
| `helicopter` | `SphereGeometry`, geometria custom de casco da cabine e painéis de vidro, `BoxGeometry`, `CylinderGeometry`, `CircleGeometry` e pequena esfera compartilhadas | Materiais de fuselagem metálica escura, vidro físico translúcido, acabamento claro, rotores, disco de rotor sutil, esquis e luz emissiva | Helicóptero leve simplificado e realista pousado no topo: fuselagem elipsoidal, cabine modelada como cockpit real com casco opaco afunilado no nariz, barriga achatada, laterais menos ovais, para-brisa frontal dividido e vidros laterais/traseiros como painéis trapezoidais escuros presos diretamente ao `cabinHull`, em coordenadas locais do casco, com pequeno offset externo para evitar z-fighting. Mantém carenagem de motor, boom de cauda, estabilizadores, rotor principal de 3 pás, rotor traseiro lateral, esquis tubulares e luz frontal. O tamanho é calculado pelo footprint do edifício. |

**Recursos compartilhados (estáticos de módulo):**

| Material | Cor | Roughness | Metalness | Extra |
|---|---|---|---|---|
| `SPOTLIGHT_HOUSING_MATERIAL` | `#222222` | 0.4 | 0.6 | Corpo escuro do holofote |
| `SPOTLIGHT_LENS_MATERIAL` | `#ffffcc` | 0.1 | 0.0 | `emissive: #ffffaa`, `emissiveIntensity: 2.5` — lente amarela brilhante |
| `SPOTLIGHT_BEAM_MATERIAL` | `#ffffdd` | — | — | `emissive: #ffffaa`, `emissiveIntensity: 1.25`, `vertexColors: true`, `transparent`, `DoubleSide`, `depthWrite: false` — feixe com alpha gradiente via vertex colors (curva quadrática: fonte opaca → topo transparente) |
| `HELIPAD_DECK_MATERIAL` | `#2f3436` | 0.88 | 0.04 | Base circular escura e fosca |
| `HELIPAD_RIM_MATERIAL` | `#3f4548` | 0.62 | 0.42 | Aro metálico baixo |
| `HELIPAD_PAINT_MATERIAL` | `#e8edf1` | 0.78 | 0.0 | Pintura branca dos anéis e do “H” |
| `HELIPAD_GREEN_LENS_MATERIAL` | `#bfffee` | 0.18 | 0.0 | Lentes verdes emissivas de perímetro |
| `HELICOPTER_BODY_MATERIAL` | `#1f272c` | 0.44 | 0.46 | Fuselagem escura com acabamento metálico discreto |
| `HELICOPTER_CABIN_MATERIAL` | `#8fb7c9` | 0.04 | 0.0 | Material translúcido legado usado apenas se uma superfície de canopy voltar a ser necessária |
| `HELICOPTER_WINDOW_MATERIAL` | `#203843` | 0.18 | 0.0 | Painéis finos `DoubleSide` do para-brisa frontal, janelas laterais e janelas traseiras da cabine, com `depthWrite: false` e `polygonOffset` |
| `HELICOPTER_TRIM_MATERIAL` | `#c7d0d3` | 0.36 | 0.42 | Faixa inferior e estabilizador claro |
| `HELICOPTER_ROTOR_MATERIAL` | `#111416` | 0.38 | 0.72 | Pás e rotor traseiro escuros e metálicos |
| `HELICOPTER_ROTOR_BLUR_MATERIAL` | `#dde8ee` | — | — | `MeshBasicMaterial` translúcido para sugerir disco de rotor em movimento |
| `HELICOPTER_SKID_MATERIAL` | `#4e565b` | 0.42 | 0.74 | Esquis, mastros e hub |

As geometrias de base, corpo, lente e feixe também são compartilhadas. `disposeRooftopMesh()` apenas libera as referências do grupo; o descarte de GPU dos recursos compartilhados acontece no dispose final.

**API:**
```typescript
createRooftopMesh(type: RooftopType, footprint?: { width: number; depth: number }): THREE.Group | null  // null se "none"
disposeRooftopMesh(group: THREE.Group): void               // limpa referências do grupo + buffers de instância
disposeRooftopSharedResources(): void                       // limpa geometrias e materiais compartilhados
```

> [!note] Otimizações de custo
> Helipad: deck/aro/anel com **32 segmentos** (era 96 — invisível nesse raio) e as 12 luzes de perímetro são **2 `InstancedMesh`** (base + lente), não 24 meshes. Água do jardim, cabine e janelas do helicóptero usam `MeshStandardMaterial` — `MeshPhysicalMaterial` com `transmission > 0` disparava um render extra da cena inteira (transmission pass).

---

### `createSignMesh.ts`

Factory para letreiros de fachada nos edifícios. Renderiza texto via `CanvasTexture` em um plano fino com material emissivo (estilo LED corporativo). Chamado pelo [[scene-managers|DonationManager]] quando o usuário digita um texto no [[html-components#BuildingCustomizePanel.tsx|BuildingCustomizePanel]].

**Características visuais:**

| Elemento | Descrição |
|---|---|
| **Fundo** | Painel escuro `rgba(8,10,16,0.88)` com cantos arredondados (8px) e borda fina `rgba(255,255,255,0.08)` |
| **Texto** | Fonte `600` (semi-bold), família Inter/Segoe UI/Helvetica, cor `#e8ecf4` |
| **Glow LED** | `shadowBlur: 12`, cor `rgba(200,220,255,0.6)` — simula sinalização LED retroiluminada |
| **Material da placa** | `MeshStandardMaterial` com `emissiveIntensity: 0.4`, `roughness: 0.35`, `metalness: 0.6` |
| **Backing plate** | `BoxGeometry` metálico escuro `#1a1c22` (`roughness: 0.7`, `metalness: 0.5`) |
| **Posição Y** | `buildingH * 0.45` acima do centro = ~95% da altura do edifício (bem perto do topo) |

**Lados (parâmetro `sides` 1–4):**

| Valor | Fachadas | Rotação da normal do plano |
|---|---|---|
| 1 | Frente (+Z) | `rotY = 0` |
| 2 | +Trás (−Z) | `rotY = π` |
| 3 | +Direita (+X) | `rotY = +π/2` |
| 4 | +Esquerda (−X) | `rotY = −π/2` |

Painéis (canvas + textura + materiais + geometrias) são **cacheados por largura da face**: faces opostas têm placa idêntica e compartilham a mesma `CanvasTexture` — antes eram até 4 rasterizações/texturas duplicadas por letreiro. A largura do letreiro se adapta à largura da fachada correspondente (`buildingW` para frente/trás, `buildingD` para laterais). A altura é consistente em todos os lados: `max(buildingW, buildingD) * 0.22`.

> [!note] Ajuste automático de fonte
> O fontSize começa em 52% da altura do canvas e é reduzido pixel a pixel até o texto caber com 12% de padding lateral. Limite máximo: 30 caracteres (imposto pelo UI).

**API:**
```typescript
createSignMesh(text: string, buildingW: number, buildingD: number, buildingH: number, sides: number, shape?: BuildingShape): THREE.Group | null
disposeSignMesh(group: THREE.Group): void  // limpa texturas, materiais e geometrias (painéis únicos + struts)
```

> [!note] Acompanhamento de torção (`shape: "twisted"`)
> Na altura do letreiro (~95% do prédio) a fachada já rodou ~85,5° em relação à base — uma placa axis-aligned ficaria parcialmente dentro do edifício, daí o "letreiro cortado". Para `shape === "twisted"`, o builder calcula `angle = (yOffset / buildingH + 0.5) · TWIST_TOTAL_ANGLE` e:
> - rotaciona o ponto de attach em **unit-space** (`x' = x·cos − z·sin`, `z' = x·sin + z·cos`) antes de aplicar o `mesh.scale` — necessário porque a geometria torcida também é deformada antes do scale e width ≠ depth troca os eixos se invertido;
> - calcula a **normal verdadeira em world-space** via inversa transposta da escala não-uniforme: `(n_unit.x/W, n_unit.z/D)` re-normalizada. Usar o vetor de posição como direção (que parece a normal mas não é, sob escala não-uniforme) deixa o plano levemente desalinhado e uma das pontas do letreiro entra na fachada;
> - aplica `mesh.rotation.y = atan2(wnx, wnz)` para alinhar o plano à tangente da face na altura do letreiro;
> - empurra a placa por **0,10** (vs 0,02 no caminho default) ao longo da normal world — margem maior porque a fachada é curva e a placa é flat: ao longo de `signH` a fachada gira mais alguns graus e os cantos superior/inferior do plano ainda poderiam cortar a face com offset menor;
> - recalcula `signW` para a largura world real da face torcida — `sqrt((W·cos)² + (D·sin)²)` para frente/trás, `sqrt((W·sin)² + (D·cos)²)` para laterais — evitando que o letreiro extrapole os cantos da face quando a torção mistura os eixos.

> [!note] Reconstrução em rebuildInstances
> O `DonationManager` guarda `{group, text, sides}` por edifício e o `syncSigns` chama `setSign` em snapshot — assim, mudanças de altura (rebalanceamento de doações) ou shape (default ↔ twisted) regeneram os letreiros com os parâmetros atuais. Sem isso o letreiro ficaria com `yOffset`/`signH`/orientação obsoletos.

---

### `createEdgeLightMesh.ts`

Factory para o efeito de **LED nas arestas** do edifício — 4 arestas verticais nos cantos (chão → topo) + 4 arestas no topo formando um retângulo. Chamado pelo [[scene-managers|DonationManager]] quando o usuário escolhe a opção LED no [[html-components#BuildingCustomizePanel.tsx|BuildingCustomizePanel]].

**Estrutura (3 `InstancedMesh` por grupo):**

Os segmentos de aresta são coletados como `SegmentSpec` (posição + quaternion + comprimento) e desenhados por **3 `InstancedMesh`** — core, halo e haloOuter — com uma instância por segmento. Resultado: **3 draw calls por LED**, independente do número de segmentos (torre twisted: antes 156 meshes, agora 3 draws).

| Camada | Material | Função visual |
|---|---|---|
| **Core** | `MeshStandardMaterial` com `emissive` | Linha sólida emissiva — o "filamento" do LED |
| **Halo** | `MeshBasicMaterial`, `transparent`, `AdditiveBlending`, `vertexColors` (alpha gradiente), `depthWrite: false` | Brilho próximo |
| **Halo externo** | mesmo material, opacidade menor, escala 3.4× | Glow difuso simulando bloom sem pós-processamento |

Uma única geometria de halo (gradiente nas seções locais X/Z, eixo dominante Y) serve pra qualquer direção de aresta — a orientação vem do quaternion da instância. `depthWrite: false` evita que halos se cancelem entre si; `depthTest` permanece ativo para que o brilho seja oclusionado pelo edifício (não atravessa a fachada).

**Layout (relativo à base do edifício, local Y=0 = chão):**

| Posição | Quantidade | Eixo |
|---|---|---|
| Cantos `(±W/2, Y=0..H, ±D/2)` | 4 | Y (vertical) |
| Topo frente/trás `(0, H+0.05, ±D/2)` | 2 | X |
| Topo laterais `(±W/2, H+0.05, 0)` | 2 | Z |

O lift de `0.05` no topo evita z-fighting com `helipad` e holofotes existentes.

**Materiais clonados por edifício:** cada `Group` cria seus próprios `core`/`halo`/`haloOuter` materials (guardados em `userData.edgeLightMaterials`). Geometrias (`BoxGeometry` do core + halo com gradiente) são compartilhadas no módulo.

**Posicionamento no DonationManager:** o grupo é colocado em `(donationX, donationY − scale.y/2, donationZ)` — ou seja, na **base** do edifício, não no topo. Quando uma nova doação rebalanceia alturas, o `syncEdgeLights` reconstrói os grupos existentes (preservando type) com as novas dimensões.

> [!warning] Sem PointLight por aresta
> O efeito é puramente material/emissivo. Adicionar luzes reais por aresta seria O(N × 12) e estouraria limites de uniforms da GPU rapidamente.

**API:**
```typescript
createEdgeLightMesh(type: EdgeLightType, footprint: { width: number; depth: number; height: number }, shape?: BuildingShape): THREE.Group | null
disposeEdgeLightMesh(group: THREE.Group): void                      // libera materiais clonados + buffers de instância
disposeEdgeLightSharedResources(): void                             // libera geometrias compartilhadas
```

> [!note] Acompanhamento de torção (`shape: "twisted"`)
> Quando o edifício é torcido, o LED não pode ser uma única caixa axis-aligned — ela ficaria reta enquanto a fachada espirala. Para `shape === "twisted"`, cada aresta vertical é segmentada em `LED_TWIST_SEGMENTS = 12` pedaços curtos; cada segmento é orientado via quaternion (`setFromUnitVectors(Y, dir)`) para alinhar à tangente da curva torcida. O retângulo do topo também é rotacionado pelo `TWIST_TOTAL_ANGLE` total (importado de [[scene-builders#createTwistedBuildingMesh.ts|createTwistedBuildingMesh]]). Com instancing, mais segmentos custam só matrizes extras — draw calls continuam 3.

---

### `createTwistedBuildingMesh.ts`

Cria um `THREE.Mesh` com geometria torcida (estilo **Cayan Tower**) para edifícios com `BuildingShape === "twisted"`.

**Responsabilidades:**
- Construir uma `BoxGeometry(1, 1, 1, 1, 24, 1)` e aplicar deformação no CPU: cada vértice `(x, y, z)` é rotacionado no plano XZ por ângulo `(y + 0.5) * (π/2)`, gerando 90° de twist do chão ao topo
- **Snapshot pré-twist** das posições e normais axis-aligned em atributos customizados `aProjPosition` e `aProjNormal` (consumidos pelo shader triplanar do [[scene-managers|DonationManager]] para evitar costura no meio do prédio)
- Recomputar normais via `geometry.computeVertexNormals()` (lighting usa as normais twisted; só a projeção da textura usa `aProjNormal`)
- Reaplicar mapeamento de `materialIndex` (topo → 1, demais → 0) idêntico à geometria base, para manter o split entre `facadeMaterial` e `topMaterial`
- Compartilhar a `BufferGeometry` entre todos os prédios torcidos (escala via `mesh.scale`)

> [!note] Por que `aProjPosition`/`aProjNormal`?
> O shader triplanar escolhe a projeção (XY/ZY/XZ) com base no eixo dominante da normal e usa a posição mundo para o UV. Com a normal twisted, a fronteira entre projeções é cruzada no meio da altura (≈45° de torção) — visível como uma costura. Usando os valores axis-aligned **pré-twist**, cada face mantém uma única projeção do chão ao topo e a textura "acompanha" a deformação da geometria sem corte. A geometria base (não torcida) também declara esses atributos como cópias diretas de `position`/`normal`, então o shader é unificado.

**Quando mexer aqui:**
- Ajustar o ângulo total de twist (atual: 90°)
- Aumentar/reduzir `TWIST_HEIGHT_SEGMENTS` (qualidade vs custo)
- Adicionar variantes de torção (sentido inverso, twist parcial, etc)

**API:**
```typescript
createTwistedBuildingMesh(facadeMaterial: THREE.Material, topMaterial: THREE.Material): THREE.Mesh
disposeTwistedBuildingSharedResources(): void  // libera a BoxGeometry torcida compartilhada
```

> [!note] Materiais não são criados aqui
> O caller (DonationManager) clona `facadeMaterial`/`topMaterial` por edifício para suportar cor individual, e passa esses clones aqui. A geometria é compartilhada; os materiais não.

> [!important] Mesh único, não Instanced
> Twisted towers são desenhadas como `Mesh` separadas, fora do `InstancedMesh`. Para isso, o `DonationManager` mantém `customShapeMeshes: Map<donationId, {mesh, facadeMat, topMat, shape}>` e pula a alocação de slot no InstancedMesh para essas doações.

---

### `createOctagonalBuildingMesh.ts`

Cria um `THREE.Mesh` com planta octogonal regular para edifícios com `BuildingShape === "octagonal"`.

**Responsabilidades:**
- Construir manualmente uma `BufferGeometry` unitária centralizada em `1×1×1`, com 8 faces laterais, tampa superior octogonal e face inferior
- Manter `materialIndex = 1` somente no topo, preservando o split `facadeMaterial`/`topMaterial` usado pelo prédio padrão
- Declarar `aProjPosition` e `aProjNormal` para o shader triplanar do [[scene-managers|DonationManager]]
- Usar normais de projeção cardinalizadas nas faces diagonais, evitando ambiguidade no branch `XY/ZY/XZ` do shader e mantendo a textura estável
- Compartilhar a `BufferGeometry` entre todos os prédios octogonais

> [!note] Textura triplanar
> A torre octogonal não deforma uma caixa como a torcida, mas ainda precisa fornecer `aProjPosition`/`aProjNormal`. Nas faces diagonais, a normal geométrica tem componentes X/Z parecidas; por isso o builder grava uma normal de projeção cardinal, escolhendo um eixo dominante determinístico para evitar alternância de projeção.

**API:**
```typescript
createOctagonalBuildingMesh(facadeMaterial: THREE.Material, topMaterial: THREE.Material): THREE.Mesh
disposeOctagonalBuildingSharedResources(): void
getOctagonalFootprintPoints(width?: number, depth?: number): Array<{ x: number; z: number }>
OCTAGON_FLAT_SIDE_RATIO: number
```

> [!note] Acessórios
> `createSignMesh` usa `OCTAGON_FLAT_SIDE_RATIO` para reduzir o letreiro às faces planas centrais. `createEdgeLightMesh` usa `getOctagonalFootprintPoints` para criar 8 arestas verticais e 8 segmentos no topo, alinhados à planta octogonal.

---

### `createSetbackBuildingMesh.ts`

Cria um `THREE.Mesh` com três patamares recuados para edifícios com `BuildingShape === "setback"`.

**Responsabilidades:**
- Construir manualmente uma `BufferGeometry` unitária centralizada em `1×1×1`, com base cheia, corpo intermediário recuado e topo mais estreito
- Gerar faces laterais verticais para cada patamar e lajes horizontais expostas nos recuos
- Manter `materialIndex = 0` nas fachadas e `materialIndex = 1` nas lajes/topo, preservando o split `facadeMaterial`/`topMaterial`
- Declarar `aProjPosition` e `aProjNormal` em todas as faces para o shader triplanar do [[scene-managers|DonationManager]]
- Compartilhar a `BufferGeometry` entre todos os prédios setback

> [!note] Textura triplanar
> A torre setback não torce os vértices, então não precisa de snapshot pré-deformação como a torcida. Ainda assim, o builder grava `aProjPosition`/`aProjNormal` explicitamente: laterais usam normais cardinais (`±X`/`±Z`) e lajes usam `+Y`, mantendo a seleção de projeção do shader estável em cada face.

**API:**
```typescript
createSetbackBuildingMesh(facadeMaterial: THREE.Material, topMaterial: THREE.Material): THREE.Mesh
disposeSetbackBuildingSharedResources(): void
getSetbackFootprintScaleAtHeightRatio(heightRatio: number): number
getSetbackTierFootprints(width?: number, depth?: number, height?: number): SetbackTierFootprint[]
```

> [!note] Acessórios
> `createSignMesh` usa `getSetbackFootprintScaleAtHeightRatio` para posicionar o letreiro no patamar correto perto do topo. `createEdgeLightMesh` usa `getSetbackTierFootprints` para criar LEDs verticais e contornos horizontais em cada nível recuado.

---

### `createHearstBuildingMesh.ts`

Cria um `THREE.Mesh` com torre facetada e diagrid inspirada na **Hearst Tower** para edifícios com `BuildingShape === "hearst"`.

**Responsabilidades:**
- Construir uma `BufferGeometry` unitária centralizada em `1×1×1`, com planta octogonal chanfrada e anéis alternando chanfragem rasa/profunda
- Gerar a malha principal da fachada com `facadeMaterial` e a tampa/diagrid com `topMaterial`, preservando o contrato de textura PBR do manager
- Recriar o diagrid da referência como cilindros embutidos na mesma geometria compartilhada, sem portar câmera/luzes/cena
- Declarar `aProjPosition` e `aProjNormal` em todas as partes para o shader triplanar
- Exportar helpers usados por letreiros e LEDs para acompanhar a planta facetada

**API:**
```typescript
createHearstBuildingMesh(facadeMaterial: THREE.Material, topMaterial: THREE.Material): THREE.Mesh
disposeHearstBuildingSharedResources(): void
getHearstRingFootprintPoints(width?: number, depth?: number, ringIndex?: number): Array<{ x: number; z: number }>
getHearstFaceSpanRatio(axis: "x" | "z", heightRatio: number): number
HEARST_RING_COUNT: number
```

> [!note] Acessórios
> `createSignMesh` reduz a largura do letreiro conforme a face reta da Hearst na altura de instalação. `createEdgeLightMesh` segmenta as arestas verticais pelos mesmos anéis da torre e contorna o topo chanfrado.

---

### `createEmpireBuildingMesh.ts`

Cria um `THREE.Mesh` com volumetria inspirada no **Empire State Building** para edifícios com `BuildingShape === "empire"`.

**Responsabilidades:**
- Construir uma `BufferGeometry` unitária centralizada em `1×1×1`, usando apenas a criação do edifício do protótipo `EmpireState.md`
- Recriar base larga, eixo vertical, setbacks, coroa, mastros, janelas e pilastras como uma geometria compartilhada
- Usar materiais próprios sem texturas PBR; o `DonationManager` marca os materiais como textureless para impedir aplicação de mapas
- Declarar `aProjPosition` e `aProjNormal` para manter compatibilidade com o shader triplanar do manager
- Exportar helpers usados por letreiros e LEDs para acompanhar os recuos principais

**API:**
```typescript
createEmpireBuildingMesh(facadeMaterial: THREE.Material, roofMaterial: THREE.Material): THREE.Mesh
disposeEmpireBuildingSharedResources(): void
setEmpireBuildingMeshColor(mesh: THREE.Mesh, color: string): void
getEmpireFootprintScaleAtHeightRatio(heightRatio: number): { x: number; z: number }
getEmpireTierFootprints(width?: number, depth?: number, height?: number): EmpireTierFootprint[]
```

---

### `createTaipeiBuildingMesh.ts`

Cria um `THREE.Mesh` com volumetria inspirada no **Taipei 101** para edifícios com `BuildingShape === "taipei"`.

**Responsabilidades:**
- Construir uma `BufferGeometry` unitária centralizada em `1×1×1`, usando apenas a criação do edifício do protótipo `taipei.md`
- Recriar base, módulos empilhados chanfrados, beirais, detalhes de quina, coroa e pináculo como geometria compartilhada
- Usar os materiais `facadeMaterial` e `topMaterial` recebidos do `DonationManager`, preservando as texturas PBR e o controle de cor/tiling do projeto
- Declarar `aProjPosition` e `aProjNormal` em todas as partes para manter compatibilidade com o shader triplanar
- Exportar helpers usados por letreiros e LEDs para acompanhar o corpo principal e os níveis do topo

**API:**
```typescript
createTaipeiBuildingMesh(facadeMaterial: THREE.Material, topMaterial: THREE.Material): THREE.Mesh
disposeTaipeiBuildingSharedResources(): void
getTaipeiFootprintScaleAtHeightRatio(heightRatio: number): number
getTaipeiTierFootprints(width?: number, depth?: number, height?: number): TaipeiTierFootprint[]
TAIPEI_SIGN_Y_OFFSET_RATIO: number
```

---

### `createOneTradeBuildingMesh.ts`

Cria um `THREE.Mesh` para o modelo **One Trade**.

**Responsabilidades:**
- Construir uma `BufferGeometry` unitária centralizada em `1×1×1`, usando apenas a criação do edifício do protótipo `One_World_Trade.md`
- Recriar base chanfrada, torre facetada afunilada, ribs verticais, faixas horizontais, parapeto e pináculo como geometria compartilhada
- Usar os materiais `facadeMaterial` e `topMaterial` recebidos do `DonationManager`, preservando as texturas PBR padrão do sistema
- Declarar `aProjPosition` e `aProjNormal` em todas as partes para manter compatibilidade com o shader triplanar
- Exportar helpers usados por letreiros e LEDs para acompanhar a largura efetiva do corpo principal

**API:**
```typescript
createOneTradeBuildingMesh(facadeMaterial: THREE.Material, topMaterial: THREE.Material): THREE.Mesh
disposeOneTradeBuildingSharedResources(): void
getOneTradeFootprintScaleAtHeightRatio(heightRatio: number): number
getOneTradeTierFootprints(width?: number, depth?: number, height?: number): OneTradeTierFootprint[]
getOneTradeLedFootprintRings(width?: number, depth?: number, height?: number): OneTradeLedFootprintRing[]
ONE_TRADE_SIGN_Y_OFFSET_RATIO: number
```

---

## O que Builders NÃO Fazem

Builders não decidem:
- Quando a animação roda → [[scene-runtime]]
- Quando os chunks são sincronizados → [[scene-managers]]
- Quando a câmera disparou refresh → [[scene-runtime]]

Essas decisões ficam no runtime e nos managers.
