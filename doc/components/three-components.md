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
| `blockLayoutSettings` | `BlockLayoutSettings` | Tamanho de quadra e largura de rua |
| `onStatsChange` | `(stats: SceneStats) => void` | Callback de métricas |

> [!note] Estado próprio
> `CitySceneCanvas` não guarda estado da cena. Apenas recebe estado do `CitySceneEditor` e entrega ao hook.

### Handle Imperativo (`CitySceneCanvasHandle`)

O componente expõe uma ref com método imperativo:

```typescript
canvasRef.current?.addDonation(value)
```

Isso permite que `CitySceneEditor` dispare ações na cena sem criar ciclos de estado React.

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

## Relação com o Hook

`CitySceneCanvas` é a porta de entrada. Quem cria e sincroniza a cena é o [[scene-hooks|useCityScene.ts]].

**Ordem de leitura natural:**

1. `CitySceneCanvas.tsx`
2. [[scene-hooks|useCityScene.ts]]
3. [[scene-runtime|createCitySceneRuntime.ts]]
