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
  RenderDirectionSettings,
  HorizonSettings,
  SceneStats,
  ShadowSettings,
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
  shadowSettings: ShadowSettings;
  renderDirectionSettings: RenderDirectionSettings;
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
  updateShadowSettings: (settings: ShadowSettings) => void;
  updateRenderDirectionSettings: (settings: RenderDirectionSettings, forceRefresh?: boolean) => void;
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
  shadowSettings,
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

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.45;
  renderer.shadowMap.enabled = shadowSettings.enabled;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

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
  const groundPlane = createGroundPlane(scene, groundSettings, shadowSettings.enabled);
  const terrainRig = createTerrain(scene, terrainSettings, shadowSettings.enabled);
  const horizonSilhouette = createHorizonSilhouette(scene, horizonSettings);

  const buildingCubeTarget = new THREE.WebGLCubeRenderTarget(256, {
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
  donationManager.setShadowEnabled(shadowSettings.enabled);
  terrainRig.setCityRadius(donationManager.getCityRadius());

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

    cubeFrameCounter = (cubeFrameCounter + 1) % 4;
    if (cubeFrameCounter === 0) {
      buildingCubeCamera.position.copy(camera.position);
      donationManager.beginEnvCapture();
      // Relevo verde fora da captura: edifícios não devem refletir o terreno.
      const terrainWasVisible = terrainRig.mesh.visible;
      terrainRig.mesh.visible = false;
      buildingCubeCamera.update(renderer, scene);
      terrainRig.mesh.visible = terrainWasVisible;
      donationManager.endEnvCapture();
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
    },
    updateTextureSettings(settings) {
      donationManager.updateTextureSettings(settings);
    },
    updateGroundSettings(settings) {
      groundPlane.update(settings);
    },
    updateTerrainSettings(settings) {
      // update() reaproveita o cityRadius retido pelo rig — relevo e zona plana juntos.
      terrainRig.update(settings);
    },
    updateLightSettings(settings) {
      lightingRig.update(settings);
    },
    updateShadowSettings(settings) {
      renderer.shadowMap.enabled = settings.enabled;
      groundPlane.setShadowEnabled(settings.enabled);
      terrainRig.setShadowEnabled(settings.enabled);
      donationManager.setShadowEnabled(settings.enabled);
    },
    // Sem chunks direcionais — mantido na API para compatibilidade com hook/canvas
    updateRenderDirectionSettings() {},
    updateHorizonSettings(settings) {
      horizonSilhouette.updateSettings(settings);
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.set(settings.fogColor);
        scene.fog.density = settings.fogDensity;
      }
    },
    updateBlockLayout(settings) {
      donationManager.updateBlockLayout(settings);
      syncTerrainToCity();
    },
    updateEnvironmentSettings(settings) {
      environmentUpdater.updateSettings(settings);
    },

    addDonation(value) {
      donationManager.addDonation(value);
      syncTerrainToCity();
      emitStatsPatch({ buildings: donationManager.getDonationCount() });
    },
    addDonations(values) {
      donationManager.addDonations(values);
      syncTerrainToCity();
      emitStatsPatch({ buildings: donationManager.getDonationCount() });
    },
    updateDonationCustomization(donationId, customization) {
      donationManager.updateDonationCustomization(donationId, customization);
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

      // Calcular posição da câmera: offset lateral e acima do edifício
      const offset = new THREE.Vector3(6, 5, 6);
      const targetPos = worldPos.clone();
      const endCamPos = targetPos.clone().add(offset);

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
