import { useState } from "react";
import { ApiError } from "@/api/http";
import { domAnimation, LazyMotion, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { Trophy } from "lucide-react";
import type { RewardNotifications } from "@/components/hooks/useCustomizationCatalog";
import { formatRewardReason } from "@/lib/rewardNotifications";
import { CustomizationImage } from "@/components/customization/CustomizationImage";
import { Button } from "@/components/ui/button";
import { BlockLoader, ErrorMark } from "@/components/ui/pixel-icon";
import { Dialog, DialogContent, DialogDescription, DialogKicker, DialogTitle } from "@/components/ui/dialog";

const sparks = [[-78, -52], [0, -75], [78, -52], [95, 5], [75, 62], [0, 80], [-75, 62], [-95, 5]];

/** Montado sob demanda, depois que os outros fluxos liberam a tela. */
export default function RewardDialog({ rewards }: { rewards: RewardNotifications }) {
  const reducedMotion = useReducedMotion();
  const [selected, setSelected] = useState<{ referralMin: number; key: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [first, ...others] = rewards.pending;
  const choice = rewards.choice;
  const selectedKey = selected?.referralMin === choice?.referralMin ? selected?.key : null;
  if (!first && !choice) return null;
  async function confirm() {
    if (!choice || !selectedKey || saving) return;
    setSaving(true);
    setError(null);
    try { await rewards.choose(choice.referralMin, selectedKey); setSelected(null); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Não foi possível confirmar. Tente novamente."); }
    finally { setSaving(false); }
  }
  if (!first && choice) return (
    <LazyMotion features={domAnimation} strict>
      <Dialog open onOpenChange={(open) => { if (!open && !saving) rewards.deferChoice(); }}>
        <DialogContent showCloseButton={false} className="gap-0 p-0 pb-1 sm:max-w-lg" onEscapeKeyDown={(event) => { if (saving) event.preventDefault(); }} onInteractOutside={(event) => { if (saving) event.preventDefault(); }}>
          <DialogKicker>Recompensa por indicação</DialogKicker>
          <m.div key={choice.referralMin} initial={{ opacity: 0, y: reducedMotion ? 0 : 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5 px-6 pt-5 pb-6">
            <div className="text-center">
              <Trophy className="mx-auto mb-3 size-6 text-primary" aria-hidden />
              <DialogTitle>Escolha sua recompensa</DialogTitle>
              <DialogDescription className="mt-2">Você completou {choice.referralMin} {choice.referralMin === 1 ? "indicação" : "indicações"}. Escolha um item para desbloquear.</DialogDescription>
            </div>
            <fieldset disabled={saving} className="space-y-3">
              <legend className="sr-only">Personalização desta etapa</legend>
              <div className="grid grid-cols-2 gap-3">
                {choice.rewards.map((reward) => <label key={reward.key} className={`relative cursor-pointer overflow-hidden pixel pixel-thin has-focus-visible:outline-3 has-focus-visible:outline-offset-4 has-focus-visible:outline-ring ${selectedKey === reward.key ? "bg-secondary pixel-ink-verde" : "bg-card hover:bg-accent"}`}>
                  <input type="radio" name="signup-reward" value={reward.key} checked={selectedKey === reward.key} onChange={() => { setSelected({ referralMin: choice.referralMin, key: reward.key }); setError(null); }} className="sr-only" />
                  {/* DS: radio quadrado; marcado = bloco verde no centro. */}
                  <span aria-hidden className="absolute top-2 right-2 z-10 grid size-5 place-items-center pixel pixel-thin bg-card">{selectedKey === reward.key && <span className="size-2.5 bg-primary" />}</span>
                  <div className="h-28 bg-background p-3"><CustomizationImage categoryKey={reward.categoryKey} optionKey={reward.optionKey ?? undefined} value={reward.value} /></div>
                  <div className="p-3"><p className="text-sm font-semibold">{reward.label}</p><p className="mt-1 text-xs text-muted-foreground">{reward.categoryLabel}</p></div>
                </label>)}
              </div>
            </fieldset>
            <p className="text-xs text-muted-foreground">Uma escolha por etapa. Os outros itens seguem no passe.</p>
            {rewards.nextChoice && <div className="pixel pixel-thin bg-accent p-3"><p className="mono-label text-primary">Próxima escolha</p><p className="mt-1 text-sm">Mais uma personalização com {rewards.nextChoice.referralMin} indicações. Faltam {rewards.nextChoice.referralMin - rewards.signupReferrals}.</p></div>}
            {error && <p role="alert" className="flex gap-2 text-sm text-destructive"><ErrorMark />{error}</p>}
            <Button className="w-full" size="lg" variant="reward" disabled={!selectedKey || saving} onClick={() => void confirm()}>{saving ? <><BlockLoader />Desbloqueando…</> : "Desbloquear escolha"}</Button>
            <Button className="w-full" variant="ghost" disabled={saving} onClick={rewards.deferChoice}>Escolher depois</Button>
          </m.div>
        </DialogContent>
      </Dialog>
    </LazyMotion>
  );
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
              <DialogDescription className="mt-2">{formatRewardReason(first.unlock, first.signupReferralMin)}</DialogDescription>
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
                    <p className="text-xs text-muted-foreground">{formatRewardReason(reward.unlock, reward.signupReferralMin)}</p>
                  </div>
                </li>)}
              </ul>
            </section>}

            {rewards.nextChoice && <section className="pixel pixel-thin bg-accent p-3" aria-label="Próxima escolha">
              <p className="mono-label text-primary">Próxima escolha</p>
              <p className="mt-1 text-sm">Escolha outro item com {rewards.nextChoice.referralMin} indicações. Faltam {rewards.nextChoice.referralMin - rewards.signupReferrals}.</p>
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
