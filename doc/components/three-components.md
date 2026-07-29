---
title: Three Components
tags:
  - cidoa
  - threejs
  - componentes
  - canvas
aliases:
  - Canvas
  - CitySceneCanvas
---

# Three Components

Componentes React responsáveis por montar a cena 3D.

## Objetivo da Camada

A pasta `src/components/three` isola o ponto de montagem da cena.

**Por que essa separação existe?**
- React cuida da árvore de componentes
- Three.js cuida do conteúdo dentro do canvas
- A cena não deve ser construída diretamente dentro do painel HTML

## Arquivos

- `CitySceneCanvas.tsx` — cena principal
- `CustomizationPreview.tsx` — preview isolado de uma personalização (admin)

## Arquivo Principal

### `CitySceneCanvas.tsx`

Componente pequeno por design. Faz três coisas:

1. Cria um `ref` para um `div`
2. Chama o hook [[scene-hooks|useCityScene]]
3. Renderiza o `div` onde `renderer.domElement` será anexado

### Props recebidas

| Prop | Tipo | Descrição |
|---|---|---|
| `buildingSettings` | `BuildingSettings` | Cor, roughness, metalness dos prédios |
| `textureSettings` | `TextureSettings` | Configurações PBR de textura |
| `groundSettings` | `GroundSettings` | Material e cor do chão |
| `lightSettings` | `LightSettings` | Luzes da cena |
| `environmentSettings` | `EnvironmentSettings` | HDRI / skybox |
| `reflectionSettings` | `ReflectionSettings` | Probe do envMap dos prédios ([[scene-runtime#Probe de reflexo (envMap dos prédios)]]) |
| `blockLayoutSettings` | `BlockLayoutSettings` | Tamanho de quadra e largura de rua |
| `onStatsChange` | `(stats: SceneStats) => void` | Callback de métricas |

> [!note] Estado próprio
> `CitySceneCanvas` não guarda estado da cena. Apenas recebe estado do `CitySceneEditor` e entrega ao hook.

### Handle Imperativo (`CitySceneCanvasHandle`)

O componente expõe uma ref com métodos imperativos:

```typescript
canvasRef.current?.addDonation(value)
canvasRef.current?.addDonations(values)
canvasRef.current?.setDonations(entries)  // replace-all do backend
canvasRef.current?.focusOnDonation(id)
canvasRef.current?.clearFocus()
canvasRef.current?.updateDonationCustomization(id, customization)
```

Isso permite que `CitySceneEditor` dispare ações na cena sem criar ciclos de estado React. `setDonations(entries)` aplica o snapshot filtrado do backend ([[donation-api]]) — replace-all preservando os IDs do backend (ver [[scene-managers#setDonations]]).

> [!note] Doações iniciais vêm do backend
> As props `initialDonations` e `initialBuildingCustomizations` foram **removidas** (junto do `useEffect` de mount que as aplicava). Agora `CitySceneEditor` carrega o snapshot via `useDonations` e empurra por `setDonations` quando `loadState.status === "ready"`. Ver [[donation-api]].

## O que ele NÃO faz

O canvas não:
- cria luz manualmente
- cria `scene` ou `camera`
- gera prédios

Tudo isso fica no [[scene-runtime|runtime]].

## Por que isso é útil

Se você quiser trocar a forma como o canvas é montado, muda um componente pequeno.

Exemplos:
- adicionar overlay acima do canvas
- trocar a classe de layout do container
- adicionar comportamento visual no wrapper

Sem essa separação, qualquer mudança simples no container exigiria mexer no código 3D pesado.

## `CustomizationPreview.tsx`

Mostra **uma** personalização fora da cena. Usado no admin ([[personalizacoes]]) pra ver o modelo, não só o nome. Só cola React + `WebGLRenderer`: quem monta a cena é [[scene-builders#createPreviewScene.ts|createPreviewScene]], que por sua vez usa os mesmos builders da cena — nada é remodelado aqui.

**Assunto** (`PreviewSubject`) = `{ kind, key }`, key crua do catálogo: `shape` (Formato), `rooftop` (Topo), `edgeLight` (LED).

Dois exports, mesma cena interna:

| Export | Uso | Custo |
|---|---|---|
| `CustomizationThumb` | miniatura na lista | render 1× por assunto → PNG data URL em cache module-level; depois é só `<img>` |
| `CustomizationPreview` | preview grande no dialog | canvas vivo com `OrbitControls` (arrastar/zoom, auto-rotate), 1 contexto WebGL enquanto montado |

**Detalhes:**
- **`resolveSubject(subject) === null`** — key sem builder no front, ou `none`: thumb some, dialog mostra "Sem preview 3D para esta opção"
- **Miniatura em `requestAnimationFrame`** — render sai do commit do React; lista com 10 itens não trava o paint
- **Sem WebGL** (contexto perdido, driver ruim) → cache guarda `""` e o componente devolve um bloco vazio, sem quebrar a página
- **Resize não reposiciona a câmera** — só a primeira medida válida chama `place()`; depois disso o giro é do usuário
- **Dispose no unmount** — `view.dispose()` (cena) + `controls`, `renderer` e o `canvas`

> [!important] three.js entra por import dinâmico
> ~600 kB. `Customizations.tsx` importa este arquivo via `lazy()` + `Suspense` e **só `import type`** de qualquer coisa de `scene/` — um único import estático de builder (nem que seja pra pegar um guard) arrasta three pro chunk compartilhado do admin, e **toda** página admin paga o download (medido: 11 kB → 221 kB).

## Relação com o Hook

`CitySceneCanvas` é a porta de entrada. Quem cria e sincroniza a cena é o [[scene-hooks|useCityScene.ts]].

**Ordem de leitura natural:**

1. `CitySceneCanvas.tsx`
2. [[scene-hooks|useCityScene.ts]]
3. [[scene-runtime|createCitySceneRuntime.ts]]
