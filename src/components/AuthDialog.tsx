import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Gift } from "lucide-react";
import { ApiError } from "@/api/http";
import { requestLoginCode } from "@/api/auth/auth.routes";
import type { AuthChallenge, RegistrationRequiredResult } from "@/api/auth/auth.types";
import type { ReferrerPreview } from "@/api/referral/referral.types";
import { useAuth } from "@/hooks/useAuth";
import { ReferralPerson } from "@/components/referral/ReferralPerson";
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

/** Logo "G" do Google (4 cores, sem fundo). */
function GoogleG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

// Client ID público do Google (mesmo projeto do backend). Env sobrescreve.
const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ??
  "234751630839-1cclfe773dck1v00tmknubila9e8tbq4.apps.googleusercontent.com";

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
  referralCode,
  referralPreview,
  referralLoading,
  referralError,
  onReferralCodeChange,
  onCancelReferral,
  onReferralApplied,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  referralCode: string;
  referralPreview: ReferrerPreview | null;
  referralLoading: boolean;
  referralError: string | null;
  onReferralCodeChange: (code: string) => void;
  onCancelReferral: () => void;
  onReferralApplied: () => void;
}) {
  const { loginWithCode, completeRegistration, loginWithGoogle } = useAuth();

  const googleBtnRef = useRef<HTMLDivElement>(null);
  // Handler do callback do Google guardado em ref: o GIS chama fora do ciclo do
  // React, então lemos sempre a versão mais recente sem reinicializar o botão.
  const handleGoogleRef = useRef<(credential: string) => void>(() => {});

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
  const [showReferral, setShowReferral] = useState(false);
  // Erro do código só aparece depois de tentar entrar — digitar não deve acusar erro.
  const [showReferralError, setShowReferralError] = useState(false);
  // Campo de indicação só aparece via link (`?ref=` já preencheu o código) ou clique.
  const referralOpen = showReferral || referralCode !== "";
  const referralBlocked = referralCode !== "" && (referralLoading || !referralPreview);

  /** Trava o envio e revela o erro do código de indicação, se houver. */
  function blockedByReferral() {
    if (!referralBlocked) return false;
    setShowReferralError(true);
    return true;
  }

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
    setShowReferral(false);
    setShowReferralError(false);
  }, []);

  function handleOpenChange(next: boolean) {
    if (!next) {
      reset();
      onCancelReferral();
    }
    onOpenChange(next);
  }

  function closeAfterAuth() {
    reset();
    onOpenChange(false);
  }

  // Contagem regressiva do cooldown de reenvio.
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  // Mantém o handler do Google sempre atualizado (fecha no sucesso, mostra erro).
  useEffect(() => {
    handleGoogleRef.current = async (credential: string) => {
      if (blockedByReferral()) return;
      setError(null);
      setSubmitting(true);
      try {
        const result = await loginWithGoogle(credential);
        if (result.status === "authenticated") {
          closeAfterAuth();
          return;
        }

        // 1º acesso: nada foi criado ainda — usuário confere nome e username.
        setRegistration(result);
        setEmail(result.email);
        setName(result.name ?? "");
        setUsername(result.username);
        setStep("profile");
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Erro ao entrar com o Google");
      } finally {
        setSubmitting(false);
      }
    };
  });

  // Inicializa e renderiza o botão do Google no passo de e-mail. O script GIS é
  // async — se ainda não carregou, tenta de novo por ~3s.
  useEffect(() => {
    if (!open || step !== "email" || !GOOGLE_CLIENT_ID) return;

    let cancelled = false;
    const render = () => {
      const id = window.google?.accounts?.id;
      const el = googleBtnRef.current;
      if (!id || !el) return false;
      id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (r) => handleGoogleRef.current(r.credential),
      });
      // Botão real do GIS: fica invisível (opacity 0) sobre o botão custom, então
      // o visual não importa — só precisa cobrir a área do clique. `width` casa
      // com a largura do wrapper pra o iframe receber o clique inteiro.
      id.renderButton(el, {
        theme: "outline",
        size: "large",
        text: "continue_with",
        width: Math.min(400, Math.round(el.offsetWidth) || 320),
        locale: "pt-BR",
      });
      return true;
    };

    if (render()) return;
    const poll = setInterval(() => {
      if (cancelled || render()) clearInterval(poll);
    }, 200);
    const stop = setTimeout(() => clearInterval(poll), 3000);
    return () => {
      cancelled = true;
      clearInterval(poll);
      clearTimeout(stop);
    };
  }, [open, step]);

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
    if (blockedByReferral()) return;
    await sendCode();
  }

  async function handleCodeSubmit(e: FormEvent) {
    e.preventDefault();
    if (!challenge || blockedByReferral()) return;
    setError(null);
    setSubmitting(true);
    try {
      const result = await loginWithCode({ challengeId: challenge.challengeId, code });
      if (result.status === "authenticated") {
        closeAfterAuth();
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
    if (!registration || blockedByReferral()) return;

    if (Date.now() >= new Date(registration.expiresAt).getTime()) {
      setStep("email");
      setRegistration(null);
      setError("A verificação expirou. Entre novamente.");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await completeRegistration({
        registrationToken: registration.registrationToken,
        name,
        username,
        referralCode: referralCode || undefined,
      });
      if (referralCode) onReferralApplied();
      closeAfterAuth();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao criar a conta");
    } finally {
      setSubmitting(false);
    }
  }

  const title = step === "profile" ? "Criar conta" : "Entrar";
  const description =
    step === "code"
      ? `Digite o código enviado para ${email}.`
      : step === "profile"
        ? "Confira seus dados antes de criar a conta."
        : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* aria-describedby={undefined} silencia o aviso do Radix quando não há descrição.
          text-foreground: o body da cena pinta texto branco, que sumiria no tema claro. */}
      <DialogContent className="text-foreground sm:max-w-sm" {...(description ? {} : { "aria-describedby": undefined })}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {step === "email" ? (
          <div className="space-y-5">
            {/* Botão custom visível + botão real do GIS invisível por cima (recebe o clique). */}
            <div
              className={`group relative h-10 ${referralBlocked ? "opacity-50" : ""}`}
              onClick={referralBlocked ? () => setShowReferralError(true) : undefined}
            >
              <button
                type="button"
                aria-hidden
                tabIndex={-1}
                className="pointer-events-none absolute inset-0 flex items-center justify-center gap-3 rounded-md border border-input bg-transparent text-sm font-medium text-foreground transition-colors group-hover:bg-accent"
              >
                <GoogleG className="size-5" />
                Continuar com Google
              </button>
              <div
                ref={googleBtnRef}
                className={`absolute inset-0 opacity-0 ${referralBlocked ? "pointer-events-none" : ""}`}
              />
            </div>
            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">ou</span>
              <span className="h-px flex-1 bg-border" />
            </div>
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
              {submitting ? "Enviando…" : "Continuar com E-mail"}
            </Button>
            </form>
          </div>
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
            <Button
              type="submit"
              disabled={submitting || code.length !== 6}
              className="w-full"
            >
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
            {/* E-mail já verificado (código ou Google): só confirmação, não editável. */}
            <Input
              id="auth-confirm-email"
              label="E-mail"
              labelClassName="bg-background"
              type="email"
              value={email}
              readOnly
              disabled
            />
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

        {/* Bloco de indicação destacado (borda tracejada + fundo primário) pra não se
            confundir com os campos de login logo acima. */}
        {referralOpen ? (
          <div className="mt-3 space-y-4 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4">
            <div className="flex items-start gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Gift className="size-4" aria-hidden />
              </span>
              <div className="space-y-0.5">
                <p className="text-sm font-semibold">Alguém te indicou o Cidoa?</p>
                <p className="text-xs text-muted-foreground">
                  Opcional. Cole o código de quem te convidou.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              {/* Fundo sólido no input: o label flutuante corta a borda e precisa da mesma cor atrás. */}
              <Input
                id="auth-referral-code"
                label="Código de indicação"
                className="bg-background font-mono tracking-[0.15em] dark:bg-background"
                placeholder="A1B2C3D4E5F60718"
                maxLength={16}
                autoCapitalize="characters"
                spellCheck={false}
                autoFocus={showReferral}
                aria-invalid={showReferralError && referralError ? true : undefined}
                value={referralCode}
                onChange={(event) => {
                  setShowReferralError(false);
                  onReferralCodeChange(event.target.value);
                }}
              />
              {referralLoading && (
                <p className="text-xs text-muted-foreground">Verificando indicação…</p>
              )}
              {showReferralError && referralError && (
                <p role="alert" className="text-sm text-destructive">{referralError}</p>
              )}
              {referralPreview && (
                <ReferralPerson label="Você foi indicado por" person={referralPreview} />
              )}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowReferral(true)}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-3 py-2.5 text-sm font-medium transition-colors hover:bg-primary/10"
          >
            <Gift className="size-4 text-primary" aria-hidden />
            Tenho um código de indicação
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}
