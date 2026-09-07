import { useEffect, useState } from "react";
import { ArrowUpRight, Gift, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import { getCustomizationTree } from "@/api/admin/admin.routes";
import type { CustomizationCategory } from "@/api/admin/admin.types";
import { ApiError } from "@/api/http";
import { categoryTarget, optionTarget, type UnlockTarget } from "@/lib/adminUnlock";
import type { PassReward } from "@/lib/pass";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileNav } from "@/components/MobileNav";
import { UnlockDialog } from "@/components/admin/UnlockDialog";
import { PassTrack } from "@/components/pass/PassTrack";
import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";

type AdminReward = PassReward & { target: UnlockTarget };

function buildRewards(categories: CustomizationCategory[]): AdminReward[] {
  const byId = new Map(categories.map((category) => [category.id, category]));
  function isActive(category: CustomizationCategory): boolean {
    const parent = category.parentId === null ? undefined : byId.get(category.parentId);
    return category.isActive && (!parent || isActive(parent));
  }
  return categories.flatMap((category) => {
    const common = { categoryKey: category.key, categoryLabel: category.label, isActive: isActive(category) };
    if (category.kind === "feature") return [{
      ...common, key: `category-${category.id}`, label: category.label,
      unlock: category.unlock, target: categoryTarget(category),
    }];
    return category.options.filter((option) => option.key !== "default" && option.key !== "none")
      .map((option) => ({
        ...common, key: `option-${option.id}`, label: option.label, optionKey: option.key,
        value: option.value, unlock: option.unlock, isActive: common.isActive && option.isActive,
        target: optionTarget(option, category),
      }));
  });
}

export default function Pass() {
  const [categories, setCategories] = useState<CustomizationCategory[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [target, setTarget] = useState<UnlockTarget | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [userPreview, setUserPreview] = useState(false);

  useEffect(() => {
    let alive = true;
    getCustomizationTree().then((tree) => {
      if (!alive) return;
      setCategories(tree.categories);
      setLoadError(null);
    }).catch((err) => {
      if (alive) setLoadError(err instanceof ApiError ? err.message : "Falha ao carregar o passe");
    });
    return () => { alive = false; };
  }, [reloadKey]);

  const rewards = buildRewards(categories ?? []);
  const visible = userPreview ? rewards.filter((reward) => reward.isActive) : rewards;
  const freeCount = visible.filter((reward) => !reward.unlock).length;

  return (
    <SidebarProvider className="h-svh">
      <AppSidebar />
      <SidebarInset className="min-w-0 overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
          <Trophy className="size-5" />
          <span className="text-lg font-semibold tracking-tight">Passe</span>
        </header>
        <div className="min-w-0 flex-1 overflow-y-auto">
          <main className="mx-auto w-full max-w-7xl space-y-8 px-4 pt-6 pb-24 sm:px-8 sm:pt-8 md:pb-10">
            <div className="relative overflow-hidden rounded-2xl border bg-card p-6 sm:p-8">
              <Trophy className="pointer-events-none absolute -right-8 -bottom-8 size-60 rotate-12 text-primary/5" strokeWidth={1} aria-hidden />
              <div className="relative">
                <span className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">Passe de personalizações</span>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Uma cidade de conquistas.</h1>
                <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Cada doação e indicação abre novas possibilidades. Organize as recompensas que dão personalidade à cidade.</p>
                <Button asChild variant="outline" size="sm" className="mt-5">
                  <Link to="/dale/personalizacoes">Gerenciar personalizações<ArrowUpRight /></Link>
                </Button>
              </div>
            </div>

            {feedback && <p role="status" className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">{feedback}</p>}

            {loadError ? (
              <div role="alert" className="rounded-xl border border-destructive/40 p-6">
                <p className="text-sm text-destructive">{loadError}</p>
                <Button variant="outline" className="mt-3" onClick={() => setReloadKey((key) => key + 1)}>Tentar de novo</Button>
              </div>
            ) : categories === null ? (
              <div role="status" aria-label="Carregando passe" className="flex gap-5 overflow-hidden">
                {[0, 1, 2, 3].map((key) => <Skeleton key={key} className="h-96 w-60 shrink-0 rounded-2xl" />)}
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-2"><Gift className="size-4" /><strong className="text-foreground">{freeCount}</strong> grátis</span>
                    <span className="flex items-center gap-2"><Trophy className="size-4" /><strong className="text-foreground">{visible.length - freeCount}</strong> para conquistar</span>
                  </div>
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm">
                    Prévia do usuário
                    <Switch checked={userPreview} onCheckedChange={setUserPreview} aria-label="Prévia do usuário" />
                  </label>
                </div>
                <PassTrack rewards={visible} onConfigure={userPreview ? undefined : (reward) => setTarget(reward.target)} />
                <p className="text-xs leading-5 text-muted-foreground">
                  {userPreview
                    ? "Prévia das recompensas ativas. O progresso individual não é exibido nesta visualização."
                    : "Grátis primeiro, depois menor doação e menos indicações no desempate. Configure os requisitos em cada cartão; conquistas anteriores são preservadas."}
                </p>
              </>
            )}
          </main>
        </div>
        <MobileNav />
      </SidebarInset>
      {target && <UnlockDialog key={`${target.kind}-${target.id}`} target={target} onClose={() => setTarget(null)} onDone={(result) => {
        setFeedback(result?.text ?? null);
        setReloadKey((key) => key + 1);
      }} />}
    </SidebarProvider>
  );
}
