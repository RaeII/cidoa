import type { ReflectionSettings } from "../types";

export const DEFAULT_REFLECTION_SETTINGS: ReflectionSettings = {
  enabled: true,
  // 256: a fachada é espelho (roughness 0) e amostra o mip 0 — em 128 o céu/skyline vira
  // mancha lisa e o prédio parece sem reflexo.
  resolution: 256,
  // Ancorado no centro da cidade, logo acima dos telhados. Subir pega mais céu, descer
  // pega mais fachada.
  probeX: 0,
  probeY: 18,
  probeZ: 0,
  followCamera: false,
  // 0.2 de offset UV = ~36° de céu descendo abaixo do horizonte, direção que a fachada
  // vertical espelha quando a câmera olha o prédio de frente e de cima.
  skyDrop: -0.030,
  updateInterval: 30,
  continuous: false,
  // Chão chapado tapa o hemisfério de baixo do cube: fora da captura por padrão.
  includeGround: false,
  includeCityFloor: false,
};

export function createDefaultReflectionSettings(): ReflectionSettings {
  return { ...DEFAULT_REFLECTION_SETTINGS };
}
