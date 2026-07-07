import { CheckboxField } from "./controls/CheckboxField";
import { ColorField } from "./controls/ColorField";
import { PanelSection } from "./controls/PanelSection";
import { RangeField } from "./controls/RangeField";
import type { HorizonSettings } from "../../scene/types";

type Props = {
  settings: HorizonSettings;
  onChange: (settings: HorizonSettings) => void;
  culledCount: number;
};

export function HorizonControls({ settings, onChange, culledCount }: Props) {
  const handleChange = <K extends keyof HorizonSettings>(key: K, value: HorizonSettings[K]) => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <>
      <PanelSection title="Silhueta do Horizonte">
        <CheckboxField
          label="Mostrar Silhueta"
          checked={settings.enabled}
          onChange={(val) => handleChange("enabled", val)}
        />

        <ColorField
          label="Cor da Silhueta"
          value={settings.color}
          onChange={(val) => handleChange("color", val)}
        />

        <RangeField
          label="Distância"
          value={settings.distance}
          min={100}
          max={600}
          step={0.1}
          onChange={(val) => handleChange("distance", val)}
        />

        <RangeField
          label="Distância atrás da câmera"
          value={settings.backDistance}
          min={10}
          max={600}
          step={0.1}
          onChange={(val) => handleChange("backDistance", val)}
        />

        <p className="text-xs leading-5 text-white/50">
          {culledCount} prédios ocultos pelo cull de distância. Prédios atrás da câmera não
          aparecem na tela — reduzir esta distância corta geometria invisível (ganho de perf e
          menos reflexo), então o efeito é neste número, não no render.
        </p>
      </PanelSection>

      <PanelSection title="Névoa">
        <RangeField
          label="Densidade"
          value={settings.fogDensity}
          min={0}
          max={0.05}
          step={0.001}
          onChange={(val) => handleChange("fogDensity", val)}
        />
        <ColorField
          label="Cor da Névoa"
          value={settings.fogColor}
          onChange={(val) => handleChange("fogColor", val)}
        />
      </PanelSection>
    </>
  );
}
