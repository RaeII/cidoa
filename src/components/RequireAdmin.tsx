import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAdminAuth } from "../hooks/useAdminAuth";

/**
 * Rota-layout que protege a área /dale. Só passa com sessão do painel
 * (AdminAuthProvider) — sessão da cena, mesmo de conta admin, não conta.
 * Sem sessão → /dale/login, guardando a origem para o login devolver o
 * admin à página que ele tentou abrir.
 *
 * Defesa em profundidade: o backend exige sessão admin em cada rota /admin
 * (adminGuard). Aqui é só o gate de navegação/UX.
 *
 * Uso:
 *   <Route element={<RequireAdmin />}>
 *     <Route path="/dale" element={<Dashboard />} />
 *   </Route>
 */
export function RequireAdmin() {
  const { user, isLoading } = useAdminAuth();
  const location = useLocation();

  if (isLoading) return <p role="status">Carregando sessão…</p>;

  if (!user) {
    return <Navigate to="/dale/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
