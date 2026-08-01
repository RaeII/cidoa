import * as THREE from "three";

import envUrl from "../../assets/environment/DaySkyHDRI040B_4K_TONEMAPPED.jpg";
import { NIGHT_PRESET } from "../config/environmentConfig";
import type { EnvironmentSettings } from "../types";
import { seeded } from "../utils/random";

export type EnvironmentUpdater = {
  updateSettings: (settings: EnvironmentSettings) => void;
  updatePosition: (x: number, y: number, z: number) => void;
  /** Esconde as estrelas (pontos de tamanho fixo em pixels viram borrões no cube do reflexo). */
  setStarsVisible: (visible: boolean) => void;
  dispose: () => void;
};

// Cache persistente da imagem HDRI no Cache API do browser.
// Bump versão se a imagem mudar de conteúdo.
const ENV_CACHE_NAME = "cidoa-env-v1";

// Resolve URL da textura priorizando o Cache API: primeira visita baixa e
// grava; visitas seguintes leem direto do cache local (sem rede). Devolve um
// object URL do blob cacheado, ou a URL original como fallback.
async function resolveEnvUrl(url: string): Promise<string> {
  if (!("caches" in globalThis)) return url;
  try {
    const cache = await caches.open(ENV_CACHE_NAME);
    let response = await cache.match(url);
    if (!response) {
      response = await fetch(url);
      if (!response.ok) return url;
      await cache.put(url, response.clone());
    }
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch {
    return url;
  }
}

// Estrelas: Points no hemisfério de cima, filho da esfera do céu — herda rotação e o
// reposicionamento por frame. sizeAttenuation off = tamanho fixo em pixels.
function createStars(): THREE.Points {
  const positions = new Float32Array(NIGHT_PRESET.starCount * 3);
  for (let i = 0; i < NIGHT_PRESET.starCount; i++) {
    const y = seeded(i, 91, 1);
    const ring = Math.sqrt(1 - y * y);
    const theta = seeded(i, 91, 2) * Math.PI * 2;
    positions[i * 3] = Math.cos(theta) * ring * NIGHT_PRESET.starRadius;
    positions[i * 3 + 1] = y * NIGHT_PRESET.starRadius;
    positions[i * 3 + 2] = Math.sin(theta) * ring * NIGHT_PRESET.starRadius;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    size: NIGHT_PRESET.starSize,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    fog: false,
  });
  return new THREE.Points(geometry, material);
}

function applySettings(
  skyMesh: THREE.Mesh,
  skyMaterial: THREE.MeshBasicMaterial,
  stars: THREE.Points,
  settings: EnvironmentSettings,
) {
  // Rotação horizontal via mesh: uniforme em todas as direções
  skyMesh.rotation.y = settings.offsetX;
  // Deslocamento vertical via UV offset: move o horizonte uniformemente em todos os lados.
  // offset é uniform — não precisa de needsUpdate (que re-enviaria a textura 4K à GPU).
  if (skyMaterial.map) skyMaterial.map.offset.y = settings.offsetY;
  // Roll (inclinação diagonal)
  skyMesh.rotation.z = settings.offsetZ;
  // Noite = céu diurno multiplicado por azul escuro; branco = passa o HDRI intacto.
  skyMaterial.color.set(settings.night ? NIGHT_PRESET.skyTint : "#ffffff");
  stars.visible = settings.night;
}

export function loadEnvironment(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  settings: EnvironmentSettings,
  onLoaded?: (envMap: THREE.Texture, bgTexture: THREE.Texture) => void,
  isCancelled?: () => boolean,
): EnvironmentUpdater {
  let skyMesh: THREE.Mesh | null = null;
  let skyGeometry: THREE.SphereGeometry | null = null;
  let skyMaterial: THREE.MeshBasicMaterial | null = null;
  let stars: THREE.Points | null = null;
  // HDRI 4K demora; noite pode ser ligada antes do load terminar.
  let currentSettings = settings;

  const loader = new THREE.TextureLoader();

  const buildSky = (texture: THREE.Texture) => {
    if (isCancelled?.()) return;

    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapT = THREE.RepeatWrapping;

    // Esfera invertida como background — permite offset UV uniforme em todas as direções
    skyGeometry = new THREE.SphereGeometry(200, 64, 40);
    skyMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    skyMesh = new THREE.Mesh(skyGeometry, skyMaterial);
    skyMesh.renderOrder = -1000;
    stars = createStars();
    skyMesh.add(stars);
    applySettings(skyMesh, skyMaterial, stars, currentSettings);
    scene.add(skyMesh);

    // scene.environment para iluminação PBR dos edifícios
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const envMap = pmremGenerator.fromEquirectangular(texture).texture;
    scene.environment = envMap;
    pmremGenerator.dispose();

    onLoaded?.(envMap, texture);
  };

  void resolveEnvUrl(envUrl).then((resolvedUrl) => {
    loader.load(resolvedUrl, (texture) => {
      if (resolvedUrl !== envUrl) URL.revokeObjectURL(resolvedUrl);
      buildSky(texture);
    });
  });

  return {
    updateSettings(newSettings: EnvironmentSettings) {
      currentSettings = newSettings;
      if (skyMesh && skyMaterial && stars) {
        applySettings(skyMesh, skyMaterial, stars, newSettings);
      }
    },
    updatePosition(x: number, y: number, z: number) {
      skyMesh?.position.set(x, y, z);
    },
    setStarsVisible(visible: boolean) {
      if (stars) stars.visible = visible && currentSettings.night;
    },
    dispose() {
      if (skyMesh) scene.remove(skyMesh);
      skyGeometry?.dispose();
      skyMaterial?.dispose();
      stars?.geometry.dispose();
      (stars?.material as THREE.Material | undefined)?.dispose();
    },
  };
}
