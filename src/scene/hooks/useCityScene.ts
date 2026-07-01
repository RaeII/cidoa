import { useCallback, useEffect, useEffectEvent, useRef, type RefObject } from "react";
import { createCitySceneRuntime, type CitySceneRuntime } from "../runtime/createCitySceneRuntime";
import type {
  BlockLayoutSettings,
  BuildingCustomization,
  BuildingSettings,
  CameraDebugInfo,
  EnvironmentSettings,
  GroundSettings,
  LightSettings,
  RenderDirectionSettings,
  SceneStats,
  ShadowSettings,
  TerrainSettings,
  TextureSettings,
  HorizonSettings,
} from "../types";

type UseCitySceneOptions = {
  mountRef: RefObject<HTMLDivElement | null>;
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

export function useCityScene({
  mountRef,
  buildingSettings,
  textureSettings,
  groundSettings,
  terrainSettings,
  lightSettings,
  shadowSettings,
  renderDirectionSettings,
  horizonSettings,
  environmentSettings,
  blockLayoutSettings,
  onStatsChange,
  onCameraDebugChange,
  onHoverChange,
  onBuildingClick,
}: UseCitySceneOptions) {
  const runtimeRef = useRef<CitySceneRuntime | null>(null);
  const initialSettingsRef = useRef<Omit<UseCitySceneOptions, "mountRef" | "onStatsChange">>({
    buildingSettings,
    textureSettings,
    groundSettings,
    terrainSettings,
    lightSettings,
    shadowSettings,
    renderDirectionSettings,
    horizonSettings,
    environmentSettings,
    blockLayoutSettings,
  });

  const handleStatsChange = useEffectEvent((stats: SceneStats) => {
    onStatsChange(stats);
  });

  const handleCameraDebugChange = useEffectEvent((cameraInfo: CameraDebugInfo) => {
    onCameraDebugChange?.(cameraInfo);
  });

  const handleHoverChange = useEffectEvent(
    (value: number | null, x: number, y: number) => {
      onHoverChange?.(value, x, y);
    },
  );

  const handleBuildingClick = useEffectEvent(
    (donationId: number | null) => {
      onBuildingClick?.(donationId);
    },
  );

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) {
      return;
    }

    const runtime = createCitySceneRuntime({
      mount,
      ...initialSettingsRef.current,
      onStatsChange: (stats) => handleStatsChange(stats),
      onCameraDebugChange: (cameraInfo) => handleCameraDebugChange(cameraInfo),
      onHoverChange: (value, x, y) => handleHoverChange(value, x, y),
      onBuildingClick: (donationId) => handleBuildingClick(donationId),
    });
    runtimeRef.current = runtime;

    return () => {
      runtimeRef.current = null;
      runtime.dispose();
    };
  }, [mountRef]);

  useEffect(() => {
    runtimeRef.current?.updateBuildingSettings(buildingSettings);
  }, [buildingSettings]);

  useEffect(() => {
    runtimeRef.current?.updateTextureSettings(textureSettings);
  }, [textureSettings]);

  useEffect(() => {
    runtimeRef.current?.updateGroundSettings(groundSettings);
  }, [groundSettings]);

  useEffect(() => {
    runtimeRef.current?.updateTerrainSettings(terrainSettings);
  }, [terrainSettings]);

  useEffect(() => {
    runtimeRef.current?.updateLightSettings(lightSettings);
  }, [lightSettings]);

  useEffect(() => {
    runtimeRef.current?.updateShadowSettings(shadowSettings);
  }, [shadowSettings]);

  useEffect(() => {
    runtimeRef.current?.updateRenderDirectionSettings(renderDirectionSettings, true);
  }, [renderDirectionSettings]);

  useEffect(() => {
    runtimeRef.current?.updateHorizonSettings(horizonSettings);
  }, [horizonSettings]);

  useEffect(() => {
    runtimeRef.current?.updateEnvironmentSettings(environmentSettings);
  }, [environmentSettings]);

  useEffect(() => {
    runtimeRef.current?.updateBlockLayout(blockLayoutSettings);
  }, [blockLayoutSettings]);

  // Referência estável: delega ao runtime atual sem recriar a função
  const addDonation = useCallback((value: number) => {
    runtimeRef.current?.addDonation(value);
  }, []);

  const addDonations = useCallback((values: number[]) => {
    runtimeRef.current?.addDonations(values);
  }, []);

  const updateDonationCustomization = useCallback(
    (donationId: number, customization: BuildingCustomization) => {
      runtimeRef.current?.updateDonationCustomization(donationId, customization);
    },
    [],
  );

  const focusOnDonation = useCallback((donationId: number) => {
    runtimeRef.current?.focusOnDonation(donationId);
  }, []);

  const clearFocus = useCallback(() => {
    runtimeRef.current?.clearFocus();
  }, []);

  const getDonationValue = useCallback((donationId: number) => {
    return runtimeRef.current?.getDonationValue(donationId) ?? null;
  }, []);

  return { addDonation, addDonations, updateDonationCustomization, focusOnDonation, clearFocus, getDonationValue };
}
