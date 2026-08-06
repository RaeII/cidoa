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
  ├── THREE.WebGLRenderer (ACES filmic, PCFSoft shadows)
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
4. **Stats** — emite contagem de prédios a cada 0.5s
5. **CubeCamera** — atualiza a cada 4 frames para capturar reflexos
6. `renderer.render(scene, camera)` — renderiza o frame

#### Resolução Fixa

Sem escala dinâmica. Render sempre no `devicePixelRatio` nativo, limitado pelo `dprCap` (2 — corta só telas 3x+). Qualidade nunca cai quando FPS baixa.

### 3. Atualizações do React

O runtime expõe métodos públicos chamados pelo [[scene-hooks|useCityScene]]:

```typescript
type CitySceneRuntime = {
  // Configurações da cena
  updateBuildingSettings(settings: BuildingSettings): void
  updateTextureSettings(settings: TextureSettings): void
  updateGroundSettings(settings: GroundSettings): void
  updateLightSettings(settings: LightSettings): void
  updateShadowSettings(settings: ShadowSettings): void
  updateRenderDirectionSettings(settings: RenderDirectionSettings): void
  updateHorizonSettings(settings: HorizonSettings): void
  updateEnvironmentSettings(settings: EnvironmentSettings): void
  updateBlockLayout(settings: BlockLayoutSettings): void
  updateTerrainSettings(settings: TerrainSettings): void

  // Doações
  addDonation(value: number, forceDefaultFacade?: boolean): void
  addDonations(values: number[]): void

  // Personalização individual
  updateDonationCustomization(donationId: number, customization: BuildingCustomization): void
  focusOnDonation(donationId: number): void  // destaque visual no edifício
  clearFocus(): void                          // remove destaque

  dispose(): void
}
```

> [!note] Evento de clique em edifícios
> O runtime escuta `pointerdown`/`pointerup` no canvas. Se o cursor não se moveu mais de 5px (não é drag), decide pelo botão:
> - **Esquerdo** (`button === 0`) — raycast identifica o edifício clicado → `onBuildingClick(donationId)` (React abre o [[html-components#`BuildingInfoModal.tsx`|modal de info]]).
> - **Direito** (`button === 2`) — `onSceneRightClick()` → React abre o [[html-components#`DonationFormModal.tsx`|formulário de doação]]. Sem raycast: clique direito em qualquer ponto (prédio, chão, céu) abre o formulário.
> - Outros botões: ignorados.
>
> Menu de contexto do navegador já é bloqueado pelo `OrbitControls` (`preventDefault` no `contextmenu`) — runtime não precisa mexer nisso. Arrastar com o direito = pan da câmera, e o guard de 5px impede que o pan abra o formulário.

> [!note] Hover do valor (tooltip)
> `mousemove` no canvas → raycast throttled por RAF → `onHoverChange(value, x, y)`. Tooltip some via `clearHover()` (cancela RAF pendente + `onHoverChange(null, 0, 0)`) em `pointerleave`, `pointercancel`, `blur` da janela e `pointerdown`. Sem isso o valor ficava grudado ao sair do canvas, ao abrir modal no clique, ou quando um raycast agendado antes da saída repunha o valor logo depois. Valor só reaparece no próximo `mousemove`.

> [!note] Sistema de foco
> `focusOnDonation` delega para `donationManager.setFocusedDonation(id)`, que deixa toda a cidade semitransparente e cria um mesh isolado do edifício selecionado. `clearFocus` restaura a opacidade original.
>
> Zoom aproxima **a partir da direção atual da câmera** — dolly ao longo da linha de visão até `FOCUS_DISTANCE` do topo do prédio, sem girar em volta. Antes usava offset fixo `(6,5,6)`, que fazia a câmera saltar sempre pro mesmo lado (movimento estranho quando vinha do lado oposto). `cameraAnim` interpola pos+target com ease-out cubic em `0.8s`. `clearFocus` restaura pos/target salvos.

> [!note] updateRenderDirectionSettings
> Mantido na API para compatibilidade com o hook e o canvas, mas sem implementação ativa (sem chunks direcionais no runtime atual).

> [!note] Relevo (terrainRig)
> O runtime possui o `terrainRig` ([[scene-builders#createTerrain.ts]]) — opção `terrainSettings` + método `updateTerrainSettings`. Sincroniza a zona plana via `syncTerrainToCity`, que chama `terrainRig.setCityRadius(donationManager.getCityRadius())` após `addDonation`/`addDonations`/`updateBlockLayout` (toda mudança de doação ou layout de quadra). Cor do chão sincronizada via `terrainRig.setGroundColor` em `updateGroundSettings`. `setShadowEnabled` é propagado ao relevo. Ver [[scene-managers|getCityRadius]].
>
> **Visibilidade do chão (anti-z-fighting):** com o relevo ligado, o `groundPlane` é o chão **escondido** (`groundPlane.mesh.visible = !terrainSettings.enabled`) — senão ele e o terreno (duas superfícies cinza quase paralelas) piscam conforme a câmera mexe. Na **captura do cube envMap** a relação inverte por um frame: o relevo é ocultado (`terrainRig.mesh.visible = false`, prédios **não refletem** o verde) e o plano cinza é exibido (piso neutro do reflexo); ambos são restaurados depois. `donationManager.beginEnvCapture()` também oculta os **lotes vazios** (`lotMesh`) nesse frame — prédios **não refletem** o loteamento — e `endEnvCapture()` reexibe.

### 4. Dispose

Limpeza completa ao desmontar:

```
dispose()
  ├── removeEventListener('mousemove')     ← hover
  ├── removeEventListener('pointerleave' | 'pointercancel' | window 'blur')  ← fim do hover
  ├── removeEventListener('pointerdown')   ← clique (detecção de drag) + limpa hover
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
| `shadowMap.type` | `PCFSoftShadowMap` |

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
