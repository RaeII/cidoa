import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import {
  fetchBuildingProfile,
  saveBuildingProfile,
  type BuildingProfile,
} from "@/api/contributionApi";
import { resizeImage } from "@/lib/image";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const NAME_MAX = 40;
const DESCRIPTION_MAX = 160;
const EMPTY_PROFILE: BuildingProfile = { name: null, description: null, image: null };

const labelClass = "mb-2 block text-sm text-foreground/75";
const textareaClass =
  "w-full min-w-0 resize-none rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

/**
 * Imagem, nome e descrição do edifício — tudo opcional, público no card do edifício.
 * Carrega o perfil atual antes de liberar os campos: o save substitui tudo, então
 * começar vazio apagaria o que já existe.
 */
export function BuildingProfileForm({
  donationId,
  submitLabel,
  onDone,
}: {
  donationId: number;
  submitLabel: string;
  /** Salvo (ou nada mudou). */
  onDone: (profile: BuildingProfile) => void;
}) {
  const nameId = useId();
  const descriptionId = useId();
  const counterId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [loadState, setLoadState] = useState<"loading" | "error" | "ready">("loading");
  const [initial, setInitial] = useState<BuildingProfile>(EMPTY_PROFILE);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchBuildingProfile(donationId, controller.signal).then(
      (profile) => {
        if (controller.signal.aborted) return;
        const loaded = profile ?? EMPTY_PROFILE;
        setInitial(loaded);
        setName(loaded.name ?? "");
        setDescription(loaded.description ?? "");
        setImage(loaded.image);
        setLoadState("ready");
      },
      () => {
        if (!controller.signal.aborted) setLoadState("error");
      },
    );
    return () => controller.abort();
  }, [donationId, attempt]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setImageBusy(true);
    setImageError(null);
    try {
      // Recodifica em canvas: descarta EXIF (GPS) e cabe no limite de 1 MB do backend.
      setImage(await resizeImage(file, 800));
    } catch (err) {
      setImageError(err instanceof Error ? err.message : "Não foi possível ler a imagem");
    } finally {
      setImageBusy(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const profile: BuildingProfile = {
      name: name.trim() || null,
      description: description.trim() || null,
      image,
    };
    const changed =
      profile.name !== initial.name ||
      profile.description !== initial.description ||
      profile.image !== initial.image;
    if (!changed) return onDone(profile);

    setSaving(true);
    setSaveError(null);
    try {
      await saveBuildingProfile(donationId, profile);
      onDone(profile);
    } catch {
      setSaveError("Não foi possível salvar. Tente de novo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <p className="text-sm text-muted-foreground">Opcional. Aparece para quem clicar no seu edifício.</p>
      {loadState === "error" && (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível carregar.{" "}
          <button
            type="button"
            className="font-medium underline underline-offset-4"
            onClick={() => {
              setLoadState("loading");
              setAttempt((n) => n + 1);
            }}
          >
            Tentar de novo
          </button>
        </p>
      )}
      <fieldset disabled={loadState !== "ready" || saving} className="space-y-5">
        <div>
          <p className={labelClass}>Imagem</p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label={image ? "Trocar imagem" : "Adicionar imagem"}
              disabled={imageBusy}
              onClick={() => fileRef.current?.click()}
              className="grid aspect-[4/3] w-28 shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted text-muted-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {imageBusy ? (
                <Loader2 className="size-5 animate-spin" />
              ) : image ? (
                <img src={image} alt="" className="size-full object-cover" />
              ) : (
                <ImagePlus className="size-6" />
              )}
            </button>
            {image ? (
              <div className="flex flex-wrap gap-1">
                <Button type="button" variant="ghost" className="h-11" disabled={imageBusy} onClick={() => fileRef.current?.click()}>
                  Trocar
                </Button>
                <Button type="button" variant="ghost" className="h-11" disabled={imageBusy} onClick={() => setImage(null)}>
                  Remover
                </Button>
              </div>
            ) : (
              <Button type="button" variant="outline" className="h-11" disabled={imageBusy} onClick={() => fileRef.current?.click()}>
                Adicionar imagem
              </Button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(event) => {
                void handleFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </div>
          {imageError && (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {imageError}
            </p>
          )}
        </div>
        <div>
          <label htmlFor={nameId} className={labelClass}>
            Nome do edifício
          </label>
          <Input id={nameId} maxLength={NAME_MAX} value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <label htmlFor={descriptionId} className="text-sm text-foreground/75">
              Descrição
            </label>
            <span id={counterId} className="text-xs text-muted-foreground tabular-nums">
              {description.length}/{DESCRIPTION_MAX}
            </span>
          </div>
          <textarea
            id={descriptionId}
            rows={3}
            maxLength={DESCRIPTION_MAX}
            aria-describedby={counterId}
            className={textareaClass}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
      </fieldset>
      {saveError && (
        <p role="alert" className="text-sm text-destructive">
          {saveError}
        </p>
      )}
      <Button type="submit" size="lg" className="h-11 w-full" disabled={loadState !== "ready" || saving || imageBusy}>
        {saving ? "Salvando…" : submitLabel}
      </Button>
    </form>
  );
}

/** "Editar nome e imagem" a partir do card do edifício. `donationId` null = fechado. */
export function BuildingProfileDialog({
  donationId,
  onClose,
  onSaved,
}: {
  donationId: number | null;
  onClose: () => void;
  onSaved: (donationId: number, profile: BuildingProfile) => void;
}) {
  return (
    <Dialog open={donationId !== null} onOpenChange={(open) => !open && onClose()}>
      {/* text-foreground: o body da cena pinta texto branco, que sumiria no tema claro. */}
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto text-foreground sm:max-w-md"
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle>Seu edifício</DialogTitle>
        </DialogHeader>
        {donationId !== null && (
          <BuildingProfileForm
            donationId={donationId}
            submitLabel="Salvar"
            onDone={(profile) => {
              onSaved(donationId, profile);
              onClose();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
