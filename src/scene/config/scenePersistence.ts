import type {
  BlockLayoutSettings,
  BuildingCustomization,
  BuildingSettings,
  EnvironmentSettings,
  GroundSettings,
  HorizonSettings,
  LightSettings,
  RenderDirectionSettings,
  ShadowSettings,
  TerrainSettings,
  TextureSettings,
} from "../types";
import { createDefaultBlockLayoutSettings } from "./blockLayoutConfig";
import { createDefaultBuildingSettings } from "./buildingConfig";
import { createDefaultEnvironmentSettings } from "./environmentConfig";
import { createDefaultGroundSettings } from "./groundConfig";
import { createDefaultHorizonSettings } from "./horizonConfig";
import { createDefaultLightSettings } from "./lightConfig";
import { createDefaultRenderDirectionSettings } from "./renderDirectionConfig";
import { createDefaultShadowSettings } from "./shadowConfig";
import { createDefaultTerrainSettings } from "./terrainConfig";
import { createDefaultTextureSettings } from "./textureConfig";

const STORAGE_KEY = "cidoa:scene";

export type PersistedSceneSettings = {
  building: BuildingSettings;
  texture: TextureSettings;
  ground: GroundSettings;
  terrain: TerrainSettings;
  light: LightSettings;
  shadow: ShadowSettings;
  renderDirection: RenderDirectionSettings;
  environment: EnvironmentSettings;
  horizon: HorizonSettings;
  blockLayout: BlockLayoutSettings;
};

/**
 * Estado da cena persistido em localStorage.
 *
 * `customizations` é alinhado por índice com `donations` (não por id de runtime):
 * o donation manager reatribui ids sequenciais a cada carga, e edifícios não
 * persistidos (simulação de pagamento) consomem ids no meio do caminho. Índice é
 * a única chave estável entre sessões. `null` = edifício sem personalização.
 */
export type PersistedScene = {
  donations: number[];
  customizations: Array<BuildingCustomization | null>;
  settings: PersistedSceneSettings;
};

export function createDefaultPersistedSettings(): PersistedSceneSettings {
  return {
    building: createDefaultBuildingSettings(),
    texture: createDefaultTextureSettings(),
    ground: createDefaultGroundSettings(),
    terrain: createDefaultTerrainSettings(),
    light: createDefaultLightSettings(),
    shadow: createDefaultShadowSettings(),
    renderDirection: createDefaultRenderDirectionSettings(),
    environment: createDefaultEnvironmentSettings(),
    horizon: createDefaultHorizonSettings(),
    blockLayout: createDefaultBlockLayoutSettings(),
  };
}

// Mescla recursiva sobre os defaults: campos novos entram com o default,
// campos removidos do tipo são descartados. Evita quebrar em versões antigas
// do storage sem validar cada propriedade à mão.
function mergeDefaults<T>(defaults: T, saved: unknown): T {
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return defaults;
  const out = { ...(defaults as Record<string, unknown>) };
  for (const [key, value] of Object.entries(saved as Record<string, unknown>)) {
    if (!(key in out)) continue;
    const fallback = out[key];
    out[key] =
      fallback && typeof fallback === "object" && !Array.isArray(fallback)
        ? mergeDefaults(fallback, value)
        : value;
  }
  return out as T;
}

/** `null` = nada salvo ainda (ou storage ilegível). */
export function loadPersistedScene(): PersistedScene | null {
  if (typeof window === "undefined") return null;
  let parsed: Partial<PersistedScene>;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    parsed = JSON.parse(raw) as Partial<PersistedScene>;
  } catch {
    return null;
  }

  const donations = Array.isArray(parsed.donations)
    ? parsed.donations.filter((v): v is number => typeof v === "number" && isFinite(v) && v > 0)
    : [];
  const savedCustomizations = Array.isArray(parsed.customizations) ? parsed.customizations : [];

  return {
    donations,
    customizations: donations.map((_, index) => savedCustomizations[index] ?? null),
    settings: mergeDefaults(createDefaultPersistedSettings(), parsed.settings),
  };
}

export function savePersistedScene(scene: PersistedScene): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(scene));
  } catch {
    // Provável estouro de cota: hologramas são data URLs e sozinhos passam do
    // limite. Salva de novo sem eles em vez de perder toda a persistência.
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          ...scene,
          customizations: scene.customizations.map((c) =>
            c ? { ...c, hologramImage: null } : null,
          ),
        }),
      );
    } catch {
      // Storage cheio/bloqueado — desiste, cena não persiste.
    }
  }
}

export function clearPersistedScene(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage bloqueado — nada a fazer.
  }
}
