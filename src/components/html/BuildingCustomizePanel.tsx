import { useRef, useState } from "react";
import { PanelSection } from "./controls/PanelSection";
import { ColorField } from "./controls/ColorField";
import { RangeField } from "./controls/RangeField";
import type {
  BuildingShape,
  EdgeLightType,
  RooftopType,
} from "../../scene/types";

const HOLOGRAM_MAX_BYTES = 4 * 1024 * 1024; // 4 MB — limite saudável para data URL em React state

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("Falha ao ler arquivo"));
    reader.readAsDataURL(file);
  });
}

const SHAPE_OPTIONS: { value: BuildingShape; label: string }[] = [
  { value: "default", label: "Padrão" },
  { value: "twisted", label: "Torre torcida" },
  { value: "octagonal", label: "Torre octogonal" },
  { value: "setback", label: "Torre setback" },
  { value: "tapered", label: "Torre afunilada" },
  { value: "chrysler", label: "Chrysler (NY)" },
  { value: "hearst", label: "Hearst Tower" },
  { value: "empire", label: "Empire State" },
  { value: "taipei", label: "Taipei 101" },
  { value: "one-trade", label: "One Trade" },
];

const ROOFTOP_OPTIONS: { value: RooftopType; label: string }[] = [
  { value: "none", label: "Nenhuma" },
  { value: "spotlights", label: "Holofotes" },
  { value: "helipad", label: "Heliponto" },
  { value: "garden", label: "Jardim suspenso" },
  { value: "helicopter", label: "Helicóptero" },
];

const EDGE_LIGHT_OPTIONS: { value: EdgeLightType; label: string }[] = [
  { value: "none", label: "Desligado" },
  { value: "led", label: "LED" },
];

const SIDE_OPTIONS = [
  { value: 1, label: "1 lado" },
  { value: 2, label: "2 lados" },
  { value: 3, label: "3 lados" },
  { value: 4, label: "4 lados" },
];

type BuildingCustomizePanelProps = {
  donationId: number;
  initialColor: string;
  initialBuildingShape: BuildingShape;
  initialRooftopType: RooftopType;
  initialSignText: string;
  initialSignSides: number;
  initialEdgeLightType: EdgeLightType;
  initialHologramImage: string | null;
  initialHologramColor: string;
  initialHologramOpacity: number;
  onColorChange: (donationId: number, color: string) => void;
  onBuildingShapeChange: (donationId: number, shape: BuildingShape) => void;
  onRooftopChange: (donationId: number, rooftopType: RooftopType) => void;
  onSignTextChange: (donationId: number, signText: string) => void;
  onSignSidesChange: (donationId: number, signSides: number) => void;
  onEdgeLightTypeChange: (donationId: number, edgeLightType: EdgeLightType) => void;
  onHologramImageChange: (donationId: number, hologramImage: string | null) => void;
  onHologramColorChange: (donationId: number, color: string) => void;
  onHologramOpacityChange: (donationId: number, opacity: number) => void;
  onClose: () => void;
};

export function BuildingCustomizePanel({
  donationId,
  initialColor,
  initialBuildingShape,
  initialRooftopType,
  initialSignText,
  initialSignSides,
  initialEdgeLightType,
  initialHologramImage,
  initialHologramColor,
  initialHologramOpacity,
  onColorChange,
  onBuildingShapeChange,
  onRooftopChange,
  onSignTextChange,
  onSignSidesChange,
  onEdgeLightTypeChange,
  onHologramImageChange,
  onHologramColorChange,
  onHologramOpacityChange,
  onClose,
}: BuildingCustomizePanelProps) {
  const [color, setColor] = useState(initialColor);
  const [buildingShape, setBuildingShape] = useState<BuildingShape>(initialBuildingShape);
  const [rooftopType, setRooftopType] = useState<RooftopType>(initialRooftopType);
  const [signText, setSignText] = useState(initialSignText);
  const [signSides, setSignSides] = useState(initialSignSides);
  const [edgeLightType, setEdgeLightType] = useState<EdgeLightType>(initialEdgeLightType);
  const [hologramImage, setHologramImage] = useState<string | null>(initialHologramImage);
  const [hologramColor, setHologramColor] = useState(initialHologramColor);
  const [hologramOpacity, setHologramOpacity] = useState(initialHologramOpacity);
  const [hologramError, setHologramError] = useState<string | null>(null);
  const hologramInputRef = useRef<HTMLInputElement | null>(null);

  const handleColorChange = (newColor: string) => {
    setColor(newColor);
    onColorChange(donationId, newColor);
  };

  const handleBuildingShapeChange = (newShape: BuildingShape) => {
    setBuildingShape(newShape);
    onBuildingShapeChange(donationId, newShape);
  };

  const handleRooftopChange = (newType: RooftopType) => {
    setRooftopType(newType);
    onRooftopChange(donationId, newType);
  };

  const handleSignTextChange = (text: string) => {
    setSignText(text);
    onSignTextChange(donationId, text);
  };

  const handleSignSidesChange = (sides: number) => {
    setSignSides(sides);
    onSignSidesChange(donationId, sides);
  };

  const handleEdgeLightTypeChange = (newType: EdgeLightType) => {
    setEdgeLightType(newType);
    onEdgeLightTypeChange(donationId, newType);
  };

  const handleHologramFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > HOLOGRAM_MAX_BYTES) {
      setHologramError("Arquivo muito grande (máx. 4 MB).");
      event.target.value = "";
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setHologramImage(dataUrl);
      setHologramError(null);
      onHologramImageChange(donationId, dataUrl);
    } catch {
      setHologramError("Não foi possível ler o arquivo.");
    } finally {
      event.target.value = "";
    }
  };

  const handleHologramRemove = () => {
    setHologramImage(null);
    setHologramError(null);
    onHologramImageChange(donationId, null);
  };

  const handleHologramColorChange = (newColor: string) => {
    setHologramColor(newColor);
    onHologramColorChange(donationId, newColor);
  };

  const handleHologramOpacityChange = (newOpacity: number) => {
    setHologramOpacity(newOpacity);
    onHologramOpacityChange(donationId, newOpacity);
  };

  return (
    <div className="absolute right-4 top-4 z-30 flex max-h-[calc(100vh-2rem)] w-72 flex-col rounded-2xl border border-white/10 bg-black/70 text-white shadow-2xl backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <span className="text-sm font-medium">Personalizar Edifício</span>
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/10 hover:text-white"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M1 1L13 13M1 13L13 1"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
      <div className="space-y-4 overflow-y-auto overscroll-contain p-4">
        <PanelSection title="Aparência">
          <ColorField
            label="Cor do edifício"
            value={color}
            onChange={handleColorChange}
          />
        </PanelSection>
        <PanelSection title="Formato">
          <div className="grid grid-cols-2 gap-2">
            {SHAPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => handleBuildingShapeChange(option.value)}
                className={`rounded-lg border px-3 py-2 text-xs transition-colors ${
                  buildingShape === option.value
                    ? "border-white/40 bg-white/15 text-white"
                    : "border-white/10 bg-white/5 text-white/50 hover:border-white/20 hover:text-white/70"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </PanelSection>
        <PanelSection title="Letreiro">
          <label className="block">
            <span className="mb-2 block text-sm text-white/75">Marca ou empresa</span>
            <input
              type="text"
              value={signText}
              onChange={(e) => handleSignTextChange(e.target.value)}
              placeholder="Ex: Acme Corp"
              maxLength={30}
              className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-white/20"
            />
          </label>
          {signText.trim() && (
            <div className="mt-3">
              <span className="mb-2 block text-sm text-white/75">Lados visíveis</span>
              <div className="flex gap-2">
                {SIDE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleSignSidesChange(option.value)}
                    className={`flex-1 rounded-lg border py-1.5 text-xs transition-colors ${
                      signSides === option.value
                        ? "border-white/40 bg-white/15 text-white"
                        : "border-white/10 bg-white/5 text-white/50 hover:border-white/20 hover:text-white/70"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </PanelSection>
        <PanelSection title="Topo">
          <div className="grid grid-cols-2 gap-2">
            {ROOFTOP_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => handleRooftopChange(option.value)}
                className={`rounded-lg border px-3 py-2 text-xs transition-colors ${
                  rooftopType === option.value
                    ? "border-white/40 bg-white/15 text-white"
                    : "border-white/10 bg-white/5 text-white/50 hover:border-white/20 hover:text-white/70"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </PanelSection>
        <PanelSection title="LED de arestas">
          <div className="grid grid-cols-2 gap-2">
            {EDGE_LIGHT_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => handleEdgeLightTypeChange(option.value)}
                className={`rounded-lg border px-3 py-2 text-xs transition-colors ${
                  edgeLightType === option.value
                    ? "border-white/40 bg-white/15 text-white"
                    : "border-white/10 bg-white/5 text-white/50 hover:border-white/20 hover:text-white/70"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

        </PanelSection>
        <PanelSection title="Holograma">
          <p className="mb-2 text-xs text-white/50">
            Imagem ou GIF projetado acima do edifício com efeito cyberpunk.
          </p>
          <input
            ref={hologramInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={handleHologramFileChange}
            className="hidden"
          />
          {hologramImage ? (
            <div className="space-y-2">
              <div className="overflow-hidden rounded-lg border border-white/10 bg-black/40">
                <img
                  src={hologramImage}
                  alt="Pré-visualização do holograma"
                  className="h-24 w-full object-contain"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => hologramInputRef.current?.click()}
                  className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 transition-colors hover:border-white/20 hover:text-white"
                >
                  Trocar
                </button>
                <button
                  onClick={handleHologramRemove}
                  className="flex-1 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200 transition-colors hover:bg-red-500/20"
                >
                  Remover
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => hologramInputRef.current?.click()}
              className="w-full rounded-lg border border-dashed border-white/15 bg-white/5 px-3 py-3 text-xs text-white/60 transition-colors hover:border-white/30 hover:text-white"
            >
              Enviar imagem ou GIF
            </button>
          )}
          {hologramError && (
            <p className="mt-2 text-xs text-red-300">{hologramError}</p>
          )}
          {hologramImage && (
            <div className="mt-3 space-y-3">
              <ColorField
                label="Cor do holograma"
                value={hologramColor}
                onChange={handleHologramColorChange}
              />
              <RangeField
                label="Opacidade"
                value={hologramOpacity}
                min={0}
                max={1}
                step={0.01}
                onChange={handleHologramOpacityChange}
                valueLabel={`${Math.round(hologramOpacity * 100)}%`}
              />
            </div>
          )}
        </PanelSection>
      </div>
    </div>
  );
}
