import { useState } from "react";
import { LogOut, UserRoundPen } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { AuthDialog } from "@/components/AuthDialog";
import { ProfileDialog } from "@/components/ProfileDialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Estilo casa com os overlays da cena (vidro escuro), não com o tema das
// páginas admin — a cena é sempre escura independente do tema claro/escuro.
const overlayButton =
  "flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-black/60 px-4 text-sm font-medium text-white/80 shadow-lg backdrop-blur-md transition-colors hover:bg-white/10 hover:text-white";

/** Botão de autenticação (canto superior direito da cena). */
export function AuthMenu() {
  const { isAuthenticated, user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  if (isAuthenticated && user) {
    const visibleUsername = user.username.length > 18
      ? `${user.username.slice(0, 18)}…`
      : user.username;

    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger className={`${overlayButton} max-w-[14rem]`} title={user.username}>
            <Avatar className="size-6 shrink-0">
              {user.profile_image && <AvatarImage src={user.profile_image} alt="" className="object-cover" />}
              <AvatarFallback className="bg-white/10 text-[10px] text-white">
                {user.username.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="truncate">{visibleUsername}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="min-w-0">
              <span className="block truncate font-semibold">{user.username}</span>
              <span className="block truncate text-xs font-normal text-muted-foreground">
                {user.email ?? "Sem e-mail"}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setProfileOpen(true)}>
              <UserRoundPen />
              Perfil
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => logout()}>
              <LogOut />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {profileOpen && (
          <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
        )}
      </>
    );
  }

  return (
    <>
      <button type="button" className={overlayButton} onClick={() => setOpen(true)}>
        Entrar
      </button>
      <AuthDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
