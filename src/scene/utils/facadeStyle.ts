import type { FacadeStyle } from "../types";
import { seeded } from "./random";

// Estilos sorteáveis na geração de edifícios — todos os conjuntos PBR disponíveis.
// Cada estilo em uso carrega ~5 mapas 1K sob demanda (ver getFacadeTextures), então
// o pool define quanto a cena baixa na primeira geração em lote.
// ponytail: pool = todos os estilos; se o carregamento inicial pesar, corte os conjuntos maiores.
export const FACADE_STYLE_POOL: readonly FacadeStyle[] = [
  "default",
  "facade001",
  "facade002",
  "facade005",
  "facade007",
  "facade014",
  "facade016",
  "facade018a",
  "facade019a",
  "facade020a",
];

// Fachada sorteada por edifício, determinística pelo id da doação. Sem estado: o
// mesmo id devolve sempre o mesmo estilo, então recarregar a cena reproduz a cidade
// e nada extra entra no localStorage. Mesma rota do jitter de escala (seeded(id, ...)).
export function randomFacadeStyle(donationId: number): FacadeStyle {
  const index = Math.floor(seeded(donationId, 3) * FACADE_STYLE_POOL.length);
  return FACADE_STYLE_POOL[Math.min(index, FACADE_STYLE_POOL.length - 1)];
}
