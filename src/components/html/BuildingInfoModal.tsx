export type BuildingInfoModalProps = {
  value: number;
  ongName?: string;
  /** "Cidade · UF". */
  place?: string;
  isOwn: boolean;
  /** Ausente = só leitura: edifício de outra pessoa (ou sem sessão). */
  onCustomize?: () => void;
  onClose: () => void;
};

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function BuildingInfoModal({
  value,
  ongName,
  place,
  isOwn,
  onCustomize,
  onClose,
}: BuildingInfoModalProps) {
  return (
    // Overlay sem dim/blur e pointer-events-none: cena visível e interativa atrás.
    <div className="pointer-events-none absolute inset-0 z-40 flex items-start justify-end p-4 pt-24 min-[900px]:p-6 min-[900px]:pt-32">
      <div
        role="dialog"
        aria-label="Informações do edifício"
        className="pointer-events-auto w-full max-w-xs rounded-2xl border border-white/10 bg-black/80 px-4 py-3 text-white shadow-2xl backdrop-blur-md min-[900px]:w-80 min-[900px]:max-w-sm min-[900px]:px-5 min-[900px]:py-4"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] font-medium uppercase tracking-wider text-white/50">
            {isOwn ? "Seu edifício" : "Doação"}
          </span>
          <button
            onClick={onClose}
            className="-mr-1.5 flex h-8 w-8 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            title="Fechar"
            aria-label="Fechar informações do edifício"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {place && <div className="truncate text-sm text-white/60">{place}</div>}

        {ongName && (
          <div className="mt-3 inline-flex max-w-full items-center gap-1.5 rounded-full border border-[#c9a86a]/25 bg-[#c9a86a]/10 px-2.5 py-1 text-[11px] text-[#e4c98b]">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#c9a86a]" />
            <span className="truncate">{ongName}</span>
          </div>
        )}

        <div className="mt-4 flex items-end justify-between gap-3">
          <div className="text-3xl font-semibold tracking-tight">{formatCurrency(value)}</div>
          {onCustomize && (
            <button
              onClick={onCustomize}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#c9a86a]/40 bg-[#c9a86a]/10 text-[#c9a86a] transition-colors hover:bg-[#c9a86a]/20 hover:text-[#e4c98b]"
              title="Personalizar edifício"
              aria-label="Personalizar edifício"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
