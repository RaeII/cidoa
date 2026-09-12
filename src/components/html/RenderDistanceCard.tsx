import { useRef, useState } from "react";
import type { HorizonSettings, SceneStats } from "../../scene/types";
import { RangeField } from "./controls/RangeField";

type Props = {
  settings: HorizonSettings;
  sceneStats: SceneStats;
  onChange: (settings: HorizonSettings) => void;
  onClose: () => void;
};

/**
 * Card flutuante para gravação de tela: arrastável pelo cabeçalho, redimensionável
 * pelo canto (CSS `resize`). Só os dois controles de distância dos edifícios.
 */
export function RenderDistanceCard({ settings, sceneStats, onChange, onClose }: Props) {
  const [pos, setPos] = useState({ x: 24, y: 96 });
  const dragOffset = useRef({ x: 0, y: 0 });

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    dragOffset.current = { x: event.clientX - pos.x, y: event.clientY - pos.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    setPos({
      x: event.clientX - dragOffset.current.x,
      y: event.clientY - dragOffset.current.y,
    });
  };

  const visible = sceneStats.buildings - sceneStats.culled;

  return (
    <div
      className="absolute z-40 flex min-h-[220px] min-w-[260px] resize flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/70 text-white shadow-2xl backdrop-blur-md"
      style={{ left: pos.x, top: pos.y, width: 340 }}
    >
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        className="flex cursor-move touch-none items-center justify-between border-b border-white/10 px-4 py-3"
      >
        <span className="text-sm font-medium text-white/85">Renderização dos edifícios</span>
        <button
          onClick={onClose}
          className="text-white/50 transition-colors hover:text-white"
          title="Fechar card"
          aria-label="Fechar card"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <RangeField
          label="Frente da câmera"
          value={settings.distance}
          min={100}
          max={600}
          step={0.1}
          onChange={(distance) => onChange({ ...settings, distance })}
        />
        <RangeField
          label="Atrás da câmera"
          value={settings.backDistance}
          min={10}
          max={600}
          step={0.1}
          onChange={(backDistance) => onChange({ ...settings, backDistance })}
        />
        <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-sm text-white/75">
          <span>Na tela</span>
          <span className="font-mono text-white">
            {visible.toLocaleString("pt-BR")} / {sceneStats.buildings.toLocaleString("pt-BR")}
          </span>
        </div>
      </div>
    </div>
  );
}
