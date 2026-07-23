import { http } from "../http";
import type {
  CreateOptionInput,
  CreateTestBuildingsResult,
  CustomizationTree,
  DashboardStats,
  DeleteAllBuildingsResult,
  IbgeCounts,
  IbgeStatus,
  UpdateCategoryInput,
  UpdateOptionInput,
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

// ─── Personalizações (catálogo) ─────────────────────────────────

/** Árvore completa de personalizações (inclui inativas) para gestão. */
export async function getCustomizationTree() {
  const { data } = await http.get<{ data: CustomizationTree }>("/admin/customization");
  return data.data;
}

/** Cria opção — só em categoria extensível (Cor/Textura). */
export async function createCustomizationOption(input: CreateOptionInput) {
  const { data } = await http.post<{ data: { id: number } }>(
    "/admin/customization/options",
    input,
  );
  return data.data;
}

/** Atualiza opção (label/value/sort/ativo). A key nunca muda. */
export async function updateCustomizationOption(id: number, input: UpdateOptionInput) {
  await http.put(`/admin/customization/options/${id}`, input);
}

/** Exclui opção. Opções presas a código não podem ser excluídas — desative-as. */
export async function deleteCustomizationOption(id: number) {
  await http.delete(`/admin/customization/options/${id}`);
}

/** Atualiza categoria — liga/desliga (isActive), renomeia ou reordena. */
export async function updateCustomizationCategory(id: number, input: UpdateCategoryInput) {
  await http.put(`/admin/customization/categories/${id}`, input);
}
