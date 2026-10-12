/**
 * Costura do pagamento Pix e do perfil do edifício (nome, descrição, imagem).
 *
 * Backend é a autoridade: valida, cria a cobrança e grava o edifício quando o
 * pagamento confirma. Sem PSP, o back só gera Pix com PIX_SIMULATED (dev).
 */
import { http } from "./http";

/** Toda contribuição escolhe ONG; aumentar mantém a cidade do edifício. `value` em reais (2 casas). */
export type Contribution =
  | { donationId: null; ongId: number; cityId: number; value: number }
  | { donationId: number; ongId: number; value: number };

/** Cobrança pendente. Status vem à parte: a consulta não reenvia o QR a cada 3 s. */
export type PixCharge = {
  id: string;
  /** Eco do pedido: resumo, erguer × aumentar, retomada após recarregar. */
  contribution: Contribution;
  /** Pix Copia e Cola (BR Code). */
  copyPaste: string;
  /** Data URL; nunca URL externa. */
  qrCodeImage: string;
  /** ISO 8601. A tela mostra só HH:MM. */
  expiresAt: string;
  /** Nome que o app do banco mostra como recebedor. */
  receiverName: string;
};

export type ChargeStatus =
  | { status: "pending" }
  /** Edifício novo ou o aumentado. */
  | { status: "paid"; donationId: number }
  /** Vencida ou cancelada: não aceita mais pagamento. */
  | { status: "expired" };

export type BuildingProfile = {
  /** ≤ 40, trim. */
  name: string | null;
  /** ≤ 160, trim. */
  description: string | null;
  /** Data URL JPEG de `resizeImage(file, 800)`. */
  image: string | null;
};

/** Exige sessão; cancela a pendente anterior do usuário; 400/503 vêm com `message`. */
export async function createPixCharge(contribution: Contribution): Promise<PixCharge> {
  const { data } = await http.post<PixCharge>("/donation/charges", contribution);
  return data;
}

/** Só o dono da cobrança. Pago = edifício já gravado no banco. */
export async function getChargeStatus(chargeId: string, signal?: AbortSignal): Promise<ChargeStatus> {
  const { data } = await http.get<ChargeStatus>(`/donation/charges/${chargeId}`, { signal });
  return data;
}

/** Uma pendente por usuário; null = nenhuma. */
export async function getPendingCharge(signal?: AbortSignal): Promise<PixCharge | null> {
  const { data } = await http.get<{ data: PixCharge | null }>("/donation/charges/pending", { signal });
  return data.data;
}

/** Público; null = edifício sem perfil. */
export async function fetchBuildingProfile(
  donationId: number,
  signal?: AbortSignal,
): Promise<BuildingProfile | null> {
  const { data } = await http.get<{ data: BuildingProfile | null }>(`/donation/${donationId}/profile`, { signal });
  return data.data;
}

/** Dono ou admin; substitui o perfil inteiro. */
export async function saveBuildingProfile(donationId: number, profile: BuildingProfile): Promise<void> {
  await http.put(`/donation/${donationId}/profile`, profile);
}
