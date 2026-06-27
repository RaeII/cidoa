import * as THREE from "three";
import {
  TERRAIN_BASE_LIFT,
  TERRAIN_CARVE_FLOOR,
  TERRAIN_CITY_PADDING,
  TERRAIN_TRANSITION,
} from "../config/terrainConfig";
import type { TerrainSettings } from "../types";

// --- Ruído value-noise + fbm + falhas (porte direto do protótipo terrain.md) ---
function mulberry32(seed: number): () => number {
  let s = seed;
  return function () {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashNoise(ix: number, iz: number, seed: number): number {
  let n = ix * 374761393 + iz * 668265263 + seed * 1442695041;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) / 4294967295;
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function valueNoise(x: number, z: number, seed: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = fade(x - ix);
  const fz = fade(z - iz);
  const a = hashNoise(ix, iz, seed);
  const b = hashNoise(ix + 1, iz, seed);
  const c = hashNoise(ix, iz + 1, seed);
  const d = hashNoise(ix + 1, iz + 1, seed);
  return lerp(lerp(a, b, fx), lerp(c, d, fx), fz);
}

function fbm(
  x: number,
  z: number,
  frequency: number,
  octaves: number,
  persistence: number,
  lacunarity: number,
  seed: number,
): number {
  let sum = 0;
  let amp = 1;
  let freq = frequency;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(x * freq, z * freq, seed + i * 1013) * amp;
    norm += amp;
    amp *= persistence;
    freq *= lacunarity;
  }
  return sum / norm;
}

function smoothHeightField(data: Float32Array, side: number, iterations: number): Float32Array {
  let source = data;
  for (let it = 0; it < iterations; it++) {
    const target = source.slice();
    for (let z = 1; z < side - 1; z++) {
      for (let x = 1; x < side - 1; x++) {
        const i = z * side + x;
        target[i] =
          (source[i] * 4 +
            source[i - 1] +
            source[i + 1] +
            source[i - side] +
            source[i + side] +
            source[i - side - 1] * 0.5 +
            source[i - side + 1] * 0.5 +
            source[i + side - 1] * 0.5 +
            source[i + side + 1] * 0.5) /
          10;
      }
    }
    source = target;
  }
  return source;
}

export type TerrainRig = {
  mesh: THREE.Mesh;
  update: (settings: TerrainSettings) => void;
  // Raio (mundo) da cidade. Reabre a zona plana ao redor da cidade conforme ela cresce.
  setCityRadius: (radius: number) => void;
  setShadowEnabled: (enabled: boolean) => void;
  dispose: () => void;
};

export function createTerrain(
  scene: THREE.Scene,
  settings: TerrainSettings,
  receiveShadow: boolean,
): TerrainRig {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.92,
    metalness: 0,
    wireframe: settings.wireframe,
  });

  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
  mesh.receiveShadow = receiveShadow;
  mesh.castShadow = false;
  scene.add(mesh);

  let current: TerrainSettings = { ...settings };
  let segments = 0;
  let side = 0;
  let count = 0;
  let positions = new Float32Array(0);
  let colors = new Float32Array(0);
  let heights = new Float32Array(0); // altura bruta (pode ser negativa), pré-carve
  let minH = 0;
  let maxH = 0;
  let cityRadius = 0;
  let lastCarveRadius = Number.NaN;

  const lowColor = new THREE.Color();
  const highColor = new THREE.Color();

  // (Re)aloca buffers + índice quando a resolução muda.
  const allocate = (segs: number) => {
    segments = segs;
    side = segs + 1;
    count = side * side;
    positions = new Float32Array(count * 3);
    colors = new Float32Array(count * 3);
    heights = new Float32Array(count);

    const indices: number[] = [];
    for (let z = 0; z < segments; z++) {
      for (let x = 0; x < segments; x++) {
        const a = z * side + x;
        const b = a + 1;
        const c = a + side;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }

    mesh.geometry.dispose();
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    mesh.geometry = geometry;
  };

  // Gera o heightfield bruto (independente de size e do carve da cidade).
  const generate = (s: TerrainSettings) => {
    const data = new Float32Array(count);
    const rng = mulberry32(s.seed);

    const faultLines: Array<{ nx: number; nz: number; offset: number; power: number }> = [];
    for (let i = 0; i < s.faults; i++) {
      const angle = rng() * Math.PI * 2;
      faultLines.push({
        nx: Math.cos(angle),
        nz: Math.sin(angle),
        offset: (rng() - 0.5) * 1.3,
        power: (1 - i / Math.max(1, s.faults)) * s.faultStrength,
      });
    }

    for (let z = 0; z < side; z++) {
      for (let x = 0; x < side; x++) {
        const u = x / segments;
        const v = z / segments;
        const px = u - 0.5;
        const pz = v - 0.5;

        const n = fbm(u, v, s.frequency, s.octaves, s.persistence, s.lacunarity, s.seed);
        const broad = fbm(
          u * 0.32 + 91.7,
          v * 0.32 - 17.2,
          Math.max(0.35, s.frequency * 0.48),
          3,
          s.persistence,
          s.lacunarity,
          s.seed + 7,
        );
        const ridge = Math.pow(1 - Math.abs(n * 2 - 1), 1.65);

        let h = (n - 0.5) * s.height * 0.82;
        h += (broad - 0.48) * s.height * 0.72;
        h += ridge * s.ridge * s.height * 0.48;

        for (const f of faultLines) {
          const sideOfLine = px * f.nx + pz * f.nz + f.offset;
          h += Math.tanh(sideOfLine * 18) * f.power;
        }

        const dist = Math.sqrt(px * px + pz * pz) * 2;
        const edgeFalloff = THREE.MathUtils.smoothstep(dist, 0.62, 1.18);
        h *= 1 - edgeFalloff * s.edge;

        if (s.terrace > 0) {
          const step = s.height / s.terrace;
          const terraced = Math.round(h / step) * step;
          h = lerp(h, terraced, 0.58);
        }

        data[z * side + x] = h;
      }
    }

    heights.set(smoothHeightField(data, side, s.smooth));
    minH = Infinity;
    maxH = -Infinity;
    for (const h of heights) {
      if (h < minH) minH = h;
      if (h > maxH) maxH = h;
    }
  };

  // Escreve posições + cores a partir de `heights`, abrindo a zona plana da cidade.
  // Perto da cidade a altura mergulha sob o chão (CARVE_FLOOR, escondido); longe sobe
  // até BASE_LIFT + relevo. Cor por altura visível (gradiente low→high).
  const applyGeometry = (s: TerrainSettings) => {
    const half = s.size / 2;
    const carveStart = cityRadius + TERRAIN_CITY_PADDING;
    const carveEnd = carveStart + TERRAIN_TRANSITION;
    const range = Math.max(1e-4, maxH - minH);

    for (let z = 0; z < side; z++) {
      for (let x = 0; x < side; x++) {
        const i = z * side + x;
        const k = i * 3;
        const wx = (x / segments) * s.size - half;
        const wz = (z / segments) * s.size - half;
        const d = Math.sqrt(wx * wx + wz * wz);
        const mask = THREE.MathUtils.smoothstep(d, carveStart, carveEnd); // 0 na cidade, 1 longe
        const norm = heights[i] - minH; // >= 0
        positions[k] = wx;
        positions[k + 1] = lerp(TERRAIN_CARVE_FLOOR, TERRAIN_BASE_LIFT + norm, mask);
        positions[k + 2] = wz;

        const t = THREE.MathUtils.clamp((norm * mask) / range, 0, 1);
        colors[k] = lerp(lowColor.r, highColor.r, t);
        colors[k + 1] = lerp(lowColor.g, highColor.g, t);
        colors[k + 2] = lerp(lowColor.b, highColor.b, t);
      }
    }

    const geometry = mesh.geometry;
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    lastCarveRadius = cityRadius;
  };

  const rebuild = (s: TerrainSettings) => {
    lowColor.set(s.lowColor);
    highColor.set(s.highColor);
    if (s.segments !== segments) allocate(s.segments);
    generate(s);
    applyGeometry(s);
    material.wireframe = s.wireframe;
    mesh.visible = s.enabled;
  };

  allocate(settings.segments);
  rebuild(settings);

  // Debounce do rebuild: arrastar slider dispara muitos updates; regenerar o
  // heightfield (falhas + suavização em até 256²) a cada tick travaria o drag.
  let updateTimer: ReturnType<typeof setTimeout> | null = null;

  return {
    mesh,
    update(s) {
      current = { ...s };
      if (updateTimer !== null) clearTimeout(updateTimer);
      updateTimer = setTimeout(() => {
        updateTimer = null;
        rebuild(current);
      }, 60);
    },
    setCityRadius(radius) {
      cityRadius = radius;
      // Só re-carve quando o raio muda de fato (cidade ganhou um anel). Não regenera ruído.
      if (Math.abs(radius - lastCarveRadius) < 0.5) return;
      applyGeometry(current);
    },
    setShadowEnabled(enabled) {
      mesh.receiveShadow = enabled;
    },
    dispose() {
      if (updateTimer !== null) clearTimeout(updateTimer);
      scene.remove(mesh);
      mesh.geometry.dispose();
      material.dispose();
    },
  };
}
