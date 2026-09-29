import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AdminAuthProvider } from "./components/AdminAuthProvider";
import { AuthProvider } from "./components/AuthProvider";
import { RequireAdmin } from "./components/RequireAdmin";
import { Toaster } from "./components/ui/toast";

// Code-split por página (doc/regras/04-performance do base_vite): a cena 3D
// (Three.js, pesada) e a área /dale (admin) viram chunks separados.
const CitySceneEditor = lazy(() =>
  import("./components/CitySceneEditor").then((m) => ({ default: m.CitySceneEditor })),
);
const Login = lazy(() => import("./pages/admin/Login"));
const Dashboard = lazy(() => import("./pages/admin/Dashboard"));
const TestBuildings = lazy(() => import("./pages/admin/TestBuildings"));
const Customizations = lazy(() => import("./pages/admin/Customizations"));
const Pass = lazy(() => import("./pages/admin/Pass"));
const EarlySignups = lazy(() => import("./pages/admin/EarlySignups"));
const Ibge = lazy(() => import("./pages/admin/Ibge"));
const Users = lazy(() => import("./pages/admin/Users"));

function PageFallback() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background">
      <span className="text-sm text-muted-foreground">Carregando…</span>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageFallback />}>
        {/* Duas sessões independentes: cena (AuthProvider) e painel (AdminAuthProvider).
            Cada área só monta a própria — login numa nunca abre a outra. */}
        <Routes>
          {/* Cena 3D pública */}
          <Route
            path="/"
            element={
              <AuthProvider>
                <CitySceneEditor />
              </AuthProvider>
            }
          />

          {/* Área admin */}
          <Route
            element={
              <AdminAuthProvider>
                <Suspense fallback={<PageFallback />}>
                  <Outlet />
                </Suspense>
              </AdminAuthProvider>
            }
          >
            <Route path="/dale/login" element={<Login />} />

            {/* Exige sessão do painel */}
            <Route element={<RequireAdmin />}>
              <Route path="/dale" element={<Dashboard />} />
              <Route path="/dale/edificios-teste" element={<TestBuildings />} />
              <Route path="/dale/personalizacoes" element={<Customizations />} />
              <Route path="/dale/passe" element={<Pass />} />
              <Route path="/dale/primeiros-inscritos" element={<EarlySignups />} />
              <Route path="/dale/ibge" element={<Ibge />} />
              <Route path="/dale/usuarios" element={<Users />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <Toaster />
    </BrowserRouter>
  );
}
