import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ApiError } from "@/api/http";
import { requestLoginCode } from "@/api/auth/auth.routes";
import type { AuthChallenge, RegistrationRequiredResult } from "@/api/auth/auth.types";
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

type Step = "email" | "code" | "profile";

/** Segundos até `iso` (cooldown de reenvio), nunca negativo. */
function secondsUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 1000));
}

/**
 * Modal passwordless único: e-mail → código → perfil apenas para conta nova.
 * A prova do e-mail confirmado fica somente no estado React; fechar ou recarregar
 * elimina o progresso e exige outro código.
 */
export function AuthDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { loginWithCode, completeRegistration } = useAuth();

  const [step, setStep] = useState<Step>("email");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<AuthChallenge | null>(null);
  const [registration, setRegistration] = useState<RegistrationRequiredResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  // Reset ao fechar — reabrir sempre começa limpo no passo de e-mail.
  const reset = useCallback(() => {
    setStep("email");
    setName("");
    setUsername("");
    setEmail("");
    setCode("");
    setChallenge(null);
    setRegistration(null);
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

  async function sendCode() {
    setError(null);
    setSubmitting(true);
    try {
      const ch = await requestLoginCode({ email });
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
    await sendCode();
  }

  async function handleCodeSubmit(e: FormEvent) {
    e.preventDefault();
    if (!challenge) return;
    setError(null);
    setSubmitting(true);
    try {
      const result = await loginWithCode({ challengeId: challenge.challengeId, code });
      if (result.status === "authenticated") {
        handleOpenChange(false);
        return;
      }

      setRegistration(result);
      setChallenge(null);
      setCode("");
      setStep("profile");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao validar o código");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleProfileSubmit(e: FormEvent) {
    e.preventDefault();
    if (!registration) return;

    if (Date.now() >= new Date(registration.expiresAt).getTime()) {
      setStep("email");
      setRegistration(null);
      setError("A verificação expirou. Envie um novo código.");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await completeRegistration({
        registrationToken: registration.registrationToken,
        name,
        username,
      });
      handleOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao criar a conta");
    } finally {
      setSubmitting(false);
    }
  }

  const title = step === "profile" ? "Criar conta" : "Entrar ou criar conta";
  const description = step === "email"
    ? "Informe seu e-mail para receber um código de 6 dígitos."
    : step === "code"
      ? `Digite o código enviado para ${email}.`
      : `E-mail ${email} confirmado. Complete seu perfil para continuar.`;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
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
          </form>
        ) : step === "code" ? (
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
              {submitting ? "Validando…" : "Continuar"}
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
                onClick={sendCode}
                className="text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:hover:text-muted-foreground"
              >
                {resendIn > 0 ? `Reenviar (${resendIn}s)` : "Reenviar código"}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <Input
              id="auth-name"
              label="Nome"
              labelClassName="bg-background"
              required
              minLength={2}
              maxLength={100}
              autoComplete="name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              id="auth-username"
              label="Nome de usuário"
              labelClassName="bg-background"
              required
              minLength={3}
              maxLength={45}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "Criando conta…" : "Criar conta"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
