import type { DonationsLoadState } from "../hooks/useDonations";

const formatMB = (bytes: number) => (bytes / 1_048_576).toFixed(1);

/**
 * Overlay do carregamento inicial das doações. Fundo pointer-events-none (cena
 * orbitável atrás); só o card de erro captura clique (botão de retry).
 * O editor mantém o overlay visível até o setDonations aplicar → mascara o
 * freeze do rebuild inicial.
 */
export function DonationLoadOverlay({
  state,
  onRetry,
}: {
  state: DonationsLoadState;
  onRetry: () => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
      <div className="pointer-events-auto w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-white/10 bg-black/70 px-6 py-5 text-white shadow-lg backdrop-blur-md">
        {state.status === "error" ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="text-sm text-red-300">Falha ao carregar as doações</div>
            <div className="text-xs text-white/60">{state.message}</div>
            <button
              onClick={onRetry}
              className="rounded-lg border border-white/10 bg-white/10 px-4 py-1.5 text-sm transition-colors hover:bg-white/20"
            >
              Tentar novamente
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
            {state.status === "loading" ? (
              <>
                <div className="text-sm">Carregando doações…</div>
                {state.totalBytes ? (
                  <div className="w-full">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-white/80 transition-[width] duration-150"
                        style={{
                          width: `${Math.min(100, (state.loadedBytes / state.totalBytes) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="mt-1 text-xs text-white/60">
                      {formatMB(state.loadedBytes)} / {formatMB(state.totalBytes)} MB
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-white/60">{formatMB(state.loadedBytes)} MB</div>
                )}
              </>
            ) : (
              <div className="text-sm">Montando cidade…</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
