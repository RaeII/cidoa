// Dados estáticos do dono do edifício. Único dado dinâmico = valor da doação.
const BUILDING_OWNER = {
  image: "/claudio.png",
  name: "Claudio",
  url: "claudio.dev",
} as const;

export type BuildingInfoModalProps = {
  value: number;
  onCustomize: () => void;
  onClose: () => void;
};

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

export function BuildingInfoModal({ value, onCustomize, onClose }: BuildingInfoModalProps) {
  return (
    // Overlay sem dim/blur e pointer-events-none: cena visível e interativa atrás.
    // Card sempre à direita, no topo. <900px: versão um pouco menor.
    <div className="pointer-events-none absolute inset-0 z-40 flex items-start justify-end p-4 min-[900px]:p-6">
      <div className="group pointer-events-auto w-full max-w-xs overflow-hidden rounded-2xl border border-white/10 bg-black/80 text-white shadow-2xl backdrop-blur-md min-[900px]:max-w-sm min-[900px]:w-80">
        <div className="relative">
          <img
            src={BUILDING_OWNER.image}
            alt={BUILDING_OWNER.name}
            className="h-36 w-full object-cover min-[900px]:h-44"
          />
          {/* X aparece no hover (desktop); sempre visível no mobile (sem mouse). */}
          <button
            onClick={onClose}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white/80 opacity-0 backdrop-blur-sm transition-opacity duration-200 hover:bg-black/70 hover:text-white group-hover:opacity-100 max-[899px]:opacity-100"
            title="Fechar"
            aria-label="Fechar informações do edifício"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="px-4 py-3 min-[900px]:px-5 min-[900px]:py-4">
          <div className="truncate text-xl font-semibold">{BUILDING_OWNER.name}</div>
          <a
            href={`https://${BUILDING_OWNER.url}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-[#c9a86a] underline decoration-[#c9a86a]/40 underline-offset-2 transition-colors hover:text-[#e4c98b] hover:decoration-[#e4c98b]"
          >
            {BUILDING_OWNER.url}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
              <path
                d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>

          <div className="mt-4 flex items-end justify-between gap-3">
            <div className="text-3xl font-semibold tracking-tight text-white">
              {formatCurrency(value)}
            </div>
            {/* Personalizar = ícone de editar (lápis), no rodapé do card. */}
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
          </div>
        </div>
      </div>
    </div>
  );
}
