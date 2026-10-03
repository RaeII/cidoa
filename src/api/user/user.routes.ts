import { http } from "../http";
import type { ProfileDetailsInput, UpdateOwnProfileInput, User } from "./user.types";

export async function getOwnSession() {
  const { data } = await http.get<{ data: User; expiresIn: number }>("/user/me");
  return data;
}

export async function updateOwnProfile(input: UpdateOwnProfileInput) {
  const { data } = await http.put<{ data: User }>("/user/me", input);
  return data.data;
}

/** Salvar ou pular (`{}`) o onboarding do primeiro login. Idempotente. */
export async function completeOnboarding(input: ProfileDetailsInput) {
  const { data } = await http.post<{ data: User }>("/user/me/onboarding", input);
  return data.data;
}
