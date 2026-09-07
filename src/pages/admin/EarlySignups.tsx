import { useEffect, useState, type FormEvent } from "react";
import { Check, Gift, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { getCustomizationTree, getEarlySignupSettings, saveEarlySignupSettings } from "@/api/admin/admin.routes";
import type { CustomizationCategory, EarlySignupInput, EarlySignupSettings } from "@/api/admin/admin.types";
import { ApiError } from "@/api/http";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileNav } from "@/components/MobileNav";
import { CustomizationImage } from "@/components/customization/CustomizationImage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Switch } from "@/components/ui/switch";

type RewardItem = {
  id: number;
  label: string;
  optionKey?: string;
  value: string | null;
  active: boolean;
  field: "optionIds" | "categoryIds";
  free: boolean;
};

export default function EarlySignups() {
  const [categories, setCategories] = useState<CustomizationCategory[]>([]);
  const [saved, setSaved] = useState<EarlySignupSettings | null>(null);
  const [form, setForm] = useState<EarlySignupInput | null>(null);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([getCustomizationTree(), getEarlySignupSettings()]).then(([tree, settings]) => {
      if (!alive) return;
      setCategories(tree.categories);
      setSaved(settings);
      setForm({ isActive: settings.isActive, userLimit: settings.userLimit, optionIds: settings.optionIds, categoryIds: settings.categoryIds });
      setError(null);
    }).catch((err: unknown) => {
      if (alive) setError(err instanceof ApiError ? err.message : "Não foi possível carregar os benefícios.");
    });
    return () => { alive = false; };
  }, [reload]);

  const byId = new Map(categories.map((category) => [category.id, category]));
  function isActive(category: CustomizationCategory): boolean {
    const parent = category.parentId === null ? undefined : byId.get(category.parentId);
    return category.isActive && (!parent || isActive(parent));
  }
  const groups: (CustomizationCategory & { items: RewardItem[] })[] = categories.filter((category) => category.kind !== "group").map((category) => ({
    ...category,
    items: category.kind === "feature"
      ? [{ id: category.id, label: category.label, optionKey: undefined, value: null, active: isActive(category), field: "categoryIds" as const, free: !category.unlock }]
      : category.options.filter((option) => option.key !== "default" && option.key !== "none").map((option) => ({
        id: option.id, label: option.label, optionKey: option.key, value: option.value,
        active: isActive(category) && option.isActive, field: "optionIds" as const, free: !option.unlock,
      })),
  }));
  const selected = groups.flatMap((group) => group.items).filter((item) => form?.[item.field].includes(item.id));
  const invalidLimit = !form || !Number.isInteger(form.userLimit) || form.userLimit < 1 || form.userLimit > 1_000_000;
  const invalidActive = form?.isActive && (!selected.length || selected.some((item) => !item.active));
  const dirty = !!form && !!saved && (form.isActive !== saved.isActive || form.userLimit !== saved.userLimit
    || (["optionIds", "categoryIds"] as const).some((field) => form[field].length !== saved[field].length
      || form[field].some((id) => !saved[field].includes(id))));

  function toggle(field: "optionIds" | "categoryIds", id: number) {
    setFeedback(null);
    setForm((current) => current && ({ ...current, [field]: current[field].includes(id)
      ? current[field].filter((value) => value !== id) : [...current[field], id] }));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!form || invalidLimit || invalidActive || saving) return;
    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      const result = await saveEarlySignupSettings(form);
      setSaved(result);
      setForm({ isActive: result.isActive, userLimit: result.userLimit, optionIds: result.optionIds, categoryIds: result.categoryIds });
      setFeedback(result.isActive ? "Benefícios salvos e liberados para os primeiros inscritos elegíveis." : "Configuração salva. Distribuição pausada; benefícios anteriores preservados.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar. Tente novamente.");
    } finally { setSaving(false); }
  }

  return (
    <SidebarProvider className="h-svh">
      <AppSidebar />
      <SidebarInset className="min-w-0 overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
          <Gift className="size-5" /><span className="text-lg font-semibold">Primeiros inscritos</span>
        </header>
        <main className="flex-1 overflow-y-auto px-4 pt-6 pb-24 sm:px-8 md:pb-10">
          <div className="mx-auto max-w-6xl space-y-6">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Um presente para quem chegou primeiro.</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Escolha um modelo, uma textura ou monte um combo de personalizações. Os primeiros inscritos recebem os itens automaticamente, sem doação ou indicação.</p>
            </div>
            {error && <div role="alert" className="rounded-xl border border-destructive/40 p-4 text-sm text-destructive">
              {error}{!form && <Button variant="outline" className="ml-3" onClick={() => setReload((value) => value + 1)}>Tentar novamente</Button>}
            </div>}
            {feedback && <p role="status" className="rounded-xl border bg-muted/40 p-4 text-sm">{feedback}</p>}
            {!form || !saved ? (!error && <p role="status" className="text-sm text-muted-foreground">Carregando benefícios…</p>) : (
              <form onSubmit={(event) => void save(event)} className="space-y-6">
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    ["Distribuição", saved.isActive ? "Ativa" : "Pausada"],
                    ["Usuários já beneficiados", saved.rewardedCount.toLocaleString("pt-BR")],
                    ["Posições para novos cadastros", Math.max(0, saved.userLimit - saved.registeredCount).toLocaleString("pt-BR")],
                  ].map(([label, value]) => <div key={label} className="rounded-xl border bg-card p-5">
                    <p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p>
                  </div>)}
                </div>
                <fieldset disabled={saving} className="space-y-6 disabled:opacity-70">
                  <div className="flex flex-wrap items-start justify-between gap-6 rounded-xl border bg-card p-5">
                    <div className="max-w-lg space-y-2">
                      <label htmlFor="signup-limit" className="text-sm font-medium">Quantos primeiros inscritos vão receber?</label>
                      <Input id="signup-limit" type="number" min={1} max={1_000_000} step={1} required className="w-40" value={Number.isNaN(form.userLimit) ? "" : form.userLimit}
                        onChange={(event) => setForm({ ...form, userLimit: event.target.valueAsNumber })} />
                      <p className="text-xs leading-5 text-muted-foreground">Conta desde o início da plataforma, incluindo cadastros anteriores. Administradores não entram; contas desativadas não cedem sua posição.</p>
                    </div>
                    <label className="flex cursor-pointer items-center gap-3 text-sm font-medium">
                      Distribuir benefícios
                      <Switch checked={form.isActive} disabled={saving} onCheckedChange={(isActive) => setForm({ ...form, isActive })} aria-label="Distribuir benefícios" />
                    </label>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div><h2 className="text-xl font-semibold">Monte o combo</h2><p className="mt-1 text-sm text-muted-foreground">Selecione um ou mais itens. {selected.length} selecionado(s).</p></div>
                    <Button asChild variant="outline" size="sm"><Link to="/dale/personalizacoes">Gerenciar catálogo</Link></Button>
                  </div>
                  {groups.map((group) => group.items.length > 0 && (
                    <section key={group.id} aria-label={group.label} className="space-y-3">
                      <h3 className="text-sm font-semibold">{group.label}</h3>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                        {group.items.map((item) => {
                          const checked = form[item.field].includes(item.id);
                          return <label key={item.id} className={`relative cursor-pointer overflow-hidden rounded-xl border bg-card transition-colors ${checked ? "border-primary ring-1 ring-primary" : "hover:border-primary/50"}`}>
                            <input type="checkbox" className="peer sr-only" checked={checked} onChange={() => toggle(item.field, item.id)} />
                            <span className="absolute inset-0 rounded-xl peer-focus-visible:ring-2 peer-focus-visible:ring-ring" />
                            <span className={`absolute top-2 right-2 z-10 flex size-5 items-center justify-center rounded border ${checked ? "border-primary bg-primary text-primary-foreground" : "bg-background"}`} aria-hidden>{checked && <Check className="size-3" />}</span>
                            <div className="h-28 bg-muted/40 p-3"><CustomizationImage categoryKey={group.key} optionKey={item.optionKey} value={item.value} /></div>
                            <div className="space-y-1 p-3"><p className="text-sm font-medium">{item.label}</p><p className="text-xs text-muted-foreground">{!item.active ? "Inativo no catálogo" : item.free ? "Já é grátis para todos" : "Liberação antecipada"}</p></div>
                          </label>;
                        })}
                      </div>
                    </section>
                  ))}
                  {!groups.some((group) => group.items.length) && <p className="text-sm text-muted-foreground">Nenhum item disponível. Configure o catálogo de personalizações primeiro.</p>}
                </fieldset>
                <div className="sticky bottom-0 space-y-3 rounded-xl border bg-background/95 p-4 backdrop-blur">
                  <p className="text-sm"><strong>Combo:</strong> {selected.map((item) => item.label).join(" · ") || "Nenhum item selecionado"}</p>
                  <p className="text-xs leading-5 text-muted-foreground">Salvar com a distribuição ativa também beneficia os cadastros anteriores elegíveis. Itens recebidos são permanentes: pausar, reduzir o limite ou remover itens não revoga conquistas. As regras do passe continuam valendo para os demais usuários.</p>
                  {invalidActive && <p className="text-sm text-destructive">Para ativar, escolha pelo menos um item e mantenha todos os selecionados ativos no catálogo.</p>}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs text-muted-foreground">{dirty ? "Alterações ainda não salvas" : "Configuração salva"}</span>
                    <Button type="submit" disabled={saving || invalidLimit || !!invalidActive || !dirty}>
                      {saving ? <Loader2 className="size-4 animate-spin" /> : <Gift className="size-4" />}{saving ? "Salvando…" : "Salvar benefícios"}
                    </Button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </main>
        <MobileNav />
      </SidebarInset>
    </SidebarProvider>
  );
}
