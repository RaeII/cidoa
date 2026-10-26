import { useEffect, useState, type ReactNode } from "react";
import { Gift } from "lucide-react";
import { getEarlySignupSettings } from "@/api/admin/admin.routes";
import type { RewardNotifications } from "@/components/hooks/useCustomizationCatalog";
import { useAuth } from "@/hooks/useAuth";
import { BlockBar } from "@/components/ui/block-bar";
import { PixelGift } from "@/components/ui/pixel-icon";

/**
 * Contador da placa da cena: indicações até o próximo presente da campanha de cadastro.
 * A barra nasce com 1 bloco aceso (progresso dado) e termina no presente. Admin não participa:
 * vê a prévia da 1ª faixa com 0 indicações. Sem próxima faixa, mostra `fallback`.
 */
export function ReferralHud({ rewards, fallback }: { rewards: RewardNotifications; fallback: ReactNode }) {
  const { user, isAdmin } = useAuth();
  const [adminGoal, setAdminGoal] = useState<number>();

  useEffect(() => {
    if (!isAdmin) return;
    let alive = true;
    getEarlySignupSettings()
      .then((settings) => {
        const mins = settings.tiers.map((tier) => tier.referralMin);
        if (alive) setAdminGoal(settings.isActive && mins.length ? Math.min(...mins) : undefined);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [isAdmin]);

  const goal = !user ? undefined : isAdmin ? adminGoal : rewards.nextChoice?.referralMin;
  if (goal == null) return fallback;

  const referrals = isAdmin ? 0 : rewards.signupReferrals;
  const left = Math.max(1, goal - referrals);
  const steps = goal + 1;

  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 font-semibold text-foreground">
        <Gift className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
        <span className="truncate">
          {left === 1 ? "Falta" : "Faltam"} apenas {left} {left === 1 ? "indicação" : "indicações"}
        </span>
      </p>
      <div className="mt-1 flex items-center gap-1.5">
        <BlockBar
          size="sm"
          className="flex-1"
          value={referrals + 1}
          max={steps}
          blocks={steps}
          highlightNext={false}
          label="Progresso até o próximo presente"
        />
        <PixelGift className="size-3.5" />
      </div>
    </div>
  );
}
