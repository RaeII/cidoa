import { domAnimation, LazyMotion, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { Trophy } from "lucide-react";
import type { RewardNotifications } from "@/components/hooks/useCustomizationCatalog";
import { formatRewardReason } from "@/lib/rewardNotifications";
import { CustomizationImage } from "@/components/customization/CustomizationImage";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogKicker, DialogTitle } from "@/components/ui/dialog";

const sparks = [[-78, -52], [0, -75], [78, -52], [95, 5], [75, 62], [0, 80], [-75, 62], [-95, 5]];

/** Montado sob demanda, depois que os outros fluxos liberam a tela. */
export default function RewardDialog({ rewards }: { rewards: RewardNotifications }) {
  const reducedMotion = useReducedMotion();
  const [first, ...others] = rewards.pending;
  if (!first) return null;
  const dismiss = () => rewards.dismiss(rewards.pending.map((reward) => reward.key));

  return (
    <LazyMotion features={domAnimation} strict>
      <Dialog open onOpenChange={(open) => { if (!open) dismiss(); }}>
        <DialogContent showCloseButton={false} className="gap-0 p-0 pb-1 text-foreground motion-reduce:animate-none sm:max-w-md">
          <DialogKicker>Conquista desbloqueada</DialogKicker>
          <div className="space-y-5 px-6 pt-5 pb-6">
            <div className="text-center">
              <div className="mb-2 flex items-center justify-center gap-2 text-primary">
                <Trophy className="size-4" aria-hidden />
                <span className="mono-label">{rewards.pending.length === 1 ? "Nova recompensa" : `${rewards.pending.length} novas recompensas`}</span>
              </div>
              <DialogTitle>{first.label}</DialogTitle>
              <DialogDescription className="mt-2">{formatRewardReason(first.unlock)}</DialogDescription>
            </div>

            <div className="relative grid h-48 place-items-center overflow-hidden bg-accent">
              {!reducedMotion && sparks.map(([x, y], index) => (
                <m.span key={index} aria-hidden className="absolute size-2 bg-ambar"
                  initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                  animate={{ x, y, opacity: [0, 1, 0], scale: [0, 1, 0.5] }}
                  transition={{ duration: 0.75, delay: 0.1 + index * 0.025, ease: "easeOut" }} />
              ))}
              <m.div className="relative h-40 w-48 p-3"
                initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.65, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={reducedMotion ? { duration: 0.15 } : { type: "spring", stiffness: 260, damping: 18 }}>
                <CustomizationImage categoryKey={first.categoryKey} optionKey={first.optionKey ?? undefined} value={first.value} />
              </m.div>
              <span className="mono-label absolute right-2 bottom-2 bg-card px-2 py-1">{first.categoryLabel}</span>
            </div>

            {others.length > 0 && <section aria-label="Outras recompensas recebidas" className="space-y-3">
              <h3 className="mono-label text-primary">Você também ganhou</h3>
              <ul className="space-y-3">
                {others.map((reward) => <li key={reward.key} className="flex items-center gap-3 border-t pt-3">
                  <div className="size-14 shrink-0 bg-accent p-1">
                    <CustomizationImage categoryKey={reward.categoryKey} optionKey={reward.optionKey ?? undefined} value={reward.value} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{reward.label}</p>
                    <p className="text-xs text-muted-foreground">{formatRewardReason(reward.unlock)}</p>
                  </div>
                </li>)}
              </ul>
            </section>}

            {rewards.next ? <section className="pixel pixel-thin space-y-2 bg-card p-3" aria-label="Próxima conquista">
              <p className="mono-label text-primary">Próxima conquista</p>
              <div className="flex items-center gap-3">
                <div className="size-12 shrink-0">
                  <CustomizationImage categoryKey={rewards.next.reward.categoryKey} optionKey={rewards.next.reward.optionKey} value={rewards.next.reward.value} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold">{rewards.next.reward.label}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{rewards.next.remaining}</p>
                </div>
              </div>
            </section> : <p className="text-center text-sm text-muted-foreground">Continue fazendo a diferença na cidade.</p>}

            <Button className="w-full" size="lg" onClick={dismiss}>Continuar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </LazyMotion>
  );
}
