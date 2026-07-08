import { http } from "./http";

export type DonationRecord = {
  id: number;
  value: number;
  cityId: number;
  ongId: number;
};

export type City = { id: number; name: string; uf: string };
export type Ong = { id: number; name: string };

export type DonationDataset = {
  donations: DonationRecord[];
  cities: City[];
  ongs: Ong[];
  total: number;
};

export type DonationLoadProgress = {
  loadedBytes: number;
  totalBytes: number | null;
};

/** Contrato do GET /donation/snapshot (formato compacto por tuplas). */
type SnapshotPayload = {
  v: number;
  total: number;
  cities: [number, string, string][];
  ongs: [number, string][];
  data: [number, number, number, number][];
};

/**
 * Busca o snapshot completo de doações (1 GET, servido de cache no back).
 *
 * Progresso: com Content-Encoding gzip o browser zera ProgressEvent.total e
 * `loaded` conta bytes DESCOMPRIMIDOS — o denominador certo é o header
 * X-Snapshot-Bytes (tamanho do JSON raw), nunca o Content-Length.
 */
export async function fetchDonationSnapshot(
  opts: {
    signal?: AbortSignal;
    onProgress?: (p: DonationLoadProgress) => void;
  } = {},
): Promise<DonationDataset> {
  const response = await http.get<SnapshotPayload>("/donation/snapshot", {
    signal: opts.signal,
    onDownloadProgress: (event) => {
      if (!opts.onProgress) return;
      const xhr = event.event?.target as XMLHttpRequest | undefined;
      const headerBytes = Number(xhr?.getResponseHeader?.("X-Snapshot-Bytes"));
      const totalBytes =
        Number.isFinite(headerBytes) && headerBytes > 0
          ? headerBytes
          : event.total ?? null;
      opts.onProgress({ loadedBytes: event.loaded, totalBytes });
    },
  });

  const payload = response.data;
  return {
    total: payload.total,
    cities: payload.cities.map(([id, name, uf]) => ({ id, name, uf })),
    ongs: payload.ongs.map(([id, name]) => ({ id, name })),
    donations: payload.data.map(([id, value, cityId, ongId]) => ({
      id,
      value,
      cityId,
      ongId,
    })),
  };
}
