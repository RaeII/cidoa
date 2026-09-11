import type { CitySceneConfig, SceneStats } from "../types";

export const CITY_SCENE_CONFIG: CitySceneConfig = {
  chunkSize: 26,
  chunkRadius: 4,
  blockSize: 2.2,
  roadWidth: 0.42,
  minHeight: 1.8,
  maxHeight: 18,
  maxBuildingsPerChunk: 180,
  // Teto do devicePixelRatio. 2 = qualidade nativa em telas retina; só corta 3x+.
  dprCap: 2,
  targetFps: 55,
  // 1 = escala dinâmica desligada (video-2): o render nunca sai da resolução nativa.
  // Baixar reativa o downscale por FPS no loop do runtime.
  minRenderScale: 1,
  maxRenderScale: 1,
  // Padrão do alcance do horizonte (camera.far + raio do céu). Ajustável na aba "horizonte";
  // independente do cull dos edifícios, que vive em HorizonSettings.distance/backDistance.
  far: 190,
  // O probe mantém o alcance anterior para não ampliar o custo das seis capturas.
  reflectionFar: 260,
  maxSolarIntensity: 20,
  minAmbientDynamic: 4,
  maxAmbientDynamic: 8,
  sceneBackground: "#05070a",
  sceneFogColor: "#8c8c8c",
  sceneFogDensity: 0.007,
  cameraFov: 58,
  cameraNear: 0.1,
  initialCameraPosition: {
    x: -12.91,
    y: 19.12,
    z: -14.70,
  },
  controlTarget: {
    x: 0.19,
    y: 9.09,
    z: 0.16,
  },
  controls: {
    dampingFactor: 0.06,
    rotateSpeed: 0.75,
    zoomSpeed: 0.8,
    panSpeed: 0.8,
    minDistance: 8,
    maxDistance: 70,
    maxPolarAngle: Math.PI * 0.48,
  },
};

export const DEFAULT_SCENE_STATS: SceneStats = {
  buildings: 0,
  culled: 0,
  fpsMode: "dynamic",
  chunks: 0,
};
