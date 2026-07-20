import { http } from "../http";
import type { UpdateOwnProfileInput, User } from "./user.types";

export async function updateOwnProfile(input: UpdateOwnProfileInput) {
  const { data } = await http.put<{ data: User }>("/user/me", input);
  return data.data;
}
