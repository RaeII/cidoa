import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ApiError } from "@/api/http";
import { requestLoginCode, requestRegisterCode } from "@/api/auth/auth.routes";
import type { AuthChallenge } from "@/api/auth/auth.types";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Mode = "login" | "register";
type Step = "email" | "code";

const COPY = {
  login: {
    title: "Entrar",
    description: "Enviamos um código de 6 dígitos para o seu e-mail.",
    request: requestLoginCode,
    submit: "Entrar",
    toggle: "Não tem conta? Criar conta",
  },
  register: {
    title: "Criar conta",
    description: "Enviamos um código para confirmar o seu e-mail.",
    request: requestRegisterCode,
    submit: "Criar conta",
    toggle: "Já tem conta? Entrar",
  },
} as const;

/** Segundos até `iso` (cooldown de reenvio), nunca negativo. */
function secondsUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 1000));
}

/**
 * Modal de autenticação passwordless: e-mail → código de 6 dígitos.
 * Login e cadastro no mesmo modal, alternados por `mode`. Ao validar o código,
 * o AuthProvider abre a sessão (cookie httpOnly) e o modal fecha.
 */
export function AuthDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { loginWithCode, registerWithCode } = useAuth();

  const [mode, setMode] = useState<Mode>("login");
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<AuthChallenge | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  // Reset ao fechar — reabrir sempre começa limpo no passo de e-mail.
  const reset = useCallback(() => {
    setMode("login");
    setStep("email");
    setEmail("");
    setCode("");
    setChallenge(null);
    setError(null);
    setSubmitting(false);
    setResendIn(0);
  }, []);

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  // Contagem regressiva do cooldown de reenvio.
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  function switchMode(next: Mode) {
    setMode(next);
    setStep("email");
    setCode("");
    setChallenge(null);
    setError(null);
  }

  async function sendCode(targetMode: Mode) {
    setError(null);
    setSubmitting(true);
    try {
      const ch = await COPY[targetMode].request({ email });
      setChallenge(ch);
      setStep("code");
      // Dev: backend devolve debugCode (nunca em produção) → já preenche o campo.
      setCode(ch.debugCode ?? "");
      setResendIn(secondsUntil(ch.resendAvailableAt));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao enviar o código");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEmailSubmit(e: FormEvent) {
    e.preventDefault();
    await sendCode(mode);
  }

  async function handleCodeSubmit(e: FormEvent) {
    e.preventDefault();
    if (!challenge) return;
    setError(null);
    setSubmitting(true);
    try {
      const verify = mode === "login" ? loginWithCode : registerWithCode;
      await verify({ challengeId: challenge.challengeId, code });
      handleOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao validar o código");
    } finally {
      setSubmitting(false);
    }
  }

  const copy = COPY[mode];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>
            {step === "email" ? copy.description : `Digite o código enviado para ${email}.`}
          </DialogDescription>
        </DialogHeader>

        {step === "email" ? (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <Input
              id="auth-email"
              label="E-mail"
              labelClassName="bg-background"
              type="email"
              required
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "Enviando…" : "Enviar código"}
            </Button>
            <button
              type="button"
              onClick={() => switchMode(mode === "login" ? "register" : "login")}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
            >
              {copy.toggle}
            </button>
          </form>
        ) : (
          <form onSubmit={handleCodeSubmit} className="space-y-4">
            {challenge?.debugCode && (
              <p className="rounded-md bg-muted px-3 py-2 text-center text-sm text-muted-foreground">
                Código (dev):{" "}
                <span className="font-mono font-semibold text-foreground">{challenge.debugCode}</span>
              </p>
            )}
            <Input
              id="auth-code"
              label="Código de 6 dígitos"
              labelClassName="bg-background"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            />
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" disabled={submitting || code.length !== 6} className="w-full">
              {submitting ? "Validando…" : copy.submit}
            </Button>
            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setError(null);
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                Trocar e-mail
              </button>
              <button
                type="button"
                disabled={resendIn > 0 || submitting}
                onClick={() => sendCode(mode)}
                className="text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:hover:text-muted-foreground"
              >
                {resendIn > 0 ? `Reenviar (${resendIn}s)` : "Reenviar código"}
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
