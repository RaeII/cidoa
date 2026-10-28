import { ChevronLeft, ChevronRight } from "lucide-react";
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
  onDetails,
  onClose,
}: {
  value: number;
  place?: string;
  index: number;
  count: number;
  onPrevious: () => void;
  onNext: () => void;
  onDetails: () => void;
  onClose: () => void;
}) {
  return (
    <nav
      aria-label="Meus edifícios na cidade"
      className="pixel bevel-edge absolute right-4 bottom-20 left-4 z-30 bg-background p-3 text-foreground sm:right-auto sm:left-1/2 sm:w-96 sm:-translate-x-1/2"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0" aria-live="polite" aria-atomic="true">
          <p className="mono-label text-primary">Seu edifício · {index + 1} de {count}</p>
          <p className="text-lg font-semibold">{formatBRL(value)}</p>
          {place && <p className="truncate text-xs text-muted-foreground">{place}</p>}
        </div>
        <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} title="Sair dos meus edifícios" aria-label="Sair dos meus edifícios">
          <PixelClose className="size-3" />
        </Button>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Button type="button" variant="outline" size="icon" disabled={count < 2} onClick={onPrevious} title="Edifício anterior" aria-label="Edifício anterior">
          <ChevronLeft />
        </Button>
        <Button type="button" variant="outline" className="flex-1" onClick={onDetails}>
          Detalhes
        </Button>
        <Button type="button" disabled={count < 2} onClick={onNext} title="Próximo edifício" aria-label="Próximo edifício">
          Próximo<ChevronRight />
        </Button>
      </div>
    </nav>
  );
}
