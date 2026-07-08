import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  fetchDonationSnapshot,
  type City,
  type DonationDataset,
  type DonationRecord,
  type Ong,
} from "../../api/donationApi";
import { UF_REGION, type Region } from "../../api/regions";

export type DonationFilter = {
  region?: Region;
  uf?: string;
  cityId?: number;
  ongId?: number;
};

export type DonationsLoadState =
  | { status: "loading"; loadedBytes: number; totalBytes: number | null }
  | { status: "ready"; count: number }
  | { status: "error"; message: string };

const EMPTY_CITIES: City[] = [];
const EMPTY_ONGS: Ong[] = [];

/**
 * Carrega o snapshot de doações do backend e aplica o filtro client-side.
 *
 * O dataset completo já é público (id, valor, cidade, ONG — sem dado de doador),
 * então filtrar no front não delega nenhuma decisão de segurança ao cliente:
 * é só escolher o que renderizar. Filtrar 100k registros custa ~5ms.
 */
export function useDonations() {
  const [loadState, setLoadState] = useState<DonationsLoadState>({
    status: "loading",
    loadedBytes: 0,
    totalBytes: null,
  });
  const [dataset, setDataset] = useState<DonationDataset | null>(null);
  const [filter, setFilter] = useState<DonationFilter>({});
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    fetchDonationSnapshot({
      signal: controller.signal,
      onProgress: ({ loadedBytes, totalBytes }) =>
        setLoadState({ status: "loading", loadedBytes, totalBytes }),
    })
      .then((data) => {
        setDataset(data);
        setLoadState({ status: "ready", count: data.donations.length });
      })
      .catch((err: unknown) => {
        // Abort do StrictMode/unmount não é erro
        if (controller.signal.aborted || axios.isCancel(err)) return;
        setLoadState({
          status: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      });

    return () => controller.abort();
  }, [reloadKey]);

  const retry = useCallback(() => {
    // Reset síncrono aqui (não no effect) → volta ao spinner na hora do clique
    setLoadState({ status: "loading", loadedBytes: 0, totalBytes: null });
    setReloadKey((key) => key + 1);
  }, []);

  const cityById = useMemo(() => {
    const map = new Map<number, City>();
    dataset?.cities.forEach((city) => map.set(city.id, city));
    return map;
  }, [dataset]);

  // Filtro AND: ONG combina com qualquer nível de local; local usa o mais
  // específico presente (cidade > UF > região). Região deriva da UF (UF_REGION).
  const donations = useMemo<DonationRecord[]>(() => {
    if (!dataset) return [];
    const { region, uf, cityId, ongId } = filter;
    if (region === undefined && uf === undefined && cityId === undefined && ongId === undefined) {
      return dataset.donations;
    }
    return dataset.donations.filter((donation) => {
      if (ongId !== undefined && donation.ongId !== ongId) return false;
      if (cityId !== undefined) return donation.cityId === cityId;
      if (uf !== undefined) return cityById.get(donation.cityId)?.uf === uf;
      if (region !== undefined) {
        const cityUf = cityById.get(donation.cityId)?.uf;
        return cityUf !== undefined && UF_REGION[cityUf] === region;
      }
      return true;
    });
  }, [dataset, filter, cityById]);

  return {
    loadState,
    donations,
    cities: dataset?.cities ?? EMPTY_CITIES,
    ongs: dataset?.ongs ?? EMPTY_ONGS,
    filter,
    setFilter,
    retry,
  };
}
