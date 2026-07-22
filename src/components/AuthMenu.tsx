import { useEffect, useRef, useState } from "react";
import { LogOut, Share2, UserRoundPen } from "lucide-react";
import { ApiError } from "@/api/http";
import {
  applyMyReferral,
  getMyReferralSummary,
  getReferralPreview,
} from "@/api/referral/referral.routes";
import {
  normalizeReferralCode,
  REFERRAL_CODE_PATTERN,
} from "@/api/referral/referral.logic";
import type { ReferrerPreview, ReferralSummary } from "@/api/referral/referral.types";
import { useAuth } from "@/hooks/useAuth";
import { AuthDialog } from "@/components/AuthDialog";
import { ProfileDialog } from "@/components/ProfileDialog";
import { ReferralDialog } from "@/components/referral/ReferralDialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const overlayButton =
  "flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-black/60 px-4 text-sm font-medium text-white/80 shadow-lg backdrop-blur-md transition-colors hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-50";

function initialReferralCode() {
  return normalizeReferralCode(new URLSearchParams(window.location.search).get("ref") ?? "");
}

function messageFrom(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

/** Autenticação, perfil e entrada única dos fluxos de indicação da cena. */
export function AuthMenu() {
  const { isAuthenticated, user, logout } = useAuth();
  const [initialCode] = useState(initialReferralCode);
  const [authOpen, setAuthOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [referralCode, setReferralCode] = useState(initialCode);
  const [referralPreview, setReferralPreview] = useState<ReferrerPreview | null>(null);
  const [referralLoading, setReferralLoading] = useState(
    REFERRAL_CODE_PATTERN.test(initialCode),
  );
  const [referralError, setReferralError] = useState<string | null>(
    initialCode && !REFERRAL_CODE_PATTERN.test(initialCode)
      ? "Código de indicação deve ter 16 caracteres hexadecimais."
      : null,
  );
  const [summaryState, setSummaryState] = useState<{
    userId: number;
    data: ReferralSummary | null;
    error: string | null;
  } | null>(null);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [appliedReferrer, setAppliedReferrer] = useState<ReferrerPreview | null>(null);
  const [shareStatus, setShareStatus] = useState<"idle" | "done" | "error">("idle");
  const shareTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const summary = summaryState?.userId === user?.id ? summaryState?.data ?? null : null;
  const summaryError = summaryState?.userId === user?.id ? summaryState?.error ?? null : null;
  const effectiveAuthOpen = authOpen || (!isAuthenticated && referralCode !== "");

  useEffect(() => {
    if (!REFERRAL_CODE_PATTERN.test(referralCode)) return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      getReferralPreview(referralCode, controller.signal)
        .then((preview) => {
          setReferralPreview(preview);
          setReferralError(null);
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setReferralPreview(null);
          setReferralError(messageFrom(error, "Erro ao consultar indicação"));
        })
        .finally(() => {
          if (!controller.signal.aborted) setReferralLoading(false);
        });
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [referralCode]);

  useEffect(() => {
    if (!user || user.is_admin) return;
    let cancelled = false;

    getMyReferralSummary()
      .then((data) => {
        if (!cancelled) setSummaryState({ userId: user.id, data, error: null });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setSummaryState({
            userId: user.id,
            data: null,
            error: messageFrom(error, "Erro ao carregar indicações"),
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => () => {
    if (shareTimer.current) clearTimeout(shareTimer.current);
  }, []);

  function changeReferralCode(rawCode: string) {
    const code = normalizeReferralCode(rawCode);
    setReferralCode(code);
    setReferralPreview(null);
    setAppliedReferrer(null);
    setApplyError(null);

    if (!code) {
      setReferralLoading(false);
      setReferralError(null);
    } else if (!REFERRAL_CODE_PATTERN.test(code)) {
      setReferralLoading(false);
      setReferralError("Código de indicação deve ter 16 caracteres hexadecimais.");
    } else {
      setReferralLoading(true);
      setReferralError(null);
    }
  }

  function clearPendingReferral() {
    changeReferralCode("");
    const url = new URL(window.location.href);
    if (url.searchParams.has("ref")) {
      url.searchParams.delete("ref");
      window.history.replaceState(
        window.history.state,
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
    }
  }

  async function confirmReferral() {
    if (!user || !summary || !referralPreview) return;
    setApplying(true);
    setApplyError(null);
    try {
      const result = await applyMyReferral(referralCode);
      setAppliedReferrer(result.referrer);
      setSummaryState({
        userId: user.id,
        data: { ...summary, can_apply_referral: false, referrer: result.referrer },
        error: null,
      });
    } catch (error) {
      setApplyError(messageFrom(error, "Erro ao confirmar indicação"));
    } finally {
      setApplying(false);
    }
  }

  async function refreshSummary() {
    if (!user || user.is_admin) return;
    try {
      const data = await getMyReferralSummary();
      setSummaryState({ userId: user.id, data, error: null });
    } catch (error) {
      setSummaryState({
        userId: user.id,
        data: null,
        error: messageFrom(error, "Erro ao carregar indicações"),
      });
    }
  }

  async function shareReferral() {
    if (!summary) return;
    if (shareTimer.current) clearTimeout(shareTimer.current);

    try {
      if (navigator.share) {
        await navigator.share({
          title: "Cidoa",
          text: "Cadastre-se na Cidoa com meu código de indicação.",
          url: summary.link,
        });
      } else {
        await navigator.clipboard.writeText(summary.link);
      }
      setShareStatus("done");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setShareStatus("error");
    }

    shareTimer.current = setTimeout(() => setShareStatus("idle"), 2500);
  }

  const referralDialogError =
    referralError ??
    applyError ??
    (user?.is_admin ? "Contas administrativas não participam do sistema de indicações." : summaryError);
  const referralDialogLoading =
    referralLoading ||
    (!referralDialogError && !summary && !user?.is_admin);

  if (isAuthenticated && user) {
    const visibleUsername = user.username.length > 18
      ? `${user.username.slice(0, 18)}…`
      : user.username;
    const shareLabel = shareStatus === "error"
      ? "Falha ao compartilhar"
      : "Compartilhar indicação";

    return (
      <>
        <div className="flex items-center gap-2">
          {summary && (
            <button
              type="button"
              className={overlayButton}
              onClick={shareReferral}
              title={shareLabel}
              aria-label={shareLabel}
            >
              <Share2 />
            </button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger className={`${overlayButton} max-w-[14rem]`} title={user.username}>
              <Avatar className="size-6 shrink-0">
                {user.profile_image && <AvatarImage src={user.profile_image} alt="" className="object-cover" />}
                <AvatarFallback className="bg-white/10 text-[10px] text-white">
                  {user.username.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">{visibleUsername}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="min-w-0">
                <span className="block truncate font-semibold">{user.username}</span>
                <span className="block truncate text-xs font-normal text-muted-foreground">
                  {user.email ?? "Sem e-mail"}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  setProfileOpen(true);
                  void refreshSummary();
                }}
              >
                <UserRoundPen />
                Perfil
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => logout()}>
                <LogOut />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {profileOpen && (
          <ProfileDialog
            open={profileOpen}
            onOpenChange={setProfileOpen}
            referralSummary={summary}
            referralError={summaryError}
            shareStatus={shareStatus}
            onShareReferral={shareReferral}
          />
        )}
        <ReferralDialog
          open={referralCode !== "" && !effectiveAuthOpen}
          code={referralCode}
          preview={referralPreview}
          summary={summary}
          loading={referralDialogLoading}
          error={referralDialogError}
          submitting={applying}
          appliedReferrer={appliedReferrer}
          onConfirm={confirmReferral}
          onCancel={clearPendingReferral}
        />
      </>
    );
  }

  return (
    <>
      <button type="button" className={overlayButton} onClick={() => setAuthOpen(true)}>
        Entrar
      </button>
      <AuthDialog
        open={effectiveAuthOpen}
        onOpenChange={setAuthOpen}
        referralCode={referralCode}
        referralPreview={referralPreview}
        referralLoading={referralLoading}
        referralError={referralError}
        onReferralCodeChange={changeReferralCode}
        onCancelReferral={clearPendingReferral}
        onReferralApplied={clearPendingReferral}
      />
    </>
  );
}
