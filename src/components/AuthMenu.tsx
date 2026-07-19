import { useState } from "react";
import { LogOut, User as UserIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { AuthDialog } from "@/components/AuthDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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

  if (isAuthenticated && user) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger className={`${overlayButton} max-w-[14rem]`}>
          <UserIcon className="size-4 shrink-0" />
          <span className="truncate">{user.username}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => logout()}>
            <LogOut />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
