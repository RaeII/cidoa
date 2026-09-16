import { useState } from "react";
import type { BlockLayoutSettings } from "../../scene/types";

type BuildingLayoutCardProps = {
  settings: BlockLayoutSettings;
  onChange: (settings: BlockLayoutSettings) => void;
  /** Quantos edifícios estão na cena hoje (null = sem limite, mostra todos). */
  visibleLimit: number | null;
  onVisibleLimitChange: (limit: number | null) => void;
  /** Total de doações disponíveis após o filtro. */
  total: number;
  onClose: () => void;
};

const MODES = [
  {
    mode: false,
    label: "Por quadra",
    hint: "Torres agrupadas nos slots centrais de cada quadra, prédios menores embaralhados no meio delas.",
  },
  {
    mode: true,
    label: "Mais alto no centro",
    hint: "Maior doação no centro exato da cena, altura caindo conforme afasta da origem.",
  },
] as const;

/**
 * Card flutuante de organização dos edifícios: modo de layout + quantos
 * edifícios entram na cena. Fica fora do painel de controle porque são os
 * dois botões que mais se mexe ao compor a cidade.
 */
export function BuildingLayoutCard({
  settings,
  onChange,
  visibleLimit,
  onVisibleLimitChange,
  total,
  onClose,
}: BuildingLayoutCardProps) {
  const [limitInput, setLimitInput] = useState(visibleLimit?.toString() ?? "");

  // Rebuild da cena trava a UI por até ~0,5s com 100k — só commita no
  // aplicar/Enter, nunca a cada tecla digitada.
  const applyLimit = () => {
    const parsed = parseInt(limitInput, 10);
    onVisibleLimitChange(isNaN(parsed) || parsed <= 0 ? null : parsed);
  };

  const shown = visibleLimit === null ? total : Math.min(visibleLimit, total);

  return (
    <div className="absolute left-4 top-4 z-30 w-64 rounded-xl border border-white/10 bg-black/60 p-3 shadow-2xl backdrop-blur-md">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium tracking-wide text-white/70">
          Organização dos edifícios
        </span>
        <button
          onClick={onClose}
          className="text-white/40 transition-colors hover:text-white"
          title="Remover card da tela"
          aria-label="Remover card da tela"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {MODES.map(({ mode, label, hint }) => (
          <button
            key={label}
            onClick={() => onChange({ ...settings, centerTallest: mode })}
            title={hint}
            className={`rounded-lg border px-2 py-2 text-[11px] font-medium transition-colors ${
              settings.centerTallest === mode
                ? "border-white/60 bg-white/15 text-white"
                : "border-white/10 bg-white/5 text-white/50 hover:text-white/80"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-3 border-t border-white/10 pt-3">
        <label className="text-[11px] font-medium tracking-wide text-white/50">
          edifícios na tela
        </label>
        <div className="mt-1.5 flex items-center gap-1.5">
          <input
            type="number"
            min={1}
            step={1}
            value={limitInput}
            placeholder="todos"
            onChange={(e) => setLimitInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyLimit()}
            className="min-w-0 flex-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-center text-sm text-white outline-none placeholder:text-white/20 focus:border-white/30 focus:bg-white/10"
          />
          <button
            onClick={applyLimit}
            className="rounded-md bg-white/10 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-white/20 active:bg-white/30"
          >
            aplicar
          </button>
          <button
            onClick={() => {
              setLimitInput("");
              onVisibleLimitChange(null);
            }}
            className="rounded-md bg-white/5 px-2.5 py-1 text-xs font-medium text-white/60 transition-colors hover:bg-white/15 hover:text-white"
            title="Mostrar todas as doações do filtro"
          >
            tudo
          </button>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-white/40">
          {shown.toLocaleString("pt-BR")} de {total.toLocaleString("pt-BR")} doações — as de maior
          valor primeiro.
        </p>
      </div>
    </div>
  );
}
