import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CircleCheckBig, Gift, HandCoins, Pencil, Users } from "lucide-react";
import { sortPassRewards, type PassReward } from "@/lib/pass";
import { formatBRL, formatReferrals } from "@/lib/unlock";
import { CustomizationImage } from "@/components/customization/CustomizationImage";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Sem onConfigure = visualização pública. Cada recompensa ocupa um cartão. */
export function PassTrack<T extends PassReward>({ rewards, onConfigure, layout = "track" }: {
  rewards: readonly T[];
  onConfigure?: (reward: T) => void;
  layout?: "track" | "grid";
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const ordered = sortPassRewards(rewards);
  const isGrid = layout === "grid";
  const [selectedReward, setSelectedReward] = useState<T | null>(null);

  function scroll(direction: number) {
    const track = trackRef.current;
    if (track) track.scrollBy({
      left: direction * Math.max(248, track.clientWidth * 0.8),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
  }

  if (!ordered.length) {
    return (
      <div className="rounded-2xl border border-dashed p-12 text-center">
        <Gift className="mx-auto mb-3 size-9 text-muted-foreground" aria-hidden />
        <p className="font-medium">Nenhuma recompensa disponível</p>
        <p className="mt-1 text-sm text-muted-foreground">As personalizações do passe aparecerão aqui.</p>
      </div>
    );
  }

  return (
    <section className="min-w-0 space-y-5" aria-label="Passe de personalizações">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{isGrid ? "Grade de recompensas" : "Trilha de recompensas"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">Por dificuldade estimada, da mais fácil à mais difícil. {isGrid ? "Quatro personalizações por linha." : "Explore para o lado."}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="mr-2 text-xs tabular-nums text-muted-foreground">{ordered.length} recompensas</span>
          {!isGrid && <>
            <Button variant="outline" size="icon" aria-label="Ver recompensas anteriores" onClick={() => scroll(-1)}><ArrowLeft /></Button>
            <Button variant="outline" size="icon" aria-label="Ver próximas recompensas" onClick={() => scroll(1)}><ArrowRight /></Button>
          </>}
        </div>
      </div>

      <div ref={trackRef} tabIndex={isGrid ? undefined : 0} role="region" aria-label={isGrid ? "Recompensas em grade por ordem de dificuldade" : "Recompensas em ordem de dificuldade; use as setas para explorar"}
        className={isGrid ? "rounded-xl" : "overflow-x-auto overscroll-x-contain rounded-xl pb-5 focus-visible:outline-2 focus-visible:outline-ring snap-x snap-proximity"}>
        <ol className={isGrid ? "grid grid-cols-1 items-stretch gap-5 md:grid-cols-2 xl:grid-cols-4" : "flex w-max min-w-full items-stretch gap-5 px-1 pt-1"}>
          {ordered.map((reward, index) => (
            <li key={reward.key} className={isGrid ? "relative flex min-w-0 flex-col" : "relative flex w-56 shrink-0 snap-start flex-col sm:w-60"}>
              <div className="relative mb-5 flex h-9 items-center justify-center">
                {!isGrid && index < ordered.length - 1 && <div className="absolute top-1/2 left-1/2 h-px w-[calc(100%+1.25rem)] bg-border" aria-hidden />}
                <span className={`relative flex size-9 items-center justify-center rounded-full border text-xs font-semibold tabular-nums ${reward.unlock ? "border-primary/30 bg-background text-foreground" : "border-emerald-600/30 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"}`}>
                  <span className="sr-only">Recompensa </span>{String(index + 1).padStart(2, "0")}
                </span>
              </div>
              <article className="flex flex-1 cursor-pointer flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-colors hover:border-primary/40">
                <div role="button" tabIndex={0} aria-label={`Ver detalhes de ${reward.label}`}
                  onClick={() => setSelectedReward(reward)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    setSelectedReward(reward);
                  }}
                  className="flex flex-1 flex-col focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring focus-visible:outline-none">
                  <div className="relative border-b bg-radial from-primary/10 to-transparent">
                    <div className="h-52 p-5">
                      <CustomizationImage categoryKey={reward.categoryKey} optionKey={reward.optionKey} value={reward.value} />
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <p className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">{reward.categoryLabel}</p>
                    <h3 className="mt-1 min-h-12 text-base leading-6 font-semibold break-words">{reward.label}</h3>
                    <div className="mt-4 flex-1 space-y-2 border-t pt-4 text-sm">
                      {!reward.unlock && <span className="inline-flex text-emerald-600 dark:text-emerald-400"><CircleCheckBig className="size-5" aria-hidden /><span className="sr-only">Disponível para todos</span></span>}
                      {reward.unlock?.donationMin != null && <p className="flex items-start gap-2"><HandCoins className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><span><strong className="font-semibold">{formatBRL(reward.unlock.donationMin)}</strong><span className="block text-xs text-muted-foreground">em doações acumuladas</span></span></p>}
                      {reward.unlock?.referralMin != null && <p className="flex items-center gap-2"><Users className="size-4 shrink-0 text-muted-foreground" /><span>{reward.unlock.donationMin != null && (reward.unlock.mode === "any" ? "ou " : "+ ")}{formatReferrals(reward.unlock.referralMin)}</span></p>}
                    </div>
                  </div>
                </div>
                {onConfigure && <Button variant="outline" size="sm" className="mx-4 mt-5 mb-4" aria-label={`Configurar liberação de ${reward.label}`} onClick={() => onConfigure(reward)}><Pencil />Configurar</Button>}
              </article>
            </li>
          ))}
        </ol>
      </div>

      <Dialog open={selectedReward !== null} onOpenChange={(open) => { if (!open) setSelectedReward(null); }}>
        {selectedReward && <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedReward.label}</DialogTitle>
            <DialogDescription>{selectedReward.categoryLabel}</DialogDescription>
          </DialogHeader>
          <div className="h-80 rounded-xl border bg-radial from-primary/10 to-transparent p-4 [&_img]:object-contain sm:h-96">
            <CustomizationImage categoryKey={selectedReward.categoryKey} optionKey={selectedReward.optionKey} value={selectedReward.value} />
          </div>
          <div className="space-y-3 pt-2">
            {!selectedReward.unlock && <span className="inline-flex px-1 py-2 text-emerald-600 dark:text-emerald-400"><CircleCheckBig className="size-6" aria-hidden /><span className="sr-only">Disponível para todos</span></span>}
            {selectedReward.unlock?.donationMin != null && <div className="flex items-center gap-4 px-1 py-2">
              <HandCoins className="size-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Doação acumulada</p>
                <p className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">{formatBRL(selectedReward.unlock.donationMin)}</p>
              </div>
            </div>}
            {selectedReward.unlock?.donationMin != null && selectedReward.unlock.referralMin != null && <div className="flex items-center gap-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              <span className="h-px flex-1 bg-border" />
              <span>{selectedReward.unlock.mode === "any" ? "ou" : "e"}</span>
              <span className="h-px flex-1 bg-border" />
            </div>}
            {selectedReward.unlock?.referralMin != null && <div className="flex items-center gap-4 px-1 py-2">
              <Users className="size-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Indicações</p>
                <p className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">{formatReferrals(selectedReward.unlock.referralMin)}</p>
              </div>
            </div>}
          </div>
        </DialogContent>}
      </Dialog>
    </section>
  );
}
