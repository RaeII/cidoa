import { ColorField } from "./controls/ColorField";
import { PanelSection } from "./controls/PanelSection";
import { RangeField } from "./controls/RangeField";
import type { GroundEdgeMode, HorizonSettings } from "../../scene/types";

const groundEdgeDescriptions: Record<GroundEdgeMode, string> = {
  straight: "Borda reta que acompanha a direção da câmera, sem quinas. A distância define onde o chão termina à frente.",
  circular: "Chão em disco, sem quinas. A distância define o raio; a borda forma uma curva, mais visível ao olhar de cima.",
  square: "Formato original para comparação. A distância define metade do lado do quadrado; as quinas podem aparecer ao girar a câmera.",
};

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
          min={60}
          max={2000}
          step={5}
          onChange={(val) => handleChange("renderDistance", val)}
        />

        <p className="text-xs leading-5 text-white/50">
          Alcance da câmera + raio do céu. Baixar aproxima o céu, tirando o vazio entre a cidade e
          o horizonte. Não altera a renderização dos edifícios.
        </p>

        <label className="block">
          <span className="mb-2 block text-sm text-white/75">Final do chão</span>
          <select
            value={settings.groundEdgeMode}
            onChange={(event) => handleChange("groundEdgeMode", event.target.value as GroundEdgeMode)}
            className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-white/20"
          >
            <option value="straight" className="bg-[#0b0d11] text-white">Linha reta (padrão)</option>
            <option value="circular" className="bg-[#0b0d11] text-white">Circular</option>
            <option value="square" className="bg-[#0b0d11] text-white">Quadrado (original)</option>
          </select>
        </label>
        <p className="text-xs leading-5 text-white/50">
          {groundEdgeDescriptions[settings.groundEdgeMode]}
        </p>

        <RangeField
          label="Distância do chão"
          value={settings.groundDistance}
          min={20}
          max={2200}
          step={5}
          onChange={(val) => handleChange("groundDistance", val)}
        />

        <p className="text-xs leading-5 text-white/50">
          O chão acompanha a câmera. Reduza a distância para comparar os formatos; use a névoa
          abaixo para suavizar a transição com o céu. Estes modos alteram apenas o chão, sem
          mudar o relevo das montanhas.
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
