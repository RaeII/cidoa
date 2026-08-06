import type {
  BlockLayoutSettings,
  BuildingCustomization,
  BuildingSettings,
  DonationInfo,
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
// Estados nomeados ("saves") da cidade. Chave separada da cena ativa: abrir um
// estado só copia ele para STORAGE_KEY e recarrega a página.
const SLOTS_KEY = "cidoa:scene-slots";
// Nome do estado que a cena ativa veio de (ou foi salva como). Só rótulo para a
// UI saber qual opção mostrar como selecionada.
const ACTIVE_SLOT_KEY = "cidoa:scene-active";

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
 * `customizations` e `infos` são alinhados por índice com `donations` (não por id
 * de runtime): o donation manager reatribui ids sequenciais a cada carga, então
 * índice é a única chave estável entre sessões. `null` = edifício sem
 * personalização / sem dados de doação.
 */
export type PersistedScene = {
  donations: number[];
  customizations: Array<BuildingCustomization | null>;
  infos: Array<DonationInfo | null>;
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
  const savedInfos = Array.isArray(parsed.infos) ? parsed.infos : [];

  return {
    donations,
    customizations: donations.map((_, index) => savedCustomizations[index] ?? null),
    infos: donations.map((_, index) => savedInfos[index] ?? null),
    settings: mergeDefaults(createDefaultPersistedSettings(), parsed.settings),
  };
}

// Hologramas são data URLs e sozinhos estouram a cota do localStorage. Sem eles
// o resto da cena ainda cabe — melhor que perder a persistência inteira.
const withoutHolograms = (scene: PersistedScene): PersistedScene => ({
  ...scene,
  customizations: scene.customizations.map((c) => (c ? { ...c, hologramImage: null } : null)),
});

// Último recurso: fotos das doações também são data URLs. Perder a foto ainda
// salva valores, personalizações e textos.
const withoutImages = (scene: PersistedScene): PersistedScene => ({
  ...withoutHolograms(scene),
  // `?? []`: estado nomeado salvo antes de `infos` existir chega aqui sem o campo.
  infos: (scene.infos ?? []).map((i) => (i ? { ...i, image: null } : null)),
});

function writeKey(key: string, value: unknown): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function savePersistedScene(scene: PersistedScene): void {
  if (writeKey(STORAGE_KEY, scene)) return;
  if (writeKey(STORAGE_KEY, withoutHolograms(scene))) return;
  writeKey(STORAGE_KEY, withoutImages(scene));
}

function removeKey(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Storage bloqueado — nada a fazer.
  }
}

export function clearPersistedScene(): void {
  removeKey(STORAGE_KEY);
  removeKey(ACTIVE_SLOT_KEY);
}

/** `null` = cena atual não veio de nenhum estado salvo. */
export function getActiveSceneSlot(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ACTIVE_SLOT_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return typeof parsed === "string" ? parsed : null;
  } catch {
    return null;
  }
}

function readSlots(): Record<string, PersistedScene> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SLOTS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/** Nomes dos estados salvos, em ordem alfabética. */
export function listSceneSlots(): string[] {
  return Object.keys(readSlots()).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/** `false` = storage cheio/bloqueado, estado não salvou. */
export function saveSceneSlot(name: string, scene: PersistedScene): boolean {
  const slots = readSlots();
  slots[name] = scene;
  let ok = writeKey(SLOTS_KEY, slots);
  if (!ok) {
    slots[name] = withoutHolograms(scene);
    ok = writeKey(SLOTS_KEY, slots);
  }
  if (!ok) {
    slots[name] = withoutImages(scene);
    ok = writeKey(SLOTS_KEY, slots);
  }
  if (ok) writeKey(ACTIVE_SLOT_KEY, name);
  return ok;
}

export function deleteSceneSlot(name: string): void {
  const slots = readSlots();
  delete slots[name];
  writeKey(SLOTS_KEY, slots);
  if (getActiveSceneSlot() === name) removeKey(ACTIVE_SLOT_KEY);
}

/**
 * Copia o estado nomeado para a cena ativa. Chamador recarrega a página — o
 * runtime é reconstruído a partir do localStorage no mount.
 * `false` = estado inexistente.
 */
export function applySceneSlot(name: string): boolean {
  const scene = readSlots()[name];
  if (!scene) return false;
  savePersistedScene(scene);
  writeKey(ACTIVE_SLOT_KEY, name);
  return true;
}
