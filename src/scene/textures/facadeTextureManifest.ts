// Descoberta automática das pastas de textura em src/assets/texture/ via Vite glob.
// `eager` + `?url` = só as URLs (strings hasheadas pelo Vite), NÃO os bytes — a
// imagem só baixa quando o TextureLoader busca a URL. Zero custo aqui; o loading é
// lazy no loader. Sem import de THREE: a página admin consome este manifesto sem
// puxar three pro bundle.

type MapKind = "color" | "normal" | "roughness" | "metalness" | "displacement";

export type FacadeMapUrls = {
  color: string;
  normal: string | null;
  roughness: string | null;
  metalness: string | null;
  displacement: string | null;
};

export type FacadeTextureInfo = { folder: string; label: string };

// Padrão literal (exigência do Vite). Casa SÓ os sufixos de mapa usados — assim o
// Vite não emite pro dist o que ninguém carrega (ex: _NormalDX, preview .png). Só
// esses arquivos viram asset hasheado. Usamos NormalGL (OpenGL), não DX.
//
// .ktx2 (Basis Universal, gerado por `npm run textures:ktx2`) tem prioridade sobre
// o PNG/JPG do mesmo mapa: fica comprimido na GPU (~4x menos VRAM) e baixa menor.
// Pasta sem .ktx2 continua funcionando pelo PNG/JPG — rodar o encoder é opcional.
const files = import.meta.glob(
  "../../assets/texture/*/*_{Color,NormalGL,Roughness,Metalness,Displacement}.{png,jpg,jpeg,ktx2}",
  { query: "?url", import: "default", eager: true },
) as Record<string, string>;

function classify(nameNoExt: string): MapKind | null {
  if (nameNoExt.endsWith("_Color")) return "color";
  if (nameNoExt.endsWith("_NormalGL")) return "normal"; // GL; _NormalDX ignorado
  if (nameNoExt.endsWith("_Roughness")) return "roughness";
  if (nameNoExt.endsWith("_Metalness")) return "metalness";
  if (nameNoExt.endsWith("_Displacement")) return "displacement";
  return null;
}

// Rótulo amigável pra pasta não-cadastrada: corta o sufixo técnico.
// "Facade006_1K-mirrored-PNG" -> "Facade006". "Concrete024_1K-JPG" -> "Concrete024".
function deriveLabel(folder: string): string {
  const cut = folder.indexOf("_1K");
  return (cut > 0 ? folder.slice(0, cut) : folder.split("_")[0]) || folder;
}

const byFolder = new Map<string, Partial<Record<MapKind, string>>>();
for (const [path, url] of Object.entries(files)) {
  const parts = path.split("/");
  const file = parts[parts.length - 1];
  const folder = parts[parts.length - 2];
  const nameNoExt = file.replace(/\.[^.]+$/, "");
  const kind = classify(nameNoExt);
  if (!kind) continue;
  let maps = byFolder.get(folder);
  if (!maps) byFolder.set(folder, (maps = {}));
  // Um mapa pode existir nas duas formas (PNG fonte + KTX2 gerado). KTX2 ganha;
  // o PNG que chegar depois não sobrescreve.
  const isKtx2 = file.endsWith(".ktx2");
  if (maps[kind] && !isKtx2) continue;
  maps[kind] = url;
}

const urlsByFolder = new Map<string, FacadeMapUrls>();
const infos: FacadeTextureInfo[] = [];
for (const [folder, maps] of byFolder) {
  if (!maps.color) continue; // sem color map não é textura válida
  urlsByFolder.set(folder, {
    color: maps.color,
    normal: maps.normal ?? null,
    roughness: maps.roughness ?? null,
    metalness: maps.metalness ?? null,
    displacement: maps.displacement ?? null,
  });
  infos.push({ folder, label: deriveLabel(folder) });
}
infos.sort((a, b) => a.folder.localeCompare(b.folder));

/** Pastas de textura disponíveis no repo (fonte da verdade do que existe). */
export const FACADE_TEXTURE_FOLDERS: readonly FacadeTextureInfo[] = infos;

/** Normaliza um `value` do catálogo ("texture/Foo" ou "Foo") para o nome da pasta. */
export function resolveFacadeFolder(value: string | null | undefined): string {
  return (value ?? "").split("/").filter(Boolean).pop() ?? "";
}

/** URLs dos mapas de uma pasta, ou null se a pasta não existe / não tem color map. */
export function getFacadeMapUrls(value: string | null | undefined): FacadeMapUrls | null {
  return urlsByFolder.get(resolveFacadeFolder(value)) ?? null;
}
