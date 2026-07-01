import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { useCityScene } from "../../scene/hooks/useCityScene";
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
} from "../../scene/types";

export type CitySceneCanvasHandle = {
  addDonation: (value: number) => void;
  addDonations: (values: number[]) => void;
  updateDonationCustomization: (donationId: number, customization: BuildingCustomization) => void;
  focusOnDonation: (donationId: number) => void;
  clearFocus: () => void;
  getDonationValue: (donationId: number) => number | null;
};

export type CitySceneCanvasProps = {
  initialDonations?: readonly number[];
  initialBuildingCustomizations?: ReadonlyMap<number, BuildingCustomization>;
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

export const CitySceneCanvas = forwardRef<CitySceneCanvasHandle, CitySceneCanvasProps>(
  function CitySceneCanvas(
    {
      initialDonations,
      initialBuildingCustomizations,
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
    },
    ref,
  ) {
    const mountRef = useRef<HTMLDivElement | null>(null);

    const { addDonation, addDonations, updateDonationCustomization, focusOnDonation, clearFocus, getDonationValue } = useCityScene({
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
    });

    useEffect(() => {
      if (!initialDonations?.length) return;

      addDonations([...initialDonations]);
      initialBuildingCustomizations?.forEach((customization, donationId) => {
        updateDonationCustomization(donationId, { ...customization });
      });
    }, [addDonations, initialBuildingCustomizations, initialDonations, updateDonationCustomization]);

    useImperativeHandle(
      ref,
      () => ({ addDonation, addDonations, updateDonationCustomization, focusOnDonation, clearFocus, getDonationValue }),
      [addDonation, addDonations, updateDonationCustomization, focusOnDonation, clearFocus, getDonationValue],
    );

    return <div ref={mountRef} className="h-full w-full cursor-grab active:cursor-grabbing" />;
  },
);
