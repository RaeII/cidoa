import type { TerrainSettings } from "../types";

// Constantes do encaixe na cidade (não expostas na UI). size/segments agora vêm de TerrainSettings.
export const TERRAIN_CITY_PADDING = 8;    // folga entre a borda da cidade e onde o relevo começa
export const TERRAIN_TRANSITION = 36;     // largura da rampa que sobe do nível do chão até o relevo cheio
export const TERRAIN_CARVE_FLOOR = -0.08; // nível do relevo na zona da cidade (abaixo do chão plano, fica escondido)
export const TERRAIN_BASE_LIFT = 0.05;    // base do relevo longe da cidade (acima do chão plano, evita o cinza vazar nos vales)

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
