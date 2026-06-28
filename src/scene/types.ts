import * as THREE from "three";

export type RooftopType =
  | "none"
  | "spotlights"
  | "helipad"
  | "garden"
  | "helicopter";

export type EdgeLightType =
  | "none"
  | "led";

export type BuildingTextureTransform = {
  scaleX: number;
  scaleY: number;
  offsetX: number;
  offsetY: number;
};

export const DEFAULT_BUILDING_TEXTURE_TRANSFORM: BuildingTextureTransform = {
  scaleX: 1,
  scaleY: 1,
  offsetX: 0,
  offsetY: 0,
};

export type BuildingShape =
  | "default"
  | "twisted"
  | "octagonal"
  | "setback"
  | "tapered"
  | "chrysler"
  | "hearst"
  | "empire"
  | "taipei"
  | "one-trade";

export type BuildingCustomization = {
  color: string;
  rooftopType: RooftopType;
  signText: string;
  signSides: number; // 1–4 lados com letreiro
  edgeLightType: EdgeLightType;
  buildingShape: BuildingShape;
  tilingScale: number; // multiplicador da textura por edifício (1.0 = sem alteração)
  textureTransform: BuildingTextureTransform; // ajuste manual da textura por edifício
  hologramImage: string | null; // data URL (PNG/JPG/GIF). null = sem holograma
  hologramColor: string; // tint cyberpunk aplicado sobre a imagem
  hologramOpacity: number; // 0–1, multiplica brilho/alpha do holograma
};

export const DEFAULT_HOLOGRAM_COLOR = "#73f2ff";
export const DEFAULT_HOLOGRAM_OPACITY = 0.78;

export type DonationEntry = {
  id: number;
  value: number;
  customization?: BuildingCustomization;
};

export type ChunkData = {
  key: string;
  mesh: THREE.InstancedMesh;
  count: number;
  centers: Float32Array;
  heights: Float32Array;
  scales: Float32Array;
};

export type HorizonSettings = {
  enabled: boolean;
  color: string;
  distance: number;
  fogDensity: number;
  fogColor: string;
};

export type RenderDirectionSettings = {
  forwardDistance: number;
  sideDistance: number;
  backwardDistance: number;
};

export type GroundMaterialType = "standard" | "matte" | "soft-metal" | "polished";

export type ShadowSettings = {
  enabled: boolean;
  intensity: number;
  bias: number;
  normalBias: number;
  radius: number;
  blurSamples: number;
  mapSize: number;
  cameraNear: number;
  cameraFar: number;
  cameraLeft: number;
  cameraRight: number;
  cameraTop: number;
  cameraBottom: number;
  buildingCountWithShadow: number;
};

export type TopTextureSettings = {
  normalScale: number;
  displacementScale: number;
  tilingScale: number;
  roughnessIntensity: number;
  metalnessIntensity: number;
  envMapIntensity: number;
};

export type TextureSettings = {
  enabled: boolean;
  normalScale: number;
  displacementScale: number;
  tilingScale: number;
  roughnessIntensity: number;
  metalnessIntensity: number;
  envMapIntensity: number;
  emissiveIntensity: number;
  clayRender: boolean;
  top: TopTextureSettings;
};

export type BuildingSettings = {
  color: string;
  roughness: number;
  metalness: number;
  targetMaxHeight: number;
};

export type GroundSettings = {
  color: string;
  roughness: number;
  metalness: number;
  materialType: GroundMaterialType;
};

// Relevo procedural ao redor da cidade (partes sem edifício).
// Mesmos controles do protótipo terrain.md (fbm + falhas + terraços + suavização),
// mais enabled e gradiente de cor low→high.
export type TerrainSettings = {
  enabled: boolean;
  seed: number;
  segments: number;      // resolução da malha (vértices por lado = segments + 1)
  size: number;          // largura total da malha (unidades de cena)
  height: number;        // amplitude do relevo (unidades de cena)
  frequency: number;     // escala do ruído (mais alto = colinas menores)
  octaves: number;       // camadas de detalhe fbm
  persistence: number;   // queda de amplitude por octave
  lacunarity: number;    // ganho de frequência por octave
  ridge: number;         // peso das cristas (ridge noise)
  faults: number;        // número de linhas de falha tectônica
  faultStrength: number; // força do degrau de cada falha
  smooth: number;        // iterações de suavização do heightfield
  terrace: number;       // número de patamares (0 = sem terraço)
  edge: number;          // rebaixamento da borda externa (0–1)
  wireframe: boolean;    // exibe malha em arame
  lowColor: string;      // cor das partes baixas
  highColor: string;     // cor dos picos
};

export type LightSettings = {
  ambientColor: string;
  ambientExtraIntensity: number;
  hemisphereSkyColor: string;
  hemisphereGroundColor: string;
  hemisphereIntensity: number;
  directionalColor: string;
  directionalDistance: number;
  directionalElevation: number;
  directionalAzimuth: number;
  directionalTargetX: number;
  directionalTargetY: number;
  directionalTargetZ: number;
};

export type PointLightConfig = {
  x: number;
  y: number;
  z: number;
  intensity: number;
};

export type EnvironmentSettings = {
  offsetX: number;
  offsetY: number;
  offsetZ: number;
};

export type BlockLayoutSettings = {
  blockSize: number;
  streetWidth: number;
  towerRatio: number;     // fração de doações tratadas como torres (0–1)
  towersPerBlock: number; // quantas torres por quadra (ocupa os N slots mais centrais)
  baseHeightCap: number;  // teto de altura da base urbana como fração de maxSceneHeight (0–1)
  lotColor: string;       // cor dos lotes vazios das quadras (loteamento esperando edifício)
};

export type SceneStats = {
  buildings: number;
  fpsMode: string;
  chunks: number;
  buildingsWithShadow: number;
};

export type CameraDebugInfo = {
  position: {
    x: number;
    y: number;
    z: number;
  };
  target: {
    x: number;
    y: number;
    z: number;
  };
};

export type CameraVisibilityState = {
  x: number;
  z: number;
  forwardX: number;
  forwardZ: number;
};

// Visibilidade dos componentes HTML sobrepostos na tela. Persistido em localStorage.
export type UIVisibilitySettings = {
  cameraLog: boolean;       // log de posição da câmera (canto inferior esquerdo)
  donationInput: boolean;   // input de doação individual
  bulkInput: boolean;       // input de geração em lote (mín/máx/qtd)
  blockLayoutInput: boolean; // input de configuração de quadras
};

export type CitySceneConfig = {
  chunkSize: number;
  chunkRadius: number;
  blockSize: number;
  roadWidth: number;
  minHeight: number;
  maxHeight: number;
  maxBuildingsPerChunk: number;
  dprCap: number;
  targetFps: number;
  minRenderScale: number;
  maxRenderScale: number;
  far: number;
  shadowBuildingCap: number;
  maxSolarIntensity: number;
  minAmbientDynamic: number;
  maxAmbientDynamic: number;
  sceneBackground: string;
  sceneFogColor: string;
  sceneFogDensity: number;
  groundSize: number;
  cameraFov: number;
  cameraNear: number;
  initialCameraPosition: {
    x: number;
    y: number;
    z: number;
  };
  controlTarget: {
    x: number;
    y: number;
    z: number;
  };
  controls: {
    dampingFactor: number;
    rotateSpeed: number;
    zoomSpeed: number;
    panSpeed: number;
    minDistance: number;
    maxDistance: number;
    maxPolarAngle: number;
  };
  cubeUpdateIntervalMoving: number;
  cubeUpdateIntervalStatic: number;
  envMapNearDistance: number;
};
