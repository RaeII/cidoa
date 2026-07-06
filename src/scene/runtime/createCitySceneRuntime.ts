import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { createGroundPlane } from "../builders/createGroundPlane";
import { createHorizonSilhouette } from "../builders/createHorizonSilhouette";
import { createLightingRig } from "../builders/createLightingRig";
import { createTerrain } from "../builders/createTerrain";
import { loadEnvironment } from "../builders/loadEnvironment";
import { CITY_SCENE_CONFIG, DEFAULT_SCENE_STATS } from "../config/citySceneConfig";
import { createDonationManager } from "../managers/createDonationManager";
import type {
  BlockLayoutSettings,
  BuildingCustomization,
  BuildingSettings,
  CameraDebugInfo,
  EnvironmentSettings,
  GroundSettings,
  LightSettings,
  HorizonSettings,
  SceneStats,
  TerrainSettings,
  TextureSettings,
} from "../types";
import { runDevAssertionsOnce } from "../utils/devAssertions";

type CitySceneRuntimeOptions = {
  mount: HTMLDivElement;
  buildingSettings: BuildingSettings;
  textureSettings: TextureSettings;
  groundSettings: GroundSettings;
  terrainSettings: TerrainSettings;
  lightSettings: LightSettings;
  horizonSettings: HorizonSettings;
  environmentSettings: EnvironmentSettings;
  blockLayoutSettings: BlockLayoutSettings;
  onStatsChange: (stats: SceneStats) => void;
  onCameraDebugChange?: (cameraInfo: CameraDebugInfo) => void;
  onHoverChange?: (value: number | null, x: number, y: number) => void;
  onBuildingClick?: (donationId: number | null) => void;
};

export type CitySceneRuntime = {
  updateBuildingSettings: (settings: BuildingSettings) => void;
  updateTextureSettings: (settings: TextureSettings) => void;
  updateGroundSettings: (settings: GroundSettings) => void;
  updateTerrainSettings: (settings: TerrainSettings) => void;
  updateLightSettings: (settings: LightSettings) => void;
  updateHorizonSettings: (settings: HorizonSettings) => void;
  updateEnvironmentSettings: (settings: EnvironmentSettings) => void;
  updateBlockLayout: (settings: BlockLayoutSettings) => void;
  addDonation: (value: number) => void;
  addDonations: (values: number[]) => void;
  updateDonationCustomization: (donationId: number, customization: BuildingCustomization) => void;
  focusOnDonation: (donationId: number) => void;
  clearFocus: () => void;
  dispose: () => void;
};

export function createCitySceneRuntime({
  mount,
  buildingSettings,
  textureSettings,
  groundSettings,
  terrainSettings,
  lightSettings,
  horizonSettings,
  environmentSettings,
  blockLayoutSettings,
  onStatsChange,
  onCameraDebugChange,
  onHoverChange,
  onBuildingClick,
}: CitySceneRuntimeOptions): CitySceneRuntime {
  runDevAssertionsOnce();

  let currentStats: SceneStats = { ...DEFAULT_SCENE_STATS };
  const emitStatsPatch = (patch: Partial<SceneStats>) => {
    currentStats = { ...currentStats, ...patch };
    onStatsChange(currentStats);
  };

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(CITY_SCENE_CONFIG.sceneBackground);
  scene.fog = new THREE.FogExp2(
    horizonSettings.fogColor,
    horizonSettings.fogDensity,
  );

  const camera = new THREE.PerspectiveCamera(
    CITY_SCENE_CONFIG.cameraFov,
    mount.clientWidth / mount.clientHeight,
    CITY_SCENE_CONFIG.cameraNear,
    CITY_SCENE_CONFIG.far,
  );
  camera.position.set(
    CITY_SCENE_CONFIG.initialCameraPosition.x,
    CITY_SCENE_CONFIG.initialCameraPosition.y,
    CITY_SCENE_CONFIG.initialCameraPosition.z,
  );

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.45;

  let renderScale = 1;
  const getPixelRatio = () =>
    Math.min(window.devicePixelRatio || 1, CITY_SCENE_CONFIG.dprCap) * renderScale;

  renderer.setPixelRatio(getPixelRatio());
  renderer.setSize(mount.clientWidth, mount.clientHeight);
  mount.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = CITY_SCENE_CONFIG.controls.dampingFactor;
  controls.rotateSpeed = CITY_SCENE_CONFIG.controls.rotateSpeed;
  controls.zoomSpeed = CITY_SCENE_CONFIG.controls.zoomSpeed;
  controls.panSpeed = CITY_SCENE_CONFIG.controls.panSpeed;
  controls.minDistance = CITY_SCENE_CONFIG.controls.minDistance;
  controls.maxDistance = CITY_SCENE_CONFIG.controls.maxDistance;
  controls.maxPolarAngle = CITY_SCENE_CONFIG.controls.maxPolarAngle;
  controls.target.set(
    CITY_SCENE_CONFIG.controlTarget.x,
    CITY_SCENE_CONFIG.controlTarget.y,
    CITY_SCENE_CONFIG.controlTarget.z,
  );
  controls.update();

  let loadedEnvMap: THREE.Texture | null = null;
  let loadedBgTexture: THREE.Texture | null = null;
  let isDisposed = false;

  const environmentUpdater = loadEnvironment(
    scene,
    renderer,
    environmentSettings,
    (envMap, bgTexture) => {
      loadedEnvMap = envMap;
      loadedBgTexture = bgTexture;
    },
    () => isDisposed,
  );

  const lightingRig = createLightingRig(scene, lightSettings);
  const groundPlane = createGroundPlane(scene, groundSettings);
  const terrainRig = createTerrain(scene, terrainSettings, groundSettings.color);
  // Relevo é o chão visível quando ligado; esconde o plano cinza no render normal pra não brigar
  // (z-fighting) com o terreno. Reaparece só na captura do envMap (piso neutro do reflexo).
  groundPlane.mesh.visible = !terrainSettings.enabled;
  const horizonSilhouette = createHorizonSilhouette(scene, horizonSettings);

  const buildingCubeTarget = new THREE.WebGLCubeRenderTarget(128, {
    type: THREE.HalfFloatType,
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
  });
  const buildingCubeCamera = new THREE.CubeCamera(0.1, CITY_SCENE_CONFIG.far, buildingCubeTarget);
  scene.add(buildingCubeCamera);

  const donationManager = createDonationManager({
    scene,
    renderer,
    buildingSettings,
    textureSettings,
    blockLayoutSettings,
  });
  donationManager.setEnvMap(buildingCubeTarget.texture);
  terrainRig.setCityRadius(donationManager.getCityRadius());

  // EnvMap dos prédios só é recapturado quando algo visível muda (câmera ou cena).
  // Câmera parada + cena estática = zero renders extras.
  let cubeDirty = true;
  const markCubeDirty = () => {
    cubeDirty = true;
  };
  controls.addEventListener("change", markCubeDirty);

  // Reabre a zona plana do relevo quando a cidade cresce. Cheap: setCityRadius
  // só recalcula a malha quando o raio muda (ganho de anel).
  const syncTerrainToCity = () => {
    terrainRig.setCityRadius(donationManager.getCityRadius());
  };

  // Hover: raycast com throttle por RAF para não impactar o loop de animação
  let pendingHoverEvent: MouseEvent | null = null;
  let hoverRafId: number | null = null;
  const handleMouseMove = onHoverChange
    ? (event: MouseEvent) => {
        pendingHoverEvent = event;
        if (hoverRafId === null) {
          hoverRafId = requestAnimationFrame(() => {
            if (pendingHoverEvent) {
              const value = donationManager.getHoveredValue(
                pendingHoverEvent,
                camera,
                renderer.domElement,
              );
              onHoverChange(value, pendingHoverEvent.clientX, pendingHoverEvent.clientY);
              pendingHoverEvent = null;
            }
            hoverRafId = null;
          });
        }
      }
    : null;
  if (handleMouseMove) renderer.domElement.addEventListener("mousemove", handleMouseMove);

  // Clique: detectar edifício clicado (só dispara se não houve drag)
  let pointerDownPos: { x: number; y: number } | null = null;
  const handlePointerDown = (event: PointerEvent) => {
    pointerDownPos = { x: event.clientX, y: event.clientY };
  };
  const handlePointerUp = onBuildingClick
    ? (event: PointerEvent) => {
        if (!pointerDownPos) return;
        const dx = event.clientX - pointerDownPos.x;
        const dy = event.clientY - pointerDownPos.y;
        // Ignorar se moveu mais de 5px (drag da câmera)
        if (dx * dx + dy * dy > 25) return;
        const donationId = donationManager.getClickedDonationId(
          event as unknown as MouseEvent,
          camera,
          renderer.domElement,
        );
        onBuildingClick(donationId);
      }
    : null;
  if (onBuildingClick) {
    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
  }
  if (handlePointerUp) renderer.domElement.addEventListener("pointerup", handlePointerUp);

  // --- Animação de foco na câmera ---
  let cameraAnim: {
    startPos: THREE.Vector3;
    startTarget: THREE.Vector3;
    endPos: THREE.Vector3;
    endTarget: THREE.Vector3;
    progress: number;
    duration: number;
  } | null = null;

  // Salvar posição da câmera antes do foco para restaurar
  let savedCameraPos: THREE.Vector3 | null = null;
  let savedCameraTarget: THREE.Vector3 | null = null;

  let animationId = 0;
  let lastTime = performance.now();
  let fpsAccumulator = 0;
  let frames = 0;
  let smoothedFps = 60;
  let cubeFrameCounter = 0;
  let cameraDebugAccumulator = 0;
  let accessoryCullAccumulator = 0;

  const updateDynamicResolution = (fps: number) => {
    const previousScale = renderScale;
    if (fps < CITY_SCENE_CONFIG.targetFps - 8) {
      renderScale = Math.max(CITY_SCENE_CONFIG.minRenderScale, renderScale - 0.05);
    } else if (fps > CITY_SCENE_CONFIG.targetFps + 5) {
      renderScale = Math.min(CITY_SCENE_CONFIG.maxRenderScale, renderScale + 0.025);
    }
    if (previousScale !== renderScale) {
      renderer.setPixelRatio(getPixelRatio());
      renderer.setSize(mount.clientWidth, mount.clientHeight, false);
    }
  };

  const animate = (time: number) => {
    animationId = requestAnimationFrame(animate);
    const delta = Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;

    controls.update();

    // Interpolar câmera durante animação de foco
    if (cameraAnim) {
      cameraAnim.progress = Math.min(1, cameraAnim.progress + delta / cameraAnim.duration);
      // Ease-out cubic
      const t = 1 - Math.pow(1 - cameraAnim.progress, 3);
      camera.position.lerpVectors(cameraAnim.startPos, cameraAnim.endPos, t);
      controls.target.lerpVectors(cameraAnim.startTarget, cameraAnim.endTarget, t);
      controls.update();
      if (cameraAnim.progress >= 1) {
        cameraAnim = null;
      }
    }

    groundPlane.setPosition(camera.position.x, camera.position.z);
    horizonSilhouette.update(camera);
    environmentUpdater.updatePosition(camera.position.x, camera.position.y, camera.position.z);

    if (onCameraDebugChange) {
      cameraDebugAccumulator += delta;
      if (cameraDebugAccumulator >= 0.2) {
        cameraDebugAccumulator = 0;
        onCameraDebugChange({
          position: {
            x: camera.position.x,
            y: camera.position.y,
            z: camera.position.z,
          },
          target: {
            x: controls.target.x,
            y: controls.target.y,
            z: controls.target.z,
          },
        });
      }
    }

    fpsAccumulator += delta;
    frames += 1;
    if (fpsAccumulator >= 0.5) {
      const currentFps = frames / fpsAccumulator;
      smoothedFps = smoothedFps * 0.72 + currentFps * 0.28;
      updateDynamicResolution(smoothedFps);
      emitStatsPatch({ buildings: donationManager.getDonationCount() });
      fpsAccumulator = 0;
      frames = 0;
    }

    // Captura no máximo a cada 4 frames, e só quando câmera/cena mudou desde a última.
    cubeFrameCounter = (cubeFrameCounter + 1) % 4;
    if (cubeFrameCounter === 0 && cubeDirty) {
      cubeDirty = false;
      buildingCubeCamera.position.copy(camera.position);
      donationManager.beginEnvCapture();
      // Relevo verde fora da captura (edifícios não devem refletir o terreno); plano cinza
      // dentro da captura (piso neutro do reflexo, já que ele fica escondido no render normal).
      const terrainWasVisible = terrainRig.mesh.visible;
      const groundWasVisible = groundPlane.mesh.visible;
      terrainRig.mesh.visible = false;
      groundPlane.mesh.visible = true;
      buildingCubeCamera.update(renderer, scene);
      terrainRig.mesh.visible = terrainWasVisible;
      groundPlane.mesh.visible = groundWasVisible;
      donationManager.endEnvCapture();
    }

    // Acessórios (letreiro, LED, holograma, topo) somem além da distância de detalhe.
    accessoryCullAccumulator += delta;
    if (accessoryCullAccumulator >= 0.25) {
      accessoryCullAccumulator = 0;
      donationManager.updateAccessoryVisibility(camera.position);
    }

    donationManager.tickAnimations(time / 1000, delta * 1000);

    renderer.render(scene, camera);
  };

  animate(performance.now());

  const handleResize = () => {
    camera.aspect = mount.clientWidth / mount.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(getPixelRatio());
    renderer.setSize(mount.clientWidth, mount.clientHeight);
  };

  window.addEventListener("resize", handleResize);

  return {
    updateBuildingSettings(settings) {
      donationManager.updateBuildingSettings(settings);
      markCubeDirty();
    },
    updateTextureSettings(settings) {
      donationManager.updateTextureSettings(settings);
      markCubeDirty();
    },
    updateGroundSettings(settings) {
      groundPlane.update(settings);
      // Zona plana do relevo = chão da cidade: mantém a mesma cor.
      terrainRig.setGroundColor(settings.color);
      markCubeDirty();
    },
    updateTerrainSettings(settings) {
      // update() reaproveita o cityRadius retido pelo rig — relevo e zona plana juntos.
      terrainRig.update(settings);
      // Plano cinza só aparece quando o relevo está desligado (senão briga com o terreno).
      groundPlane.mesh.visible = !settings.enabled;
      markCubeDirty();
    },
    updateLightSettings(settings) {
      lightingRig.update(settings);
      markCubeDirty();
    },
    updateHorizonSettings(settings) {
      horizonSilhouette.updateSettings(settings);
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.set(settings.fogColor);
        scene.fog.density = settings.fogDensity;
      }
      markCubeDirty();
    },
    updateBlockLayout(settings) {
      donationManager.updateBlockLayout(settings);
      syncTerrainToCity();
      markCubeDirty();
    },
    updateEnvironmentSettings(settings) {
      environmentUpdater.updateSettings(settings);
      markCubeDirty();
    },

    addDonation(value) {
      donationManager.addDonation(value);
      syncTerrainToCity();
      emitStatsPatch({ buildings: donationManager.getDonationCount() });
      markCubeDirty();
    },
    addDonations(values) {
      donationManager.addDonations(values);
      syncTerrainToCity();
      emitStatsPatch({ buildings: donationManager.getDonationCount() });
      markCubeDirty();
    },
    updateDonationCustomization(donationId, customization) {
      donationManager.updateDonationCustomization(donationId, customization);
      markCubeDirty();
    },
    focusOnDonation(donationId) {
      const worldPos = donationManager.getDonationWorldPosition(donationId);
      if (!worldPos) return;

      // Salvar posição atual para restaurar depois
      if (!savedCameraPos) {
        savedCameraPos = camera.position.clone();
        savedCameraTarget = controls.target.clone();
      }

      // Aplicar transparência nos outros prédios
      donationManager.setFocusedDonation(donationId);

      // Aproximar a partir da direção atual da câmera (só dolly, sem girar em volta)
      const targetPos = worldPos.clone();
      const FOCUS_DISTANCE = 12;
      const dir = camera.position.clone().sub(targetPos);
      // Fallback se câmera coincidir com o alvo (direção degenerada)
      if (dir.lengthSq() < 1e-6) dir.set(6, 5, 6);
      dir.normalize();
      const endCamPos = targetPos.clone().add(dir.multiplyScalar(FOCUS_DISTANCE));

      cameraAnim = {
        startPos: camera.position.clone(),
        startTarget: controls.target.clone(),
        endPos: endCamPos,
        endTarget: targetPos,
        progress: 0,
        duration: 0.8,
      };
    },
    clearFocus() {
      donationManager.setFocusedDonation(null);

      if (savedCameraPos && savedCameraTarget) {
        cameraAnim = {
          startPos: camera.position.clone(),
          startTarget: controls.target.clone(),
          endPos: savedCameraPos,
          endTarget: savedCameraTarget,
          progress: 0,
          duration: 0.8,
        };
        savedCameraPos = null;
        savedCameraTarget = null;
      }
    },
    dispose() {
      if (handleMouseMove) renderer.domElement.removeEventListener("mousemove", handleMouseMove);
      if (onBuildingClick) renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      if (handlePointerUp) renderer.domElement.removeEventListener("pointerup", handlePointerUp);
      if (hoverRafId !== null) cancelAnimationFrame(hoverRafId);
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", handleResize);
      controls.removeEventListener("change", markCubeDirty);
      controls.dispose();
      donationManager.dispose();
      groundPlane.dispose();
      terrainRig.dispose();
      horizonSilhouette.dispose();
      lightingRig.dispose();
      isDisposed = true;
      environmentUpdater.dispose();
      loadedEnvMap?.dispose();
      loadedBgTexture?.dispose();
      scene.remove(buildingCubeCamera);
      buildingCubeTarget.dispose();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    },
  };
}
