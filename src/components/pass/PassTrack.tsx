import { useRef } from "react";
import { ArrowLeft, ArrowRight, Gift, HandCoins, Pencil, Trophy, Users } from "lucide-react";
import { sortPassRewards, type PassReward } from "@/lib/pass";
import { formatBRL, formatReferrals } from "@/lib/unlock";
import { CustomizationImage } from "@/components/customization/CustomizationImage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/** Sem onConfigure = visualização pública. Cada recompensa ocupa um cartão. */
export function PassTrack<T extends PassReward>({ rewards, onConfigure }: {
  rewards: readonly T[];
  onConfigure?: (reward: T) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const ordered = sortPassRewards(rewards);

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
          <h2 className="text-lg font-semibold">Trilha de recompensas</h2>
          <p className="mt-1 text-sm text-muted-foreground">Da mais fácil à mais difícil. Explore para o lado.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="mr-2 text-xs tabular-nums text-muted-foreground">{ordered.length} recompensas</span>
          <Button variant="outline" size="icon" aria-label="Ver recompensas anteriores" onClick={() => scroll(-1)}><ArrowLeft /></Button>
          <Button variant="outline" size="icon" aria-label="Ver próximas recompensas" onClick={() => scroll(1)}><ArrowRight /></Button>
        </div>
      </div>

      <div ref={trackRef} tabIndex={0} role="region" aria-label="Recompensas em ordem de dificuldade; use as setas para explorar"
        className="overflow-x-auto overscroll-x-contain rounded-xl pb-5 focus-visible:outline-2 focus-visible:outline-ring snap-x snap-proximity">
        <ol className="flex w-max min-w-full items-stretch gap-5 px-1 pt-1">
          {ordered.map((reward, index) => (
            <li key={reward.key} className="relative flex w-56 shrink-0 snap-start flex-col sm:w-60">
              <div className="relative mb-5 flex h-9 items-center justify-center">
                {index < ordered.length - 1 && <div className="absolute top-1/2 left-1/2 h-px w-[calc(100%+1.25rem)] bg-border" aria-hidden />}
                <span className={`relative flex size-9 items-center justify-center rounded-full border text-xs font-semibold tabular-nums ${reward.unlock ? "border-primary/30 bg-background text-foreground" : "border-emerald-600/30 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"}`}>
                  <span className="sr-only">Recompensa </span>{String(index + 1).padStart(2, "0")}
                </span>
              </div>
              <article className="flex flex-1 flex-col overflow-hidden rounded-2xl border bg-card shadow-sm">
                <div className="relative border-b bg-radial from-primary/10 to-transparent">
                  <div className="absolute inset-x-3 top-3 z-10 flex justify-between gap-2">
                    <Badge variant="outline" className="bg-background/90">
                      {reward.unlock ? <Trophy /> : <Gift />}{reward.unlock ? "Conquista" : "Grátis"}
                    </Badge>
                    {reward.isActive === false && <Badge variant="secondary">Inativa</Badge>}
                  </div>
                  <div className="h-52 p-5 pt-12">
                    <CustomizationImage categoryKey={reward.categoryKey} optionKey={reward.optionKey} value={reward.value} />
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <p className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">{reward.categoryLabel}</p>
                  <h3 className="mt-1 min-h-12 text-base leading-6 font-semibold break-words">{reward.label}</h3>
                  <div className="mt-4 flex-1 space-y-2 border-t pt-4 text-sm">
                    {!reward.unlock && <p className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400"><Gift className="size-4 shrink-0" />Disponível para todos</p>}
                    {reward.unlock?.donationMin != null && <p className="flex items-start gap-2"><HandCoins className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><span><strong className="font-semibold">{formatBRL(reward.unlock.donationMin)}</strong><span className="block text-xs text-muted-foreground">em doações acumuladas</span></span></p>}
                    {reward.unlock?.referralMin != null && <p className="flex items-center gap-2"><Users className="size-4 shrink-0 text-muted-foreground" /><span>{reward.unlock.donationMin != null && "+ "}{formatReferrals(reward.unlock.referralMin)}</span></p>}
                  </div>
                  {onConfigure && <Button variant="outline" size="sm" className="mt-5 w-full" aria-label={`Configurar liberação de ${reward.label}`} onClick={() => onConfigure(reward)}><Pencil />Configurar</Button>}
                </div>
              </article>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
