import { http } from "../http";
import type {
  CreateTestBuildingsResult,
  DashboardStats,
  DeleteAllBuildingsResult,
  IbgeCounts,
  IbgeStatus,
} from "./admin.types";

// Rotas /admin do backend — todas exigem JWT + admin (cookie httpOnly).

export async function getDashboardStats() {
  const { data } = await http.get<{ data: DashboardStats }>("/admin/dashboard/stats");
  return data.data;
}

/** Cria N edifícios (doações) de teste. Acumulativo — soma ao banco. */
export async function createTestBuildings(count: number) {
  const { data } = await http.post<{ data: CreateTestBuildingsResult }>(
    "/admin/test-buildings",
    { count },
  );
  return data.data;
}

/** Exclui TODAS as doações. Destrutivo — exige senha do .env do backend. */
export async function deleteAllBuildings(password: string) {
  const { data } = await http.delete<{ data: DeleteAllBuildingsResult }>(
    "/admin/test-buildings",
    { data: { confirm: true, password } },
  );
  return data.data;
}

/** Diz se o catálogo IBGE (regiões/estados/municípios) já foi vinculado + contagens. */
export async function getIbgeStatus() {
  const { data } = await http.get<{ data: IbgeStatus }>("/admin/ibge/status");
  return data.data;
}

/** Sincroniza regiões/estados/municípios do IBGE no banco (upsert idempotente). */
export async function syncIbge() {
  const { data } = await http.post<{ data: IbgeCounts }>("/admin/ibge/sync");
  return data.data;
}
