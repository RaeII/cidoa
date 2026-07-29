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
  // Fachada vertical vista de cima espelha PRA BAIXO do horizonte (R.y = -V.y), onde o cube
  // só tem cinza. 0.6 puxa o vetor de reflexão de volta pro horizonte — igual em toda face,
  // porque só escala Y. 0 = comportamento cru do probe.
  envHorizon: 0.6,
  envRotY: 0,
  heightFadeStart: 32.8,
  heightFadeEnd: 57.6,
  heightBlur: 0.65,
  reflectionDistanceStart: 40,
  reflectionDistanceEnd: 90,
  updateInterval: 30,
  continuous: false,
  // Chão, relevo e piso urbano entram no cube para aparecerem nos reflexos dos edifícios.
  // Os controles permitem excluí-los quando a prioridade for destacar céu/skyline.
  includeGround: true,
  includeCityFloor: true,
};

export function createDefaultReflectionSettings(): ReflectionSettings {
  return { ...DEFAULT_REFLECTION_SETTINGS };
}
