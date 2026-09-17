import { useEffect, useState } from "react";
import { Loader2, Search, ShieldCheck, Users as UsersIcon } from "lucide-react";
import { listUsers, setUserAdmin } from "@/api/user/user.routes";
import type { User } from "@/api/user/user.types";
import { ApiError } from "@/api/http";
import { useAuth } from "@/hooks/useAuth";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileNav } from "@/components/MobileNav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

const PAGE_SIZE = 20;

type Feedback = { ok: boolean; text: string } | null;

function errMsg(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.message : fallback;
}

function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

/** Linha da lista: identidade à esquerda, chave de admin à direita. */
function UserRow({
  user,
  isSelf,
  onToggle,
}: {
  user: User;
  isSelf: boolean;
  onToggle: (next: boolean) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);

  async function handleChange(next: boolean) {
    setSaving(true);
    try {
      await onToggle(next);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
      <Avatar className="size-9 rounded-lg">
        {user.profile_image && (
          <AvatarImage src={user.profile_image} alt="" className="object-cover" />
        )}
        <AvatarFallback className="rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          {initials(user.name ?? user.username)}
        </AvatarFallback>
      </Avatar>

      <div className="grid min-w-0 flex-1 leading-tight">
        <span className="truncate text-sm font-medium">
          {user.name ?? user.username}
          {isSelf && <span className="ml-2 text-xs text-muted-foreground">(você)</span>}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          @{user.username}
          {user.email ? ` · ${user.email}` : ""}
        </span>
      </div>

      <span className="hidden text-xs tabular-nums text-muted-foreground sm:inline">
        #{user.id}
      </span>

      <label className="flex items-center gap-2 text-xs">
        <span className={user.is_admin ? "text-accent" : "text-muted-foreground"}>Admin</span>
        <Switch
          checked={user.is_admin}
          // Auto-rebaixamento fecha a porta por dentro — o backend também recusa.
          disabled={saving || isSelf}
          onCheckedChange={(next) => void handleChange(next)}
          aria-label={`Acesso de administrador de ${user.username}`}
        />
      </label>
    </div>
  );
}

function Users() {
  const { user: me } = useAuth();
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [users, setUsers] = useState<User[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>(null);

  // Fetch só em callback assíncrono — o estado inicial (loading=true) cobre o
  // 1º render e quem muda busca/página liga o loading ANTES de mexer na dep.
  useEffect(() => {
    let alive = true;
    listUsers({ search, page, limit: PAGE_SIZE })
      .then((res) => {
        if (!alive) return;
        setUsers(res.data);
        setTotal(res.pagination.total);
        setTotalPages(res.pagination.totalPages);
        setLoadError(null);
      })
      .catch((err) => {
        // 401 cai no interceptor (derruba a sessão).
        if (alive) setLoadError(errMsg(err, "Falha ao carregar usuários"));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [search, page, reloadKey]);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const next = term.trim();
    setLoading(true);
    setPage(1);
    setSearch(next);
    // Buscar o mesmo termo não muda dep nenhuma — a key força o refetch.
    if (next === search && page === 1) setReloadKey((k) => k + 1);
  }

  function goToPage(next: number) {
    setLoading(true);
    setPage(next);
  }

  function retry() {
    setLoadError(null);
    setLoading(true);
    setReloadKey((k) => k + 1);
  }

  async function toggleAdmin(target: User, next: boolean) {
    setFeedback(null);
    try {
      const updated = await setUserAdmin(target.id, next);
      setUsers((list) => list.map((u) => (u.id === updated.id ? updated : u)));
      setFeedback({
        ok: true,
        text: next
          ? `@${updated.username} agora é admin. Atualize a página para visualizar o acesso.`
          : `@${updated.username} não é mais admin.`,
      });
    } catch (err) {
      setFeedback({ ok: false, text: errMsg(err, "Falha ao alterar o acesso") });
    }
  }

  return (
    <SidebarProvider className="h-svh">
      <AppSidebar />
      <SidebarInset className="overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
          <UsersIcon className="size-5" />
          <span className="text-lg font-semibold tracking-tight">Usuários</span>
        </header>

        <div className="flex-1 overflow-y-auto">
          <main className="mx-auto w-full max-w-3xl px-6 pt-8 pb-24 md:pb-10">
            <p className="text-muted-foreground">
              Dá ou tira acesso de administrador. Admin entra no painel <code>/dale</code> e usa
              todas as personalizações da cena sem precisar cumprir o passe.
            </p>

            <Card className="mt-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="size-5" />
                  Acesso de administrador
                </CardTitle>
                <CardDescription>
                  As permissões mudam imediatamente. Atualize a página ou volte à aba
                  para visualizar o acesso atualizado.
                </CardDescription>
              </CardHeader>

              <CardContent className="px-0">
                <form onSubmit={submitSearch} className="flex gap-2 px-6 pb-4">
                  <Input
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    placeholder="Buscar por username, nome ou e-mail"
                    aria-label="Buscar usuário"
                  />
                  <Button type="submit" variant="outline" disabled={loading}>
                    {loading ? <Loader2 className="animate-spin" /> : <Search />}
                    <span className="hidden sm:inline">Buscar</span>
                  </Button>
                </form>

                {loading ? (
                  <div className="space-y-2 px-6">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : loadError ? (
                  <div className="mx-6 rounded-xl border border-destructive/40 bg-destructive/5 p-6">
                    <p className="text-sm text-destructive">{loadError}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={retry}
                    >
                      Tentar de novo
                    </Button>
                  </div>
                ) : users.length === 0 ? (
                  <p className="px-6 text-sm text-muted-foreground">
                    Nenhum usuário encontrado.
                  </p>
                ) : (
                  <div className="border-t">
                    {users.map((u) => (
                      <UserRow
                        key={u.id}
                        user={u}
                        isSelf={u.id === me?.id}
                        onToggle={(next) => toggleAdmin(u, next)}
                      />
                    ))}
                  </div>
                )}

                {feedback && (
                  <p
                    className={`px-6 pt-4 text-sm ${
                      feedback.ok ? "text-accent" : "text-destructive"
                    }`}
                  >
                    {feedback.text}
                  </p>
                )}

                {totalPages > 1 && (
                  <div className="flex items-center justify-between gap-3 px-6 pt-4">
                    <span className="text-xs text-muted-foreground">
                      Página {page} de {totalPages} · {total} usuários
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page <= 1 || loading}
                        onClick={() => goToPage(page - 1)}
                      >
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page >= totalPages || loading}
                        onClick={() => goToPage(page + 1)}
                      >
                        Próxima
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </main>
        </div>

        <MobileNav />
      </SidebarInset>
    </SidebarProvider>
  );
}

export default Users;
