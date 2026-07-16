import { http } from "../http";
import type {
  CreateTestBuildingsResult,
  DashboardStats,
  DeleteAllBuildingsResult,
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
