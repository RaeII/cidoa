import { useRef, useState } from "react";
import { PARTNER_NGOS } from "./DonationInfoSection";
import { BUILDING_OWNER } from "./BuildingInfoModal";
import type { DonationInfo } from "../../scene/types";
import { readImageDownscaled } from "../../scene/utils/image";

const IMAGE_MAX_BYTES = 8 * 1024 * 1024; // 8 MB — mesmo teto do formulário de doação

const FIELD_CLASS =
  "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-white/30 focus:border-white/20";

const LABEL_CLASS = "mb-1.5 block text-sm text-white/75";

/**
 * Edifício sem doação preenchida cai no dono padrão — os mesmos dados que o
 * [[BuildingInfoModal]] mostra. Editar parte de um form já preenchido, não vazio.
 */
const infoOrDefault = (info?: DonationInfo): DonationInfo =>
  info ?? {
    title: BUILDING_OWNER.name,
    description: "",
    link: BUILDING_OWNER.url,
    image: BUILDING_OWNER.image,
    ngo: PARTNER_NGOS[0].name,
  };

type BuildingInfoFormProps = {
  donationId: number;
  info?: DonationInfo;
  onInfoChange: (donationId: number, info: DonationInfo) => void;
};

/**
 * Aba "Informações" do painel de personalização: edita o conteúdo que aparece no
 * modal do edifício (imagem, título, link, ONG, descrição). Cada campo aplica na
 * hora — igual ao resto do painel, sem botão de salvar.
 */
export function BuildingInfoForm({ donationId, info, onInfoChange }: BuildingInfoFormProps) {
  const [draft, setDraft] = useState<DonationInfo>(() => infoOrDefault(info));
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const patch = (changes: Partial<DonationInfo>) => {
    const next = { ...draft, ...changes };
    setDraft(next);
    onInfoChange(donationId, next);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // permite reenviar o mesmo arquivo
    if (!file) return;
    if (file.size > IMAGE_MAX_BYTES) {
      setImageError("Imagem muito grande (máx. 8 MB).");
      return;
    }
    try {
      patch({ image: await readImageDownscaled(file) });
      setImageError(null);
    } catch {
      setImageError("Não foi possível ler essa imagem.");
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-white/50">
        É isso que aparece no modal ao clicar neste edifício.
      </p>

      <div>
        <span className={LABEL_CLASS}>Imagem</span>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleFileChange}
          className="hidden"
        />
        {draft.image ? (
          <div className="space-y-2">
            <div className="overflow-hidden rounded-lg border border-white/10 bg-black/40">
              <img src={draft.image} alt="Pré-visualização" className="h-24 w-full object-cover" />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 transition-colors hover:border-white/20 hover:text-white"
              >
                Trocar
              </button>
              <button
                onClick={() => patch({ image: null })}
                className="flex-1 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200 transition-colors hover:bg-red-500/20"
              >
                Remover
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full rounded-lg border border-dashed border-white/15 bg-white/5 px-3 py-3 text-xs text-white/60 transition-colors hover:border-white/30 hover:text-white"
          >
            Enviar imagem
          </button>
        )}
        {imageError && <p className="mt-2 text-xs text-red-300">{imageError}</p>}
      </div>

      <label className="block">
        <span className={LABEL_CLASS}>Título</span>
        <input
          type="text"
          value={draft.title}
          onChange={(e) => patch({ title: e.target.value })}
          placeholder="Nome que aparece no modal"
          className={FIELD_CLASS}
        />
      </label>

      <label className="block">
        <span className={LABEL_CLASS}>Link</span>
        <input
          type="text"
          value={draft.link}
          onChange={(e) => patch({ link: e.target.value })}
          placeholder="seusite.com"
          className={FIELD_CLASS}
        />
      </label>

      <label className="block">
        <span className={LABEL_CLASS}>ONG beneficiada</span>
        <select
          value={draft.ngo}
          onChange={(e) => patch({ ngo: e.target.value })}
          className={`${FIELD_CLASS} appearance-none`}
        >
          {PARTNER_NGOS.map((partner) => (
            <option key={partner.name} value={partner.name} className="bg-[#0b0d12]">
              {partner.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className={LABEL_CLASS}>Descrição</span>
        <textarea
          value={draft.description}
          onChange={(e) => patch({ description: e.target.value })}
          rows={3}
          placeholder="Uma frase sobre você ou sobre a causa"
          className={`${FIELD_CLASS} resize-none`}
        />
      </label>
    </div>
  );
}
