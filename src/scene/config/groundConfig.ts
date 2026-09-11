import type { GroundSettings } from "../types";

export const DEFAULT_GROUND_SETTINGS: GroundSettings = {
  color: "#292929",
  roughness: 1,
  metalness: 0.01,
  materialType: "standard",
};

export function createDefaultGroundSettings(): GroundSettings {
  return { ...DEFAULT_GROUND_SETTINGS };
}
