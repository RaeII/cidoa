import { useEffect, useRef, useState } from "react";
import {
  animate,
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
} from "motion/react";

/** Doação em processamento exibida pelo cartão de pagamento. */
export type Payment = { id: number; amount: number };

type PaymentSimulationProps = {
  /** Pagamento ativo. `null` = nenhum cartão visível. */
  payment: Payment | null;
  /** Dispara quando a confirmação anima — momento de fazer o edifício aparecer. */
  onConfirmed: (amount: number) => void;
  /** Pede o fechamento do cartão (limpar `payment` no pai → inicia a saída). */
  onDone: () => void;
  /** Dispara após o cartão sair de tela — libera o próximo pagamento. */
  onExited: () => void;
};

// Duração de cada fase (ms), na ordem da simulação de pagamento.
const TYPING_MS = 1500; // 1) digita o valor (caractere por caractere)
const QR_MS = 1800; // 2) QR Code do Pix visível para "pagar"
const LOADING_MS = 1800; // 3) barra de loading processa
const CONFIRMED_HOLD_MS = 1500; // 4) confirmação antes do cartão sair

const formatBRL = (value: number) => `R$ ${Math.round(value).toLocaleString("pt-BR")}`;

// QR Code do Pix servido de `public/` (raiz do Vite).
const QR_SRC = "/qr_code.png";

/**
 * Overlay de simulação de pagamento no canto superior direito.
 * Um cartão por vez: preenche o valor, processa, confirma (checkmark) e sai.
 * `AnimatePresence` cuida da animação de saída quando `payment` vira `null`.
 */
export function PaymentSimulation({
  payment,
  onConfirmed,
  onDone,
  onExited,
}: PaymentSimulationProps) {
  return (
    <div className="pointer-events-none absolute right-[12%] top-[25%] z-40 flex w-[min(21rem,calc(100vw-2rem))] -translate-y-1/2 flex-col items-end">
      <AnimatePresence onExitComplete={onExited}>
        {payment && (
          <PaymentCard
            key={payment.id}
            amount={payment.amount}
            onConfirmed={onConfirmed}
            onDone={onDone}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

type PaymentCardProps = {
  amount: number;
  onConfirmed: (amount: number) => void;
  onDone: () => void;
};

type Phase = "typing" | "qr" | "loading" | "confirmed";

function PaymentCard({ amount, onConfirmed, onDone }: PaymentCardProps) {
  const [phase, setPhase] = useState<Phase>("typing");

  // Refs para os callbacks: o efeito de timeline roda uma vez e não deve
  // reiniciar quando o pai recria as funções a cada render.
  const onConfirmedRef = useRef(onConfirmed);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onConfirmedRef.current = onConfirmed;
    onDoneRef.current = onDone;
  });

  // Efeito de digitação: revela o valor formatado caractere por caractere.
  const fullValue = formatBRL(amount);
  const typedChars = useMotionValue(0);
  const displayValue = useTransform(typedChars, (v) => fullValue.slice(0, Math.round(v)));

  useEffect(() => {
    // 1) digita o valor
    const typeControls = animate(typedChars, fullValue.length, {
      duration: TYPING_MS / 1000,
      ease: "linear", // ritmo constante de digitação
    });

    // 2) valor preenchido → mostra o QR Code
    const toQr = setTimeout(() => setPhase("qr"), TYPING_MS);
    // 3) QR escaneado → barra de loading processa
    const toLoading = setTimeout(() => setPhase("loading"), TYPING_MS + QR_MS);
    // 4) loading completo → confirmação (e o edifício aparece)
    const toConfirm = setTimeout(() => {
      setPhase("confirmed");
      onConfirmedRef.current(amount);
    }, TYPING_MS + QR_MS + LOADING_MS);
    // cartão sai
    const toDone = setTimeout(() => {
      onDoneRef.current();
    }, TYPING_MS + QR_MS + LOADING_MS + CONFIRMED_HOLD_MS);

    return () => {
      typeControls.stop();
      clearTimeout(toQr);
      clearTimeout(toLoading);
      clearTimeout(toConfirm);
      clearTimeout(toDone);
    };
  }, [amount, fullValue, typedChars]);

  const confirmed = phase === "confirmed";

  return (
    <motion.div
      initial={{ opacity: 0, x: 48, scale: 0.94 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 48, scale: 0.96, transition: { duration: 0.45, ease: [0.4, 0, 1, 1] } }}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
      className="pointer-events-auto relative w-full overflow-hidden rounded-2xl border border-white/10 bg-black/70 shadow-2xl backdrop-blur-xl"
    >
      {/* Brilho superior sutil */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

      {/* Faixa de acento que muda de cor ao confirmar */}
      <motion.div
        className="absolute inset-x-0 top-0 h-[3px] origin-left"
        animate={{
          background: confirmed
            ? "linear-gradient(90deg,#34d399,#10b981)"
            : "linear-gradient(90deg,#38bdf8,#818cf8)",
        }}
        transition={{ duration: 0.4 }}
      />

      <div className="flex flex-col gap-3 px-5 pb-4 pt-[18px]">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CardGlyph confirmed={confirmed} />
            <div className="flex flex-col">
              <span className="text-[13px] font-semibold leading-tight text-white">
                Pagamento
              </span>
              <span className="text-[11px] leading-tight text-white/40">via Pix</span>
            </div>
          </div>
          <StatusBadge confirmed={confirmed} />
        </div>

        {/* Valor (efeito de digitação) */}
        <div className="flex h-8 items-center gap-0.5">
          <motion.span
            className="text-2xl font-semibold tabular-nums tracking-tight text-white"
            animate={confirmed ? { scale: [1, 1.06, 1] } : {}}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            {displayValue}
          </motion.span>
          {phase === "typing" && <TypingCursor />}
        </div>

        {/* 2) QR Code do Pix — aparece após digitar o valor; colapsa ao processar */}
        <AnimatePresence initial={false}>
          {phase === "qr" && (
            <motion.div
              key="qr"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="flex flex-col items-center gap-2 pt-1">
                <div className="rounded-xl bg-white p-2.5 shadow-inner">
                  <img
                    src={QR_SRC}
                    alt="QR Code Pix"
                    draggable={false}
                    className="h-28 w-28 select-none"
                  />
                </div>
                <span className="text-[11px] text-white/40">escaneie para pagar</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 3) Barra de loading — processa o pagamento */}
        <AnimatePresence initial={false}>
          {phase === "loading" && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="flex flex-col gap-2 pt-1">
                <ProgressBar />
                <div className="flex items-center justify-between text-[11px] text-white/40">
                  <span>processando transação</span>
                  <span>aguarde</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 4) Confirmação */}
        <AnimatePresence initial={false}>
          {confirmed && (
            <motion.div
              key="success"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-2.5 pt-1">
                <CheckBadge />
                <span className="text-[13px] font-medium text-emerald-300">
                  Pagamento confirmado
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/** Cursor piscante exibido ao lado do valor durante a digitação. */
function TypingCursor() {
  return (
    <motion.span
      className="inline-block h-6 w-[2px] translate-y-[1px] rounded-full bg-white/70"
      animate={{ opacity: [1, 1, 0, 0] }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear", times: [0, 0.5, 0.5, 1] }}
    />
  );
}

/** Barra de progresso que preenche durante PROCESSING_MS com brilho deslizante. */
function ProgressBar() {
  return (
    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      <motion.div
        className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-sky-400 to-indigo-400"
        initial={{ width: "0%" }}
        animate={{ width: "100%" }}
        transition={{ duration: LOADING_MS / 1000, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Brilho que desliza sobre o preenchimento */}
        <motion.div
          className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/60 to-transparent"
          animate={{ x: ["-120%", "320%"] }}
          transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.div>
    </div>
  );
}

/** Glyph do cartão (cartão de crédito) no cabeçalho. */
function CardGlyph({ confirmed }: { confirmed: boolean }) {
  return (
    <motion.div
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10"
      animate={{
        backgroundColor: confirmed ? "rgba(16,185,129,0.15)" : "rgba(56,189,248,0.12)",
      }}
      transition={{ duration: 0.4 }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect
          x="2.5"
          y="5"
          width="19"
          height="14"
          rx="2.5"
          stroke={confirmed ? "#34d399" : "#7dd3fc"}
          strokeWidth="1.6"
        />
        <path d="M2.5 9.5h19" stroke={confirmed ? "#34d399" : "#7dd3fc"} strokeWidth="1.6" />
        <path
          d="M6 14.5h4"
          stroke={confirmed ? "#34d399" : "#7dd3fc"}
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    </motion.div>
  );
}

/** Pílula de status no canto superior direito: spinner → check. */
function StatusBadge({ confirmed }: { confirmed: boolean }) {
  return (
    <div className="flex h-6 items-center">
      <AnimatePresence mode="wait" initial={false}>
        {confirmed ? (
          <motion.div
            key="ok"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ type: "spring", stiffness: 360, damping: 22 }}
            className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-300"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            ok
          </motion.div>
        ) : (
          <motion.div
            key="spin"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-1.5 rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-medium text-white/50"
          >
            <Spinner />
            processando
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Spinner circular contínuo. */
function Spinner() {
  return (
    <motion.span
      className="block h-3 w-3 rounded-full border-[1.5px] border-white/20 border-t-sky-400"
      animate={{ rotate: 360 }}
      transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }}
    />
  );
}

/** Círculo verde com checkmark desenhado (pathLength) + pulso de anel. */
function CheckBadge() {
  return (
    <div className="relative flex h-6 w-6 items-center justify-center">
      {/* Anel que expande e some no momento da confirmação */}
      <motion.span
        className="absolute inset-0 rounded-full border border-emerald-400"
        initial={{ scale: 0.6, opacity: 0.8 }}
        animate={{ scale: 1.9, opacity: 0 }}
        transition={{ duration: 1, ease: "easeOut" }}
      />
      <motion.span
        className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 360, damping: 20 }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <motion.path
            d="M5 12.5l4.2 4.2L19 7"
            stroke="#34d399"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.18, duration: 0.55, ease: "easeOut" }}
          />
        </svg>
      </motion.span>
    </div>
  );
}
