import { lazy, Suspense, useEffect, useEffectEvent, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type SVGProps } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, CircleCheck, Clock, Copy, HeartHandshake, Loader2, MapPin, Search } from "lucide-react";
import { AlertDialog, RadioGroup } from "radix-ui";
import {
  createPixCharge,
  getChargeStatus,
  getPendingCharge,
  type ChargeStatus,
  type Contribution,
  type PixCharge,
} from "@/api/contributionApi";
import type { Ong } from "@/api/donationApi";
import type { CustomizationCatalog } from "@/api/customizationApi";
import type { BuildingCustomization, TextureSettings } from "@/scene/types";
import { ApiError } from "@/api/http";
import type { City } from "@/api/location/location.types";
import type { MyDonation } from "@/components/GameMenu";
import { CityCombobox } from "@/components/ProfileDetailsFields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth";
import { formatCity, normalizeSearch } from "@/lib/citySearch";
import { formatMoneyInput, normalizeMoneyInput } from "@/lib/moneyInput";
import { formatBRL, parseMoney } from "@/lib/unlock";
import { cn } from "@/lib/utils";
import { BuildingProfileForm } from "./BuildingProfileForm";

const BuildingCustomizer = lazy(() => import("@/components/customization/BuildingCustomizer").then((module) => ({ default: module.BuildingCustomizer })));

const PRESETS = [10, 25, 50, 100];
// Padrão baixo aumenta a taxa de conclusão (Goswami & Urminsky, 2016).
const DEFAULT_AMOUNT = "25,00";
// Só UI: o backend tem a palavra final (400 com `message` aparece na tela).
const MIN_VALUE = 5;
const MAX_BUILDINGS = 3;
const POLL_MS = 3_000;
const STEPS = ["Contribuição", "Pagamento", "Seu edifício"];
const STEP_INDEX = { form: 0, pay: 1, done: 2 } as const;

const labelClass = "mb-2.5 block text-sm font-medium text-foreground";
const chipClass =
  "min-h-11 rounded-xl border border-input px-2 text-sm font-medium transition-colors outline-none data-[state=unchecked]:hover:bg-foreground/5 focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground";
const selectClass = "w-full rounded-xl data-[size=default]:h-12";

/** Estado do fluxo. Vive fora do `DialogContent`: fechar o modal não perde o Pix. */
type Flow =
  | { step: "form" }
  | { step: "pay"; userId: number; charge: PixCharge; expired: boolean }
  | { step: "done"; userId: number; contribution: Contribution; donationId: number };

// ponytail: cópia do lucide `building-complex-plus` (só existe no lucide-react ≥ 1.52); trocar pelo import ao atualizar.
function BuildingComplexPlus(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M10 12h4" />
      <path d="M10 21v-3a2 2 0 013.05-1.702" />
      <path d="M10 8h4" />
      <path d="M16 19h6" />
      <path d="M18 7h2a2 2 0 012 2v4.355" />
      <path d="M19 16v6" />
      <path d="M6 10H4a2 2 0 00-2 2v7a2 2 0 002 2h8.535" />
      <path d="M6 21V5a2 2 0 012-2h8a2 2 0 012 2v7.126" />
    </svg>
  );
}

function Stepper({ current }: { current: number }) {
  return (
    <ol aria-label="Etapas da contribuição" className="grid grid-cols-3 gap-3 border-b pb-6 sm:gap-6">
      {STEPS.map((label, index) => (
        <li
          key={label}
          aria-current={index === current ? "step" : undefined}
          className={cn("flex flex-col items-start gap-2 text-[11px] sm:flex-row sm:items-center sm:text-sm", index === current ? "font-medium text-foreground" : "text-muted-foreground")}
        >
          <span aria-hidden="true" className={cn("grid size-7 shrink-0 place-items-center rounded-full text-xs sm:size-8", index <= current ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
            {index < current ? <Check className="size-4" /> : index + 1}
          </span>
          <span>{label}</span>
        </li>
      ))}
    </ol>
  );
}

/** Mesmo padrão ARIA da busca de cidade; seleção sempre aponta para uma ONG do catálogo. */
function OngCombobox({ id, ongs, value, onChange }: {
  id: string;
  ongs: readonly Ong[];
  value: string;
  onChange: (value: string) => void;
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const selected = ongs.find((ong) => String(ong.id) === value);
  const normalizedQuery = normalizeSearch(query ?? "");
  const results = ongs.filter((ong) => normalizeSearch(ong.name).includes(normalizedQuery));
  const expanded = open && results.length > 0;
  const activeIndex = Math.min(active, results.length - 1);

  useEffect(() => {
    if (!open) return;
    const closeList = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" || event.target !== inputRef.current) return;
      event.preventDefault();
      setOpen(false);
      setQuery(null);
    };
    window.addEventListener("keydown", closeList, true);
    return () => window.removeEventListener("keydown", closeList, true);
  }, [open]);

  useEffect(() => {
    if (expanded) listRef.current?.children[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [expanded, activeIndex]);

  function pick(ong: Ong) {
    onChange(String(ong.id));
    setQuery(null);
    setOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if ((event.key === "ArrowDown" || event.key === "ArrowUp") && results.length) {
      event.preventDefault();
      setOpen(true);
      if (expanded) setActive((activeIndex + (event.key === "ArrowDown" ? 1 : -1) + results.length) % results.length);
    } else if (event.key === "Enter" && open) {
      event.preventDefault();
      if (expanded) pick(results[activeIndex]);
    }
  }

  return (
    <div className="relative">
      <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-4 size-4 text-muted-foreground" />
      <Input
        ref={inputRef}
        id={id}
        role="combobox"
        aria-required="true"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={expanded ? `${listId}-${activeIndex}` : undefined}
        autoComplete="off"
        spellCheck={false}
        disabled={!ongs.length}
        placeholder={ongs.length ? "Busque ou escolha uma ONG" : "Nenhuma ONG disponível"}
        className="h-12 rounded-xl bg-background pl-10 pr-10"
        value={query ?? selected?.name ?? ""}
        onFocus={(event) => {
          event.target.select();
          setActive(Math.max(0, ongs.findIndex((ong) => String(ong.id) === value)));
          setOpen(true);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onBlur={() => {
          if (query?.trim()) {
            const exact = results.filter((ong) => normalizeSearch(ong.name) === normalizeSearch(query));
            const match = results.length === 1 ? results[0] : exact.length === 1 ? exact[0] : null;
            if (match) onChange(String(match.id));
          }
          setQuery(null);
          setOpen(false);
        }}
        onKeyDown={handleKeyDown}
      />
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3.5 top-4 size-4 text-muted-foreground" />
      <ul
        ref={listRef}
        id={listId}
        role="listbox"
        aria-label="ONGs"
        hidden={!expanded}
        className="absolute inset-x-0 top-full z-20 mt-2 max-h-60 overflow-y-auto rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg"
      >
        {results.map((ong, index) => (
          <li
            key={ong.id}
            id={`${listId}-${index}`}
            role="option"
            aria-selected={index === activeIndex}
            className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm aria-selected:bg-muted"
            onMouseDown={(event) => event.preventDefault()}
            onMouseMove={() => setActive(index)}
            onClick={() => pick(ong)}
          >
            <span className="min-w-0 break-words">{ong.name}</span>
            {String(ong.id) === value && <Check aria-hidden="true" className="size-4 shrink-0" />}
          </li>
        ))}
      </ul>
      {open && !results.length && (
        <p role="status" className="absolute inset-x-0 top-full z-20 mt-2 rounded-xl border bg-popover px-4 py-3 text-sm text-muted-foreground shadow-lg">
          Nenhuma ONG encontrada.
        </p>
      )}
    </div>
  );
}

/** Etapa 2: Copia e Cola é a ação primária no celular; QR em destaque no desktop. */
function PixPayment({
  charge,
  ongName,
  place,
  expired,
  offline,
  creating,
  error,
  onRenew,
  onBack,
  onClose,
}: {
  charge: PixCharge;
  ongName?: string;
  place?: string;
  expired: boolean;
  offline: boolean;
  creating: boolean;
  error: string | null;
  onRenew: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const isMobile = useIsMobile();
  const codeId = useId();
  const codeRef = useRef<HTMLInputElement>(null);
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2_000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(charge.copyPaste);
      setCopyFailed(false);
      setCopied(true);
    } catch {
      // Clipboard só existe em contexto seguro: sobra selecionar à mão.
      codeRef.current?.select();
      setCopyFailed(true);
    }
  }

  const qr = <img src={charge.qrCodeImage} alt="QR code do Pix" className="mx-auto size-56 max-w-full rounded-2xl bg-white p-3" />;
  const validUntil = new Date(charge.expiresAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] md:gap-8">
        <div className="flex flex-col items-center justify-center gap-5 rounded-2xl border bg-muted/40 p-5 text-center sm:p-6">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Sua contribuição</p>
            <p className="break-words text-4xl font-semibold tracking-tight tabular-nums">{formatBRL(charge.contribution.value)}</p>
            {ongName && <p className="break-words text-sm font-medium">{ongName}</p>}
            {place && <p className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground"><MapPin aria-hidden="true" className="size-3.5 shrink-0" />{place}</p>}
          </div>
          {!expired && (isMobile ? (
            <div className="space-y-3">
              <Button type="button" variant="outline" aria-expanded={showQr} onClick={() => setShowQr((show) => !show)}>
                {showQr ? "Esconder QR code" : "Mostrar QR code"}
              </Button>
              {showQr && qr}
            </div>
          ) : qr)}
          {!expired && <p className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums"><Clock aria-hidden="true" className="size-3.5" />Válido até {validUntil}</p>}
        </div>

        <div className="min-w-0 space-y-5">
          {expired ? (
            <div className="space-y-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
              <Clock aria-hidden="true" className="size-7 text-amber-600 dark:text-amber-400" />
              <h3 className="font-semibold">Este código expirou</h3>
              <p className="text-sm text-muted-foreground">Gere outro Pix para continuar com a mesma contribuição.</p>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <Button size="lg" className="h-12 w-full rounded-xl" disabled={creating} onClick={onRenew}>
                {creating ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Gerando Pix…
                  </>
                ) : (
                  "Gerar novo código"
                )}
              </Button>
            </div>
          ) : (
            <>
              <div>
                <label htmlFor={codeId} className={labelClass}>
                  Pix Copia e Cola
                </label>
                <Input
                  ref={codeRef}
                  id={codeId}
                  readOnly
                  value={charge.copyPaste}
                  className="h-12 rounded-xl bg-background font-mono text-xs md:text-xs"
                  onFocus={(event) => event.target.select()}
                />
                {copyFailed && <p className="mt-2 text-sm text-muted-foreground">Selecione o código e copie.</p>}
              </div>
              <Button
                type="button"
                size="lg"
                className="h-12 w-full rounded-xl"
                onClick={copyCode}
              >
                {copied ? <Check /> : <Copy />}
                {copied ? "Código copiado" : "Copiar código Pix"}
              </Button>
              <span role="status" className="sr-only">
                {copied ? "Código copiado." : ""}
              </span>
              <ol className="space-y-4 text-sm">
                {["Abra o app do seu banco e entre em Pix.", isMobile ? "Escolha Pix Copia e Cola e cole o código." : "Leia o QR code ou cole o código copiado.", "Confira o valor e o recebedor antes de confirmar."].map((instruction, index) => (
                  <li key={instruction} className="flex items-start gap-3">
                    <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-medium">{index + 1}</span>
                    <span className="pt-0.5 text-muted-foreground">{instruction}</span>
                  </li>
                ))}
              </ol>
              <div className="rounded-xl border px-4 py-3 text-sm">
                <p className="text-xs text-muted-foreground">Recebedor no app do banco</p>
                <p className="mt-1 break-words font-medium">{charge.receiverName}</p>
              </div>
              <p role="status" className="flex items-center gap-2 rounded-xl bg-muted/60 px-4 py-3 text-sm">
                <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", offline ? "bg-amber-500" : "bg-emerald-500 motion-safe:animate-pulse")} />
                {offline ? "Sem conexão. Tentando novamente…" : "Aguardando confirmação do pagamento"}
              </p>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap justify-between gap-2 border-t pt-5">
        <Button type="button" variant="ghost" className="h-11 rounded-xl" disabled={creating} onClick={onBack}>
          Alterar contribuição
        </Button>
        <Button type="button" variant="outline" className="h-11 rounded-xl" disabled={creating} onClick={onClose}>
          Continuar depois
        </Button>
      </div>
    </div>
  );
}

/**
 * Pílula "Contribuir" + modal em 3 etapas: contribuição (ONG, cidade, valor) →
 * pagamento Pix → seu edifício (prévia 3D, aparência e perfil). Entrar na cidade
 * mantém a etapa 3 disponível para voltar à edição.
 */
export function ContributeDialog({
  open,
  onOpenChange,
  ongs,
  buildings,
  catalog,
  textureSettings,
  getCustomization,
  onCustomizationChange,
  onRequestLogin,
  onPaid,
  onFinish,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ongs: readonly Ong[];
  /** Edifícios do usuário; sem nenhum, a escolha novo/aumentar some. */
  buildings: readonly MyDonation[];
  catalog: CustomizationCatalog | null;
  textureSettings: TextureSettings;
  getCustomization: (donationId: number) => BuildingCustomization;
  onCustomizationChange: (donationId: number, patch: Partial<BuildingCustomization>) => void;
  onRequestLogin: () => void;
  /** Pagamento confirmado pelo servidor: o edifício entra ou cresce na cidade. */
  onPaid: (contribution: Contribution, donationId: number) => void;
  /** Ver o edifício: foca e abre a personalização sem apagar a etapa 3. */
  onFinish: (donationId: number) => void;
}) {
  const { user, isLoading } = useAuth();
  const userId = user?.id;
  const ongFieldId = useId();
  const cityFieldId = useId();
  const amountId = useId();
  const amountErrorId = useId();
  const amountHintId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);

  const [grow, setGrow] = useState(false);
  const [buildingId, setBuildingId] = useState("");
  const [ongId, setOngId] = useState("");
  /** undefined = campo não tocado: mostra a cidade do perfil. */
  const [city, setCity] = useState<City | null | undefined>(undefined);
  const [amount, setAmount] = useState(DEFAULT_AMOUNT);
  const [amountBlurred, setAmountBlurred] = useState(false);
  const [flow, setFlow] = useState<Flow>({ step: "form" });
  const [editingCharge, setEditingCharge] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [profileEdit, setProfileEdit] = useState({ dirty: false, busy: false });
  const [appearanceBusy, setAppearanceBusy] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);

  // Cobrança de outra sessão (logout/troca de conta) nunca é reaproveitada.
  const active = flow.step === "form" || flow.userId !== userId ? null : flow;
  const step = active?.step === "pay" && editingCharge ? "form" : active?.step ?? "form";
  const pendingChargeId = active?.step === "pay" && !active.expired ? active.charge.id : null;
  const customization = useMemo(() => active?.step === "done" ? getCustomization(active.donationId) : null, [active, getCustomization]);
  const editBusy = profileEdit.busy || appearanceBusy;

  const ongNameOf = (contribution: Contribution) =>
    ongs.find((ong) => ong.id === contribution.ongId)?.name;

  const handleStatus = useEffectEvent((chargeId: string, result: ChargeStatus) => {
    if (active?.step !== "pay" || active.charge.id !== chargeId) return;
    if (result.status === "expired") setFlow({ ...active, expired: true });
    if (result.status !== "paid") return;
    const { contribution } = active.charge;
    onPaid(contribution, result.donationId);
    setEditingCharge(false);
    setFlow({ step: "done", userId: active.userId, contribution, donationId: result.donationId });
    if (!open) {
      toast.success("Pagamento confirmado.", {
        description: contribution.donationId === null ? "Seu edifício já está na cidade." : "Seu edifício cresceu.",
        duration: 10_000,
        action: { label: "Continuar", onClick: () => onOpenChange(true) },
      });
    }
  });

  // Status ao vivo, com o modal aberto ou fechado. Aba escondida não consulta;
  // voltar do app do banco (visibilitychange) consulta na hora.
  useEffect(() => {
    if (!pendingChargeId) return;
    const chargeId = pendingChargeId;
    const controller = new AbortController();
    let failures = 0;
    let busy = false;
    async function check() {
      if (busy || document.hidden) return;
      busy = true;
      try {
        const result = await getChargeStatus(chargeId, controller.signal);
        failures = 0;
        if (!controller.signal.aborted) handleStatus(chargeId, result);
      } catch {
        failures += 1;
      } finally {
        busy = false;
      }
      if (!controller.signal.aborted) setOffline(failures >= 3);
    }
    const timer = setInterval(check, POLL_MS);
    document.addEventListener("visibilitychange", check);
    return () => {
      controller.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [pendingChargeId]);

  // Retoma o Pix pendente da conta (remount após retry; com o backend, recarregar a página).
  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    getPendingCharge(controller.signal).then(
      (charge) => {
        if (!charge || controller.signal.aborted) return;
        setFlow((current) =>
          current.step !== "form" && current.userId === userId
            ? current
            : { step: "pay", userId, charge, expired: false },
        );
      },
      () => {},
    );
    return () => controller.abort();
  }, [userId]);

  // Troca de etapa leva o foco ao título; a 1ª abertura fica com o autofocus do Radix.
  const lastStep = useRef(step);
  useEffect(() => {
    if (lastStep.current === step) return;
    lastStep.current = step;
    if (open) titleRef.current?.focus();
  }, [step, open]);

  const value = parseMoney(amount);
  const atBuildingLimit = buildings.length >= MAX_BUILDINGS;
  const growing = (grow || atBuildingLimit) && buildings.length > 0;
  const pickedBuilding = buildingId || (buildings.length === 1 ? String(buildings[0].id) : "");
  const pickedOng = ongId || (ongs.length === 1 ? String(ongs[0].id) : "");
  const pickedCity = city === undefined ? (user?.city ?? null) : city;
  const selectedBuilding = buildings.find((building) => String(building.id) === pickedBuilding);
  const selectedOng = ongs.find((ong) => String(ong.id) === pickedOng);
  const destinationName = selectedOng?.name;
  const destinationPlace = growing ? selectedBuilding?.place : pickedCity ? formatCity(pickedCity) : undefined;
  const amountError = amountBlurred && (value === null || value < MIN_VALUE)
    ? `Mínimo de ${formatBRL(MIN_VALUE)}.`
    : null;

  let contribution: Contribution | null = null;
  if (value !== null && value >= MIN_VALUE && selectedOng) {
    if (growing) {
      if (selectedBuilding) contribution = { donationId: selectedBuilding.id, ongId: selectedOng.id, value };
    } else if (pickedCity) {
      contribution = { donationId: null, ongId: selectedOng.id, cityId: pickedCity.id, value };
    }
  }

  async function startCharge(input: Contribution) {
    if (creating) return;
    if (!user) return onRequestLogin();
    setCreating(true);
    setError(null);
    try {
      const charge = await createPixCharge(input);
      setOffline(false);
      setEditingCharge(false);
      setFlow({ step: "pay", userId: user.id, charge, expired: false });
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      if (status === 401) {
        setError("Sua sessão expirou. Entre de novo.");
        onRequestLogin();
      } else {
        setError(
          status === 400 && err instanceof ApiError ? err.message : "Não foi possível gerar o Pix. Tente de novo.",
        );
      }
    } finally {
      setCreating(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!contribution) return;
    if (!user) return onRequestLogin();
    void startCharge(contribution);
  }

  function backToForm() {
    setEditingCharge(true);
    setError(null);
  }

  function finish(donationId: number) {
    setProfileEdit({ dirty: false, busy: false });
    setConfirmExit(false);
    onOpenChange(false);
    onFinish(donationId);
  }

  function leaveProfile() {
    if (active?.step !== "done" || editBusy) return;
    if (profileEdit.dirty) setConfirmExit(true);
    else finish(active.donationId);
  }

  // Depois de pago, sair leva ao edifício e permite retornar à etapa 3.
  // Edições pendentes pedem confirmação antes de serem descartadas.
  function handleOpenChange(next: boolean) {
    if (!next && active?.step === "done") return leaveProfile();
    onOpenChange(next);
  }

  const doneOngName = active?.step === "done" ? ongNameOf(active.contribution) : undefined;
  const doneGrew = active?.step === "done" && active.contribution.donationId !== null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="absolute bottom-6 left-1/2 z-30 flex h-12 -translate-x-1/2 items-center gap-2 rounded-full bg-primary-foreground px-6 text-sm font-semibold text-primary shadow-lg outline-none transition-transform hover:scale-[1.03] focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-100"
        >
          {active?.step === "done" ? <ArrowLeft aria-hidden="true" className="size-5" /> : pendingChargeId ? <Clock className="size-5" /> : <BuildingComplexPlus className="size-5" />}
          {active?.step === "done" ? "Voltar à edição" : pendingChargeId ? "Pix pendente" : "Contribuir"}
        </button>
      </DialogTrigger>
      {/* text-foreground: o body da cena pinta texto branco, que sumiria no tema claro. */}
      <DialogContent
        className={cn("max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-[calc(100%-1rem)] gap-6 overflow-y-auto overscroll-contain rounded-3xl p-5 text-foreground sm:max-h-[calc(100dvh-3rem)] sm:w-[calc(100%-3rem)] sm:max-w-3xl sm:p-8 lg:max-w-4xl lg:p-10", step === "done" && "lg:max-w-6xl")}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          titleRef.current?.focus();
        }}
        showCloseButton={step !== "done" || !editBusy}
        onEscapeKeyDown={(event) => {
          if (step === "done" && editBusy) event.preventDefault();
        }}
        // Etapa 3: clique fora não descarta o que foi digitado.
        onInteractOutside={step === "done" ? (event) => event.preventDefault() : undefined}
      >
        <DialogHeader className="pr-6 text-left">
          <DialogTitle
            ref={titleRef}
            tabIndex={-1}
            className="flex items-center gap-3 text-2xl leading-tight outline-none sm:text-3xl"
          >
            <span className={cn("grid size-11 shrink-0 place-items-center rounded-2xl", step === "done" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-primary/10 text-primary")}>
              {step === "done" ? <CircleCheck aria-hidden="true" className="size-6" /> : <HeartHandshake aria-hidden="true" className="size-6" />}
            </span>
            {step === "form" ? "Faça sua contribuição" : step === "pay" ? "Pagamento com Pix" : "Pagamento confirmado"}
          </DialogTitle>
          <DialogDescription>
            {step === "form"
              ? "Apoie uma ONG e tenha seu edifício na cidade."
              : step === "pay"
                ? "Esta tela atualiza sozinha quando o pagamento for confirmado."
                : `Sua contribuição ${doneOngName ? `para ${doneOngName} ` : ""}foi confirmada e seu edifício ${
                    doneGrew ? "cresceu." : "já está na cidade."
                  }`}
          </DialogDescription>
        </DialogHeader>
        <Stepper current={STEP_INDEX[step]} />

        {active?.step === "pay" && !editingCharge ? (
          <PixPayment
            key={active.charge.id}
            charge={active.charge}
            ongName={ongNameOf(active.charge.contribution)}
            place={active.charge.contribution.donationId === null
              ? pickedCity?.id === active.charge.contribution.cityId ? formatCity(pickedCity) : undefined
              : buildings.find((building) => building.id === active.charge.contribution.donationId)?.place}
            expired={active.expired}
            offline={offline}
            creating={creating}
            error={error}
            onRenew={() => void startCharge(active.charge.contribution)}
            onBack={backToForm}
            onClose={() => onOpenChange(false)}
          />
        ) : active?.step === "done" ? (open && customization && (
          <div className="space-y-6">
            <Suspense fallback={<p role="status" className="flex items-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 aria-hidden className="size-5 animate-spin" />Carregando personalização…</p>}>
              <BuildingCustomizer
                catalog={catalog}
                customization={customization}
                textureSettings={textureSettings}
                onChange={(patch) => onCustomizationChange(active.donationId, patch)}
                onBusyChange={setAppearanceBusy}
              />
            </Suspense>
            <BuildingProfileForm
              donationId={active.donationId}
              collapsible
              disabled={appearanceBusy}
              submitLabel="Entrar na cidade"
              onDone={() => finish(active.donationId)}
              onSkip={leaveProfile}
              onEditStateChange={setProfileEdit}
            />
          </div>
        )) : (
          <form onSubmit={handleSubmit} aria-busy={creating} className="space-y-6">
            {pendingChargeId && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/50 px-4 py-3 text-sm">
                <p className="flex items-center gap-2"><Clock aria-hidden="true" className="size-4 shrink-0" />Você tem um Pix pendente.</p>
                <Button type="button" variant="outline" disabled={creating} onClick={() => {
                  setEditingCharge(false);
                  setError(null);
                }}>Voltar ao Pix</Button>
                <p className="w-full text-xs text-muted-foreground">Ao gerar outro Pix, o código anterior será substituído.</p>
              </div>
            )}
            <fieldset disabled={creating} className="grid min-w-0 gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-8">
              <div className="min-w-0 space-y-6">
                {buildings.length > 0 && (
                  <div>
                    <p id={`${amountId}-building`} className={labelClass}>Edifício</p>
                    <RadioGroup.Root
                      aria-labelledby={`${amountId}-building`}
                      value={growing ? "grow" : "new"}
                      onValueChange={(next) => setGrow(next === "grow")}
                      className="grid grid-cols-2 gap-2"
                    >
                      <RadioGroup.Item value="new" disabled={atBuildingLimit} className={cn(chipClass, "min-h-14 disabled:cursor-not-allowed disabled:opacity-50")}>
                        Novo edifício
                      </RadioGroup.Item>
                      <RadioGroup.Item value="grow" className={cn(chipClass, "min-h-14")}>
                        Aumentar edifício
                      </RadioGroup.Item>
                    </RadioGroup.Root>
                    {atBuildingLimit && <p className="mt-2 text-xs text-muted-foreground">Limite de 3 edifícios por conta.</p>}
                    {growing && (
                      <Select value={pickedBuilding} onValueChange={setBuildingId}>
                        <SelectTrigger aria-label="Qual edifício" className={`mt-4 ${selectClass}`}>
                          <SelectValue placeholder="Qual edifício?" />
                        </SelectTrigger>
                        <SelectContent>
                          {buildings.map((building, index) => (
                            <SelectItem key={building.id} value={String(building.id)}>
                              Edifício {index + 1} · {formatBRL(building.value)}
                              {building.ongName && ` · ${building.ongName}`}
                              {building.place && ` · ${building.place}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}
                <div>
                  <label htmlFor={ongFieldId} className={labelClass}>
                    ONG
                  </label>
                  <OngCombobox id={ongFieldId} ongs={ongs} value={pickedOng} onChange={setOngId} />
                </div>
                {!growing && (
                  <div>
                    <label htmlFor={cityFieldId} className={labelClass}>
                      Cidade do edifício
                    </label>
                    <CityCombobox id={cityFieldId} value={pickedCity} onChange={setCity} className="h-12 rounded-xl bg-background" />
                    <p className="mt-2 text-xs text-muted-foreground">Seu edifício aparecerá nesta cidade.</p>
                  </div>
                )}
                <div className="flex items-start gap-3 rounded-2xl bg-muted/40 p-4 text-sm text-muted-foreground">
                  <BuildingComplexPlus className="mt-0.5 size-5 shrink-0 text-foreground" />
                  <p>{growing ? "Sua contribuição aumenta o valor do edifício escolhido." : "Após o pagamento, escolha o nome e a imagem do seu edifício."}</p>
                </div>
              </div>
              <div className="min-w-0 rounded-2xl border bg-muted/30 p-5 sm:p-6">
                <label htmlFor={amountId} className={labelClass}>
                  Valor da contribuição
                </label>
                <div className="relative mb-4">
                  <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-4 grid place-items-center text-xl font-medium text-muted-foreground">
                    R$
                  </span>
                  <Input
                    id={amountId}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="0,00"
                    className="h-24 rounded-2xl bg-background pl-14 pr-4 text-4xl font-semibold tracking-tight tabular-nums md:text-4xl"
                    value={amount}
                    aria-invalid={amountError ? true : undefined}
                    aria-describedby={`${amountHintId}${amountError ? ` ${amountErrorId}` : ""}`}
                    onFocus={(event) => event.target.select()}
                    onChange={(event) => {
                      const next = formatMoneyInput(event.target.value);
                      if (next !== null) setAmount(next);
                    }}
                    onPaste={(event) => {
                      event.preventDefault();
                      const next = normalizeMoneyInput(event.clipboardData.getData("text"));
                      if (next !== null) setAmount(next);
                    }}
                    onBlur={() => setAmountBlurred(true)}
                  />
                </div>
                <RadioGroup.Root
                  aria-label="Valores sugeridos"
                  value={value !== null && PRESETS.includes(value) ? String(value) : ""}
                  onValueChange={(preset) => {
                    setAmount(`${preset},00`);
                    setAmountBlurred(false);
                  }}
                  className="grid grid-cols-2 gap-2 min-[380px]:grid-cols-4"
                >
                  {PRESETS.map((preset) => (
                    <RadioGroup.Item key={preset} value={String(preset)} className={chipClass}>
                      {formatBRL(preset)}
                    </RadioGroup.Item>
                  ))}
                </RadioGroup.Root>
                <p id={amountHintId} className="mt-3 text-xs text-muted-foreground">Mínimo de {formatBRL(MIN_VALUE)}. Você pode digitar outro valor.</p>
                {amountError && (
                  <p id={amountErrorId} role="alert" className="mt-2 text-sm text-destructive">
                    {amountError}
                  </p>
                )}
                <dl className="mt-5 space-y-3 border-t pt-5 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">ONG</dt>
                    <dd className="min-w-0 break-words text-right font-medium">{destinationName ?? "Selecione uma ONG"}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Cidade</dt>
                    <dd className="min-w-0 break-words text-right font-medium">{destinationPlace ?? (growing ? selectedBuilding ? "Cidade do edifício" : "Selecione um edifício" : "Selecione uma cidade")}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Pagamento</dt>
                    <dd className="font-medium">Pix</dd>
                  </div>
                  {growing && selectedBuilding && value !== null && (
                    <div className="flex justify-between gap-4 border-t pt-3">
                      <dt className="text-muted-foreground">Edifício após a contribuição</dt>
                      <dd className="font-medium tabular-nums">{formatBRL(selectedBuilding.value + value)}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </fieldset>
            <div className="flex flex-col gap-4 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                {error ? <p role="alert" className="text-destructive">{error}</p>
                  : !contribution ? <p>{growing && !selectedBuilding ? "Escolha o edifício para continuar." : !selectedOng ? "Escolha uma ONG para continuar." : !growing && !pickedCity ? "Escolha uma cidade para continuar." : "Informe um valor a partir de R$ 5."}</p>
                  : !user ? <p>Entre para vincular o edifício à sua conta.</p>
                  : <p>Na próxima etapa, você recebe o código Pix.</p>}
              </div>
              <Button type="submit" size="lg" className="h-12 w-full rounded-xl px-6 sm:w-auto sm:min-w-52" disabled={!contribution || creating || isLoading}>
                {creating ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Gerando Pix…
                  </>
                ) : !user ? (
                  "Entrar para continuar"
                ) : (
                  <>
                    Ir para pagamento
                    <ArrowRight aria-hidden="true" />
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
        <AlertDialog.Root open={confirmExit} onOpenChange={setConfirmExit}>
          <AlertDialog.Portal>
            <AlertDialog.Overlay className="fixed inset-0 z-[60] bg-black/60" />
            <AlertDialog.Content className="fixed left-1/2 top-1/2 z-[60] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-2xl border bg-background p-6 text-foreground shadow-xl">
              <AlertDialog.Title className="text-lg font-semibold">Sair sem salvar?</AlertDialog.Title>
              <AlertDialog.Description className="text-sm text-muted-foreground">O pagamento está confirmado. As alterações no nome, na descrição e na imagem serão descartadas.</AlertDialog.Description>
              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <AlertDialog.Cancel asChild><Button variant="outline" className="h-11 rounded-xl">Continuar editando</Button></AlertDialog.Cancel>
                <AlertDialog.Action asChild><Button className="h-11 rounded-xl" onClick={() => {
                  if (active?.step === "done") finish(active.donationId);
                }}>Sair sem salvar</Button></AlertDialog.Action>
              </div>
            </AlertDialog.Content>
          </AlertDialog.Portal>
        </AlertDialog.Root>
      </DialogContent>
    </Dialog>
  );
}
