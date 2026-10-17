import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AdminAuthProvider } from "./components/AdminAuthProvider";
import { AuthProvider } from "./components/AuthProvider";
import { CityPoster } from "./components/CityPoster";
import { CookieNotice } from "./components/CookieNotice";
import { RequireAdmin } from "./components/RequireAdmin";
import { BlockLoader } from "./components/ui/pixel-icon";
import { PRIVACY_PATH, TERMS_PATH } from "./lib/legal";

/**
 * Resolve depois que a casca chega na tela. Duplo rAF: o 1º roda antes do paint do
 * próprio frame; o 2º só depois de ele ser apresentado. Aba oculta não tem rAF:
 * resolve na hora pra não segurar o carregamento.
 */
function afterPaint() {
  return new Promise<void>((resolve) => {
    if (document.hidden) return resolve();
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

// Code-split por página (doc/regras/04-performance do base_vite): a cena 3D
// (Three.js, pesada) e a área /dale (admin) viram chunks separados. A cena só
// começa a baixar depois que a casca (pôster, aviso de cookies) pinta: o
// download e a avaliação do Three.js não atrasam o 1º paint útil (LCP).
const CitySceneEditor = lazy(() =>
  afterPaint()
    .then(() => import("./components/CitySceneEditor"))
    .then((m) => ({ default: m.CitySceneEditor })),
);
// Toaster (Radix Toast) fora do bundle inicial: monta após o 1º paint. O store do
// toast vive fora do React — toast() chamado antes aparece quando ele montar.
const Toaster = lazy(() =>
  afterPaint()
    .then(() => import("./components/ui/toast"))
    .then((m) => ({ default: m.Toaster })),
);
const Login = lazy(() => import("./pages/admin/Login"));
const Dashboard = lazy(() => import("./pages/admin/Dashboard"));
const TestBuildings = lazy(() => import("./pages/admin/TestBuildings"));
const Customizations = lazy(() => import("./pages/admin/Customizations"));
const Pass = lazy(() => import("./pages/admin/Pass"));
const EarlySignups = lazy(() => import("./pages/admin/EarlySignups"));
const Ibge = lazy(() => import("./pages/admin/Ibge"));
const Users = lazy(() => import("./pages/admin/Users"));
const Terms = lazy(() => import("./pages/legal/Terms"));
const Privacy = lazy(() => import("./pages/legal/Privacy"));

function PageFallback() {
  return (
    <div className="flex min-h-svh items-center justify-center gap-3 bg-background pattern-paws text-muted-foreground">
      <BlockLoader />
      <span className="text-sm">Carregando…</span>
    </div>
  );
}

/** Enquanto o chunk da cena baixa: mesmo pôster do index.html + aviso de carregamento. */
function SceneFallback() {
  return (
    <div className="relative h-screen w-full overflow-hidden bg-background">
      <CityPoster />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="pixel bevel-edge flex items-center gap-3 bg-background px-6 py-5 text-sm text-foreground">
          <BlockLoader className="text-primary" />
          Carregando…
        </div>
      </div>
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
          {/* Cena 3D pública. Enquanto o chunk da cena baixa, segue o mesmo pôster
              estático do index.html (sem flash do "Carregando…"). */}
          <Route
            path="/"
            element={
              <AuthProvider>
                <Suspense fallback={<SceneFallback />}>
                  <CitySceneEditor />
                </Suspense>
              </AuthProvider>
            }
          />

          {/* Documentos legais: públicos, sem sessão (link exigido pelo login com Google) */}
          <Route path={TERMS_PATH} element={<Terms />} />
          <Route path={PRIVACY_PATH} element={<Privacy />} />

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
      <CookieNotice />
      <Suspense fallback={null}>
        <Toaster />
      </Suspense>
    </BrowserRouter>
  );
}
