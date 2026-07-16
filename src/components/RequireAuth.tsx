import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

/**
 * Rota-layout que protege a área /dale (admin). Só passa admin logado.
 * Sem sessão ou sem admin → /dale/login, guardando a origem
 * para o login devolver o usuário à página que ele tentou abrir.
 *
 * Defesa em profundidade: o backend também exige JWT + admin em cada
 * rota /admin (adminGuard). Aqui é só o gate de navegação/UX.
 *
 * Uso:
 *   <Route element={<RequireAuth />}>
 *     <Route path="/dale" element={<Dashboard />} />
 *   </Route>
 */
export function RequireAuth() {
  const { isAuthenticated, isAdmin } = useAuth();
  const location = useLocation();

  if (!isAuthenticated || !isAdmin) {
    return <Navigate to="/dale/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
