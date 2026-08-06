import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { PARTNER_NGOS } from "./DonationInfoSection";
import type { DonationInfo } from "../../scene/types";

type DonationFormModalProps = {
  open: boolean;
  onConfirm: (amount: number, info: DonationInfo) => void;
  onClose: () => void;
};

// Valores sugeridos. Altura do edifício é normalizada (`targetMaxHeight`), então
// o número em si só define quem é o mais alto da cidade.
const AMOUNT_PRESETS = [50, 100, 250, 500] as const;

const IMAGE_MAX_BYTES = 8 * 1024 * 1024; // 8 MB — teto antes de decodificar o arquivo
// A foto vai para o localStorage como data URL junto da cena. Foto de celular em
// base64 estoura sozinha a cota (~5 MB), então reduz antes de guardar.
const MAX_IMAGE_SIDE = 512;

const formatBRL = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

async function readImageDownscaled(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.82);
}

const FIELD_CLASS =
  "w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-white/25 focus:border-[#c9a86a]/60 focus:bg-white/[0.07]";

const LABEL_CLASS = "mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-white/40";

/**
 * Modal centralizado de simulação de doação (botão direito na cena).
 * Doador escolhe valor, ONG, imagem, título, descrição e link; ao confirmar,
 * o pai dispara a simulação de pagamento e o edifício nasce com essas informações.
 */
export function DonationFormModal({ open, onConfirm, onClose }: DonationFormModalProps) {
  const [amount, setAmount] = useState<number>(100);
  const [ngo, setNgo] = useState<string>(PARTNER_NGOS[0].name);
  const [image, setImage] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [link, setLink] = useState("");
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // permite reenviar o mesmo arquivo
    if (!file) return;
    if (file.size > IMAGE_MAX_BYTES) {
      setImageError("Imagem muito grande (máx. 8 MB).");
      return;
    }
    try {
      setImage(await readImageDownscaled(file));
      setImageError(null);
    } catch {
      setImageError("Não foi possível ler essa imagem.");
    }
  };

  const canConfirm = title.trim().length > 0 && amount > 0;

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm(amount, {
      title: title.trim(),
      description: description.trim(),
      link: link.trim(),
      image,
      ngo,
    });
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="absolute inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Fundo escuro: clique fora fecha */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Nova doação"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97, transition: { duration: 0.2 } }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
            className="scrollbar-hidden relative max-h-[88vh] w-full max-w-xl overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-[#0b0d12]/95 shadow-2xl backdrop-blur-xl"
          >
            {/* Brilho superior + faixa de acento */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
            <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#c9a86a] via-[#e4c98b] to-[#c9a86a]" />

            <div className="flex items-start justify-between px-6 pb-2 pt-6">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-[#c9a86a]">
                  Nova doação
                </p>
                <h2 className="mt-2 text-2xl font-medium leading-tight text-white">
                  Erga seu prédio na cidade
                </h2>
                <p className="mt-1.5 text-sm text-white/45">
                  Escolha o valor, a ONG e como seu edifício se apresenta.
                </p>
              </div>
              <button
                onClick={onClose}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                title="Fechar"
                aria-label="Fechar formulário de doação"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="space-y-5 px-6 pb-6 pt-4">
              {/* Valor */}
              <div>
                <span className={LABEL_CLASS}>Valor da doação</span>
                <div className="flex flex-wrap gap-2">
                  {AMOUNT_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setAmount(preset)}
                      className={`rounded-lg border px-3.5 py-2 text-sm tabular-nums transition-colors ${
                        amount === preset
                          ? "border-[#c9a86a]/60 bg-[#c9a86a]/15 text-[#e4c98b]"
                          : "border-white/10 bg-white/5 text-white/55 hover:border-white/25 hover:text-white"
                      }`}
                    >
                      {formatBRL(preset)}
                    </button>
                  ))}
                  <div className="flex min-w-[8rem] flex-1 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 focus-within:border-[#c9a86a]/60">
                    <span className="text-sm text-white/35">R$</span>
                    <input
                      type="number"
                      min={1}
                      value={amount}
                      onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-transparent py-2 text-sm tabular-nums text-white outline-none"
                      aria-label="Valor personalizado"
                    />
                  </div>
                </div>
              </div>

              {/* ONG */}
              <div>
                <label className={LABEL_CLASS} htmlFor="donation-ngo">
                  ONG beneficiada
                </label>
                <select
                  id="donation-ngo"
                  value={ngo}
                  onChange={(e) => setNgo(e.target.value)}
                  className={`${FIELD_CLASS} appearance-none`}
                >
                  {PARTNER_NGOS.map((partner) => (
                    <option key={partner.name} value={partner.name} className="bg-[#0b0d12]">
                      {partner.name} — {partner.city}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-white/30">
                  {PARTNER_NGOS.find((p) => p.name === ngo)?.focus}
                </p>
              </div>

              {/* Imagem + título + link */}
              <div className="grid gap-4 sm:grid-cols-[8.5rem_1fr]">
                <div>
                  <span className={LABEL_CLASS}>Imagem</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="group relative flex h-[8.5rem] w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-white/15 bg-white/[0.03] transition-colors hover:border-[#c9a86a]/50"
                    title="Escolher imagem"
                  >
                    {image ? (
                      <>
                        <img src={image} alt="Pré-visualização" className="h-full w-full object-cover" />
                        <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                          Trocar
                        </span>
                      </>
                    ) : (
                      <span className="flex flex-col items-center gap-1.5 text-white/35">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path
                            d="M3 16.5V7.5A2.5 2.5 0 0 1 5.5 5h13A2.5 2.5 0 0 1 21 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16.5Zm0 0 5.2-5.2a2 2 0 0 1 2.8 0L16 16.5m-2-3 1.7-1.7a2 2 0 0 1 2.8 0L21 14.2M15.5 9h.01"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <span className="text-xs">enviar foto</span>
                      </span>
                    )}
                  </button>
                  {image && (
                    <button
                      onClick={() => setImage(null)}
                      className="mt-1.5 w-full text-xs text-white/35 transition-colors hover:text-red-300"
                    >
                      remover
                    </button>
                  )}
                  {imageError && <p className="mt-1.5 text-xs text-red-300">{imageError}</p>}
                </div>

                <div className="space-y-4">
                  <div>
                    <label className={LABEL_CLASS} htmlFor="donation-title">
                      Título
                    </label>
                    <input
                      id="donation-title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Nome que aparece no edifício"
                      className={FIELD_CLASS}
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className={LABEL_CLASS} htmlFor="donation-link">
                      Link
                    </label>
                    <input
                      id="donation-link"
                      value={link}
                      onChange={(e) => setLink(e.target.value)}
                      placeholder="seusite.com"
                      className={FIELD_CLASS}
                    />
                  </div>
                </div>
              </div>

              {/* Descrição */}
              <div>
                <label className={LABEL_CLASS} htmlFor="donation-description">
                  Descrição
                </label>
                <textarea
                  id="donation-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Uma frase sobre você ou sobre a causa"
                  className={`${FIELD_CLASS} resize-none`}
                />
              </div>
            </div>

            {/* Rodapé */}
            <div className="flex items-center justify-between gap-4 border-t border-white/10 bg-white/[0.02] px-6 py-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-white/35">Total</p>
                <p className="text-xl font-semibold tabular-nums text-white">{formatBRL(amount)}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-white/55 transition-colors hover:border-white/25 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={!canConfirm}
                  className="rounded-lg bg-[#c9a86a] px-5 py-2.5 text-sm font-medium text-[#14161c] transition-colors hover:bg-[#e4c98b] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/30"
                  title={canConfirm ? "Confirmar doação" : "Preencha o título"}
                >
                  Confirmar doação
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
