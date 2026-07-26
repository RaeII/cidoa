import type { ReflectionSettings, TextureSettings } from "../../scene/types";
import { PanelSection } from "./controls/PanelSection";
import { CheckboxField } from "./controls/CheckboxField";
import { RangeField } from "./controls/RangeField";

type ReflectionControlsProps = {
  value: ReflectionSettings;
  /** Intensidade do reflexo vive no material (mesmos sliders da aba Texturas). */
  textureSettings: TextureSettings;
  onChange: (settings: ReflectionSettings) => void;
  onTextureSettingsChange: (settings: TextureSettings) => void;
};

// Resolução do cube precisa ser potência de 2 pra mipmap: slider anda no expoente.
const MIN_RESOLUTION_EXP = 6; // 64
const MAX_RESOLUTION_EXP = 10; // 1024

export function ReflectionControls({
  value,
  textureSettings,
  onChange,
  onTextureSettingsChange,
}: ReflectionControlsProps) {
  return (
    <>
      <PanelSection
        title="Reflexo"
        description="Probe (CubeCamera) que gera o envMap dos prédios. Desligado, as fachadas caem no HDRI da cena (scene.environment) — sem a cidade refletida."
      >
        <CheckboxField
          label="Reflexo ativo"
          checked={value.enabled}
          onChange={(enabled) => onChange({ ...value, enabled })}
        />
      </PanelSection>

      <PanelSection
        title="Intensidade"
        description="Força do reflexo no material. Mesmos valores da aba Texturas."
      >
        <RangeField
          label="Intensidade na fachada"
          value={textureSettings.envMapIntensity}
          min={0}
          max={5}
          step={0.1}
          valueLabel={textureSettings.envMapIntensity.toFixed(1)}
          onChange={(envMapIntensity) =>
            onTextureSettingsChange({ ...textureSettings, envMapIntensity })
          }
        />
        <RangeField
          label="Intensidade no topo"
          value={textureSettings.top.envMapIntensity}
          min={0}
          max={5}
          step={0.1}
          valueLabel={textureSettings.top.envMapIntensity.toFixed(1)}
          onChange={(envMapIntensity) =>
            onTextureSettingsChange({
              ...textureSettings,
              top: { ...textureSettings.top, envMapIntensity },
            })
          }
        />
        <RangeField
          label="Nitidez (rugosidade da fachada)"
          value={textureSettings.roughnessIntensity}
          min={0}
          max={100}
          step={1}
          valueLabel={textureSettings.roughnessIntensity.toFixed(2)}
          onChange={(roughnessIntensity) =>
            onTextureSettingsChange({ ...textureSettings, roughnessIntensity })
          }
        />
        <RangeField
          label="Espelhamento (metalness da fachada)"
          value={textureSettings.metalnessIntensity}
          min={0}
          max={10}
          step={0.001}
          valueLabel={textureSettings.metalnessIntensity.toFixed(2)}
          onChange={(metalnessIntensity) =>
            onTextureSettingsChange({ ...textureSettings, metalnessIntensity })
          }
        />
      </PanelSection>

      <PanelSection
        title="Qualidade"
        description="Resolução do cube map. Cada passo dobra o custo de captura: 6 renders da cena por captura."
      >
        <RangeField
          label="Resolução"
          value={Math.round(Math.log2(value.resolution))}
          min={MIN_RESOLUTION_EXP}
          max={MAX_RESOLUTION_EXP}
          step={1}
          valueLabel={`${value.resolution}px`}
          onChange={(exp) => onChange({ ...value, resolution: 2 ** exp })}
        />
      </PanelSection>

      <PanelSection
        title="Posição do probe"
        description="De onde o reflexo é capturado. Ancorado na cidade, o reflexo fica estável em qualquer ângulo de órbita."
      >
        <CheckboxField
          label="Seguir a câmera"
          checked={value.followCamera}
          onChange={(followCamera) => onChange({ ...value, followCamera })}
        />
        <RangeField
          label="Altura (Y)"
          value={value.probeY}
          min={0}
          max={120}
          step={0.5}
          valueLabel={value.probeY.toFixed(1)}
          onChange={(probeY) => onChange({ ...value, probeY })}
        />
        <RangeField
          label="Posição X"
          value={value.probeX}
          min={-200}
          max={200}
          step={1}
          valueLabel={value.probeX.toFixed(0)}
          onChange={(probeX) => onChange({ ...value, probeX })}
        />
        <RangeField
          label="Posição Z"
          value={value.probeZ}
          min={-200}
          max={200}
          step={1}
          valueLabel={value.probeZ.toFixed(0)}
          onChange={(probeZ) => onChange({ ...value, probeZ })}
        />
      </PanelSection>

      <PanelSection
        title="Céu no reflexo"
        description="Desce a faixa de céu só na captura. Prédio visto de frente espelha para BAIXO do horizonte — sem esse deslocamento, essa direção só tem cinza chapado do HDRI."
      >
        <RangeField
          label="Deslocamento do céu"
          value={value.skyDrop}
          min={-0.5}
          max={0.5}
          step={0.005}
          valueLabel={value.skyDrop.toFixed(3)}
          onChange={(skyDrop) => onChange({ ...value, skyDrop })}
        />
      </PanelSection>

      <PanelSection
        title="Conteúdo da captura"
        description="Chão chapado tapa o hemisfério de baixo do cube e mata o reflexo de céu na visão frontal."
      >
        <div className="space-y-2">
          <CheckboxField
            label="Incluir chão e relevo"
            checked={value.includeGround}
            onChange={(includeGround) => onChange({ ...value, includeGround })}
          />
          <CheckboxField
            label="Incluir asfalto, calçada e lotes"
            checked={value.includeCityFloor}
            onChange={(includeCityFloor) => onChange({ ...value, includeCityFloor })}
          />
        </div>
      </PanelSection>

      <PanelSection
        title="Atualização"
        description="Captura roda a cada N frames e só quando a cena muda. Contínuo recaptura sempre (custa FPS)."
      >
        <RangeField
          label="Intervalo (frames)"
          value={value.updateInterval}
          min={1}
          max={60}
          step={1}
          valueLabel={`${value.updateInterval}`}
          onChange={(updateInterval) => onChange({ ...value, updateInterval })}
        />
        <div className="mt-4">
          <CheckboxField
            label="Recaptura contínua"
            checked={value.continuous}
            onChange={(continuous) => onChange({ ...value, continuous })}
          />
        </div>
      </PanelSection>
    </>
  );
}
