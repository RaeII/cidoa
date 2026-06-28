import type { BlockLayoutSettings } from "../types";

export function createDefaultBlockLayoutSettings(): BlockLayoutSettings {
  return {
    blockSize: 8,
    streetWidth: 6.0,
    towerRatio: 0.12,
    towersPerBlock: 8,
    baseHeightCap: 0.70,
    lotColor: "#383838",
  };
}
