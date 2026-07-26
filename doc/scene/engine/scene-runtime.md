---
title: Scene Runtime
tags:
  - cidoa
  - runtime
  - threejs
  - orquestrador
aliases:
  - Runtime
  - createCitySceneRuntime
---

# Scene Runtime

O orquestrador da cena 3D: `src/scene/runtime/createCitySceneRuntime.ts`.

> [!abstract] Analogia
> Se o projeto fosse uma orquestra:
> - `config` → a partitura com valores
> - `builders` → os instrumentos montados
> - `managers` → os grupos especializados
> - `runtime` → **o maestro**

## Responsabilidades

O runtime:
- Cria `scene`, `camera`, `renderer` e `OrbitControls`
- Chama os [[scene-builders|builders]]
- Chama os [[scene-managers|managers]]
- Roda o loop de animação
- Escuta eventos de `resize`
- Faz `dispose` completo no final

## Fluxo Interno

### 1. Inicialização

```
createCitySceneRuntime({mount, settings...})
  ├── runDevAssertionsOnce()
  ├── THREE.Scene (background, FogExp2)
  ├── THREE.PerspectiveCamera
  ├── THREE.WebGLRenderer (ACES filmic, powerPreference "high-performance")
  ├── OrbitControls
  ├── loadEnvironment()       ← builder de HDRI
  ├── createLightingRig()     ← builder de luzes
  ├── createGroundPlane()     ← builder do chão
  ├── createTerrain()         ← builder do relevo (terrainRig)
  ├── WebGLCubeRenderTarget   ← envMap dinâmico dos prédios (256px)
  ├── CubeCamera              ← probe fixo no centro da cidade (y = ENV_PROBE_HEIGHT)
  └── createDonationManager() ← manager principal (recebe blockLayoutSettings)
```

### 2. Loop de Animação (`animate`)

A cada frame:

1. `controls.update()` — aplica damping do OrbitControls
2. `groundPlane.setPosition(camera.x, camera.z)` — chão segue a câmera
3. `environmentUpdater.updatePosition(...)` — skybox segue a câmera
4. **Métricas de FPS** — acumula e suaviza a cada 0.5s
5. **Resolução dinâmica** — ajusta `renderScale` para atingir `targetFps`
6. **CubeCamera** — captura reflexos só quando `cubeDirty` (cena mudou via `add*/update*`, asset assíncrono chegou, ou o cull de distância escondeu/devolveu prédio), no máximo a cada `updateInterval` frames (4 no padrão). Render target de `resolution` px (256 no padrão). Ver [[#Probe de reflexo (envMap dos prédios)]].
7. **Culling de acessórios** — a cada 0.25s chama `donationManager.updateAccessoryVisibility(camera.position)`: letreiro, LED, topo e holograma somem além de 80 unidades (fog já os apaga; só a silhueta do prédio importa)
8. `renderer.render(scene, camera)` — renderiza o frame

#### Resolução Dinâmica

```
FPS < targetFps - 8  → renderScale -= 0.05 (reduz qualidade)
FPS > targetFps + 5  → renderScale += 0.025 (aumenta qualidade)
```

O `renderScale` é multiplicado pelo `devicePixelRatio` (limitado pelo `dprCap`).

### 3. Atualizações do React

O runtime expõe métodos públicos chamados pelo [[scene-hooks|useCityScene]]:

```typescript
type CitySceneRuntime = {
  // Configurações da cena
  updateBuildingSettings(settings: BuildingSettings): void
  updateTextureSettings(settings: TextureSettings): void
  updateGroundSettings(settings: GroundSettings): void
  updateLightSettings(settings: LightSettings): void
  updateHorizonSettings(settings: HorizonSettings): void // distance também controla camera.far (+2) — alcance de renderização dos prédios
  updateEnvironmentSettings(settings: EnvironmentSettings): void
  updateReflectionSettings(settings: ReflectionSettings): void // probe do envMap; resolution recria o cube target
  updateBlockLayout(settings: BlockLayoutSettings): void
  updateTerrainSettings(settings: TerrainSettings): void

  // Doações
  addDonation(value: number): void
  addDonations(values: number[]): void
  setDonations(entries: { id: number; value: number }[]): void  // replace-all do backend

  // Personalização individual
  updateDonationCustomization(donationId: number, customization: BuildingCustomization): void
  focusOnDonation(donationId: number): void  // destaque visual no edifício
  clearFocus(): void                          // remove destaque

  dispose(): void
}
```

> [!note] setDonations
> Replace-all do snapshot do backend ([[donation-api]]). Chama `donationManager.setDonations(entries)`, depois `syncTerrainToCity()` (relevo reabre a zona plana pro novo raio), `emitStatsPatch({ buildings })` (contador do painel) e `markCubeDirty()` (força recaptura do envMap). Ver [[scene-managers#setDonations]].

> [!note] Evento de clique em edifícios
> O runtime escuta `pointerdown`/`pointerup` no canvas. Se o cursor não se moveu mais de 5px (não é drag), faz raycast para identificar o edifício clicado e chama `onBuildingClick(donationId)` para o React abrir o painel de personalização.

> [!note] Sistema de foco
> `focusOnDonation` delega para `donationManager.setFocusedDonation(id)`, que deixa toda a cidade semitransparente e cria um mesh isolado do edifício selecionado. `clearFocus` restaura a opacidade original.
>
> Zoom aproxima **a partir da direção atual da câmera** — dolly ao longo da linha de visão até `FOCUS_DISTANCE` do topo do prédio, sem girar em volta. Antes usava offset fixo `(6,5,6)`, que fazia a câmera saltar sempre pro mesmo lado (movimento estranho quando vinha do lado oposto). `cameraAnim` interpola pos+target com ease-out cubic em `0.8s`. `clearFocus` restaura pos/target salvos.

> [!note] Sem sombras
> Cena não tem luz direcional — iluminação é ambiente + IBL do HDRI. Sistema de sombras (settings, UI, flags `castShadow`) foi removido por ser código morto. Pra reintroduzir: criar `DirectionalLight` com shadow camera antes de qualquer flag.

> [!note] Relevo (terrainRig)
> O runtime possui o `terrainRig` ([[scene-builders#createTerrain.ts]]) — opção `terrainSettings` + método `updateTerrainSettings`. Sincroniza a zona plana via `syncTerrainToCity`, que chama `terrainRig.setCityRadius(donationManager.getCityRadius())` após `addDonation`/`addDonations`/`updateBlockLayout` (toda mudança de doação ou layout de quadra). Cor do chão sincronizada via `terrainRig.setGroundColor` em `updateGroundSettings`. Ver [[scene-managers|getCityRadius]].
>
> **Chão infinito:** o `groundPlane` fica **sempre visível** (`y=−0.05`, abaixo do piso do relevo em `−0.04`) e **segue a câmera** (`setPosition` no loop). Onde há relevo, o terreno cobre; além da borda do relevo (mesh fixo, 700u na origem), o plano preenche o vazio → cidade grande **não tem limite** ao mover a câmera. Fica sempre abaixo do terreno → **sem z-fighting** (antes o plano era escondido com o relevo ligado, pra não piscar por ficar acima). Na **captura do cube envMap** relevo e plano cinza são ocultados por um frame (`visible = false`; prédios **não refletem** verde nem chão chapado) — o hemisfério de baixo do reflexo fica com céu. Visibilidade restaurada depois. Reversível pelo `includeGround` da aba **reflexo**.

### Probe de reflexo (envMap dos prédios)

Fachada usa o cube do `buildingCubeTarget` como `envMap` (ver [[scene-managers|setEnvMap]]). Probe é **ancorado na cidade** por padrão, não na câmera. Todo knob vem de `ReflectionSettings` — aba **reflexo** do painel ([[html-components#ReflectionControls.tsx]]), defaults em [[scene-config#reflectionConfig.ts]], tipo em [[scene-types#ReflectionSettings]]:

| Campo | Padrão | Efeito no runtime |
|---|---|---|
| `enabled` | `true` | `false` → `setEnvMap(null)` e captura não roda; three.js cai no `scene.environment` (HDRI PMREM), então sobra reflexo difuso do céu — só a **cidade** sai do reflexo |
| `resolution` | `256` | Lado do `WebGLCubeRenderTarget`; trocar **recria** target + `CubeCamera` |
| `probeX/Y/Z` | `0, 18, 0` | Posição da captura (Y sobe = mais céu, desce = mais fachada) |
| `followCamera` | `false` | Probe na câmera; força recaptura todo intervalo |
| `skyDrop` | `0.2` | `offsetY` extra do céu **só na captura** (~36°) |
| `updateInterval` | `4` | Frames entre capturas (`cubeFrameCounter % max(1, n)`) |
| `continuous` | `false` | Recaptura mesmo sem `cubeDirty` |
| `includeGround` | `false` | Mantém plano cinza + relevo na captura |
| `includeCityFloor` | `false` | Mantém asfalto/calçada/lotes (repassado a `beginEnvCapture`) |

`updateReflectionSettings` só paga o custo alto quando precisa: `resolution` diferente → dispose do target antigo, `createCubeProbe(res)`, `setEnvMap` na textura nova; `enabled` diferente → só `setEnvMap`. Resto é troca de variável + `markCubeDirty`.

> [!bug] Por que não na câmera
> Probe na posição da câmera = reflexo só aparecia de lado, em certo ângulo. Motivo: o shader amostra o cube pela direção `reflect()`. Prédio de frente → direção de amostragem sai da câmera pra trás/pra baixo → céu e chão vazios atrás do observador = fachada lisa. Girando a órbita, o cube inteiro escorregava junto → reflexo "surgia" em ângulos específicos. Probe fixo no centro: qualquer ângulo amostra a cidade e a imagem fica estável.

> [!bug] Céu abaixo do horizonte (prédio de frente)
> Espelho vertical visto **de cima** reflete pra **baixo**: `R.y = −V.y`. Câmera 24° acima do prédio → o raio refletido sai 24° abaixo do horizonte, faixa onde só havia chão chapado (plano cinza + asfalto/lote/calçada) e, mais longe, a metade cinza lisa do HDRI. Reflexo sem imagem = fachada parecia opaca de frente. Três coisas põem céu ali:
>
> 1. `groundPlane.mesh.visible = false` na captura (antes era forçado a `true`) — desligável por `includeGround`.
> 2. `donationManager.beginEnvCapture(includeCityFloor)` esconde o piso da cidade (asfalto, calçada, lotes) — ver [[scene-managers#beginEnvCapture]].
> 3. `skyDrop` soma `+0.2` ao `offsetY` do céu **durante a captura** (`updateSettings` → restaurado antes do `renderer.render`): a faixa azul/nuvens/sol desce ~36°, então o raio que aponta pra baixo ainda pega céu de verdade. O fundo da cena não se move — o offset do `EnvironmentSettings` que o usuário controla continua valendo no render normal.
>
> Sobra do prédio pra baixo: telhados e fachadas dos vizinhos, com céu nos vãos. Só em vista quase de topo (>40° abaixo) o reflexo volta a pegar cinza.

Consequências:

- **Órbita não suja o cube.** Girar a câmera daria captura idêntica — o reflexo varia sozinho pelo `reflect()`. `controls` não tem mais listener `change` → `markCubeDirty`. Único vínculo com a câmera é o cull de distância (suja o cube quando o número de prédios ocultos muda). Exceções pagas por escolha do usuário: `followCamera` e `continuous` capturam todo `updateInterval`.
- **Asset assíncrono suja o cube.** `THREE.DefaultLoadingManager.onLoad = markCubeDirty` (+ `markCubeDirty()` no `onLoaded` do [[scene-builders#loadEnvironment.ts|loadEnvironment]]). Obrigatório desde que a órbita parou de sujar: a primeira captura roda no frame 4 e o HDRI (fetch + decode de JPG 4K) só entra na cena muito depois — sem isso o reflexo ficava **sem céu** até alguma outra mudança acontecer. `dispose` limpa o `onLoad`.
- **Céu segue o probe durante a captura.** No render normal a esfera de céu segue a câmera; na captura recebe a posição do probe (`environmentUpdater.updatePosition`) e volta pra câmera antes do `renderer.render` do mesmo frame. Sem isso a esfera (raio 200) ficaria deslocada ou atrás do probe. Chão não precisa: fica oculto (`includeGround = false`).
- **256px, não 128.** Fachada com `roughnessIntensity = 0` é espelho e amostra o mip 0 — em 128px céu e skyline viravam mancha lisa. Custo cabe porque a captura deixou de rodar a cada frame de órbita. `resolution` vai de 64 a 1024 pelo painel; cada passo dobra o custo (6 renders da cena por captura).

> [!tip] Reflexo lavado
> `envMapIntensity` da fachada (4.8 no padrão) multiplica o especular do cube; alto demais + ACES achata o contraste do reflexo até parecer chapado. Baixar o slider revela a imagem refletida. `normalScale = 20` também embaralha a normal por pixel → reflexo cintilante em vez de imagem legível. Sliders nas abas **texturas** e **reflexo** (mesmo `TextureSettings` — intensidade vive no material, não no probe).

### 4. Dispose

Limpeza completa ao desmontar:

```
dispose()
  ├── removeEventListener('mousemove')     ← hover
  ├── removeEventListener('pointerdown')   ← clique (detecção de drag)
  ├── removeEventListener('pointerup')     ← clique (raycast)
  ├── cancelAnimationFrame
  ├── removeEventListener('resize')
  ├── controls.dispose()
  ├── donationManager.dispose()            ← inclui acessórios de topo, signs, focus mesh
  ├── groundPlane.dispose()
  ├── terrainRig.dispose()                 ← relevo procedural
  ├── horizonSilhouette.dispose()
  ├── lightingRig.dispose()
  ├── environmentUpdater.dispose()
  ├── loadedEnvMap?.dispose()
  ├── loadedBgTexture?.dispose()
  ├── buildingCubeTarget.dispose()
  ├── renderer.dispose()
  └── mount.removeChild(renderer.domElement)
```

## Configuração do Renderer

| Propriedade | Valor |
|---|---|
| `outputColorSpace` | `SRGBColorSpace` |
| `toneMapping` | `ACESFilmicToneMapping` |
| `toneMappingExposure` | `1.45` |
| `powerPreference` | `"high-performance"` (força GPU dedicada em laptop híbrido) |

## Por que essa Camada é Importante

Sem o runtime, a lógica ficaria espalhada em componentes React:
- código difícil de ler
- cleanup arriscado
- cena dependente do ciclo de render do React

Com o runtime:
- Three.js fica centralizado
- React só envia estado
- manutenção previsível

## Quando Mexer no Runtime

Mexa aqui quando a mudança envolver **coordenação entre várias partes da cena**:

- Mudar o comportamento do loop principal
- Alterar a regra de refresh da câmera
- Mudar a ordem de criação da cena
- Alterar a estratégia de `dispose`
- Adicionar nova peça que precisa ser sincronizada

## Relações

- Criado por: [[scene-hooks|useCityScene]]
- Usa builders: [[scene-builders]]
- Usa managers: [[scene-managers]]
- Tipos das opções: [[scene-types]]
- Valores de config: [[scene-config]]
