import { useEffect, useState } from "react";
import { Share2 } from "lucide-react";
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
import type { CustomizationCatalog } from "@/api/customizationApi";
import { useAuth } from "@/hooks/useAuth";
import { AuthDialog } from "@/components/AuthDialog";
import { GameMenu, type MyDonation } from "@/components/GameMenu";
import { OnboardingDialog } from "@/components/OnboardingDialog";
import { ReferralDialog } from "@/components/referral/ReferralDialog";
import { ShareDialog } from "@/components/referral/ShareDialog";
import { NightToggle } from "@/components/ThemeToggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const overlayButton =
  "flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-black/60 px-4 text-sm font-medium text-white/80 shadow-lg backdrop-blur-md transition-colors hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-50";

function initialReferralCode() {
  return normalizeReferralCode(new URLSearchParams(window.location.search).get("ref") ?? "");
}

function messageFrom(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

type AuthMenuProps = {
  /** Modo noite da cena (`EnvironmentSettings.night`), controlado por aqui. */
  night: boolean;
  onNightChange: (night: boolean) => void;
  /** Doações da sessão, p/ a aba "Doações" do menu. */
  myDonations: readonly MyDonation[];
  catalog: CustomizationCatalog | null;
  onOpenDonation: (donationId: number) => void;
};

/** Autenticação, onboarding do primeiro login, menu do usuário (GameMenu) e entrada única dos fluxos de indicação da cena. */
export function AuthMenu({ night, onNightChange, myDonations, catalog, onOpenDonation }: AuthMenuProps) {
  const { isAuthenticated, user } = useAuth();
  const [initialCode] = useState(initialReferralCode);
  const [authOpen, setAuthOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [referralCode, setReferralCode] = useState(initialCode);
  const [referralPreview, setReferralPreview] = useState<ReferrerPreview | null>(null);
  const [referralLoading, setReferralLoading] = useState(
    REFERRAL_CODE_PATTERN.test(initialCode),
  );
  const [referralError, setReferralError] = useState<string | null>(
    initialCode && !REFERRAL_CODE_PATTERN.test(initialCode)
      ? "Código inválido."
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
  const [shareOpen, setShareOpen] = useState(false);

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
      setReferralError("Código inválido.");
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

  const referralDialogError =
    referralError ??
    applyError ??
    (user?.is_admin ? "Contas administrativas não participam do sistema de indicações." : summaryError);
  const referralDialogLoading =
    referralLoading ||
    (!referralDialogError && !summary && !user?.is_admin);

  if (isAuthenticated && user) {
    // Tela principal mostra o primeiro nome da conta; username só no menu.
    const firstName = user.name?.trim().split(/\s+/)[0] || user.username;
    const visibleName = firstName.length > 18 ? `${firstName.slice(0, 18)}…` : firstName;

    return (
      <>
        <div className="flex items-center gap-2">
          {summary && (
            <button
              type="button"
              className={overlayButton}
              onClick={() => setShareOpen(true)}
              title="Compartilhar indicação"
              aria-label="Compartilhar indicação"
            >
              <Share2 />
            </button>
          )}
          <button
            type="button"
            className={`${overlayButton} max-w-[14rem]`}
            title={firstName}
            aria-haspopup="dialog"
            onClick={() => {
              setMenuOpen(true);
              void refreshSummary();
            }}
          >
            <Avatar className="size-6 shrink-0">
              {user.profile_image && <AvatarImage src={user.profile_image} alt="" className="object-cover" />}
              <AvatarFallback className="bg-white/10 text-[10px] text-white">
                {firstName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="truncate">{visibleName}</span>
          </button>
        </div>
        <GameMenu
          open={menuOpen}
          onOpenChange={setMenuOpen}
          night={night}
          onNightChange={onNightChange}
          donations={myDonations}
          catalog={catalog}
          onOpenDonation={onOpenDonation}
          referralSummary={summary}
          referralError={summaryError}
        />
        {summary && (
          <ShareDialog open={shareOpen} onOpenChange={setShareOpen} url={summary.link} />
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
        {/* Não empilha modal: espera indicação pendente, menu e compartilhar fecharem. */}
        <OnboardingDialog blocked={referralCode !== "" || menuOpen || shareOpen} />
      </>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Deslogado não tem menu — o mesmo toggle fica ao lado do "Entrar". */}
        <NightToggle night={night} onNightChange={onNightChange} />
        <button type="button" className={overlayButton} onClick={() => setAuthOpen(true)}>
          Entrar
        </button>
      </div>
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
