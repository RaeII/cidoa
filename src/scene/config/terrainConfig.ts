import type { TerrainSettings } from "../types";

// Constantes do encaixe na cidade (não expostas na UI). size/segments agora vêm de TerrainSettings.
export const TERRAIN_CITY_PADDING = 8;    // folga entre a borda da cidade e onde as colinas começam
export const TERRAIN_TRANSITION = 60;     // largura MÍNIMA do degradê cidade→relevo (cresce com a altura: max(este, height*3))
// Nível plano do relevo na zona da cidade. O relevo é o chão único (o plano cinza fica
// escondido enquanto o relevo está ligado — ver runtime), então só precisa ficar ABAIXO das
// ruas (-0.015) com folga pra não brigar (z-fighting) com elas. As colinas sobem a partir daqui.
export const TERRAIN_GROUND_Y = -0.04;

// Opções de resolução da malha (mesmas do protótipo terrain.md).
export const TERRAIN_SEGMENT_OPTIONS = [64, 96, 128, 192, 256] as const;

export const DEFAULT_TERRAIN_SETTINGS: TerrainSettings = {
  enabled: true,
  seed: 4690,
  segments: 128,
  size: 700,
  height: 35,
  frequency: 2,
  octaves: 6,
  persistence: 0.5,
  lacunarity: 2.2,
  ridge: 1.0,
  faults: 4,
  faultStrength: 4,
  smooth: 4,
  terrace: 0,
  edge: 0.3,
  wireframe: false,
  lowColor: "#3f5f32",
  highColor: "#aeca7b",
};

export function createDefaultTerrainSettings(): TerrainSettings {
  return { ...DEFAULT_TERRAIN_SETTINGS };
}
