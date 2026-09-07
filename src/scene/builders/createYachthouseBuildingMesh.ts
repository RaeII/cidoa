import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// Coordenadas unitárias: base em 0, topo em 1; o mesh final fica centrado em Y.
export const YACHTHOUSE_TOWER_CENTERS = [-0.255, 0.255] as const;
export const YACHTHOUSE_BODY = { bottom: 0.105, top: 0.865, width: 0.39, depth: 0.72 };
export const YACHTHOUSE_ROOF = { height: 0.96, width: 0.34, depth: 0.66 };
let sharedGeometry: THREE.BufferGeometry | null = null;

function buildGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[][] = [[], []];
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, material = 1) => {
    const source = new THREE.BoxGeometry(w, h, d);
    const geometry = source.toNonIndexed();
    source.dispose();
    geometry.translate(x, y - 0.5, z);
    parts[material].push(geometry);
  };
  // Planta chanfrada: cantos das sacadas acompanham a fachada das referências.
  const prism = (w: number, d: number, bottom: number, top: number, x: number, material: number) => {
    const cut = 0.025;
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2 + cut, -d / 2);
    shape.lineTo(w / 2 - cut, -d / 2);
    shape.lineTo(w / 2, -d / 2 + cut);
    shape.lineTo(w / 2, d / 2 - cut);
    shape.lineTo(w / 2 - cut, d / 2);
    shape.lineTo(-w / 2 + cut, d / 2);
    shape.lineTo(-w / 2, d / 2 - cut);
    shape.lineTo(-w / 2, -d / 2 + cut);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: top - bottom, bevelEnabled: false, steps: 1 });
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(x, bottom - 0.5, 0);
    parts[material].push(geometry);
  };

  // Embasamento comum envidraçado, lajes e marquise de entrada.
  box(1, 0.012, 1, 0, 0.006, 0);
  box(0.96, 0.072, 0.94, 0, 0.048, 0, 0);
  for (const y of [0.035, 0.063, 0.089]) box(1, 0.005, 1, 0, y, 0);
  box(0.52, 0.006, 0.1, 0, 0.036, 0.45);
  box(0.9, 0.014, 0.84, 0, 0.098, 0);

  for (const x of YACHTHOUSE_TOWER_CENTERS) {
    const { bottom, top, width, depth } = YACHTHOUSE_BODY;
    prism(width, depth, bottom, top, x, 0);
    // Faixas de pavimento em relevo; número fixo mantém custo previsível.
    for (let floor = 0; floor <= 64; floor++) {
      const y = bottom + (top - bottom) * floor / 64;
      prism(width + 0.014, depth + 0.016, y, y + 0.0025, x, 1);
    }
    // Faixa vertical contínua cobre as lajes no centro de cada face principal.
    for (const z of [-0.374, 0.374]) {
      box(0.07, top - bottom, 0.016, x, (bottom + top) / 2, z, 0);
    }
    // Coroamento recuado, cobertura em balanço e mastro no lado interno.
    prism(0.31, 0.62, 0.8675, 0.949, x, 0);
    for (const y of [0.891, 0.918, 0.944]) box(0.316, 0.004, 0.626, x, y, 0);
    box(YACHTHOUSE_ROOF.width, 0.008, YACHTHOUSE_ROOF.depth, x, 0.956, 0);
    box(0.012, 0.052, 0.023, x - Math.sign(x) * 0.137, 0.974, -0.27);
  }

  // Dois grupos, como os outros modelos: fachada PBR e acabamento/topo.
  const merged = parts.map((items) => mergeGeometries(items)!);
  const geometry = mergeGeometries(merged, true)!;
  for (const item of [...parts.flat(), ...merged]) item.dispose();
  geometry.setAttribute("aProjPosition", geometry.getAttribute("position").clone());
  geometry.setAttribute("aProjNormal", geometry.getAttribute("normal").clone());
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export function createYachthouseBuildingMesh(
  facadeMaterial: THREE.Material,
  topMaterial: THREE.Material,
): THREE.Mesh {
  sharedGeometry ??= buildGeometry();
  return new THREE.Mesh(sharedGeometry, [facadeMaterial, topMaterial]);
}

export function disposeYachthouseBuildingSharedResources(): void {
  sharedGeometry?.dispose();
  sharedGeometry = null;
}
