import { http } from "../http";
import type {
  ApplyReferralResult,
  ReferrerPreview,
  ReferralSummary,
} from "./referral.types";

export async function getReferralPreview(code: string, signal?: AbortSignal) {
  const { data } = await http.get<{ data: ReferrerPreview }>(
    `/referral/preview/${encodeURIComponent(code)}`,
    { signal },
  );
  return data.data;
}

export async function getMyReferralSummary() {
  const { data } = await http.get<{ data: ReferralSummary }>("/referral/me");
  return data.data;
}

export async function applyMyReferral(code: string) {
  const { data } = await http.post<{ data: ApplyReferralResult }>("/referral/me", { code });
  return data.data;
}
