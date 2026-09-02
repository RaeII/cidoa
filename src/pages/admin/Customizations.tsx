import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { EllipsisVertical, Loader2, Lock, Palette, Pencil, Plus, Trash2, Trophy } from "lucide-react";
import {
  createCustomizationOption,
  deleteCustomizationOption,
  getCustomizationTree,
  updateCustomizationCategory,
  updateCustomizationOption,
} from "@/api/admin/admin.routes";
import type {
  CustomizationCategory,
  CustomizationOption,
} from "@/api/admin/admin.types";
import { ApiError } from "@/api/http";
import {
  formatUnlockCta,
  formatUnlockRequirement,
  type UnlockRule,
} from "@/lib/unlock";
import {
  FACADE_TEXTURE_FOLDERS,
  resolveFacadeFolder,
  type FacadeTextureInfo,
} from "@/scene/textures/facadeTextureManifest";
import type { PreviewSubject } from "@/scene/builders/createPreviewScene";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileNav } from "@/components/MobileNav";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Switch } from "@/components/ui/switch";

// three.js só entra quando uma categoria com preview aparece na tela — as outras
// páginas do admin compartilham o mesmo chunk e não podem pagar por isso. Por
// isso nada daqui importa builder de forma estática (só `import type`).
const previewModule = () => import("@/components/three/CustomizationPreview");
const PreviewThumb = lazy(() =>
  previewModule().then((m) => ({ default: m.CustomizationThumb })),
);
const PreviewCanvas = lazy(() =>
  previewModule().then((m) => ({ default: m.CustomizationPreview })),
);

/** Categoria do catálogo -> tipo de preview 3D. Fora daqui, linha sem miniatura. */
const PREVIEW_KIND: Record<string, PreviewSubject["kind"]> = {
  shape: "shape",
  rooftop: "rooftop",
  edge_light: "edgeLight",
};

/**
 * Estado base do edifício (formato padrão, sem topo, LED desligado). O backend
 * recusa requisito nessas — travá-las deixaria o prédio sem nada. A UI nem
 * oferece a ação, em vez de deixar o admin descobrir pelo erro 400.
 */
const BASELINE_OPTION_KEYS = new Set(["default", "none"]);

/** Alvo de uma regra de liberação: uma opção ou uma categoria-feature. */
type UnlockTarget = {
  kind: "option" | "category";
  id: number;
  label: string;
  /** Categoria a que pertence — dá contexto ao chip na visão Passe. */
  context: string;
  unlock: UnlockRule;
  unlockedCount: number;
};

function optionTarget(option: CustomizationOption, category: CustomizationCategory): UnlockTarget {
  return {
    kind: "option",
    id: option.id,
    label: option.label,
    context: category.label,
    unlock: option.unlock,
    unlockedCount: option.unlockedCount,
  };
}

function categoryTarget(category: CustomizationCategory): UnlockTarget {
  return {
    kind: "category",
    id: category.id,
    label: category.label,
    context: "Customização",
    unlock: category.unlock,
    unlockedCount: category.unlockedCount,
  };
}

/** Categoria-feature (Letreiro/Holograma) carrega a regra na própria categoria. */
const isFeature = (category: CustomizationCategory) => category.kind === "feature";

/**
 * Aceita as duas formas que o admin digita: "50,90" (vírgula, pt-BR) e "50.90".
 * A vírgula decide: com ela, ponto é separador de milhar. Devolve null para
 * qualquer coisa que não seja um valor exigível (vazio, zero, texto).
 */
function parseMoney(raw: string): number | null {
  const text = raw.trim();
  if (!text) return null;
  const normalized = text.includes(",")
    ? text.replace(/\./g, "").replace(",", ".")
    : text;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100) / 100;
}

function parseCount(raw: string): number | null {
  const parsed = Number(raw.trim());
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

/** Badge do requisito. Grátis fica discreto; regra chama atenção. */
function UnlockBadge({ unlock, baseline }: { unlock: UnlockRule; baseline?: boolean }) {
  if (baseline) {
    return (
      <Badge variant="outline" title="Estado padrão do edifício — sempre disponível">
        Padrão
      </Badge>
    );
  }
  return (
    <Badge variant={unlock ? "secondary" : "muted"}>
      {unlock && <Trophy />}
      {formatUnlockRequirement(unlock)}
    </Badge>
  );
}

type Feedback = { ok: boolean; text: string } | null;
type ToggleTarget = {
  type: "category" | "option";
  id: number;
  label: string;
  isActive: boolean;
};

function errMsg(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.message : fallback;
}

/** Pasta -> key válida no backend (/^[a-z0-9-]+$/). */
function folderToKey(folder: string): string {
  return folder.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Pastas de textura no repo que ainda não viraram opção do catálogo. */
function unregisteredFacadeFolders(options: CustomizationOption[]): FacadeTextureInfo[] {
  const registered = new Set(options.map((o) => resolveFacadeFolder(o.value)));
  return FACADE_TEXTURE_FOLDERS.filter((f) => !registered.has(f.folder));
}

/** Diálogo criar/editar opção. Reinicia o form ao trocar de alvo (key no pai). */
type DialogState =
  | { mode: "create"; category: CustomizationCategory }
  | { mode: "edit"; category: CustomizationCategory; option: CustomizationOption };

function OptionDialog({
  state,
  onClose,
  onDone,
}: {
  state: DialogState;
  onClose: () => void;
  onDone: (fb: Feedback) => void;
}) {
  const isColor = state.category.key === "color";
  const initial = state.mode === "edit" ? state.option : null;
  const [key, setKey] = useState(initial?.key ?? "");
  const [label, setLabel] = useState(initial?.label ?? "");
  const [value, setValue] = useState(initial?.value ?? (isColor ? "#8A8F94" : ""));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      if (state.mode === "create") {
        await createCustomizationOption({
          categoryId: state.category.id,
          key,
          label,
          value: value.trim() || undefined,
        });
        onDone({ ok: true, text: `Opção "${label}" criada.` });
      } else {
        await updateCustomizationOption(state.option.id, {
          label,
          value: value.trim() || null,
        });
        onDone({ ok: true, text: `Opção "${label}" atualizada.` });
      }
      onClose();
    } catch (err) {
      setError(errMsg(err, "Falha ao salvar"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {state.mode === "create" ? "Nova opção" : "Editar opção"} · {state.category.label}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {state.mode === "create" && (
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Identificador (key)</span>
              <Input
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="ex: azul-noite"
              />
              <span className="text-xs text-muted-foreground">
                Minúsculas, números e hífen. Não muda depois de criado.
              </span>
            </label>
          )}
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Nome</span>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="ex: Azul Noite" />
          </label>
          {state.category.isExtensible && (
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">{isColor ? "Cor (hex)" : "Valor / URL"}</span>
              <div className="flex items-center gap-2">
                {isColor && (
                  <input
                    type="color"
                    value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#8A8F94"}
                    onChange={(e) => setValue(e.target.value)}
                    className="h-9 w-12 shrink-0 rounded border"
                  />
                )}
                <Input
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={isColor ? "#8A8F94" : "texture/..."}
                />
              </div>
            </label>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button onClick={() => void handleSave()} disabled={saving || !label.trim() || (state.mode === "create" && !key.trim())}>
            {saving && <Loader2 className="animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Define o requisito de liberação de uma personalização.
 *
 * Cada eixo é um Switch + input. O Switch é o que torna impossível gravar
 * zero: "não exigir" é um estado do controle, não um número digitado — que é
 * exatamente o que impede a tela do usuário de dizer "R$ 30 e 0 indicações".
 */
function UnlockDialog({
  target,
  onClose,
  onDone,
}: {
  target: UnlockTarget;
  onClose: () => void;
  onDone: (fb: Feedback) => void;
}) {
  const [requireDonation, setRequireDonation] = useState(target.unlock?.donationMin != null);
  const [donation, setDonation] = useState(
    target.unlock?.donationMin != null ? String(target.unlock.donationMin).replace(".", ",") : "",
  );
  const [requireReferral, setRequireReferral] = useState(target.unlock?.referralMin != null);
  const [referral, setReferral] = useState(
    target.unlock?.referralMin != null ? String(target.unlock.referralMin) : "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const donationMin = requireDonation ? parseMoney(donation) : null;
  const referralMin = requireReferral ? parseCount(referral) : null;
  const incomplete =
    (requireDonation && donationMin === null) || (requireReferral && referralMin === null);
  const preview: UnlockRule =
    donationMin == null && referralMin == null ? null : { donationMin, referralMin };

  async function handleSave() {
    setSaving(true);
    setError(null);
    // Manda os dois eixos sempre: este diálogo é dono da regra inteira, então
    // null aqui significa "limpa", não "não mexe".
    const payload = { unlockDonationMin: donationMin, unlockReferralMin: referralMin };
    try {
      if (target.kind === "option") await updateCustomizationOption(target.id, payload);
      else await updateCustomizationCategory(target.id, payload);
      onDone({ ok: true, text: `Liberação de "${target.label}" atualizada.` });
      onClose();
    } catch (err) {
      setError(errMsg(err, "Falha ao salvar liberação"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Liberação · {target.label}</DialogTitle>
          <DialogDescription>
            O que o usuário precisa fazer para conquistar esta personalização.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-sm font-medium">Exigir doação</span>
                <p className="text-xs text-muted-foreground">
                  Soma de tudo que o usuário já doou.
                </p>
              </div>
              <Switch
                checked={requireDonation}
                onCheckedChange={setRequireDonation}
                aria-label="Exigir doação"
              />
            </div>
            {requireDonation && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">R$</span>
                <Input
                  autoFocus
                  inputMode="decimal"
                  value={donation}
                  onChange={(e) => setDonation(e.target.value)}
                  placeholder="50,00"
                  aria-label="Valor mínimo de doação"
                />
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-sm font-medium">Exigir indicações</span>
                <p className="text-xs text-muted-foreground">
                  Total histórico de pessoas que entraram pelo código dele.
                </p>
              </div>
              <Switch
                checked={requireReferral}
                onCheckedChange={setRequireReferral}
                aria-label="Exigir indicações"
              />
            </div>
            {requireReferral && (
              <Input
                inputMode="numeric"
                value={referral}
                onChange={(e) => setReferral(e.target.value)}
                placeholder="3"
                aria-label="Número mínimo de indicações"
              />
            )}
          </div>

          <div className="rounded-lg bg-muted/50 p-3">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              O usuário vai ler
            </span>
            <p className="mt-1 text-sm font-medium">{formatUnlockCta(preview)}</p>
          </div>

          {target.unlockedCount > 0 && (
            <p className="flex items-start gap-2 rounded-lg border border-accent/40 bg-accent/5 p-3 text-xs">
              <Trophy className="mt-0.5 size-3.5 shrink-0" />
              <span>
                <strong>{target.unlockedCount}</strong>{" "}
                {target.unlockedCount === 1 ? "usuário já conquistou" : "usuários já conquistaram"}{" "}
                esta personalização e {target.unlockedCount === 1 ? "mantém" : "mantêm"} o acesso.
                A regra nova só vale para quem ainda não conquistou.
              </span>
            </p>
          )}

          {incomplete && (
            <p className="text-sm text-destructive">
              Preencha um valor maior que zero, ou desligue a exigência.
            </p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            variant="ghost"
            disabled={saving || (!requireDonation && !requireReferral)}
            onClick={() => {
              setRequireDonation(false);
              setRequireReferral(false);
            }}
          >
            Tornar grátis
          </Button>
          <div className="flex gap-2">
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={() => void handleSave()} disabled={saving || incomplete}>
              {saving && <Loader2 className="animate-spin" />}
              Salvar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OptionRow({
  option,
  isColor,
  subject,
  busy,
  onToggle,
  onEdit,
  onDelete,
  onPreview,
  onSetUnlock,
}: {
  option: CustomizationOption;
  isColor: boolean;
  /** Opção renderizável em 3D (formato/topo/LED) — mostra miniatura clicável. */
  subject: PreviewSubject | null;
  busy: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onPreview: () => void;
  onSetUnlock: () => void;
}) {
  // Estado base nunca é conquista: sem badge de regra e sem a ação no menu.
  const isBaseline = BASELINE_OPTION_KEYS.has(option.key);
  return (
    <div className="flex items-center gap-3 rounded-lg border px-3 py-2">
      {subject && (
        <button
          type="button"
          onClick={onPreview}
          title={`Ver ${option.label} em 3D`}
          aria-label={`Ver ${option.label} em 3D`}
          className={`size-12 shrink-0 overflow-hidden rounded-md border bg-muted/40 transition-colors hover:border-foreground/40 ${option.isActive ? "" : "opacity-40"}`}
        >
          <Suspense fallback={null}>
            <PreviewThumb subject={subject} className="size-full object-contain" />
          </Suspense>
        </button>
      )}
      {isColor && option.value && (
        <span
          className="size-5 shrink-0 rounded border"
          style={{ backgroundColor: option.value }}
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`truncate text-sm font-medium ${option.isActive ? "" : "text-muted-foreground line-through"}`}>
            {option.label}
          </span>
          {option.isCodeBound && <Lock className="size-3 text-muted-foreground" aria-label="Presa a código" />}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">{option.key}{option.value ? ` · ${option.value}` : ""}</span>
          <UnlockBadge unlock={option.unlock} baseline={isBaseline} />
        </div>
      </div>
      <span className="text-xs font-medium text-muted-foreground">
        {option.isActive ? "Ativa" : "Inativa"}
      </span>
      <Switch
        checked={option.isActive}
        disabled={busy}
        onCheckedChange={onToggle}
        aria-label={`${option.isActive ? "Desativar" : "Ativar"} opção ${option.label}`}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            disabled={busy}
            aria-label={`Ações de ${option.label}`}
          >
            <EllipsisVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onEdit}>
            <Pencil />
            Editar
          </DropdownMenuItem>
          {!isBaseline && (
            <DropdownMenuItem onSelect={onSetUnlock}>
              <Trophy />
              Definir liberação
            </DropdownMenuItem>
          )}
          {!option.isCodeBound && (
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              <Trash2 />
              Excluir
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

type PassStep = { key: string; unlock: UnlockRule; entries: UnlockTarget[] };

/**
 * Trilha do passe: toda personalização agrupada por requisito idêntico e
 * ordenada por esforço. A visão em lista mostra uma categoria por vez e
 * esconde a curva — buraco entre R$10 e R$500, ou dez conquistas empilhadas no
 * mesmo degrau, só aparecem com tudo lado a lado.
 */
function buildPass(categories: CustomizationCategory[]): PassStep[] {
  const steps = new Map<string, PassStep>();
  const push = (target: UnlockTarget) => {
    const key = `${target.unlock?.donationMin ?? ""}|${target.unlock?.referralMin ?? ""}`;
    const step = steps.get(key);
    if (step) step.entries.push(target);
    else steps.set(key, { key, unlock: target.unlock, entries: [target] });
  };

  for (const category of categories) {
    if (isFeature(category)) push(categoryTarget(category));
    for (const option of category.options) {
      if (BASELINE_OPTION_KEYS.has(option.key)) continue;
      push(optionTarget(option, category));
    }
  }

  // Grátis (ambos null) cai em 0/0 e abre a trilha, que é onde ele pertence.
  return [...steps.values()].sort(
    (a, b) =>
      (a.unlock?.donationMin ?? 0) - (b.unlock?.donationMin ?? 0) ||
      (a.unlock?.referralMin ?? 0) - (b.unlock?.referralMin ?? 0),
  );
}

function PassView({
  steps,
  onSelect,
}: {
  steps: PassStep[];
  onSelect: (target: UnlockTarget) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Todas as personalizações na ordem em que o usuário conquista. Salto grande entre dois
        degraus trava o passe; degrau com muita coisa junta entrega tudo de uma vez. Clique em
        qualquer uma para mudar a regra.
      </p>
      <ol className="space-y-3">
        {steps.map((step) => (
          <li key={step.key} className="rounded-xl border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <UnlockBadge unlock={step.unlock} />
              <span className="text-xs text-muted-foreground">
                {step.entries.length === 1
                  ? "1 personalização"
                  : `${step.entries.length} personalizações`}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {step.entries.map((entry) => (
                <button
                  key={`${entry.kind}-${entry.id}`}
                  type="button"
                  onClick={() => onSelect(entry)}
                  title={`Definir liberação de ${entry.label}`}
                  className="rounded-md border px-2 py-1 text-xs transition-colors hover:border-foreground/40 hover:bg-muted"
                >
                  <span className="text-muted-foreground">{entry.context}</span> · {entry.label}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Customizations() {
  const [categories, setCategories] = useState<CustomizationCategory[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [toggleTarget, setToggleTarget] = useState<ToggleTarget | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [preview, setPreview] = useState<{ subject: PreviewSubject; title: string } | null>(null);
  const [unlockTarget, setUnlockTarget] = useState<UnlockTarget | null>(null);
  const [view, setView] = useState<"list" | "pass">("list");

  useEffect(() => {
    let alive = true;
    getCustomizationTree()
      .then((tree) => {
        if (!alive) return;
        setCategories(tree.categories);
        setLoadError(null);
      })
      .catch((err) => {
        if (alive) setLoadError(errMsg(err, "Falha ao carregar catálogo"));
      });
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const reload = () => setReloadKey((k) => k + 1);

  async function run(id: number, fn: () => Promise<void>, okText: string) {
    setBusyId(id);
    setFeedback(null);
    try {
      await fn();
      setFeedback({ ok: true, text: okText });
      reload();
    } catch (err) {
      setFeedback({ ok: false, text: errMsg(err, "Falha na operação") });
    } finally {
      setBusyId(null);
    }
  }

  function confirmToggle() {
    if (!toggleTarget) return;

    const { type, id, label, isActive } = toggleTarget;
    setToggleTarget(null);
    void run(
      id,
      () => type === "category"
        ? updateCustomizationCategory(id, { isActive: !isActive })
        : updateCustomizationOption(id, { isActive: !isActive }),
      `${type === "category" ? "Categoria" : "Opção"} "${label}" ${isActive ? "desativada" : "ativada"}.`,
    );
  }

  function renderCategory(category: CustomizationCategory, all: CustomizationCategory[]) {
    const children = all
      .filter((c) => c.parentId === category.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const isColor = category.key === "color";
    const previewKind = PREVIEW_KIND[category.key];
    const isTexture = category.key === "texture";
    const unregistered = isTexture ? unregisteredFacadeFolders(category.options) : [];
    const busy = busyId === category.id;

    return (
      <Card key={category.id} className={category.isActive ? "" : "opacity-60"}>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{category.label}</CardTitle>
            <CardDescription>
              {category.kind === "group"
                ? "Agrupa subcategorias"
                : category.kind === "feature"
                  ? "Recurso liga/desliga (aparece no painel quando ativo)"
                  : `${category.options.length} opção(ões)`}
            </CardDescription>
            {/* Feature não tem lista de opções — a regra vive na própria categoria. */}
            {isFeature(category) && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <UnlockBadge unlock={category.unlock} />
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => setUnlockTarget(categoryTarget(category))}
                >
                  <Trophy className="size-4" />
                  Definir liberação
                </Button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              {category.isActive ? "Ativa" : "Inativa"}
            </span>
            <Switch
              checked={category.isActive}
              disabled={busy}
              onCheckedChange={() => setToggleTarget({
                type: "category",
                id: category.id,
                label: category.label,
                isActive: category.isActive,
              })}
              aria-label={`${category.isActive ? "Desativar" : "Ativar"} categoria ${category.label}`}
            />
          </div>
        </CardHeader>

        {category.kind !== "group" && (
          <CardContent className="space-y-2">
            {category.options
              .slice()
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((option) => {
                // `none` = ausência de acessório: não tem o que renderizar.
                const subject = previewKind && option.key !== "none"
                  ? { kind: previewKind, key: option.key }
                  : null;
                return (
                <OptionRow
                  key={option.id}
                  option={option}
                  isColor={isColor}
                  subject={subject}
                  busy={busyId === option.id}
                  onToggle={() => setToggleTarget({
                    type: "option",
                    id: option.id,
                    label: option.label,
                    isActive: option.isActive,
                  })}
                  onEdit={() => setDialog({ mode: "edit", category, option })}
                  onDelete={() =>
                    void run(option.id, () => deleteCustomizationOption(option.id), `Opção "${option.label}" excluída.`)
                  }
                  onPreview={() =>
                    subject && setPreview({ subject, title: `${category.label} · ${option.label}` })
                  }
                  onSetUnlock={() => setUnlockTarget(optionTarget(option, category))}
                />
                );
              })}
            {category.kind === "feature" && category.options.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Sem opções — controlado só pelo botão ativa/inativa.
              </p>
            )}
            {isTexture && unregistered.map((f) => (
              <div key={f.folder} className="flex items-center gap-3 rounded-lg border border-dashed px-3 py-2">
                <div className="min-w-0 flex-1">
                  <span className="truncate text-sm font-medium text-muted-foreground">{f.label}</span>
                  <span className="block text-xs text-muted-foreground">{f.folder} · não cadastrada</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      category.id,
                      async () => {
                        await createCustomizationOption({
                          categoryId: category.id,
                          key: folderToKey(f.folder),
                          label: f.label,
                          value: f.folder,
                        });
                      },
                      `Textura "${f.label}" cadastrada.`,
                    )
                  }
                >
                  <Plus className="size-4" />
                  Cadastrar
                </Button>
              </div>
            ))}
            {category.isExtensible && !isTexture && (
              <Button variant="ghost" size="sm" onClick={() => setDialog({ mode: "create", category })}>
                <Plus className="size-4" />
                Adicionar opção
              </Button>
            )}
          </CardContent>
        )}

        {children.length > 0 && (
          <CardContent className="space-y-4 border-t pt-4">
            {children.map((child) => renderCategory(child, all))}
          </CardContent>
        )}
      </Card>
    );
  }

  const topLevel = categories
    ?.filter((c) => c.parentId === null)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const selected = topLevel?.find((c) => c.id === selectedId) ?? topLevel?.[0];
  const passSteps = useMemo(() => buildPass(categories ?? []), [categories]);

  return (
    <SidebarProvider className="h-svh">
      <AppSidebar />
      <SidebarInset className="overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
          <Palette className="size-5" />
          <span className="text-lg font-semibold tracking-tight">Personalizações</span>
        </header>

        <div className="flex-1 overflow-y-auto">
          <main className="mx-auto w-full max-w-3xl px-6 pt-8 pb-24 md:pb-10">
            <p className="text-muted-foreground">
              Catálogo consumido pela cena 3D. Opções presas a código{" "}
              <Lock className="inline size-3" /> (Formato, Topo, LED) só ligam/desligam.
              Cor e Textura aceitam cadastro livre. Cada personalização tem um requisito{" "}
              <Trophy className="inline size-3" /> de doação e/ou indicação — quem já conquistou
              mantém o acesso mesmo se o valor mudar.
            </p>

            {feedback && (
              <p className={`mt-4 text-sm ${feedback.ok ? "text-accent" : "text-destructive"}`}>
                {feedback.text}
              </p>
            )}

            {loadError ? (
              <div className="mt-8 rounded-xl border border-destructive/40 bg-destructive/5 p-6">
                <p className="text-sm text-destructive">{loadError}</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={reload}>
                  Tentar de novo
                </Button>
              </div>
            ) : !topLevel ? (
              <Skeleton className="mt-8 h-64 w-full" />
            ) : (
              <div className="mt-8 space-y-4">
                <div className="flex flex-wrap items-end gap-3">
                  {view === "list" && (
                    <label className="block min-w-56 flex-1 space-y-1.5">
                      <span className="text-sm font-medium">Personalização</span>
                      <Select
                        value={selected ? String(selected.id) : undefined}
                        onValueChange={(v) => setSelectedId(Number(v))}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecione uma personalização" />
                        </SelectTrigger>
                        <SelectContent>
                          {topLevel.map((c) => (
                            <SelectItem key={c.id} value={String(c.id)}>
                              {c.label}
                              {c.isActive ? "" : " (inativa)"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>
                  )}
                  {/* Duas visões do mesmo catálogo: gerir uma categoria × ler a curva inteira. */}
                  <div className="ml-auto flex gap-1 rounded-lg border p-1">
                    <Button
                      size="sm"
                      variant={view === "list" ? "secondary" : "ghost"}
                      onClick={() => setView("list")}
                    >
                      Lista
                    </Button>
                    <Button
                      size="sm"
                      variant={view === "pass" ? "secondary" : "ghost"}
                      onClick={() => setView("pass")}
                    >
                      <Trophy className="size-4" />
                      Passe
                    </Button>
                  </div>
                </div>
                {view === "pass"
                  ? <PassView steps={passSteps} onSelect={setUnlockTarget} />
                  : selected && renderCategory(selected, categories!)}
              </div>
            )}
          </main>
        </div>

        <MobileNav />
      </SidebarInset>

      {dialog && (
        <OptionDialog
          key={dialog.mode === "edit" ? `e${dialog.option.id}` : `c${dialog.category.id}`}
          state={dialog}
          onClose={() => setDialog(null)}
          onDone={(fb) => {
            setFeedback(fb);
            reload();
          }}
        />
      )}

      {unlockTarget && (
        <UnlockDialog
          key={`${unlockTarget.kind}-${unlockTarget.id}`}
          target={unlockTarget}
          onClose={() => setUnlockTarget(null)}
          onDone={(fb) => {
            setFeedback(fb);
            reload();
          }}
        />
      )}

      {/* Preview grande: só monta quando aberto — 1 contexto WebGL por vez. */}
      <Dialog open={preview !== null} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{preview?.title}</DialogTitle>
            <DialogDescription>
              Arraste para girar, scroll para aproximar. Mesma geometria usada na cena 3D.
            </DialogDescription>
          </DialogHeader>
          {preview && (
            <Suspense
              fallback={<Skeleton className="h-[55vh] w-full rounded-xl" />}
            >
              <PreviewCanvas
                key={`${preview.subject.kind}:${preview.subject.key}`}
                subject={preview.subject}
                className="h-[55vh] w-full cursor-grab overflow-hidden rounded-xl border bg-muted/30 active:cursor-grabbing"
              />
            </Suspense>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={toggleTarget !== null} onOpenChange={(open) => !open && setToggleTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {toggleTarget?.isActive ? "Desativar" : "Ativar"}{" "}
              {toggleTarget?.type === "category" ? "categoria" : "opção"}?
            </DialogTitle>
            <DialogDescription>
              Confirme para {toggleTarget?.isActive ? "desativar" : "ativar"}{" "}
              <strong>{toggleTarget?.label}</strong>. A alteração afeta as personalizações
              disponíveis na cena.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToggleTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant={toggleTarget?.isActive ? "destructive" : "default"}
              onClick={confirmToggle}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}

export default Customizations;
