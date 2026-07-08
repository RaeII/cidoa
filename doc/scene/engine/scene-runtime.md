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
  ├── WebGLCubeRenderTarget   ← envMap dinâmico dos prédios
  ├── CubeCamera              ← captura reflexos em tempo real
  └── createDonationManager() ← manager principal (recebe blockLayoutSettings)
```

### 2. Loop de Animação (`animate`)

A cada frame:

1. `controls.update()` — aplica damping do OrbitControls
2. `groundPlane.setPosition(camera.x, camera.z)` — chão segue a câmera
3. `environmentUpdater.updatePosition(...)` — skybox segue a câmera
4. **Métricas de FPS** — acumula e suaviza a cada 0.5s
5. **Resolução dinâmica** — ajusta `renderScale` para atingir `targetFps`
6. **CubeCamera** — captura reflexos só quando `cubeDirty` (câmera moveu — evento `change` do OrbitControls — ou cena mudou via `add*/update*`), no máximo a cada 4 frames. Câmera parada = zero renders extras. Render target de 128px.
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
> **Chão infinito:** o `groundPlane` fica **sempre visível** (`y=−0.05`, abaixo do piso do relevo em `−0.04`) e **segue a câmera** (`setPosition` no loop). Onde há relevo, o terreno cobre; além da borda do relevo (mesh fixo, 700u na origem), o plano preenche o vazio → cidade grande **não tem limite** ao mover a câmera. Fica sempre abaixo do terreno → **sem z-fighting** (antes o plano era escondido com o relevo ligado, pra não piscar por ficar acima). Na **captura do cube envMap** o relevo é ocultado por um frame (`terrainRig.mesh.visible = false`, prédios **não refletem** o verde) e sobra o plano cinza (piso neutro do reflexo); a visibilidade do relevo é restaurada depois.

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
