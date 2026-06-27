import { TERRAIN_SEGMENT_OPTIONS } from "../../scene/config/terrainConfig";
import type { TerrainSettings } from "../../scene/types";
import { CheckboxField } from "./controls/CheckboxField";
import { ColorField } from "./controls/ColorField";
import { PanelSection } from "./controls/PanelSection";
import { RangeField } from "./controls/RangeField";

type TerrainControlsProps = {
  value: TerrainSettings;
  onChange: (settings: TerrainSettings) => void;
};

export function TerrainControls({ value, onChange }: TerrainControlsProps) {
  return (
    <>
      <PanelSection
        title="Relevo"
        description="Colinas ao redor da cidade, nas partes sem edifício. Ficam planas perto da cidade e recuam quando ela cresce."
      >
        <CheckboxField
          label="Mostrar relevo"
          checked={value.enabled}
          onChange={(enabled) => onChange({ ...value, enabled })}
        />

        <label className="mt-4 block">
          <span className="mb-2 block text-sm text-white/75">Resolução</span>
          <select
            value={value.segments}
            onChange={(event) => onChange({ ...value, segments: Number(event.target.value) })}
            className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-white/20"
          >
            {TERRAIN_SEGMENT_OPTIONS.map((seg) => (
              <option key={seg} value={seg} className="bg-[#0b0d11] text-white">
                {seg} x {seg}
              </option>
            ))}
          </select>
        </label>

        <RangeField
          label="Tamanho"
          value={value.size}
          min={200}
          max={1200}
          step={10}
          valueLabel={value.size.toFixed(0)}
          onChange={(size) => onChange({ ...value, size })}
        />

        <RangeField
          label="Altura"
          value={value.height}
          min={4}
          max={120}
          step={1}
          valueLabel={value.height.toFixed(0)}
          onChange={(height) => onChange({ ...value, height })}
        />

        <RangeField
          label="Frequência"
          value={value.frequency}
          min={0.4}
          max={7}
          step={0.1}
          valueLabel={value.frequency.toFixed(1)}
          onChange={(frequency) => onChange({ ...value, frequency })}
        />

        <RangeField
          label="Octaves"
          value={value.octaves}
          min={1}
          max={8}
          step={1}
          valueLabel={value.octaves.toFixed(0)}
          onChange={(octaves) => onChange({ ...value, octaves })}
        />

        <RangeField
          label="Persistência"
          value={value.persistence}
          min={0.15}
          max={0.9}
          step={0.01}
          valueLabel={value.persistence.toFixed(2)}
          onChange={(persistence) => onChange({ ...value, persistence })}
        />

        <RangeField
          label="Lacunarity"
          value={value.lacunarity}
          min={1.4}
          max={3.8}
          step={0.05}
          valueLabel={value.lacunarity.toFixed(2)}
          onChange={(lacunarity) => onChange({ ...value, lacunarity })}
        />

        <RangeField
          label="Ridge"
          value={value.ridge}
          min={0}
          max={2}
          step={0.01}
          valueLabel={value.ridge.toFixed(2)}
          onChange={(ridge) => onChange({ ...value, ridge })}
        />

        <RangeField
          label="Falhas"
          value={value.faults}
          min={0}
          max={48}
          step={1}
          valueLabel={value.faults.toFixed(0)}
          onChange={(faults) => onChange({ ...value, faults })}
        />

        <RangeField
          label="Força da falha"
          value={value.faultStrength}
          min={0}
          max={12}
          step={0.1}
          valueLabel={value.faultStrength.toFixed(1)}
          onChange={(faultStrength) => onChange({ ...value, faultStrength })}
        />

        <RangeField
          label="Suavização"
          value={value.smooth}
          min={0}
          max={8}
          step={1}
          valueLabel={value.smooth.toFixed(0)}
          onChange={(smooth) => onChange({ ...value, smooth })}
        />

        <RangeField
          label="Terraços"
          value={value.terrace}
          min={0}
          max={18}
          step={1}
          valueLabel={value.terrace.toFixed(0)}
          onChange={(terrace) => onChange({ ...value, terrace })}
        />

        <RangeField
          label="Borda baixa"
          value={value.edge}
          min={0}
          max={1}
          step={0.01}
          valueLabel={value.edge.toFixed(2)}
          onChange={(edge) => onChange({ ...value, edge })}
        />
      </PanelSection>

      <PanelSection title="Aparência do relevo" description="Semente do ruído, cores por altura e malha em arame.">
        <RangeField
          label="Seed"
          value={value.seed}
          min={1}
          max={999999}
          step={1}
          valueLabel={value.seed.toFixed(0)}
          onChange={(seed) => onChange({ ...value, seed })}
        />

        <button
          type="button"
          onClick={() => onChange({ ...value, seed: Math.floor(Math.random() * 999999) + 1 })}
          className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          Nova seed
        </button>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <ColorField
            label="Cor baixa"
            value={value.lowColor}
            onChange={(lowColor) => onChange({ ...value, lowColor })}
            placeholder="#3f5f32"
          />
          <ColorField
            label="Cor alta"
            value={value.highColor}
            onChange={(highColor) => onChange({ ...value, highColor })}
            placeholder="#aeca7b"
          />
        </div>

        <div className="mt-4">
          <CheckboxField
            label="Wireframe"
            checked={value.wireframe}
            onChange={(wireframe) => onChange({ ...value, wireframe })}
          />
        </div>
      </PanelSection>
    </>
  );
}
