import type { TextureSettings, TopTextureSettings } from "../types";

export const DEFAULT_TOP_TEXTURE_SETTINGS: TopTextureSettings = {
  normalScale: 20,
  displacementScale: 0.0,
  tilingScale: 1.3,
  roughnessIntensity: 0,
  metalnessIntensity: 0,
  envMapIntensity: 0,
};

export const DEFAULT_TEXTURE_SETTINGS: TextureSettings = {
  enabled: true,
  normalScale: 20,
  displacementScale: 0.0,
  tilingScale: 0.4,
  roughnessIntensity: 0,
  metalnessIntensity: 1.44,
  envMapIntensity: 3.5,
  emissiveIntensity: 0,
  clayRender: false,
  top: { ...DEFAULT_TOP_TEXTURE_SETTINGS },
};

export function createDefaultTextureSettings(): TextureSettings {
  return { ...DEFAULT_TEXTURE_SETTINGS };
}
