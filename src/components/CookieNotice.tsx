import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PRIVACY_PATH } from "@/lib/legal";

const STORAGE_KEY = "cidoa:cookie-notice";

export function CookieNotice() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "acknowledged";
    } catch {
      return false;
    }
  });

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, "acknowledged");
    } catch {
      // Storage bloqueado: fecha o aviso apenas nesta visita.
    }
    setDismissed(true);
  }

  if (dismissed) return null;

  return (
    <section
      aria-label="Cookies"
      className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] left-4 z-40 flex flex-col items-start gap-4 pixel bevel-edge bg-card p-5 text-card-foreground md:bottom-6 md:left-auto md:max-w-md"
    >
      <p className="text-sm leading-relaxed">
        Usamos cookies essenciais para manter sua sessão. Não usamos cookies de publicidade ou análise.{" "}
        <a
          href={`${PRIVACY_PATH}#cookies`}
          target="_blank"
          rel="noopener"
          className="font-semibold underline decoration-2 underline-offset-3 hover:bg-accent hover:text-primary"
        >
          Política de Privacidade
        </a>
        .
      </p>
      <Button type="button" size="sm" onClick={dismiss}>Entendi</Button>
    </section>
  );
}
