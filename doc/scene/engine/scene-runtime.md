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
  ├── createGridHelper()      ← builder do grid
  ├── WebGLCubeRenderTarget   ← envMap dinâmico dos prédios
  ├── CubeCamera              ← captura reflexos em tempo real
  └── createDonationManager() ← manager principal (recebe blockLayoutSettings)
```

### 2. Loop de Animação (`animate`)

A cada frame:

1. `controls.update()` — aplica damping do OrbitControls
2. `groundPlane.setPosition(camera.x, camera.z)` — chão segue a câmera
3. `gridHelper.setPosition(camera.x, camera.z)` — grid segue a câmera
4. `environmentUpdater.updatePosition(...)` — skybox segue a câmera
5. **Métricas de FPS** — acumula e suaviza a cada 0.5s
6. **Resolução dinâmica** — ajusta `renderScale` para atingir `targetFps`
7. **CubeCamera** — atualiza a cada 4 frames para capturar reflexos
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
  updateShadowSettings(settings: ShadowSettings): void
  updateRenderDirectionSettings(settings: RenderDirectionSettings): void
  updateHorizonSettings(settings: HorizonSettings): void
  updateEnvironmentSettings(settings: EnvironmentSettings): void
  updateBlockLayout(settings: BlockLayoutSettings): void

  // Doações
  addDonation(value: number): void
  addDonations(values: number[]): void

  // Personalização individual
  updateDonationCustomization(donationId: number, customization: BuildingCustomization): void
  focusOnDonation(donationId: number): void  // destaque visual no edifício
  clearFocus(): void                          // remove destaque

  dispose(): void
}
```

> [!note] Evento de clique em edifícios
> O runtime escuta `pointerdown`/`pointerup` no canvas. Se o cursor não se moveu mais de 5px (não é drag), faz raycast para identificar o edifício clicado e chama `onBuildingClick(donationId)` para o React abrir o painel de personalização.

> [!note] Sistema de foco
> `focusOnDonation` delega para `donationManager.setFocusedDonation(id)`, que deixa toda a cidade semitransparente e cria um mesh isolado do edifício selecionado. `clearFocus` restaura a opacidade original.

> [!note] updateRenderDirectionSettings
> Mantido na API para compatibilidade com o hook e o canvas, mas sem implementação ativa (sem chunks direcionais no runtime atual).

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
  ├── gridHelper.dispose()
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
