import { useEffect, useEffectEvent, useId, useRef, useState, type FormEvent, type SVGProps } from "react";
import { Check, CircleCheck, Clock, Copy, Loader2 } from "lucide-react";
import { RadioGroup } from "radix-ui";
import {
  createPixCharge,
  getChargeStatus,
  getPendingCharge,
  type ChargeStatus,
  type Contribution,
  type PixCharge,
} from "@/api/contributionApi";
import type { Ong } from "@/api/donationApi";
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
import { formatBRL, parseMoney } from "@/lib/unlock";
import { cn } from "@/lib/utils";
import { BuildingProfileForm } from "./BuildingProfileForm";

const PRESETS = [10, 25, 50, 100];
// Padrão baixo aumenta a taxa de conclusão (Goswami & Urminsky, 2016).
const DEFAULT_AMOUNT = "25";
// Só UI: o backend tem a palavra final (400 com `message` aparece na tela).
const MIN_VALUE = 5;
const POLL_MS = 3_000;
const STEPS = ["Contribuição", "Pagamento", "Seu edifício"];
const STEP_INDEX = { form: 0, pay: 1, done: 2 } as const;

const labelClass = "mb-2 block text-sm text-foreground/75";
const chipClass =
  "h-11 rounded-full border border-input px-2 text-sm font-medium transition-colors outline-none data-[state=unchecked]:hover:bg-foreground/5 focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground";
const selectClass = "w-full data-[size=default]:h-11";

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
    <ol aria-label="Etapas" className="grid grid-cols-3 gap-2">
      {STEPS.map((label, index) => (
        <li
          key={label}
          aria-current={index === current ? "step" : undefined}
          className={cn("text-xs", index === current ? "text-foreground" : "text-muted-foreground")}
        >
          <span className={cn("mb-1.5 block h-1 rounded-full", index <= current ? "bg-primary" : "bg-muted")} />
          {label}
        </li>
      ))}
    </ol>
  );
}

/** Etapa 2: Copia e Cola é a ação primária no celular; QR em destaque no desktop. */
function PixPayment({
  charge,
  ongName,
  expired,
  offline,
  creating,
  error,
  onRenew,
  onBack,
}: {
  charge: PixCharge;
  ongName?: string;
  expired: boolean;
  offline: boolean;
  creating: boolean;
  error: string | null;
  onRenew: () => void;
  onBack: () => void;
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

  const qr = <img src={charge.qrCodeImage} alt="QR code do Pix" className="mx-auto size-48 rounded-lg bg-white p-2" />;
  const validUntil = new Date(charge.expiresAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-5">
      <div className="text-center">
        <p className="text-3xl font-semibold tracking-tight">{formatBRL(charge.contribution.value)}</p>
        {ongName && <p className="text-sm text-muted-foreground">para {ongName}</p>}
      </div>

      {expired ? (
        <>
          <p className="text-center text-sm">Este código expirou.</p>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button size="lg" className="h-11 w-full" disabled={creating} onClick={onRenew}>
            {creating ? (
              <>
                <Loader2 className="animate-spin" />
                Gerando Pix…
              </>
            ) : (
              "Gerar novo código"
            )}
          </Button>
        </>
      ) : (
        <>
          {isMobile ? (
            <div className="space-y-3 text-center">
              <Button type="button" variant="link" onClick={() => setShowQr((show) => !show)}>
                {showQr ? "Esconder QR code" : "Mostrar QR code"}
              </Button>
              {showQr && qr}
            </div>
          ) : (
            qr
          )}
          <div>
            <label htmlFor={codeId} className={labelClass}>
              Pix Copia e Cola
            </label>
            <Input
              ref={codeRef}
              id={codeId}
              readOnly
              value={charge.copyPaste}
              className="font-mono text-xs md:text-xs"
              onFocus={(event) => event.target.select()}
            />
            {copyFailed && <p className="mt-2 text-sm text-muted-foreground">Selecione o código e copie.</p>}
          </div>
          <Button
            type="button"
            size="lg"
            variant={isMobile ? "default" : "outline"}
            className="h-11 w-full"
            onClick={copyCode}
          >
            {copied ? <Check /> : <Copy />}
            {copied ? "Código copiado" : "Copiar código"}
          </Button>
          <span role="status" className="sr-only">
            {copied ? "Código copiado." : ""}
          </span>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Abra o app do seu banco e entre em Pix.</li>
            <li>{isMobile ? "Escolha Pix Copia e Cola e cole o código." : "Leia o QR code ou use Pix Copia e Cola."}</li>
            <li>Confira se o recebedor é {charge.receiverName} e confirme.</li>
          </ol>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
            <p role="status" className="flex items-center gap-2">
              <span aria-hidden="true" className="size-2 rounded-full bg-emerald-500 motion-safe:animate-pulse" />
              {offline ? "Sem conexão. Tentando de novo…" : "Aguardando pagamento"}
            </p>
            <span className="text-muted-foreground tabular-nums">Válido até {validUntil}</span>
          </div>
        </>
      )}

      <Button type="button" variant="ghost" className="h-11 w-full" onClick={onBack}>
        Voltar
      </Button>
    </div>
  );
}

/**
 * Pílula "Contribuir" + modal em 3 etapas: contribuição (ONG, cidade, valor) →
 * pagamento Pix → seu edifício (imagem, nome, descrição). Ao terminar, o editor
 * foca o edifício e abre o painel de personalização ao vivo na cena.
 */
export function ContributeDialog({
  open,
  onOpenChange,
  ongs,
  buildings,
  onRequestLogin,
  onPaid,
  onFinish,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ongs: readonly Ong[];
  /** Edifícios do usuário; sem nenhum, a escolha novo/aumentar some. */
  buildings: readonly MyDonation[];
  onRequestLogin: () => void;
  /** Pagamento confirmado pelo servidor: o edifício entra ou cresce na cidade. */
  onPaid: (contribution: Contribution, donationId: number) => void;
  /** Fim do fluxo: foca o edifício e abre a personalização. */
  onFinish: (donationId: number) => void;
}) {
  const { user, isLoading } = useAuth();
  const userId = user?.id;
  const ongFieldId = useId();
  const cityFieldId = useId();
  const amountId = useId();
  const amountErrorId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);

  const [grow, setGrow] = useState(false);
  const [buildingId, setBuildingId] = useState("");
  const [ongId, setOngId] = useState("");
  /** undefined = campo não tocado: mostra a cidade do perfil. */
  const [city, setCity] = useState<City | null | undefined>(undefined);
  const [amount, setAmount] = useState(DEFAULT_AMOUNT);
  const [amountBlurred, setAmountBlurred] = useState(false);
  const [flow, setFlow] = useState<Flow>({ step: "form" });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  // Cobrança de outra sessão (logout/troca de conta) nunca é reaproveitada.
  const active = flow.step === "form" || flow.userId !== userId ? null : flow;
  const step = active?.step ?? "form";
  const pendingChargeId = active?.step === "pay" && !active.expired ? active.charge.id : null;

  const ongNameOf = (contribution: Contribution) =>
    contribution.donationId === null
      ? ongs.find((ong) => ong.id === contribution.ongId)?.name
      : buildings.find((building) => building.id === contribution.donationId)?.ongName;

  const handleStatus = useEffectEvent((chargeId: string, result: ChargeStatus) => {
    if (active?.step !== "pay" || active.charge.id !== chargeId) return;
    if (result.status === "expired") setFlow({ ...active, expired: true });
    if (result.status !== "paid") return;
    const { contribution } = active.charge;
    onPaid(contribution, result.donationId);
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
  const growing = grow && buildings.length > 0;
  const pickedBuilding = buildingId || (buildings.length === 1 ? String(buildings[0].id) : "");
  const pickedOng = ongId || (ongs.length === 1 ? String(ongs[0].id) : "");
  const pickedCity = city === undefined ? (user?.city ?? null) : city;
  const amountError =
    !amountBlurred || !amount.trim()
      ? null
      : value === null
        ? "Digite um valor válido."
        : value < MIN_VALUE
          ? `Mínimo de ${formatBRL(MIN_VALUE)}.`
          : null;

  let contribution: Contribution | null = null;
  if (value !== null && value >= MIN_VALUE) {
    if (growing) {
      if (pickedBuilding) contribution = { donationId: Number(pickedBuilding), value };
    } else if (pickedOng && pickedCity) {
      contribution = { donationId: null, ongId: Number(pickedOng), cityId: pickedCity.id, value };
    }
  }

  async function startCharge(input: Contribution) {
    if (!user) return onRequestLogin();
    setCreating(true);
    setError(null);
    try {
      const charge = await createPixCharge(input);
      setOffline(false);
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
    setFlow({ step: "form" });
    setError(null);
  }

  function finish(donationId: number) {
    setFlow({ step: "form" });
    setGrow(false);
    setBuildingId("");
    setOngId("");
    setCity(undefined);
    setAmount(DEFAULT_AMOUNT);
    setAmountBlurred(false);
    setError(null);
    onOpenChange(false);
    onFinish(donationId);
  }

  // Depois de pago, toda saída (X, Esc) leva ao edifício.
  function handleOpenChange(next: boolean) {
    if (!next && active?.step === "done") return finish(active.donationId);
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
          {pendingChargeId ? <Clock className="size-5" /> : <BuildingComplexPlus className="size-5" />}
          {pendingChargeId ? "Pix pendente" : "Contribuir"}
        </button>
      </DialogTrigger>
      {/* text-foreground: o body da cena pinta texto branco, que sumiria no tema claro. */}
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto text-foreground sm:max-w-md"
        // Etapa 3: clique fora não descarta o que foi digitado.
        onInteractOutside={step === "done" ? (event) => event.preventDefault() : undefined}
      >
        <DialogHeader>
          <DialogTitle
            ref={titleRef}
            tabIndex={-1}
            className="flex items-center justify-center gap-2 outline-none sm:justify-start"
          >
            {step === "done" && <CircleCheck className="size-5 text-emerald-600" />}
            {step === "form" ? "Contribuir" : step === "pay" ? "Pague com Pix" : "Pagamento confirmado"}
          </DialogTitle>
          <DialogDescription>
            {step === "form"
              ? "Sua contribuição vai para a ONG e ergue seu edifício na cidade."
              : step === "pay"
                ? "Esta tela atualiza sozinha quando o pagamento for confirmado."
                : `Sua contribuição ${doneOngName ? `para ${doneOngName} ` : ""}foi confirmada e seu edifício ${
                    doneGrew ? "cresceu." : "já está na cidade."
                  }`}
          </DialogDescription>
        </DialogHeader>
        <Stepper current={STEP_INDEX[step]} />

        {active?.step === "pay" ? (
          <PixPayment
            key={active.charge.id}
            charge={active.charge}
            ongName={ongNameOf(active.charge.contribution)}
            expired={active.expired}
            offline={offline}
            creating={creating}
            error={error}
            onRenew={() => void startCharge(active.charge.contribution)}
            onBack={backToForm}
          />
        ) : active?.step === "done" ? (
          <BuildingProfileForm
            donationId={active.donationId}
            submitLabel="Ver meu edifício"
            onDone={() => finish(active.donationId)}
          />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <fieldset disabled={creating} className="space-y-5">
              {buildings.length > 0 && (
                <div>
                  <RadioGroup.Root
                    aria-label="Edifício"
                    value={grow ? "grow" : "new"}
                    onValueChange={(next) => setGrow(next === "grow")}
                    className="grid grid-cols-2 gap-2"
                  >
                    <RadioGroup.Item value="new" className={chipClass}>
                      Novo edifício
                    </RadioGroup.Item>
                    <RadioGroup.Item value="grow" className={chipClass}>
                      Aumentar edifício
                    </RadioGroup.Item>
                  </RadioGroup.Root>
                  {grow && (
                    <Select value={pickedBuilding} onValueChange={setBuildingId}>
                      <SelectTrigger aria-label="Qual edifício" className={`mt-3 ${selectClass}`}>
                        <SelectValue placeholder="Qual edifício?" />
                      </SelectTrigger>
                      <SelectContent>
                        {buildings.map((building) => (
                          <SelectItem key={building.id} value={String(building.id)}>
                            {formatBRL(building.value)}
                            {building.ongName && ` · ${building.ongName}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
              {!growing && (
                <>
                  <div>
                    <label htmlFor={ongFieldId} className={labelClass}>
                      ONG
                    </label>
                    <Select value={pickedOng} onValueChange={setOngId} disabled={ongs.length === 0}>
                      <SelectTrigger id={ongFieldId} className={selectClass}>
                        <SelectValue placeholder={ongs.length ? "Escolha a ONG" : "Nenhuma ONG disponível"} />
                      </SelectTrigger>
                      <SelectContent>
                        {ongs.map((ong) => (
                          <SelectItem key={ong.id} value={String(ong.id)}>
                            {ong.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label htmlFor={cityFieldId} className={labelClass}>
                      Cidade do edifício
                    </label>
                    <CityCombobox id={cityFieldId} value={pickedCity} onChange={setCity} />
                  </div>
                </>
              )}
              <div>
                <label htmlFor={amountId} className={labelClass}>
                  Valor
                </label>
                <RadioGroup.Root
                  aria-label="Valores sugeridos"
                  value={value !== null && PRESETS.includes(value) ? String(value) : ""}
                  onValueChange={(preset) => {
                    setAmount(preset);
                    setAmountBlurred(false);
                  }}
                  className="mb-3 grid grid-cols-4 gap-2"
                >
                  {PRESETS.map((preset) => (
                    <RadioGroup.Item key={preset} value={String(preset)} className={chipClass}>
                      {formatBRL(preset)}
                    </RadioGroup.Item>
                  ))}
                </RadioGroup.Root>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-sm text-muted-foreground">
                    R$
                  </span>
                  <Input
                    id={amountId}
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="Outro valor"
                    className="pl-9"
                    value={amount}
                    aria-invalid={amountError ? true : undefined}
                    aria-describedby={amountError ? amountErrorId : undefined}
                    onChange={(event) => setAmount(event.target.value)}
                    onBlur={() => setAmountBlurred(true)}
                  />
                </div>
                {amountError && (
                  <p id={amountErrorId} className="mt-2 text-sm text-destructive">
                    {amountError}
                  </p>
                )}
              </div>
            </fieldset>
            {!user && <p className="text-sm text-muted-foreground">Entre para o edifício ficar na sua conta.</p>}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" className="h-11 w-full" disabled={!contribution || creating || isLoading}>
              {creating ? (
                <>
                  <Loader2 className="animate-spin" />
                  Gerando Pix…
                </>
              ) : !user ? (
                "Entrar para continuar"
              ) : (
                <>
                  {growing ? "Aumentar edifício" : "Erguer edifício"}
                  {value !== null && ` · ${formatBRL(value)}`}
                </>
              )}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
