import { useEffect, useState } from "react";
import { Loader2, Lock, Palette, Pencil, Plus, Trash2 } from "lucide-react";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

type Feedback = { ok: boolean; text: string } | null;

function errMsg(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.message : fallback;
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
  busy,
  onToggle,
  onEdit,
  onDelete,
}: {
  option: CustomizationOption;
  isColor: boolean;
  busy: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border px-3 py-2">
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
      <Button variant="ghost" size="sm" disabled={busy} onClick={onToggle}>
        {option.isActive ? "Ativa" : "Inativa"}
      </Button>
      <Button variant="ghost" size="icon" disabled={busy} onClick={onEdit} aria-label="Editar">
        <Pencil className="size-4" />
      </Button>
      {!option.isCodeBound && (
        <Button variant="ghost" size="icon" disabled={busy} onClick={onDelete} aria-label="Excluir">
          <Trash2 className="size-4 text-destructive" />
        </Button>
      )}
    </div>
  );
}

function Customizations() {
  const [categories, setCategories] = useState<CustomizationCategory[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

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

  function renderCategory(category: CustomizationCategory, all: CustomizationCategory[]) {
    const children = all
      .filter((c) => c.parentId === category.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const isColor = category.key === "color";
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
          <Button variant="outline" size="sm" disabled={busy} onClick={() =>
            void run(category.id, () => updateCustomizationCategory(category.id, { isActive: !category.isActive }),
              `Categoria "${category.label}" ${category.isActive ? "desativada" : "ativada"}.`)
          }>
            {busy && <Loader2 className="animate-spin" />}
            {category.isActive ? "Ativa" : "Inativa"}
          </Button>
        </CardHeader>

        {category.kind !== "group" && (
          <CardContent className="space-y-2">
            {category.options
              .slice()
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((option) => (
                <OptionRow
                  key={option.id}
                  option={option}
                  isColor={isColor}
                  busy={busyId === option.id}
                  onToggle={() =>
                    void run(option.id, () => updateCustomizationOption(option.id, { isActive: !option.isActive }),
                      `Opção "${option.label}" ${option.isActive ? "desativada" : "ativada"}.`)
                  }
                  onEdit={() => setDialog({ mode: "edit", category, option })}
                  onDelete={() =>
                    void run(option.id, () => deleteCustomizationOption(option.id), `Opção "${option.label}" excluída.`)
                  }
                />
              ))}
            {category.kind === "feature" && category.options.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Sem opções — controlado só pelo botão ativa/inativa.
              </p>
            )}
            {category.isExtensible && (
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
                {topLevel.map((category) => renderCategory(category, categories!))}
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
    </SidebarProvider>
  );
}

export default Customizations;
