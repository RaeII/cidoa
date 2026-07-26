import * as THREE from "three";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { getFacadeMapUrls, resolveFacadeFolder } from "./facadeTextureManifest";

export type FacadeTextureSet = {
  color: THREE.Texture;
  normal: THREE.Texture | null;
  roughness: THREE.Texture | null;
  metalness: THREE.Texture | null;
  displacement: THREE.Texture | null;
};

const textureLoader = new THREE.TextureLoader();

// KTX2 precisa saber quais formatos comprimidos a GPU aceita (BC7/ASTC/ETC2) —
// daí o detectSupport(renderer). Sem init, um .ktx2 cai no fallback PNG/JPG do
// próprio manifesto (que só acontece se o encoder nunca rodou), ou avisa e falha.
let ktx2Loader: KTX2Loader | null = null;

/** Chamado uma vez pelo manager, com o renderer da cena. Idempotente. */
export function initFacadeTextureLoader(renderer: THREE.WebGLRenderer): void {
  if (ktx2Loader) return;
  ktx2Loader = new KTX2Loader()
    // basis_transcoder.{js,wasm} vivem em public/basis/ (cópia de three/examples).
    // BASE_URL cobre deploy em subpath.
    .setTranscoderPath(`${import.meta.env.BASE_URL}basis/`)
    .detectSupport(renderer);
}

async function loadOne(
  url: string,
  srgb: boolean,
  anisotropy: number,
): Promise<THREE.Texture> {
  let tex: THREE.Texture;
  if (url.endsWith(".ktx2")) {
    if (!ktx2Loader) {
      throw new Error("KTX2Loader não inicializado — chame initFacadeTextureLoader(renderer).");
    }
    tex = await ktx2Loader.loadAsync(url);
  } else {
    tex = await textureLoader.loadAsync(url);
  }
  // O .ktx2 é gerado com y-flip (ver scripts/encode-ktx2.mjs), então as duas rotas
  // chegam na GPU com a mesma orientação — trocar de formato não muda a imagem.
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

function loadOptional(
  url: string | null,
  srgb: boolean,
  anisotropy: number,
): Promise<THREE.Texture | null> {
  if (!url) return Promise.resolve(null);
  return loadOne(url, srgb, anisotropy).catch((err) => {
    console.warn(`[textures] mapa opcional falhou: ${url}`, err);
    return null;
  });
}

// Cache por pasta, vida do app: cada textura carrega 1x e é compartilhada entre
// todos os prédios/materiais. Trocar textura e voltar reusa (zero re-download,
// zero re-upload GPU). Curated set pequeno — sem eviction.
// ponytail: cache global sem LRU; adicionar eviction se o set de texturas crescer.
const inFlight = new Map<string, Promise<FacadeTextureSet | null>>();
const ready = new Map<string, FacadeTextureSet>();

/** Set já carregado, sem disparar rede. Usado pra evitar 1 frame sem textura. */
export function peekFacadeTextureSet(
  value: string | null | undefined,
): FacadeTextureSet | null {
  return ready.get(resolveFacadeFolder(value)) ?? null;
}

/**
 * Set de texturas PBR de uma pasta. Lazy: só baixa quando pedido, e uma vez só —
 * chamadas concorrentes compartilham a mesma Promise. Resolve `null` se a pasta
 * não existe (catálogo apontando pra asset removido) ou se o color map falhou;
 * o chamador cai no fallback. Mapas secundários ausentes viram `null` no set.
 */
export function loadFacadeTextureSet(
  value: string | null | undefined,
  anisotropy: number,
): Promise<FacadeTextureSet | null> {
  const key = resolveFacadeFolder(value);
  const existing = inFlight.get(key);
  if (existing) return existing;

  const urls = getFacadeMapUrls(key);
  if (!urls) return Promise.resolve(null);

  const pending = (async () => {
    try {
      const [color, normal, roughness, metalness, displacement] = await Promise.all([
        loadOne(urls.color, true, anisotropy),
        loadOptional(urls.normal, false, anisotropy),
        loadOptional(urls.roughness, false, anisotropy),
        loadOptional(urls.metalness, false, anisotropy),
        loadOptional(urls.displacement, false, anisotropy),
      ]);
      const set: FacadeTextureSet = { color, normal, roughness, metalness, displacement };
      ready.set(key, set);
      return set;
    } catch (err) {
      console.warn(`[textures] falha ao carregar a pasta "${key}"`, err);
      inFlight.delete(key); // permite retry numa próxima seleção
      return null;
    }
  })();

  inFlight.set(key, pending);
  return pending;
}
