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
      <PanelSection
        title="Renderização do horizonte"
        description="Até onde a cena é desenhada: alcance da câmera e distância do céu."
      >
        <RangeField
          label="Distância do horizonte"
          value={settings.renderDistance}
          min={250}
          max={2000}
          step={10}
          onChange={(val) => handleChange("renderDistance", val)}
        />

        <p className="text-xs leading-5 text-white/50">
          Não altera a renderização dos edifícios — só o limite do horizonte.
        </p>
      </PanelSection>

      <PanelSection
        title="Renderização dos edifícios"
        description="Controla até onde os edifícios aparecem, sem cortar o chão ou as montanhas."
      >
        <RangeField
          label="Distância dos edifícios à frente"
          value={settings.distance}
          min={100}
          max={600}
          step={0.1}
          onChange={(val) => handleChange("distance", val)}
        />

        <RangeField
          label="Distância dos edifícios atrás da câmera"
          value={settings.backDistance}
          min={10}
          max={600}
          step={0.1}
          onChange={(val) => handleChange("backDistance", val)}
        />

        <p className="text-xs leading-5 text-white/50">
          {culledCount} prédios ocultos por distância. Reduzir as distâncias diminui a
          quantidade de edifícios renderizados.
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
