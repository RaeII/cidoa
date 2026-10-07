/**
 * Costura do pagamento Pix e do perfil do edifício (nome, descrição, imagem).
 *
 * ponytail: mock em memória; o backend troca o corpo, a assinatura fica.
 * Backend valida as regras antes do Pix simulado. Pagamento real deve ser
 * confirmado pelo webhook do PSP. Recarregar a página zera o mock.
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

const MOCK_PAY_AFTER_MS = 6_000;
const MOCK_EXPIRES_IN_MS = 60 * 60_000;
/** Valor que nunca é pago e expira em 15 s: testa a tela de expirado. */
const MOCK_NEVER_PAID_VALUE = 13;
const MOCK_NEVER_PAID_EXPIRES_IN_MS = 15_000;

const QR_PLACEHOLDER = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#fff"/><path d="M8 8h26v26H8zM66 8h26v26H66zM8 66h26v26H8z" fill="none" stroke="#04283d" stroke-width="6"/><text x="50" y="56" font-family="sans-serif" font-size="13" font-weight="700" text-anchor="middle" fill="#04283d">TESTE</text></svg>',
)}`;

type MockCharge = PixCharge & { createdAt: number; donationId: number };

const charges = new Map<string, MockCharge>();
const profiles = new Map<number, BuildingProfile>();
let pendingCharge: MockCharge | null = null;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Exige sessão; cancela a pendente anterior do usuário; 400 vem com `message`. */
export async function createPixCharge(contribution: Contribution): Promise<PixCharge> {
  // ponytail: id negativo só existe no mock local; remover o desvio ao integrar o PSP.
  if (contribution.donationId === null || contribution.donationId > 0) {
    await http.post("/donation/contributions/validate", contribution);
  }
  await wait(600);
  const now = Date.now();
  const neverPaid = contribution.value === MOCK_NEVER_PAID_VALUE;
  const id = crypto.randomUUID();
  const charge: MockCharge = {
    id,
    contribution,
    copyPaste: `000201-PIX-TESTE-CIDOA-${contribution.value.toFixed(2)}-${id.slice(0, 8)}`,
    qrCodeImage: QR_PLACEHOLDER,
    expiresAt: new Date(now + (neverPaid ? MOCK_NEVER_PAID_EXPIRES_IN_MS : MOCK_EXPIRES_IN_MS)).toISOString(),
    receiverName: "Cidoa",
    createdAt: now,
    // Id negativo = edifício local do mock (some ao recarregar).
    donationId: contribution.donationId ?? -now,
  };
  charges.set(charge.id, charge);
  pendingCharge = charge;
  return charge;
}

/** Só o dono da cobrança. */
export async function getChargeStatus(chargeId: string, signal?: AbortSignal): Promise<ChargeStatus> {
  await wait(200);
  signal?.throwIfAborted();
  const charge = charges.get(chargeId);
  const now = Date.now();
  let status: ChargeStatus = { status: "pending" };
  if (!charge || now >= Date.parse(charge.expiresAt)) {
    status = { status: "expired" };
  } else if (charge.contribution.value !== MOCK_NEVER_PAID_VALUE && now - charge.createdAt >= MOCK_PAY_AFTER_MS) {
    status = { status: "paid", donationId: charge.donationId };
  }
  if (status.status !== "pending" && pendingCharge?.id === chargeId) pendingCharge = null;
  return status;
}

/** Uma pendente por usuário; null = nenhuma. */
export async function getPendingCharge(signal?: AbortSignal): Promise<PixCharge | null> {
  await wait(200);
  signal?.throwIfAborted();
  return pendingCharge;
}

/** Público; null = edifício sem perfil. */
export async function fetchBuildingProfile(
  donationId: number,
  signal?: AbortSignal,
): Promise<BuildingProfile | null> {
  await wait(300);
  signal?.throwIfAborted();
  return profiles.get(donationId) ?? null;
}

/** Dono ou admin; substitui o perfil inteiro. */
export async function saveBuildingProfile(donationId: number, profile: BuildingProfile): Promise<void> {
  await wait(400);
  profiles.set(donationId, profile);
}
