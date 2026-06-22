import { useState } from "react";
import type {
  BuildingSettings,
  EnvironmentSettings,
  GroundSettings,
  LightSettings,
  RenderDirectionSettings,
  SceneStats,
  ShadowSettings,
  TextureSettings,
  HorizonSettings,
  UIVisibilitySettings,
} from "../../scene/types";
import { BuildingControls } from "./BuildingControls";
import { EnvironmentControls } from "./EnvironmentControls";
import { GroundControls } from "./GroundControls";
import { PanelIntro } from "./PanelIntro";
import { RenderDirectionControls } from "./RenderDirectionControls";
import { SceneLightControls } from "./SceneLightControls";
import { ShadowControls } from "./ShadowControls";
import { TextureControls } from "./TextureControls";
import { HorizonControls } from "./HorizonControls";
import { PanelSection } from "./controls/PanelSection";
import { CheckboxField } from "./controls/CheckboxField";

type Tab = "geral" | "texturas" | "luz" | "horizonte" | "tela";

export type CityControlPanelProps = {
  buildingSettings: BuildingSettings;
  textureSettings: TextureSettings;
  groundSettings: GroundSettings;
  lightSettings: LightSettings;
  shadowSettings: ShadowSettings;
  renderDirectionSettings: RenderDirectionSettings;
  environmentSettings: EnvironmentSettings;
  horizonSettings: HorizonSettings;
  uiVisibility: UIVisibilitySettings;
  sceneStats: SceneStats;
  lightMetrics: {
    ambientDynamic: number;
    ambientTotal: number;
    solarIntensity: number;
  };
  onBuildingSettingsChange: (settings: BuildingSettings) => void;
  onTextureSettingsChange: (settings: TextureSettings) => void;
  onGroundSettingsChange: (settings: GroundSettings) => void;
  onLightSettingsChange: (settings: LightSettings) => void;
  onShadowSettingsChange: (settings: ShadowSettings) => void;
  onRenderDirectionSettingsChange: (settings: RenderDirectionSettings) => void;
  onEnvironmentSettingsChange: (settings: EnvironmentSettings) => void;
  onHorizonSettingsChange: (settings: HorizonSettings) => void;
  onUIVisibilityChange: (settings: UIVisibilitySettings) => void;
  onClose: () => void;
};

export function CityControlPanel({
  buildingSettings,
  textureSettings,
  groundSettings,
  lightSettings,
  shadowSettings,
  renderDirectionSettings,
  environmentSettings,
  horizonSettings,
  uiVisibility,
  sceneStats,
  lightMetrics,
  onBuildingSettingsChange,
  onTextureSettingsChange,
  onGroundSettingsChange,
  onLightSettingsChange,
  onShadowSettingsChange,
  onRenderDirectionSettingsChange,
  onEnvironmentSettingsChange,
  onHorizonSettingsChange,
  onUIVisibilityChange,
  onClose,
}: CityControlPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>("geral");

  return (
    <div className="absolute right-0 top-0 z-20 flex h-screen w-full max-w-[360px] flex-col border-l border-white/10 bg-black/55 text-white shadow-2xl backdrop-blur-md">
      <div className="flex items-stretch border-b border-white/10">
        {(["geral", "texturas", "luz", "horizonte", "tela"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 text-sm font-medium capitalize tracking-wide transition-colors ${
              activeTab === tab
                ? "border-b-2 border-white text-white"
                : "text-white/40 hover:text-white/70"
            }`}
          >
            {tab}
          </button>
        ))}
        <button
          onClick={onClose}
          className="flex w-11 shrink-0 items-center justify-center text-white/50 transition-colors hover:text-white"
          title="Fechar painel"
          aria-label="Fechar painel"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "geral" && (
          <div className="space-y-6 pb-8 pt-2">
            <PanelIntro sceneStats={sceneStats} solarIntensity={lightMetrics.solarIntensity} />
            <BuildingControls value={buildingSettings} onChange={onBuildingSettingsChange} />
            <ShadowControls value={shadowSettings} onChange={onShadowSettingsChange} />
            <RenderDirectionControls
              value={renderDirectionSettings}
              onChange={onRenderDirectionSettingsChange}
            />
            <GroundControls value={groundSettings} onChange={onGroundSettingsChange} />
            <EnvironmentControls value={environmentSettings} onChange={onEnvironmentSettingsChange} />
          </div>
        )}

        {activeTab === "texturas" && (
          <div className="space-y-6 pb-8 pt-2">
            <TextureControls value={textureSettings} onChange={onTextureSettingsChange} />
          </div>
        )}

        {activeTab === "luz" && (
          <div className="space-y-6 pb-8 pt-2">
            <SceneLightControls
              value={lightSettings}
              metrics={lightMetrics}
              onChange={onLightSettingsChange}
            />
          </div>
        )}

        {activeTab === "horizonte" && (
          <div className="space-y-6 pb-8 pt-2">
            <HorizonControls settings={horizonSettings} onChange={onHorizonSettingsChange} />
          </div>
        )}

        {activeTab === "tela" && (
          <div className="space-y-6 pb-8 pt-2">
            <PanelSection
              title="Componentes da tela"
              description="Ativa ou esconde os elementos sobrepostos na cena. Preferência salva automaticamente."
            >
              <div className="space-y-2">
                <CheckboxField
                  label="Log de posição da câmera"
                  checked={uiVisibility.cameraLog}
                  onChange={(cameraLog) => onUIVisibilityChange({ ...uiVisibility, cameraLog })}
                />
                <CheckboxField
                  label="Input de doação individual"
                  checked={uiVisibility.donationInput}
                  onChange={(donationInput) =>
                    onUIVisibilityChange({ ...uiVisibility, donationInput })
                  }
                />
                <CheckboxField
                  label="Input de geração em lote"
                  checked={uiVisibility.bulkInput}
                  onChange={(bulkInput) => onUIVisibilityChange({ ...uiVisibility, bulkInput })}
                />
                <CheckboxField
                  label="Input de configuração de quadras"
                  checked={uiVisibility.blockLayoutInput}
                  onChange={(blockLayoutInput) =>
                    onUIVisibilityChange({ ...uiVisibility, blockLayoutInput })
                  }
                />
              </div>
            </PanelSection>
          </div>
        )}
      </div>
    </div>
  );
}
