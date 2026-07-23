import { http } from "./http";

/** Uma opção do catálogo. `value` = hex p/ cor, caminho/URL p/ textura, null p/ shape/topo/led. */
export type CatalogOption = {
  id: number;
  key: string;
  label: string;
  value: string | null;
  sortOrder: number;
};

type CatalogCategory = {
  key: string;
  label: string;
  kind: string;
  parentKey: string | null;
  sortOrder: number;
  options: CatalogOption[];
};

type CatalogResponse = { categories: CatalogCategory[] };

/**
 * Catálogo normalizado por categoria — o painel consome direto, sem conhecer a
 * árvore. `features` = categorias-feature ativas (Letreiro/Holograma): só vêm
 * do backend quando ativas, então presença = habilitado.
 */
export type CustomizationCatalog = {
  shapes: CatalogOption[];
  rooftops: CatalogOption[];
  edgeLights: CatalogOption[];
  colors: CatalogOption[];
  textures: CatalogOption[];
  features: { sign: boolean; hologram: boolean };
};

export async function fetchCustomizationCatalog(
  opts: { signal?: AbortSignal } = {},
): Promise<CustomizationCatalog> {
  const { data } = await http.get<CatalogResponse>("/customization/catalog", {
    signal: opts.signal,
  });
  const byKey = new Map(data.categories.map((c) => [c.key, c]));
  const optionsOf = (key: string) => byKey.get(key)?.options ?? [];
  return {
    shapes: optionsOf("shape"),
    rooftops: optionsOf("rooftop"),
    edgeLights: optionsOf("edge_light"),
    colors: optionsOf("color"),
    textures: optionsOf("texture"),
    features: { sign: byKey.has("sign"), hologram: byKey.has("hologram") },
  };
}
