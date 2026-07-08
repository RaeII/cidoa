---
title: Scene Hooks
tags:
  - cidoa
  - react
  - hooks
  - bridge
aliases:
  - Hooks
  - useCityScene
  - Bridge React-Three
---

# Scene Hooks

A ponte entre React e Three.js: `src/scene/hooks/useCityScene.ts`.

## Objetivo do Hook

Esse hook existe para que os componentes React **não precisem conhecer diretamente** a implementação do runtime.

**Duas responsabilidades principais:**
1. Criar o [[scene-runtime|runtime]] uma única vez
2. Sincronizar mudanças de estado React com o runtime

## Como Funciona

### Criação

Quando [[three-components|CitySceneCanvas]] monta:

1. O hook lê o `mountRef` (o `div` do canvas)
2. Cria o runtime com os valores iniciais (via `initialSettingsRef`)
3. Salva a referência do runtime em `runtimeRef`

> [!note] initialSettingsRef
> As settings iniciais são capturadas numa ref para evitar que o `useEffect` de criação rode novamente quando as settings mudarem. O runtime recebe os valores corretos na criação; as atualizações subsequentes são feitas pelos efeitos de sincronização.

### Sincronização

Cada `useEffect` é responsável por uma área:

```typescript
useEffect(() => {
  runtimeRef.current?.updateBuildingSettings(buildingSettings);
}, [buildingSettings]);

useEffect(() => {
  runtimeRef.current?.updateTextureSettings(textureSettings);
}, [textureSettings]);

useEffect(() => {
  runtimeRef.current?.updateGroundSettings(groundSettings);
}, [groundSettings]);

useEffect(() => {
  runtimeRef.current?.updateLightSettings(lightSettings);
}, [lightSettings]);

useEffect(() => {
  runtimeRef.current?.updateEnvironmentSettings(environmentSettings);
}, [environmentSettings]);

useEffect(() => {
  runtimeRef.current?.updateBlockLayout(blockLayoutSettings);
}, [blockLayoutSettings]);

useEffect(() => {
  runtimeRef.current?.updateTerrainSettings(terrainSettings);
}, [terrainSettings]);
```

> [!note] terrainSettings
> Threaded também no `initialSettingsRef` (criação) — um `useEffect` dedicado chama `updateTerrainSettings` quando muda. Ver relevo em [[scene-runtime]].

Isso é importante para evitar um efeito gigante tentando fazer tudo.

### Retorno

O hook retorna um objeto com referências estáveis (via `useCallback`) que delegam ao runtime atual:

```typescript
{
  addDonation: (value: number) => void
  addDonations: (values: number[]) => void
  setDonations: (entries: { id: number; value: number }[]) => void
  updateDonationCustomization: (donationId: number, customization: BuildingCustomization) => void
  focusOnDonation: (donationId: number) => void
  clearFocus: () => void
}
```

Cada função é memorizada para não recriar o handle imperativo do [[three-components|CitySceneCanvas]] a cada render. `setDonations` é `useCallback` estável que delega ao runtime — o editor chama com o snapshot filtrado do backend ([[donation-api]]).

## `useEffectEvent`

O hook usa `useEffectEvent` para callbacks que não devem recriar o runtime:

```typescript
const handleStatsChange = useEffectEvent((stats: SceneStats) => {
  onStatsChange(stats);
});

const handleHoverChange = useEffectEvent(
  (value: number | null, x: number, y: number) => {
    onHoverChange?.(value, x, y);
  },
);

const handleBuildingClick = useEffectEvent(
  (donationId: number | null) => {
    onBuildingClick?.(donationId);
  },
);
```

Isso repassa os callbacks para o runtime sem recriar o runtime toda vez que o React renderiza — cada callback sempre vê o valor mais recente sem precisar ser listado como dependência.

## Cleanup

Quando o canvas desmonta:

```typescript
return () => {
  runtimeRef.current = null;
  runtime.dispose();
};
```

Evita vazamentos de:
- renderer e WebGL context
- event listeners (`resize`)
- animation frame (`requestAnimationFrame`)
- objetos da cena (geometrias, materiais, texturas)

## Por que Usar um Hook

- O [[three-components|componente do canvas]] continua simples
- O [[scene-runtime|runtime]] não fica acoplado diretamente ao componente
- O ciclo de vida fica explícito e testável isoladamente

## Quando Mexer Aqui

Mexa em `useCityScene.ts` quando o problema for de **sincronização entre React e runtime**:

| Problema | Ação |
|---|---|
| Mudança de estado não chega na cena | Verifique os `useEffect` de sync |
| Novo método do runtime precisa ser chamado | Adicione `useEffect` correspondente |
| Lifecycle de montagem/desmontagem precisa mudar | Edite o `useEffect` principal |

> [!tip]
> Se o problema for comportamento interno da cena, o arquivo certo provavelmente é [[scene-runtime|createCitySceneRuntime.ts]].

## Relações

- Usado por: [[three-components|CitySceneCanvas]]
- Cria: [[scene-runtime|createCitySceneRuntime]]
- Tipos de opções: [[scene-types]]
