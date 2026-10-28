import { ChevronLeft, ChevronRight, Info, Paintbrush } from "lucide-react";
import { formatBRL } from "@/lib/unlock";
import { Button } from "@/components/ui/button";
import { PixelClose } from "@/components/ui/pixel-icon";

export function MyBuildingsNavigation({
  value,
  place,
  index,
  count,
  onPrevious,
  onNext,
  onCustomize,
  onDetails,
  onClose,
}: {
  value?: number;
  place?: string;
  index: number;
  count: number;
  onPrevious: () => void;
  onNext: () => void;
  onCustomize: () => void;
  onDetails: () => void;
  onClose: () => void;
}) {
  return (
    <nav
      aria-label="Meus edifícios na cidade"
      className="pointer-events-none absolute inset-0 z-30 text-foreground [text-shadow:0_1px_3px_var(--background)]"
    >
      <div className="pixel bevel-edge pointer-events-auto absolute top-3 left-2 max-h-[calc(50%-3rem)] max-w-40 overflow-y-auto bg-background px-2 pt-2 pb-3 text-left [text-shadow:none] sm:top-4 sm:left-4 sm:max-w-64 sm:px-4 sm:pt-3 sm:pb-4 md:left-1/4" aria-live="polite" aria-atomic="true">
        {value !== undefined ? <>
          <p className="mono-label text-[10px] text-primary sm:text-xs">Seu edifício · {index + 1} de {count}</p>
          <p className="mt-1 text-lg font-semibold break-words sm:text-2xl">{formatBRL(value)}</p>
          {place && <p className="mt-1 truncate text-[11px] sm:text-sm">{place}</p>}
        </> : <p role="status" className="text-sm">Localizando edifício…</p>}
      </div>
      <Button type="button" variant="ghost" size="icon-lg" className="pointer-events-auto absolute top-3 right-3 hover:bg-transparent" autoFocus onClick={onClose} aria-label="Sair dos meus edifícios">
        <PixelClose className="size-4" />
      </Button>
      <Button type="button" variant="outline" size="icon-lg" className="pointer-events-auto absolute top-1/2 left-4 -mt-6 md:left-1/4" disabled={count < 2 || value === undefined} onClick={onPrevious} aria-label="Edifício anterior">
        <ChevronLeft className="size-6" />
      </Button>
      <Button type="button" variant="outline" size="icon-lg" className="pointer-events-auto absolute top-1/2 right-4 -mt-6 md:right-1/4" disabled={count < 2 || value === undefined} onClick={onNext} aria-label="Próximo edifício">
        <ChevronRight className="size-6" />
      </Button>
      <div className="absolute inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] flex justify-center gap-4 sm:bottom-6 sm:gap-8">
        <Button type="button" size="lg" className="pointer-events-auto has-[>svg]:px-3 max-sm:text-sm" disabled={value === undefined} onClick={onCustomize}>
          <Paintbrush />Personalizar
        </Button>
        <Button type="button" variant="outline" size="lg" className="pointer-events-auto has-[>svg]:px-3 max-sm:text-sm" disabled={value === undefined} onClick={onDetails}>
          <Info />Detalhes
        </Button>
      </div>
    </nav>
  );
}
