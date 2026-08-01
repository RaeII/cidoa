import type { EnvironmentSettings } from "../types";

export function createDefaultEnvironmentSettings(): EnvironmentSettings {
  return {
    offsetX: 0,
    offsetY: 0.075,
    offsetZ: -0.10
    ,
    night: false,
  };
}

// Modo noite derivado do HDRI diurno — sem segundo asset de 3 MB. `skyTint` multiplica o
// mapa do céu (MeshBasicMaterial.color), o resto escurece cena/luz/névoa.
export const NIGHT_PRESET = {
  /** Multiplicador do céu diurno → azul-noite mantendo a estrutura das nuvens. */
  skyTint: "#1b2440",
  /** Luz ambiente vira luar frio. */
  ambientColor: "#8ea6d6",
  /** Fator sobre `ambientTotal` — prédios ficam escuros, LED/holograma passam a dominar. */
  ambientScale: 0.09,
  /** Peso do IBL (scene.environment continua sendo o HDRI diurno). */
  environmentIntensity: 0.1,
  fogColor: "#070b16",
  horizonColor: "#0d1220",
  /** Pontos do campo de estrelas (hemisfério de cima, raio 180). */
  starCount: 1400,
  starRadius: 180,
  starSize: 1.6,
};
