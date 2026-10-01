import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { ImagePlus, Mail, Pencil, Trash2, UserRound } from "lucide-react";
import { ApiError } from "@/api/http";
import { useAuth } from "@/hooks/useAuth";
import { resizeImage } from "@/lib/image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Aba "Perfil" do GameMenu: nome, username e imagem de perfil. */
export function ProfilePanel() {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [profileImage, setProfileImage] = useState(user?.profile_image ?? null);
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

  const imageChanged = profileImage !== (user.profile_image ?? null);
  const hasChanges = name !== (user.name ?? "") || username !== user.username || imageChanged;

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
      toast.success("Perfil atualizado.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao atualizar o perfil");
    } finally {
      setSubmitting(false);
    }
  }

  function removeProfileImage() {
    setProfileImage(null);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao processar a imagem");
    } finally {
      setProcessingImage(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6 md:grid-cols-[auto_1fr]">
      <div className="flex flex-col items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={handleImageChange}
        />
        <div className="relative">
          <Avatar className="size-28 rounded-none">
            {profileImage && <AvatarImage src={profileImage} alt="Imagem de perfil" className="object-cover" />}
            <AvatarFallback className="rounded-none bg-white/10 text-2xl font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="icon-sm"
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
      </div>

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

        <div className="flex items-center gap-3 border border-white/10 bg-white/5 p-3">
          <Mail className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">E-mail confirmado</p>
            <p className="truncate text-sm font-medium">{user.email ?? "Sem e-mail"}</p>
          </div>
        </div>

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end">
          <Button type="submit" disabled={!hasChanges || submitting || processingImage}>
            <UserRound />
            {submitting ? "Salvando…" : "Salvar alterações"}
          </Button>
        </div>
      </div>
    </form>
  );
}
