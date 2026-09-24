import * as THREE from "three";
import type { BuildingShape, EdgeLightType } from "../types";
import { getChryslerTierFootprints } from "./createChryslerBuildingMesh";
import { getEmpireTierFootprints } from "./createEmpireBuildingMesh";
import {
  HEARST_RING_COUNT,
  getHearstRingFootprintPoints,
} from "./createHearstBuildingMesh";
import { getOctagonalFootprintPoints } from "./createOctagonalBuildingMesh";
import { getOneTradeLedFootprintRings } from "./createOneTradeBuildingMesh";
import { getResidentialTierFootprints } from "./createResidentialBuildingMesh";
import { getSetbackTierFootprints } from "./createSetbackBuildingMesh";
import { getTaipeiTierFootprints } from "./createTaipeiBuildingMesh";
import { getTaperedFootprintScaleAtHeightRatio } from "./createTaperedBuildingMesh";
import { TWIST_TOTAL_ANGLE } from "./createTwistedBuildingMesh";

type EdgeLightFootprint = {
  width: number;
  depth: number;
  height: number;
};

// Quantidade de segmentos verticais para acompanhar a curva torcida.
// 12 já dá uma curva suficientemente suave sem multiplicar muito o nº de meshes
// (cada segmento gera core + 2 halos). A geometria do prédio usa 24 — é seguro
// usar metade pois o LED é fino e a aproximação por segmentos curtos é menos visível.
const LED_TWIST_SEGMENTS = 12;
const LED_TAPER_SEGMENTS = 12;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

export const DEFAULT_EDGE_LIGHT_COLOR = "#ffca57";
export const DEFAULT_EDGE_LIGHT_INTENSITY = 10;
export const DEFAULT_EDGE_LIGHT_DISTANCE = 0.04;
export const DEFAULT_EDGE_LIGHT_THICKNESS = 0.05;

type EdgeLightFactory = (
  footprint: EdgeLightFootprint,
  shape: BuildingShape,
) => THREE.Group;

const TOP_LIFT = 0.05;
const HALO_OPACITY = 0.55;
const HALO_OUTER_OPACITY = 0.22;

// Geometria sólida para o core (sem gradiente).
const EDGE_CORE_GEOMETRY = new THREE.BoxGeometry(1, 1, 1);

/**
 * Cria BoxGeometry(1×1×1) com vertex colors RGBA cujo alpha faz gradiente radial
 * suave nas duas axes perpendiculares ao eixo principal da aresta.
 * alpha = 1.0 no centro (dist=0), alpha = 0.0 na borda (dist=0.5 em coords locais).
 * Usado pelos halos para que a luz se dissipe sem borda visível.
 */
function createGradientHaloGeometry(
  fade1: "x" | "y" | "z",
  fade2: "x" | "y" | "z",
): THREE.BoxGeometry {
  const SEG = 10; // subdivisões nas axes de fade para suavidade
  const wx = fade1 === "x" || fade2 === "x" ? SEG : 1;
  const hy = fade1 === "y" || fade2 === "y" ? SEG : 1;
  const dz = fade1 === "z" || fade2 === "z" ? SEG : 1;

  const geo = new THREE.BoxGeometry(1, 1, 1, wx, hy, dz);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const count = pos.count;
  const colors = new Float32Array(count * 4);

  const getComp: Record<"x" | "y" | "z", (i: number) => number> = {
    x: (i) => pos.getX(i),
    y: (i) => pos.getY(i),
    z: (i) => pos.getZ(i),
  };

  for (let i = 0; i < count; i++) {
    // Distância normalizada [0,1] do centro nas axes de fade
    // Coord local está em [-0.5, 0.5], portanto ×2 → [0, 1]
    const d1 = Math.abs(getComp[fade1](i)) * 2;
    const d2 = Math.abs(getComp[fade2](i)) * 2;
    // Math.min garante que as faces laterais (onde uma das distâncias é 1) 
    // calculem o gradiente a partir do centro da face. (Math.max as tornava invisíveis)
    const dist = Math.min(d1, d2);
    
    const t = Math.min(1, dist);
    // Queda exponencial (pow) cria um efeito de dissipação de luz muito mais 
    // realista do que o smoothstep, que criava um núcleo "sólido" demais.
    const alpha = Math.pow(1 - t, 2.0);

    colors[i * 4] = 1;
    colors[i * 4 + 1] = 1;
    colors[i * 4 + 2] = 1;
    colors[i * 4 + 3] = alpha;
  }

  geo.setAttribute("color", new THREE.BufferAttribute(colors, 4));
  return geo;
}

// Geometrias de halo com gradiente — uma por combinação de axes perpendiculares.
// "fade_AB" significa que o gradiente dissolve ao longo das axes A e B,
// enquanto o eixo dominante da aresta é o complementar.
const HALO_GEO_XZ = createGradientHaloGeometry("x", "z"); // para arestas Y (cantos verticais)
const HALO_GEO_YZ = createGradientHaloGeometry("y", "z"); // para arestas X (topo frente/trás)
const HALO_GEO_XY = createGradientHaloGeometry("x", "y"); // para arestas Z (topo esq/dir)

const HALO_GEOMETRY_FOR_AXIS: Record<"x" | "y" | "z", THREE.BufferGeometry> = {
  y: HALO_GEO_XZ,
  x: HALO_GEO_YZ,
  z: HALO_GEO_XY,
};

const SHARED_EDGE_LIGHT_GEOMETRIES: THREE.BufferGeometry[] = [
  EDGE_CORE_GEOMETRY,
  HALO_GEO_XZ,
  HALO_GEO_YZ,
  HALO_GEO_XY,
];

type EdgeMaterials = {
  core: THREE.MeshStandardMaterial;
  halo: THREE.MeshBasicMaterial;
  haloOuter: THREE.MeshBasicMaterial;
};

function createEdgeMaterials(color: string, intensity: number): EdgeMaterials {
  const colorObj = new THREE.Color(color);
  const haloColorObj = colorObj.clone().multiplyScalar(intensity / 4.0);

  const core = new THREE.MeshStandardMaterial({
    color: colorObj.clone(),
    emissive: colorObj.clone(),
    emissiveIntensity: intensity,
    roughness: 0.3,
    metalness: 0.0,
    toneMapped: true,
  });

  // vertexColors: true → o alpha dos vertex colors controla a dissolução do halo
  const halo = new THREE.MeshBasicMaterial({
    color: haloColorObj.clone(),
    transparent: true,
    opacity: HALO_OPACITY,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });

  const haloOuter = new THREE.MeshBasicMaterial({
    color: haloColorObj.clone(),
    transparent: true,
    opacity: HALO_OUTER_OPACITY,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });

  return { core, halo, haloOuter };
}

function setShadowRole(
  mesh: THREE.Mesh,
  castsShadow: boolean,
  receivesShadow: boolean,
): void {
  mesh.userData.edgeLightCastsShadow = castsShadow;
  mesh.userData.edgeLightReceivesShadow = receivesShadow;
}

/**
 * Adiciona uma aresta ao grupo: core sólido emissivo + dois halos com gradiente
 * de alpha que dissipa a luz sem borda visível.
 */
function addEdgeSegment(
  group: THREE.Group,
  materials: EdgeMaterials,
  position: THREE.Vector3,
  axis: "x" | "y" | "z",
  length: number,
  distance: number,
  thickness: number,
): void {
  const buildScale = (t: number): THREE.Vector3 => {
    if (axis === "x") return new THREE.Vector3(length, t, t);
    if (axis === "z") return new THREE.Vector3(t, t, length);
    return new THREE.Vector3(t, length, t);
  };

  const haloGeo = HALO_GEOMETRY_FOR_AXIS[axis];

  const core = new THREE.Mesh(EDGE_CORE_GEOMETRY, materials.core);
  core.scale.copy(buildScale(thickness));
  core.position.copy(position);
  setShadowRole(core, false, false);
  group.add(core);

  const halo = new THREE.Mesh(haloGeo, materials.halo);
  halo.scale.copy(buildScale(distance));
  halo.position.copy(position);
  halo.renderOrder = 1;
  setShadowRole(halo, false, false);
  group.add(halo);

  const haloOuter = new THREE.Mesh(haloGeo, materials.haloOuter);
  haloOuter.scale.copy(buildScale(distance * 3.4));
  haloOuter.position.copy(position);
  haloOuter.renderOrder = 2;
  setShadowRole(haloOuter, false, false);
  group.add(haloOuter);
}

/**
 * Adiciona um segmento de aresta orientado em uma direção arbitrária. Usado
 * pelas torres torcidas, onde os cantos verticais sobem em curva e o retângulo
 * superior está rotacionado em relação ao inferior. Ao contrário de
 * `addEdgeSegment` (axis-aligned), aqui aplicamos uma quaternion para alinhar
 * o eixo Y local da geometria ao vetor `direction`.
 */
function addOrientedEdgeSegment(
  group: THREE.Group,
  materials: EdgeMaterials,
  center: THREE.Vector3,
  direction: THREE.Vector3,
  length: number,
  distance: number,
  thickness: number,
): void {
  const quat = new THREE.Quaternion().setFromUnitVectors(Y_AXIS, direction);

  // Halo cujo gradiente está nas axes X/Z perpendiculares ao Y local. Ao rotar
  // a mesh para alinhar Y → direction, o gradiente continua na seção transversal.
  const haloGeo = HALO_GEOMETRY_FOR_AXIS["y"];

  const core = new THREE.Mesh(EDGE_CORE_GEOMETRY, materials.core);
  core.scale.set(thickness, length, thickness);
  core.position.copy(center);
  core.quaternion.copy(quat);
  setShadowRole(core, false, false);
  group.add(core);

  const halo = new THREE.Mesh(haloGeo, materials.halo);
  halo.scale.set(distance, length, distance);
  halo.position.copy(center);
  halo.quaternion.copy(quat);
  halo.renderOrder = 1;
  setShadowRole(halo, false, false);
  group.add(halo);

  const haloOuter = new THREE.Mesh(haloGeo, materials.haloOuter);
  haloOuter.scale.set(distance * 3.4, length, distance * 3.4);
  haloOuter.position.copy(center);
  haloOuter.quaternion.copy(quat);
  haloOuter.renderOrder = 2;
  setShadowRole(haloOuter, false, false);
  group.add(haloOuter);
}

function createLed(
  footprint: EdgeLightFootprint,
  shape: BuildingShape,
): THREE.Group {
  const group = new THREE.Group();
  const { width, depth, height } = footprint;
  const halfW = width / 2;
  const halfD = depth / 2;

  const materials = createEdgeMaterials(DEFAULT_EDGE_LIGHT_COLOR, DEFAULT_EDGE_LIGHT_INTENSITY);
  group.userData.edgeLightMaterials = materials;

  if (shape === "twisted") {
    // Cantos em unit-space (±0.5). A torção da geometria do edifício acontece
    // ANTES da aplicação do `mesh.scale` (ver createTwistedBuildingMesh), logo
    // o canto unit é rotacionado primeiro e só então multiplicado por width/depth.
    // Fazer o contrário (rotacionar valores já escalados) troca os eixos X↔Z
    // quando width ≠ depth — o LED fica desencaixado do edifício.
    const unitCorners: Array<[number, number]> = [
      [-0.5, -0.5],
      [0.5, -0.5],
      [0.5, 0.5],
      [-0.5, 0.5],
    ];

    // Cada canto vertical vira uma sequência de segmentos curtos acompanhando
    // a curva da torção. Ângulo na altura y é proporcional a y/height —
    // mesma fórmula que `createTwistedBuildingMesh` (onde
    // angle = (y_local + 0.5) * TWIST_TOTAL_ANGLE com y_local em [-0.5, 0.5]).
    const tmpDir = new THREE.Vector3();
    for (const [ux, uz] of unitCorners) {
      for (let i = 0; i < LED_TWIST_SEGMENTS; i++) {
        const y0 = (i / LED_TWIST_SEGMENTS) * height;
        const y1 = ((i + 1) / LED_TWIST_SEGMENTS) * height;
        const a0 = (y0 / height) * TWIST_TOTAL_ANGLE;
        const a1 = (y1 / height) * TWIST_TOTAL_ANGLE;
        const x0 = (ux * Math.cos(a0) - uz * Math.sin(a0)) * width;
        const z0 = (ux * Math.sin(a0) + uz * Math.cos(a0)) * depth;
        const x1 = (ux * Math.cos(a1) - uz * Math.sin(a1)) * width;
        const z1 = (ux * Math.sin(a1) + uz * Math.cos(a1)) * depth;

        const cx_avg = (x0 + x1) / 2;
        const cy_avg = (y0 + y1) / 2;
        const cz_avg = (z0 + z1) / 2;
        tmpDir.set(x1 - x0, y1 - y0, z1 - z0);
        const segLen = tmpDir.length();
        tmpDir.divideScalar(segLen); // normaliza in-place

        addOrientedEdgeSegment(
          group,
          materials,
          new THREE.Vector3(cx_avg, cy_avg, cz_avg),
          tmpDir.clone(),
          segLen,
          DEFAULT_EDGE_LIGHT_DISTANCE,
          DEFAULT_EDGE_LIGHT_THICKNESS,
        );
      }
    }

    // Retângulo do topo: cantos unit rotacionados pelo ângulo total e então escalados.
    const topAngle = TWIST_TOTAL_ANGLE;
    const topY = height + TOP_LIFT;
    const cosA = Math.cos(topAngle);
    const sinA = Math.sin(topAngle);
    const topCorners = unitCorners.map(([ux, uz]) => ({
      x: (ux * cosA - uz * sinA) * width,
      z: (ux * sinA + uz * cosA) * depth,
    }));
    for (let i = 0; i < topCorners.length; i++) {
      const a = topCorners[i];
      const b = topCorners[(i + 1) % topCorners.length];
      const center = new THREE.Vector3((a.x + b.x) / 2, topY, (a.z + b.z) / 2);
      const dir = new THREE.Vector3(b.x - a.x, 0, b.z - a.z);
      const len = dir.length();
      dir.divideScalar(len);
      addOrientedEdgeSegment(
        group,
        materials,
        center,
        dir,
        len,
        DEFAULT_EDGE_LIGHT_DISTANCE,
        DEFAULT_EDGE_LIGHT_THICKNESS,
      );
    }

    return group;
  }

  if (shape === "setback") {
    const tiers = getSetbackTierFootprints(width, depth, height);

    for (const tier of tiers) {
      const halfW = tier.width / 2;
      const halfD = tier.depth / 2;
      const segmentHeight = tier.topY - tier.bottomY;
      const centerY = tier.bottomY + segmentHeight / 2;
      const corners: Array<[number, number]> = [
        [-halfW, -halfD],
        [halfW, -halfD],
        [halfW, halfD],
        [-halfW, halfD],
      ];

      for (const [x, z] of corners) {
        addEdgeSegment(
          group,
          materials,
          new THREE.Vector3(x, centerY, z),
          "y",
          segmentHeight,
          DEFAULT_EDGE_LIGHT_DISTANCE,
          DEFAULT_EDGE_LIGHT_THICKNESS,
        );
      }

      const topY = tier.topY + TOP_LIFT;
      for (const z of [-halfD, halfD]) {
        addEdgeSegment(
          group,
          materials,
          new THREE.Vector3(0, topY, z),
          "x",
          tier.width,
          DEFAULT_EDGE_LIGHT_DISTANCE,
          DEFAULT_EDGE_LIGHT_THICKNESS,
        );
      }
      for (const x of [-halfW, halfW]) {
        addEdgeSegment(
          group,
          materials,
          new THREE.Vector3(x, topY, 0),
          "z",
          tier.depth,
          DEFAULT_EDGE_LIGHT_DISTANCE,
          DEFAULT_EDGE_LIGHT_THICKNESS,
        );
      }
    }

    return group;
  }

  if (shape === "octagonal") {
    const corners = getOctagonalFootprintPoints(width, depth);

    for (const { x, z } of corners) {
      addEdgeSegment(
        group,
        materials,
        new THREE.Vector3(x, height / 2, z),
        "y",
        height,
        DEFAULT_EDGE_LIGHT_DISTANCE,
        DEFAULT_EDGE_LIGHT_THICKNESS,
      );
    }

    const topY = height + TOP_LIFT;
    for (let i = 0; i < corners.length; i++) {
      const a = corners[i];
      const b = corners[(i + 1) % corners.length];
      const center = new THREE.Vector3((a.x + b.x) / 2, topY, (a.z + b.z) / 2);
      const dir = new THREE.Vector3(b.x - a.x, 0, b.z - a.z);
      const len = dir.length();
      dir.divideScalar(len);
      addOrientedEdgeSegment(
        group,
        materials,
        center,
        dir,
        len,
        DEFAULT_EDGE_LIGHT_DISTANCE,
        DEFAULT_EDGE_LIGHT_THICKNESS,
      );
    }

    return group;
  }

  if (shape === "tapered") {
    const safeHeight = Math.max(height, 1e-6);
    const corners: Array<[number, number]> = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ];

    const tmpDir = new THREE.Vector3();
    for (const [sx, sz] of corners) {
      for (let i = 0; i < LED_TAPER_SEGMENTS; i++) {
        const y0 = (i / LED_TAPER_SEGMENTS) * height;
        const y1 = ((i + 1) / LED_TAPER_SEGMENTS) * height;
        const s0 = getTaperedFootprintScaleAtHeightRatio(y0 / safeHeight);
        const s1 = getTaperedFootprintScaleAtHeightRatio(y1 / safeHeight);

        const x0 = sx * (width * s0) / 2;
        const z0 = sz * (depth * s0) / 2;
        const x1 = sx * (width * s1) / 2;
        const z1 = sz * (depth * s1) / 2;

        tmpDir.set(x1 - x0, y1 - y0, z1 - z0);
        const segmentLength = tmpDir.length();
        if (segmentLength <= 1e-6) continue;
        tmpDir.divideScalar(segmentLength);

        addOrientedEdgeSegment(
          group,
          materials,
          new THREE.Vector3((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2),
          tmpDir.clone(),
          segmentLength,
          DEFAULT_EDGE_LIGHT_DISTANCE,
          DEFAULT_EDGE_LIGHT_THICKNESS,
        );
      }
    }

    const topScale = getTaperedFootprintScaleAtHeightRatio(1);
    const topW = width * topScale;
    const topD = depth * topScale;
    const topY = height + TOP_LIFT;
    for (const z of [-topD / 2, topD / 2]) {
      addEdgeSegment(
        group,
        materials,
        new THREE.Vector3(0, topY, z),
        "x",
        topW,
        DEFAULT_EDGE_LIGHT_DISTANCE,
        DEFAULT_EDGE_LIGHT_THICKNESS,
      );
    }
    for (const x of [-topW / 2, topW / 2]) {
      addEdgeSegment(
        group,
        materials,
        new THREE.Vector3(x, topY, 0),
        "z",
        topD,
        DEFAULT_EDGE_LIGHT_DISTANCE,
        DEFAULT_EDGE_LIGHT_THICKNESS,
      );
    }

    return group;
  }

  if (shape === "chrysler") {
    const tiers = getChryslerTierFootprints(width, depth, height);
    for (const tier of tiers) {
      const halfW = tier.width / 2;
      const halfD = tier.depth / 2;
      const segmentHeight = tier.topY - tier.bottomY;
      const centerY = tier.bottomY + segmentHeight / 2;
      const corners: Array<[number, number]> = [
        [-halfW, -halfD],
        [halfW, -halfD],
        [halfW, halfD],
        [-halfW, halfD],
      ];

      for (const [x, z] of corners) {
        addEdgeSegment(
          group,
          materials,
          new THREE.Vector3(x, centerY, z),
          "y",
          segmentHeight,
          DEFAULT_EDGE_LIGHT_DISTANCE,
          DEFAULT_EDGE_LIGHT_THICKNESS,
        );
      }

      // Nos tiers de coroa, adiciona reforço horizontal extra para destacar
      // o escalonamento metálico do topo (leitura visual art déco).
      const topY = tier.topY + TOP_LIFT;
      for (const z of [-halfD, halfD]) {
        addEdgeSegment(
          group,
          materials,
          new THREE.Vector3(0, topY, z),
          "x",
          tier.width,
          DEFAULT_EDGE_LIGHT_DISTANCE,
          DEFAULT_EDGE_LIGHT_THICKNESS,
        );
      }
      for (const x of [-halfW, halfW]) {
        addEdgeSegment(
          group,
          materials,
          new THREE.Vector3(x, topY, 0),
          "z",
          tier.depth,
          DEFAULT_EDGE_LIGHT_DISTANCE,
          DEFAULT_EDGE_LIGHT_THICKNESS,
        );
      }
    }

    const crownTop = tiers[tiers.length - 1];
    if (crownTop) {
      const spireY0 = crownTop.topY + TOP_LIFT;
      const spireY1 = height + TOP_LIFT;
      const halfW = crownTop.width * 0.09;
      const halfD = crownTop.depth * 0.09;
      const spireLen = Math.max(0.05, spireY1 - spireY0);
      for (const [x, z] of [
        [-halfW, -halfD],
        [halfW, -halfD],
        [halfW, halfD],
        [-halfW, halfD],
      ] as Array<[number, number]>) {
        addEdgeSegment(
          group,
          materials,
          new THREE.Vector3(x, spireY0 + spireLen / 2, z),
          "y",
          spireLen,
          DEFAULT_EDGE_LIGHT_DISTANCE * 0.85,
          DEFAULT_EDGE_LIGHT_THICKNESS * 0.8,
        );
      }
    }

    return group;
  }

  if (shape === "empire") {
    const tiers = getEmpireTierFootprints(width, depth, height);
    for (const tier of tiers) {
      const halfW = tier.width / 2;
      const halfD = tier.depth / 2;
      const segmentHeight = tier.topY - tier.bottomY;
      const centerY = tier.bottomY + segmentHeight / 2;
      const corners: Array<[number, number]> = [
        [-halfW, -halfD],
        [halfW, -halfD],
        [halfW, halfD],
        [-halfW, halfD],
      ];

      for (const [x, z] of corners) {
        addEdgeSegment(
          group,
          materials,
          new THREE.Vector3(x, centerY, z),
          "y",
          segmentHeight,
          DEFAULT_EDGE_LIGHT_DISTANCE,
          DEFAULT_EDGE_LIGHT_THICKNESS,
        );
      }

      const topY = tier.topY + TOP_LIFT;
      for (const z of [-halfD, halfD]) {
        addEdgeSegment(
          group,
          materials,
          new THREE.Vector3(0, topY, z),
          "x",
          tier.width,
          DEFAULT_EDGE_LIGHT_DISTANCE,
          DEFAULT_EDGE_LIGHT_THICKNESS,
        );
      }
      for (const x of [-halfW, halfW]) {
        addEdgeSegment(
          group,
          materials,
          new THREE.Vector3(x, topY, 0),
          "z",
          tier.depth,
          DEFAULT_EDGE_LIGHT_DISTANCE,
          DEFAULT_EDGE_LIGHT_THICKNESS,
        );
      }
    }

    return group;
  }

  if (shape === "taipei" || shape === "residential") {
    const tiers = shape === "taipei"
      ? getTaipeiTierFootprints(width, depth, height)
      : getResidentialTierFootprints(width, depth, height);
    for (const tier of tiers) {
      const halfW = tier.width / 2;
      const halfD = tier.depth / 2;
      const segmentHeight = tier.topY - tier.bottomY;
      const centerY = tier.bottomY + segmentHeight / 2;
      const corners: Array<[number, number]> = [
        [-halfW, -halfD],
        [halfW, -halfD],
        [halfW, halfD],
        [-halfW, halfD],
      ];

      for (const [x, z] of corners) {
        addEdgeSegment(
          group,
          materials,
          new THREE.Vector3(x, centerY, z),
          "y",
          segmentHeight,
          DEFAULT_EDGE_LIGHT_DISTANCE,
          DEFAULT_EDGE_LIGHT_THICKNESS,
        );
      }

      const topY = tier.topY + TOP_LIFT;
      for (const z of [-halfD, halfD]) {
        addEdgeSegment(
          group,
          materials,
          new THREE.Vector3(0, topY, z),
          "x",
          tier.width,
          DEFAULT_EDGE_LIGHT_DISTANCE,
          DEFAULT_EDGE_LIGHT_THICKNESS,
        );
      }
      for (const x of [-halfW, halfW]) {
        addEdgeSegment(
          group,
          materials,
          new THREE.Vector3(x, topY, 0),
          "z",
          tier.depth,
          DEFAULT_EDGE_LIGHT_DISTANCE,
          DEFAULT_EDGE_LIGHT_THICKNESS,
        );
      }
    }

    return group;
  }

  if (shape === "one-trade") {
    const rings = getOneTradeLedFootprintRings(width, depth, height);
    const tmpDir = new THREE.Vector3();

    for (let corner = 0; corner < rings[0].points.length; corner++) {
      for (let ring = 0; ring < rings.length - 1; ring++) {
        const current = rings[ring];
        const next = rings[ring + 1];
        if (Math.abs(next.y - current.y) <= 1e-6) continue;

        const a = current.points[corner];
        const b = next.points[corner];
        const start = new THREE.Vector3(a.x, current.y, a.z);
        const end = new THREE.Vector3(b.x, next.y, b.z);
        tmpDir.subVectors(end, start);
        const len = tmpDir.length();
        if (len <= 1e-6) continue;
        tmpDir.divideScalar(len);

        addOrientedEdgeSegment(
          group,
          materials,
          new THREE.Vector3().copy(start).add(end).multiplyScalar(0.5),
          tmpDir.clone(),
          len,
          DEFAULT_EDGE_LIGHT_DISTANCE,
          DEFAULT_EDGE_LIGHT_THICKNESS,
        );
      }
    }

    for (const ring of [rings[1], rings[rings.length - 1]]) {
      const y = ring.y + TOP_LIFT;
      for (let i = 0; i < ring.points.length; i++) {
        const a = ring.points[i];
        const b = ring.points[(i + 1) % ring.points.length];
        const start = new THREE.Vector3(a.x, y, a.z);
        const end = new THREE.Vector3(b.x, y, b.z);
        tmpDir.subVectors(end, start);
        const len = tmpDir.length();
        if (len <= 1e-6) continue;
        tmpDir.divideScalar(len);

        addOrientedEdgeSegment(
          group,
          materials,
          new THREE.Vector3().copy(start).add(end).multiplyScalar(0.5),
          tmpDir.clone(),
          len,
          DEFAULT_EDGE_LIGHT_DISTANCE,
          DEFAULT_EDGE_LIGHT_THICKNESS,
        );
      }
    }

    return group;
  }

  if (shape === "hearst") {
    const rings = Array.from({ length: HEARST_RING_COUNT + 1 }, (_, ringIndex) => {
      const y = (ringIndex / HEARST_RING_COUNT) * height;
      return getHearstRingFootprintPoints(width, depth, ringIndex).map(
        ({ x, z }) => new THREE.Vector3(x, y, z),
      );
    });

    const tmpDir = new THREE.Vector3();
    for (let corner = 0; corner < rings[0].length; corner++) {
      for (let ring = 0; ring < HEARST_RING_COUNT; ring++) {
        const a = rings[ring][corner];
        const b = rings[ring + 1][corner];
        tmpDir.subVectors(b, a);
        const len = tmpDir.length();
        if (len <= 1e-6) continue;
        tmpDir.divideScalar(len);
        addOrientedEdgeSegment(
          group,
          materials,
          new THREE.Vector3().copy(a).add(b).multiplyScalar(0.5),
          tmpDir.clone(),
          len,
          DEFAULT_EDGE_LIGHT_DISTANCE,
          DEFAULT_EDGE_LIGHT_THICKNESS,
        );
      }
    }

    const top = rings[HEARST_RING_COUNT];
    const topLift = new THREE.Vector3(0, TOP_LIFT, 0);
    for (let i = 0; i < top.length; i++) {
      const a = new THREE.Vector3().copy(top[i]).add(topLift);
      const b = new THREE.Vector3().copy(top[(i + 1) % top.length]).add(topLift);
      tmpDir.subVectors(b, a);
      const len = tmpDir.length();
      if (len <= 1e-6) continue;
      tmpDir.divideScalar(len);
      addOrientedEdgeSegment(
        group,
        materials,
        new THREE.Vector3().copy(a).add(b).multiplyScalar(0.5),
        tmpDir.clone(),
        len,
        DEFAULT_EDGE_LIGHT_DISTANCE,
        DEFAULT_EDGE_LIGHT_THICKNESS,
      );
    }

    return group;
  }

  // Caminho default: arestas axis-aligned (mais leves — 1 mesh por aresta).
  const corners: Array<[number, number]> = [
    [-halfW, -halfD],
    [halfW, -halfD],
    [halfW, halfD],
    [-halfW, halfD],
  ];
  for (const [x, z] of corners) {
    addEdgeSegment(
      group,
      materials,
      new THREE.Vector3(x, height / 2, z),
      "y",
      height,
      DEFAULT_EDGE_LIGHT_DISTANCE,
      DEFAULT_EDGE_LIGHT_THICKNESS,
    );
  }

  // 4 arestas no topo (retângulo). Lift leve para não colidir com helipad/holofotes.
  const topY = height + TOP_LIFT;

  for (const z of [-halfD, halfD]) {
    addEdgeSegment(group, materials, new THREE.Vector3(0, topY, z), "x", width, DEFAULT_EDGE_LIGHT_DISTANCE, DEFAULT_EDGE_LIGHT_THICKNESS);
  }
  for (const x of [-halfW, halfW]) {
    addEdgeSegment(group, materials, new THREE.Vector3(x, topY, 0), "z", depth, DEFAULT_EDGE_LIGHT_DISTANCE, DEFAULT_EDGE_LIGHT_THICKNESS);
  }

  return group;
}

const FACTORIES: Record<Exclude<EdgeLightType, "none">, EdgeLightFactory> = {
  led: createLed,
};

/**
 * Cria um Group Three.js para o efeito de LED nas arestas do edifício.
 * O grupo deve ser posicionado na BASE do edifício (não no topo); local Y=0
 * corresponde ao chão, local Y=height ao topo.
 */
export function createEdgeLightMesh(
  type: EdgeLightType,
  footprint: EdgeLightFootprint,
  shape: BuildingShape = "default",
): THREE.Group | null {
  if (type === "none") return null;
  const factory = FACTORIES[type];
  const group = factory(footprint, shape);
  group.userData.edgeLightType = type;
  setEdgeLightMeshShadowEnabled(group, true);
  return group;
}



export function setEdgeLightMeshShadowEnabled(
  group: THREE.Group,
  enabled: boolean,
): void {
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = enabled && child.userData.edgeLightCastsShadow === true;
      child.receiveShadow = enabled && child.userData.edgeLightReceivesShadow === true;
    }
  });
}

/**
 * Libera materiais clonados deste grupo. Geometrias são compartilhadas no módulo.
 */
export function disposeEdgeLightMesh(group: THREE.Group): void {
  const materials = group.userData.edgeLightMaterials as EdgeMaterials | undefined;
  if (materials) {
    materials.core.dispose();
    materials.halo.dispose();
    materials.haloOuter.dispose();
  }
  group.clear();
}

/** Descarta recursos compartilhados. Chamar apenas no dispose final do manager. */
export function disposeEdgeLightSharedResources(): void {
  for (const geometry of SHARED_EDGE_LIGHT_GEOMETRIES) {
    geometry.dispose();
  }
}
