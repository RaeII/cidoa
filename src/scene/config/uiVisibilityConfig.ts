import type { UIVisibilitySettings } from "../types";

const STORAGE_KEY = "cidoa:ui-visibility";

export function createDefaultUIVisibilitySettings(): UIVisibilitySettings {
  return {
    cameraLog: true,
    donationInput: true,
    bulkInput: true,
    blockLayoutInput: true,
    donationFilter: true,
    buildingLayoutCard: true,
  };
}

// Carrega do localStorage, mesclado com defaults. Campos novos/ausentes caem no default.
export function loadUIVisibilitySettings(): UIVisibilitySettings {
  const defaults = createDefaultUIVisibilitySettings();
  if (typeof window === "undefined") return defaults;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<UIVisibilitySettings>;
    const merged = { ...defaults };
    for (const key of Object.keys(defaults) as (keyof UIVisibilitySettings)[]) {
      if (typeof parsed[key] === "boolean") merged[key] = parsed[key];
    }
    return merged;
  } catch {
    return defaults;
  }
}

export function saveUIVisibilitySettings(settings: UIVisibilitySettings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // localStorage cheio/bloqueado — ignora, preferência não persiste
  }
}
