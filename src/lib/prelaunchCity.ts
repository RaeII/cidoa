import type { Contribution, BuildingProfile } from "../api/contributionApi";
import type { City, DonationRecord } from "../api/donationApi";
import type { BuildingCustomization } from "../scene/types";

export type LocalBuilding = DonationRecord & { city: City };
export const LOCAL_CITY_EVENT = "cidoa:prelaunch-city";

export function localCityKey(userId: number | null, area: string): string {
  return `cidoa:prelaunch:v1:${userId ?? "guest"}:${area}`;
}

export function readLocalValue<T>(userId: number | null, area: string, fallback: T): T {
  const raw = window.localStorage.getItem(localCityKey(userId, area));
  if (raw === null) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (fallback !== null && (parsed === null || typeof parsed !== typeof fallback || Array.isArray(parsed) !== Array.isArray(fallback))) {
      throw new Error();
    }
    if (area === "buildings" && !isValidLocalBuildings(parsed)) throw new Error();
    return parsed as T;
  } catch {
    throw new Error("Dados locais inválidos. Não foi possível carregar sua cidade.");
  }
}

export function writeLocalValue<T>(userId: number | null, area: string, value: T): void {
  const key = localCityKey(userId, area);
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    throw new Error("Não foi possível salvar neste navegador. Verifique o espaço e a permissão de armazenamento.");
  }
  window.dispatchEvent(new CustomEvent(LOCAL_CITY_EVENT, { detail: key }));
}

function isValidLocalBuildings(value: unknown): value is LocalBuilding[] {
  return Array.isArray(value) && value.every((building: LocalBuilding) => building && Number.isSafeInteger(building.id) && building.id < 0
    && Number.isFinite(building.value) && building.value > 0 && Number.isSafeInteger(building.cityId)
    && Number.isSafeInteger(building.ongId) && Array.isArray(building.ongIds)
    && building.ongIds.every(Number.isSafeInteger) && building.city?.id === building.cityId
    && typeof building.city.name === "string" && typeof building.city.uf === "string");
}

export function readLocalBuildings(userId: number): LocalBuilding[] {
  return readLocalValue<LocalBuilding[]>(userId, "buildings", []);
}

/** Pré-lançamento: nenhum pagamento ou edifício é enviado ao backend. */
export function simulateContribution(userId: number, contribution: Contribution, city?: City | null): number {
  if (!Number.isSafeInteger(userId) || userId <= 0) throw new Error("Entre na sua conta para simular.");
  const cents = Math.round(contribution.value * 100);
  if (!Number.isSafeInteger(cents) || cents < 500 || !Number.isSafeInteger(contribution.ongId) || contribution.ongId <= 0) {
    throw new Error("Escolha uma ONG e um valor a partir de R$ 5.");
  }
  const buildings = readLocalBuildings(userId);
  let donationId: number;
  if (contribution.donationId === null) {
    if (buildings.length >= 3) throw new Error("Limite de 3 edifícios por conta neste navegador.");
    if (!city || city.id !== contribution.cityId || !Number.isSafeInteger(city.id) || city.id <= 0) {
      throw new Error("Escolha uma cidade.");
    }
    // IDs negativos não colidem com os registros públicos do banco.
    donationId = Math.min(0, ...buildings.map((building) => building.id)) - 1;
    buildings.push({ id: donationId, value: cents / 100, cityId: city.id, city,
      ongId: contribution.ongId, ongIds: [contribution.ongId] });
  } else {
    const building = buildings.find((item) => item.id === contribution.donationId);
    if (!building) throw new Error("Este edifício não pertence à sua simulação.");
    const total = Math.round(building.value * 100) + cents;
    if (!Number.isSafeInteger(total)) throw new Error("Valor acima do limite da simulação.");
    building.value = total / 100;
    building.ongIds = [...new Set([...building.ongIds, contribution.ongId])];
    donationId = building.id;
  }
  writeLocalValue(userId, "buildings", buildings);
  return donationId;
}

export function saveLocalCustomization(userId: number, donationId: number, customization: BuildingCustomization): void {
  const saved = readLocalValue<Record<string, BuildingCustomization>>(userId, "customizations", {});
  writeLocalValue(userId, "customizations", { ...saved, [donationId]: customization });
}

export function saveLocalProfile(userId: number, donationId: number, profile: BuildingProfile): void {
  const saved = readLocalValue<Record<string, BuildingProfile>>(userId, "profiles", {});
  writeLocalValue(userId, "profiles", { ...saved, [donationId]: profile });
}
