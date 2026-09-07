import type { UnlockRule } from "./unlock";
import type { PreviewSubject } from "@/scene/builders/createPreviewScene";

export const PREVIEW_KIND: Record<string, PreviewSubject["kind"]> = {
  shape: "shape",
  rooftop: "rooftop",
  edge_light: "edgeLight",
};

/** Dados visuais apenas; sem sessão, API ou permissões do admin. */
export type PassReward = {
  key: string;
  label: string;
  categoryKey: string;
  categoryLabel: string;
  optionKey?: string;
  value?: string | null;
  unlock: UnlockRule;
  isActive?: boolean;
};

/** Grátis → menor doação → menos indicações. Empates mantêm a ordem do catálogo. */
export function sortPassRewards<T extends PassReward>(rewards: readonly T[]): T[] {
  return [...rewards].sort((a, b) =>
    Number(a.unlock !== null) - Number(b.unlock !== null) ||
    (a.unlock?.donationMin ?? 0) - (b.unlock?.donationMin ?? 0) ||
    (a.unlock?.referralMin ?? 0) - (b.unlock?.referralMin ?? 0),
  );
}
