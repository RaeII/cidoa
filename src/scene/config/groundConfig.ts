import { CITY_SCENE_CONFIG } from "./citySceneConfig";
import type { GroundSettings } from "../types";

export const DEFAULT_GROUND_SETTINGS: GroundSettings = {
  color: "#292929",
  size: CITY_SCENE_CONFIG.groundSize,
  roughness: 1,
  metalness: 0.01,
  materialType: "standard",
};

export function createDefaultGroundSettings(): GroundSettings {
  return { ...DEFAULT_GROUND_SETTINGS };
}
