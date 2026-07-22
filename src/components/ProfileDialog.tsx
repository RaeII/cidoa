import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { ImagePlus, Mail, Pencil, Share2, Trash2, UserRound, Users } from "lucide-react";
import { ApiError } from "@/api/http";
import type { ReferralSummary } from "@/api/referral/referral.types";
import { useAuth } from "@/hooks/useAuth";
import { resizeImage } from "@/lib/image";
import { ReferralPerson } from "@/components/referral/ReferralPerson";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ProfileDialog({
  open,
  onOpenChange,
  referralSummary,
  referralError,
  shareStatus,
  onShareReferral,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  referralSummary: ReferralSummary | null;
  referralError: string | null;
  shareStatus: "idle" | "done" | "error";
  onShareReferral: () => void;
}) {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [profileImage, setProfileImage] = useState(user?.profile_image ?? null);
  const [imageChanged, setImageChanged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [processingImage, setProcessingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!user) return null;

  const initials = (user.name ?? user.username)
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await updateProfile({
        name,
        username,
        ...(imageChanged ? { profile_image: profileImage } : {}),
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao atualizar o perfil");
    } finally {
      setSubmitting(false);
    }
  }

  function removeProfileImage() {
    setProfileImage(null);
    setImageChanged(true);
    setError(null);
  }

  async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError(null);
    setProcessingImage(true);
    try {
      setProfileImage(await resizeImage(file));
      setImageChanged(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao processar a imagem");
    } finally {
      setProcessingImage(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto p-0 sm:max-w-md">
        <div className="bg-gradient-to-br from-primary/15 via-background to-background px-6 pt-8 pb-6">
          <div className="flex items-center gap-2.5">
            <div className="flex shrink-0 flex-col items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={handleImageChange}
              />
              <div className="relative">
                <Avatar className="size-14 ring-4 ring-background shadow-md">
                  {profileImage && <AvatarImage src={profileImage} alt="Imagem de perfil" className="object-cover" />}
                  <AvatarFallback className="bg-primary text-base font-semibold text-primary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      size="icon-xs"
                      className="absolute -right-2 -bottom-2 rounded-full shadow-md"
                      disabled={processingImage || submitting}
                      aria-label="Editar imagem de perfil"
                    >
                      <Pencil />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onSelect={() => fileInputRef.current?.click()}>
                      <ImagePlus />
                      {profileImage ? "Trocar imagem" : "Adicionar imagem"}
                    </DropdownMenuItem>
                    {profileImage && (
                      <DropdownMenuItem variant="destructive" onSelect={removeProfileImage}>
                        <Trash2 />
                        Remover imagem
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {!profileImage && (
                <p className="w-20 text-center text-[11px] leading-tight text-muted-foreground">
                  Adicionar uma imagem de perfil
                </p>
              )}
            </div>
            <DialogHeader className="min-w-0 gap-0.5 text-left">
              <DialogTitle className="truncate text-xl">{user.name ?? user.username}</DialogTitle>
              <DialogDescription className="truncate">
                @{user.username}
              </DialogDescription>
            </DialogHeader>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-6 pb-6">
          <div className="space-y-4">
            <Input
              id="profile-name"
              label="Nome"
              required
              minLength={2}
              maxLength={100}
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <Input
              id="profile-username"
              label="Nome de usuário"
              required
              minLength={3}
              maxLength={45}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </div>

          <div className="rounded-xl border bg-muted/40 p-3">
            <div className="flex items-center gap-3">
              <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-background shadow-xs">
                <Mail className="size-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">E-mail confirmado</p>
                <p className="truncate text-sm font-medium">{user.email ?? "Sem e-mail"}</p>
              </div>
            </div>
          </div>

          {referralSummary && (
            <div className="rounded-xl border bg-muted/40 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">Código de indicação</p>
                  <p className="truncate font-mono text-sm font-semibold">{referralSummary.code}</p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={onShareReferral}>
                  <Share2 />
                  {shareStatus === "error" ? "Tentar novamente" : "Compartilhar"}
                </Button>
              </div>
            </div>
          )}

          {referralSummary?.referrer && (
            <ReferralPerson label="Você foi indicado por" person={referralSummary.referrer} />
          )}

          {referralSummary && referralSummary.referral_count > 0 && (
            <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-3">
              <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-background shadow-xs">
                <Users className="size-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Indicações realizadas</p>
                <p className="text-sm font-semibold">
                  {referralSummary.referral_count.toLocaleString("pt-BR")}
                </p>
              </div>
            </div>
          )}

          {referralError && (
            <p role="alert" className="text-sm text-destructive">{referralError}</p>
          )}

          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting || processingImage}>
              <UserRound />
              {submitting ? "Salvando…" : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
