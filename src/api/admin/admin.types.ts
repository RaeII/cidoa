/** Métricas agregadas de GET /admin/dashboard/stats (rota JWT + admin). */
export interface DashboardStats {
  donations: {
    count: number;
    total_value: number;
    avg_value: number;
    max_value: number;
  };
  cities: number;
  ongs: number;
  users: number;
}

/** Resposta de POST /admin/test-buildings (cria N edifícios de teste, acumulativo). */
export interface CreateTestBuildingsResult {
  inserted: number;
  total_active: number;
}

/** Resposta de DELETE /admin/test-buildings (exclui TODAS as doações). */
export interface DeleteAllBuildingsResult {
  deleted: number;
}

/** Contagens do catálogo IBGE (regiões/estados/municípios). Base de sync e status. */
export interface IbgeCounts {
  regions: number;
  states: number;
  cities: number;
}

/** Resposta de GET /admin/ibge/status — `linked` diz se o catálogo já foi carregado. */
export interface IbgeStatus extends IbgeCounts {
  linked: boolean;
}
