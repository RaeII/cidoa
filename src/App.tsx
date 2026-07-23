import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./components/AuthProvider";
import { RequireAuth } from "./components/RequireAuth";

// Code-split por página (doc/regras/04-performance do base_vite): a cena 3D
// (Three.js, pesada) e a área /dale (admin) viram chunks separados.
const CitySceneEditor = lazy(() =>
  import("./components/CitySceneEditor").then((m) => ({ default: m.CitySceneEditor })),
);
const Login = lazy(() => import("./pages/admin/Login"));
const Dashboard = lazy(() => import("./pages/admin/Dashboard"));
const TestBuildings = lazy(() => import("./pages/admin/TestBuildings"));
const Customizations = lazy(() => import("./pages/admin/Customizations"));
const Ibge = lazy(() => import("./pages/admin/Ibge"));

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
      <AuthProvider>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            {/* Cena 3D pública */}
            <Route path="/" element={<CitySceneEditor />} />

            {/* Login do admin */}
            <Route path="/dale/login" element={<Login />} />

            {/* Área admin: exige admin logado */}
            <Route element={<RequireAuth />}>
              <Route path="/dale" element={<Dashboard />} />
              <Route path="/dale/edificios-teste" element={<TestBuildings />} />
              <Route path="/dale/personalizacoes" element={<Customizations />} />
              <Route path="/dale/ibge" element={<Ibge />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
