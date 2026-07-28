import { lazy, Suspense, useEffect, useState } from "react";
import { EllipsisVertical, Loader2, Lock, Palette, Pencil, Plus, Trash2 } from "lucide-react";
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
  FACADE_TEXTURE_FOLDERS,
  resolveFacadeFolder,
  type FacadeTextureInfo,
} from "@/scene/textures/facadeTextureManifest";
import type { PreviewSubject } from "@/components/three/CustomizationPreview";
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

function OptionRow({
  option,
  isColor,
  subject,
  busy,
  onToggle,
  onEdit,
  onDelete,
  onPreview,
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
}) {
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
        <span className="text-xs text-muted-foreground">{option.key}{option.value ? ` · ${option.value}` : ""}</span>
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
              Cor e Textura aceitam cadastro livre.
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
                <label className="block space-y-1.5">
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
                {selected && renderCategory(selected, categories!)}
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
