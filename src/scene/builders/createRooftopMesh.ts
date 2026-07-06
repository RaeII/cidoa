import * as THREE from "three";
import type { RooftopType } from "../types";

type RooftopFootprint = {
  width: number;
  depth: number;
};

type RooftopFactory = (footprint?: RooftopFootprint) => THREE.Group;
type WindowPanelCorners = [
  [number, number, number],
  [number, number, number],
  [number, number, number],
  [number, number, number],
];

const SPOTLIGHT_SCALE = 0.75;
const SPOTLIGHT_LENS_RADIUS = 0.04 * SPOTLIGHT_SCALE;
const SPOTLIGHT_BEAM_HEIGHT = 10.0;

const HELIPAD_DECK_HEIGHT = 0.035;
const HELIPAD_ROOF_CLEARANCE = 0.006;
const HELIPAD_PAINT_THICKNESS = 0.004;
const GARDEN_ROOF_CLEARANCE = 0.008;
const GARDEN_DECK_HEIGHT = 0.045;
const GARDEN_SOIL_HEIGHT = 0.026;
const GARDEN_PLANTER_HEIGHT = 0.11;
const GARDEN_PLANTER_WIDTH = 0.09;
const GARDEN_RAIL_HEIGHT = 0.2;
const GARDEN_TREE_COUNT = 4;
const GARDEN_BRANCHES_PER_TREE = 5;
const GARDEN_LEAF_CARDS_PER_TREE = 15;
const HELICOPTER_ROOF_CLEARANCE = 0.04;
const HELICOPTER_SKID_RADIUS = 0.012;
const HELICOPTER_MAST_RADIUS = 0.014;
const HELICOPTER_MAST_HEIGHT = 0.09;

const SPOTLIGHT_HOUSING_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0x222222,
  roughness: 0.4,
  metalness: 0.6,
});

const SPOTLIGHT_LENS_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0xffffcc,
  emissive: new THREE.Color(0xffffaa),
  emissiveIntensity: 2.5,
  roughness: 0.1,
  metalness: 0.0,
});

const SPOTLIGHT_BEAM_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0xffffdd,
  emissive: new THREE.Color(0xffffaa),
  emissiveIntensity: 1.25,
  transparent: true,
  vertexColors: true,
  side: THREE.DoubleSide,
  depthWrite: false,
});

const SPOTLIGHT_BASE_GEOMETRY = new THREE.CylinderGeometry(
  0.06 * SPOTLIGHT_SCALE,
  0.08 * SPOTLIGHT_SCALE,
  0.05 * SPOTLIGHT_SCALE,
  8,
);
const SPOTLIGHT_HOUSING_GEOMETRY = new THREE.CylinderGeometry(
  0.04 * SPOTLIGHT_SCALE,
  0.07 * SPOTLIGHT_SCALE,
  0.12 * SPOTLIGHT_SCALE,
  8,
);
const SPOTLIGHT_LENS_GEOMETRY = new THREE.CircleGeometry(SPOTLIGHT_LENS_RADIUS, 12);

const HELIPAD_DECK_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0x2f3436,
  roughness: 0.88,
  metalness: 0.04,
});

const HELIPAD_RIM_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0x3f4548,
  roughness: 0.62,
  metalness: 0.42,
});

const HELIPAD_PAINT_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0xe8edf1,
  roughness: 0.78,
  metalness: 0.0,
});

const HELIPAD_LIGHT_BASE_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0x151719,
  roughness: 0.42,
  metalness: 0.65,
});

const HELIPAD_GREEN_LENS_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0xbfffee,
  emissive: new THREE.Color(0x36ffc6),
  emissiveIntensity: 1.6,
  roughness: 0.18,
  metalness: 0.0,
});

const HELIPAD_UTILITY_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0x596166,
  roughness: 0.72,
  metalness: 0.38,
});

const GARDEN_DECK_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0x3f4240,
  roughness: 0.82,
  metalness: 0.04,
});

const GARDEN_POOL_COPING_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0xc3b79d,
  roughness: 0.86,
  metalness: 0.0,
});

const GARDEN_POOL_TILE_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0x7fb2c8,
  roughness: 0.58,
  metalness: 0.0,
});

const GARDEN_PLANTER_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0x59534a,
  roughness: 0.78,
  metalness: 0.08,
});

const GARDEN_SOIL_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0x24170f,
  roughness: 0.96,
  metalness: 0.0,
});

const GARDEN_GRASS_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0x4f6840,
  roughness: 0.98,
  metalness: 0.0,
});

const GARDEN_LEAF_CARD_MATERIAL = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  alphaTest: 0.08,
  side: THREE.DoubleSide,
  depthWrite: false,
});

const GARDEN_LEAF_DARK_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0x1f5d32,
  roughness: 0.86,
  metalness: 0.0,
});

const GARDEN_LEAF_LIGHT_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0x5d9b55,
  roughness: 0.88,
  metalness: 0.0,
});

const GARDEN_TRUNK_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0x6a4630,
  roughness: 0.82,
  metalness: 0.0,
});

const GARDEN_WOOD_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0x76583a,
  roughness: 0.78,
  metalness: 0.05,
});

// Standard em vez de Physical: transmission > 0 dispara um render extra da cena
// inteira (transmission pass) — custo altíssimo pra uma piscina de topo.
const GARDEN_WATER_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0x5fb7d5,
  roughness: 0.03,
  metalness: 0.0,
  transparent: true,
  opacity: 0.62,
  envMapIntensity: 0.9,
});

const GARDEN_POOL_CAUSTIC_MATERIAL = new THREE.MeshBasicMaterial({
  color: 0xcdf8ff,
  transparent: true,
  opacity: 0.28,
  depthWrite: false,
});

const GARDEN_WARM_LIGHT_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0xffdd99,
  emissive: new THREE.Color(0xffb64d),
  emissiveIntensity: 1.35,
  roughness: 0.24,
  metalness: 0.0,
});

const HELICOPTER_BODY_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0x1f272c,
  roughness: 0.44,
  metalness: 0.46,
});

// Standard em vez de Physical (mesmo motivo da água do jardim: transmission
// dispara render extra da cena; clearcoat dobra o shading). Vidro fake com
// transparência + envMap fica visualmente equivalente nesse tamanho.
const HELICOPTER_CABIN_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0x8fb7c9,
  roughness: 0.04,
  metalness: 0.0,
  transparent: true,
  side: THREE.DoubleSide,
  opacity: 0.62,
  envMapIntensity: 0.85,
});

const HELICOPTER_WINDOW_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0x203843,
  roughness: 0.18,
  metalness: 0.0,
  transparent: true,
  side: THREE.DoubleSide,
  depthWrite: false,
  opacity: 0.9,
  polygonOffset: true,
  polygonOffsetFactor: -1,
  polygonOffsetUnits: -1,
});

const HELICOPTER_TRIM_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0xc7d0d3,
  roughness: 0.36,
  metalness: 0.42,
});

const HELICOPTER_ROTOR_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0x111416,
  roughness: 0.38,
  metalness: 0.72,
});

const HELICOPTER_ROTOR_BLUR_MATERIAL = new THREE.MeshBasicMaterial({
  color: 0xdde8ee,
  transparent: true,
  opacity: 0.11,
  side: THREE.DoubleSide,
  depthWrite: false,
});

const HELICOPTER_SKID_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0x4e565b,
  roughness: 0.42,
  metalness: 0.74,
});

const HELICOPTER_NAV_LIGHT_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0xffe7c2,
  emissive: new THREE.Color(0xffaa44),
  emissiveIntensity: 1.25,
  roughness: 0.18,
  metalness: 0.0,
});

// 32 segmentos bastam para o raio pequeno do helipad (96 era imperceptível e 3× o custo).
const HELIPAD_DECK_GEOMETRY = new THREE.CylinderGeometry(
  1,
  1,
  HELIPAD_DECK_HEIGHT,
  32,
  1,
  false,
);
const HELIPAD_RIM_GEOMETRY = new THREE.TorusGeometry(1, 0.016, 8, 32);
const HELIPAD_OUTER_RING_GEOMETRY = new THREE.RingGeometry(0.78, 0.9, 32);
const HELIPAD_STRIP_GEOMETRY = new THREE.BoxGeometry(1, HELIPAD_PAINT_THICKNESS, 1);
const HELIPAD_LIGHT_BASE_GEOMETRY = new THREE.CylinderGeometry(1, 1, 0.018, 12);
const HELIPAD_LIGHT_LENS_GEOMETRY = new THREE.CylinderGeometry(1, 1, 0.012, 12);
const HELIPAD_UTILITY_GEOMETRY = new THREE.BoxGeometry(1, 1, 1);
const GARDEN_BOX_GEOMETRY = new THREE.BoxGeometry(1, 1, 1);
const GARDEN_TRUNK_GEOMETRY = new THREE.CylinderGeometry(0.56, 1, 1, 7);
const GARDEN_BRANCH_GEOMETRY = new THREE.CylinderGeometry(0.35, 1, 1, 6);
const GARDEN_LEAF_CARD_GEOMETRY = new THREE.PlaneGeometry(1, 1);
const GARDEN_SHRUB_GEOMETRY = new THREE.SphereGeometry(1, 8, 6);
const GARDEN_LIGHT_GEOMETRY = new THREE.SphereGeometry(1, 8, 5);
const HELICOPTER_BODY_GEOMETRY = new THREE.SphereGeometry(0.5, 16, 8);
const HELICOPTER_CABIN_GEOMETRY = createHelicopterCabinHullGeometry();
const HELICOPTER_RIGHT_WINDSHIELD_GEOMETRY = createWindowPanelGeometry([
  [0.51, -0.14, 0.035],
  [0.48, -0.12, 0.18],
  [0.28, 0.24, 0.3],
  [0.32, 0.28, 0.08],
]);
const HELICOPTER_LEFT_WINDSHIELD_GEOMETRY = createWindowPanelGeometry([
  [0.48, -0.12, -0.18],
  [0.51, -0.14, -0.035],
  [0.32, 0.28, -0.08],
  [0.28, 0.24, -0.3],
]);
const HELICOPTER_RIGHT_SIDE_WINDOW_GEOMETRY = createWindowPanelGeometry([
  [-0.18, -0.08, 0.505],
  [0.16, -0.1, 0.49],
  [0.12, 0.27, 0.47],
  [-0.2, 0.32, 0.495],
]);
const HELICOPTER_RIGHT_REAR_WINDOW_GEOMETRY = createWindowPanelGeometry([
  [-0.42, -0.1, 0.43],
  [-0.24, -0.08, 0.5],
  [-0.24, 0.27, 0.48],
  [-0.42, 0.2, 0.41],
]);
const HELICOPTER_LEFT_SIDE_WINDOW_GEOMETRY = createWindowPanelGeometry([
  [0.16, -0.1, -0.49],
  [-0.18, -0.08, -0.505],
  [-0.2, 0.32, -0.495],
  [0.12, 0.27, -0.47],
]);
const HELICOPTER_LEFT_REAR_WINDOW_GEOMETRY = createWindowPanelGeometry([
  [-0.24, -0.08, -0.5],
  [-0.42, -0.1, -0.43],
  [-0.42, 0.2, -0.41],
  [-0.24, 0.27, -0.48],
]);
const HELICOPTER_BOX_GEOMETRY = new THREE.BoxGeometry(1, 1, 1);
const HELICOPTER_SKID_GEOMETRY = new THREE.CylinderGeometry(1, 1, 1, 8);
const HELICOPTER_TAIL_BOOM_GEOMETRY = new THREE.CylinderGeometry(0.42, 1, 1, 10);
const HELICOPTER_MAST_GEOMETRY = new THREE.CylinderGeometry(1, 1, 1, 10);
const HELICOPTER_LIGHT_GEOMETRY = new THREE.SphereGeometry(1, 8, 5);
const HELICOPTER_ROTOR_DISC_GEOMETRY = new THREE.CircleGeometry(1, 24);
let gardenGrassTexture: THREE.CanvasTexture | null = null;
let gardenWoodTexture: THREE.CanvasTexture | null = null;
let gardenPoolTileTexture: THREE.CanvasTexture | null = null;
let gardenPoolWaterNormalTexture: THREE.CanvasTexture | null = null;
let gardenPoolCausticTexture: THREE.CanvasTexture | null = null;
let gardenLeafCardTexture: THREE.CanvasTexture | null = null;

/** Cria um feixe com alpha gradiente via vertex colors (opaco na fonte, transparente no topo). */
function createBeamGeometry(
  sourceRadius: number,
  endRadius: number,
  height: number,
  segments: number,
): THREE.CylinderGeometry {
  const geo = new THREE.CylinderGeometry(
    sourceRadius,
    endRadius,
    height,
    segments,
    4,
    true,
  );
  const pos = geo.attributes.position;
  const count = pos.count;
  const colors = new Float32Array(count * 4);

  // Após rotation.x = PI, Y mais alto fica embaixo (fonte) e Y mais baixo fica em cima.
  const halfH = height / 2;
  for (let i = 0; i < count; i++) {
    const y = pos.getY(i);
    const t = (y + halfH) / height;
    const alpha = t * t * 0.18;
    colors[i * 4] = 1;
    colors[i * 4 + 1] = 1;
    colors[i * 4 + 2] = 0.9;
    colors[i * 4 + 3] = alpha;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 4));
  return geo;
}

function createWindowPanelGeometry(
  corners: WindowPanelCorners,
): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(corners.flat(), 3),
  );
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.computeVertexNormals();
  return geometry;
}

function createHelicopterCabinHullGeometry(): THREE.BufferGeometry {
  const sections = [
    { x: -0.5, y: -0.06, ry: 0.3, rz: 0.42 },
    { x: -0.25, y: 0.01, ry: 0.48, rz: 0.5 },
    { x: 0.1, y: 0.02, ry: 0.5, rz: 0.48 },
    { x: 0.35, y: -0.09, ry: 0.3, rz: 0.34 },
    { x: 0.5, y: -0.2, ry: 0.12, rz: 0.18 },
  ];
  const radialSegments = 12;
  const positions: number[] = [];
  const indices: number[] = [];

  for (const section of sections) {
    for (let segment = 0; segment < radialSegments; segment++) {
      const angle = (segment / radialSegments) * Math.PI * 2;
      const sin = Math.sin(angle);
      const cos = Math.cos(angle);
      const bottomCompression = sin < 0 ? 0.46 : 1;
      const sideCompression = Math.abs(cos) > 0.72 ? 0.9 : 1;
      const flattenedBelly = sin < -0.72 ? -0.055 : 0;
      positions.push(
        section.x,
        section.y + sin * section.ry * bottomCompression + flattenedBelly,
        cos * section.rz * sideCompression,
      );
    }
  }

  for (let section = 0; section < sections.length - 1; section++) {
    const current = section * radialSegments;
    const next = (section + 1) * radialSegments;

    for (let segment = 0; segment < radialSegments; segment++) {
      const a = current + segment;
      const b = current + ((segment + 1) % radialSegments);
      const c = next + segment;
      const d = next + ((segment + 1) % radialSegments);
      indices.push(a, c, b, b, c, d);
    }
  }

  const rearCenterIndex = positions.length / 3;
  positions.push(sections[0].x, sections[0].y, 0);
  for (let segment = 0; segment < radialSegments; segment++) {
    indices.push(rearCenterIndex, segment, (segment + 1) % radialSegments);
  }

  const frontCenterIndex = positions.length / 3;
  const frontOffset = (sections.length - 1) * radialSegments;
  const front = sections[sections.length - 1];
  positions.push(front.x, front.y, 0);
  for (let segment = 0; segment < radialSegments; segment++) {
    indices.push(
      frontCenterIndex,
      frontOffset + ((segment + 1) % radialSegments),
      frontOffset + segment,
    );
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

const SPOTLIGHT_BEAM_GEOMETRY = createBeamGeometry(
  SPOTLIGHT_LENS_RADIUS,
  0.22,
  SPOTLIGHT_BEAM_HEIGHT,
  16,
);

const SHARED_ROOFTOP_GEOMETRIES: THREE.BufferGeometry[] = [
  SPOTLIGHT_BASE_GEOMETRY,
  SPOTLIGHT_HOUSING_GEOMETRY,
  SPOTLIGHT_LENS_GEOMETRY,
  SPOTLIGHT_BEAM_GEOMETRY,
  HELIPAD_DECK_GEOMETRY,
  HELIPAD_RIM_GEOMETRY,
  HELIPAD_OUTER_RING_GEOMETRY,
  HELIPAD_STRIP_GEOMETRY,
  HELIPAD_LIGHT_BASE_GEOMETRY,
  HELIPAD_LIGHT_LENS_GEOMETRY,
  HELIPAD_UTILITY_GEOMETRY,
  GARDEN_BOX_GEOMETRY,
  GARDEN_TRUNK_GEOMETRY,
  GARDEN_BRANCH_GEOMETRY,
  GARDEN_LEAF_CARD_GEOMETRY,
  GARDEN_SHRUB_GEOMETRY,
  GARDEN_LIGHT_GEOMETRY,
  HELICOPTER_BODY_GEOMETRY,
  HELICOPTER_CABIN_GEOMETRY,
  HELICOPTER_RIGHT_WINDSHIELD_GEOMETRY,
  HELICOPTER_LEFT_WINDSHIELD_GEOMETRY,
  HELICOPTER_RIGHT_SIDE_WINDOW_GEOMETRY,
  HELICOPTER_RIGHT_REAR_WINDOW_GEOMETRY,
  HELICOPTER_LEFT_SIDE_WINDOW_GEOMETRY,
  HELICOPTER_LEFT_REAR_WINDOW_GEOMETRY,
  HELICOPTER_BOX_GEOMETRY,
  HELICOPTER_SKID_GEOMETRY,
  HELICOPTER_TAIL_BOOM_GEOMETRY,
  HELICOPTER_MAST_GEOMETRY,
  HELICOPTER_LIGHT_GEOMETRY,
  HELICOPTER_ROTOR_DISC_GEOMETRY,
];

const SHARED_ROOFTOP_MATERIALS: THREE.Material[] = [
  SPOTLIGHT_HOUSING_MATERIAL,
  SPOTLIGHT_LENS_MATERIAL,
  SPOTLIGHT_BEAM_MATERIAL,
  HELIPAD_DECK_MATERIAL,
  HELIPAD_RIM_MATERIAL,
  HELIPAD_PAINT_MATERIAL,
  HELIPAD_LIGHT_BASE_MATERIAL,
  HELIPAD_GREEN_LENS_MATERIAL,
  HELIPAD_UTILITY_MATERIAL,
  GARDEN_DECK_MATERIAL,
  GARDEN_POOL_COPING_MATERIAL,
  GARDEN_POOL_TILE_MATERIAL,
  GARDEN_PLANTER_MATERIAL,
  GARDEN_SOIL_MATERIAL,
  GARDEN_GRASS_MATERIAL,
  GARDEN_LEAF_CARD_MATERIAL,
  GARDEN_LEAF_DARK_MATERIAL,
  GARDEN_LEAF_LIGHT_MATERIAL,
  GARDEN_TRUNK_MATERIAL,
  GARDEN_WOOD_MATERIAL,
  GARDEN_WATER_MATERIAL,
  GARDEN_POOL_CAUSTIC_MATERIAL,
  GARDEN_WARM_LIGHT_MATERIAL,
  HELICOPTER_BODY_MATERIAL,
  HELICOPTER_CABIN_MATERIAL,
  HELICOPTER_WINDOW_MATERIAL,
  HELICOPTER_TRIM_MATERIAL,
  HELICOPTER_ROTOR_MATERIAL,
  HELICOPTER_ROTOR_BLUR_MATERIAL,
  HELICOPTER_SKID_MATERIAL,
  HELICOPTER_NAV_LIGHT_MATERIAL,
];

function setShadowRole(
  mesh: THREE.Mesh,
  castsShadow: boolean,
  receivesShadow: boolean,
): void {
  mesh.userData.rooftopCastsShadow = castsShadow;
  mesh.userData.rooftopReceivesShadow = receivesShadow;
}

function configureGardenTexture(
  texture: THREE.CanvasTexture,
  repeatX: number,
  repeatY: number,
): THREE.CanvasTexture {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = 2;
  texture.needsUpdate = true;
  return texture;
}

function configureGardenNormalTexture(
  texture: THREE.CanvasTexture,
  repeatX: number,
  repeatY: number,
): THREE.CanvasTexture {
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = 2;
  texture.needsUpdate = true;
  return texture;
}

function getGardenGrassMaterial(): THREE.MeshStandardMaterial {
  if (!gardenGrassTexture) {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");

    if (ctx) {
      ctx.fillStyle = "#536b42";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < 520; i++) {
        const x = (i * 37) % 128;
        const y = (i * 61) % 128;
        const length = 5 + (i % 7);
        const lean = ((i % 9) - 4) * 0.35;
        ctx.strokeStyle = i % 5 === 0
          ? "rgba(105, 131, 74, 0.62)"
          : i % 3 === 0
            ? "rgba(47, 79, 38, 0.56)"
            : "rgba(72, 105, 55, 0.5)";
        ctx.lineWidth = i % 11 === 0 ? 1.4 : 0.75;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + lean, y - length);
        ctx.stroke();
      }

      for (let i = 0; i < 90; i++) {
        const x = (i * 53) % 128;
        const y = (i * 29) % 128;
        ctx.fillStyle = i % 2 === 0
          ? "rgba(36, 62, 31, 0.22)"
          : "rgba(130, 143, 91, 0.2)";
        ctx.fillRect(x, y, 1.5, 1.5);
      }
    }

    gardenGrassTexture = configureGardenTexture(new THREE.CanvasTexture(canvas), 4, 4);
  }

  GARDEN_GRASS_MATERIAL.map = gardenGrassTexture;
  GARDEN_GRASS_MATERIAL.needsUpdate = true;
  return GARDEN_GRASS_MATERIAL;
}

function getGardenWoodMaterial(): THREE.MeshStandardMaterial {
  if (!gardenWoodTexture) {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");

    if (ctx) {
      const base = ctx.createLinearGradient(0, 0, 128, 0);
      base.addColorStop(0, "#6b4e31");
      base.addColorStop(0.42, "#8a6844");
      base.addColorStop(1, "#5b3f27");
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < 34; i++) {
        const y = (i * 11) % 128;
        const offset = (i % 5) * 6;
        ctx.strokeStyle = i % 3 === 0
          ? "rgba(45, 29, 17, 0.42)"
          : "rgba(151, 112, 70, 0.36)";
        ctx.lineWidth = i % 4 === 0 ? 2.1 : 1.1;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(32, y + offset - 12, 76, y - offset + 10, 128, y + (i % 7) - 3);
        ctx.stroke();
      }

      for (let i = 0; i < 4; i++) {
        const x = 24 + i * 27;
        const y = 24 + ((i * 31) % 74);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate((i - 1.5) * 0.34);
        ctx.strokeStyle = "rgba(48, 31, 18, 0.5)";
        ctx.fillStyle = "rgba(84, 54, 31, 0.24)";
        ctx.beginPath();
        ctx.ellipse(0, 0, 13, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(0, 0, 6, 2.2, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    gardenWoodTexture = configureGardenTexture(new THREE.CanvasTexture(canvas), 2.8, 1.4);
  }

  GARDEN_WOOD_MATERIAL.map = gardenWoodTexture;
  GARDEN_WOOD_MATERIAL.needsUpdate = true;
  return GARDEN_WOOD_MATERIAL;
}

function getGardenPoolTileMaterial(): THREE.MeshStandardMaterial {
  if (!gardenPoolTileTexture) {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");

    if (ctx) {
      ctx.fillStyle = "#76abc3";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let y = 0; y <= 128; y += 16) {
        ctx.strokeStyle = "rgba(219, 245, 250, 0.58)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(128, y + 0.5);
        ctx.stroke();
      }

      for (let x = 0; x <= 128; x += 16) {
        ctx.strokeStyle = "rgba(38, 112, 138, 0.34)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, 128);
        ctx.stroke();
      }

      for (let i = 0; i < 80; i++) {
        const x = (i * 43) % 128;
        const y = (i * 71) % 128;
        ctx.fillStyle = i % 2 === 0
          ? "rgba(255, 255, 255, 0.14)"
          : "rgba(42, 116, 145, 0.12)";
        ctx.fillRect(x, y, 2, 2);
      }
    }

    gardenPoolTileTexture = configureGardenTexture(new THREE.CanvasTexture(canvas), 3, 2);
  }

  GARDEN_POOL_TILE_MATERIAL.map = gardenPoolTileTexture;
  GARDEN_POOL_TILE_MATERIAL.needsUpdate = true;
  return GARDEN_POOL_TILE_MATERIAL;
}

function getGardenPoolWaterMaterial(): THREE.MeshStandardMaterial {
  if (!gardenPoolWaterNormalTexture) {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");

    if (ctx) {
      ctx.fillStyle = "rgb(128, 128, 255)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < 36; i++) {
        const y = (i * 17) % 128;
        ctx.strokeStyle = i % 2 === 0
          ? "rgba(103, 146, 255, 0.72)"
          : "rgba(154, 118, 255, 0.5)";
        ctx.lineWidth = i % 3 === 0 ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(32, y - 10, 70, y + 12, 128, y - 4);
        ctx.stroke();
      }
    }

    gardenPoolWaterNormalTexture = configureGardenNormalTexture(
      new THREE.CanvasTexture(canvas),
      2.5,
      2,
    );
  }

  GARDEN_WATER_MATERIAL.normalMap = gardenPoolWaterNormalTexture;
  GARDEN_WATER_MATERIAL.normalScale.set(0.18, 0.18);
  GARDEN_WATER_MATERIAL.needsUpdate = true;
  return GARDEN_WATER_MATERIAL;
}

function getGardenPoolCausticMaterial(): THREE.MeshBasicMaterial {
  if (!gardenPoolCausticTexture) {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");

    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "rgba(235, 255, 255, 0.62)";
      ctx.lineWidth = 2;

      for (let i = 0; i < 18; i++) {
        const x = (i * 31) % 128;
        const y = (i * 47) % 128;
        ctx.beginPath();
        ctx.moveTo(x - 28, y);
        ctx.bezierCurveTo(x - 10, y - 13, x + 18, y + 15, x + 42, y - 5);
        ctx.stroke();
      }
    }

    gardenPoolCausticTexture = configureGardenTexture(new THREE.CanvasTexture(canvas), 2, 1.4);
  }

  GARDEN_POOL_CAUSTIC_MATERIAL.map = gardenPoolCausticTexture;
  GARDEN_POOL_CAUSTIC_MATERIAL.needsUpdate = true;
  return GARDEN_POOL_CAUSTIC_MATERIAL;
}

function getGardenLeafCardMaterial(): THREE.MeshBasicMaterial {
  if (!gardenLeafCardTexture) {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");

    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = "source-over";

      const leaves = [
        [36, 42, 26, 13, -0.65, "#245f34"],
        [62, 36, 31, 14, 0.25, "#367a40"],
        [88, 45, 26, 12, 0.72, "#5a914e"],
        [45, 67, 34, 15, 0.62, "#2f743b"],
        [76, 68, 36, 16, -0.38, "#6a9f58"],
        [56, 91, 29, 13, -0.85, "#225a32"],
        [92, 91, 25, 12, 0.45, "#4f8845"],
        [28, 88, 22, 10, 0.18, "#5f9952"],
      ] as const;

      for (const [x, y, rx, ry, rotation, color] of leaves) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(18, 54, 27, 0.34)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-rx * 0.55, 0);
        ctx.lineTo(rx * 0.62, 0);
        ctx.stroke();
        ctx.restore();
      }
    }

    gardenLeafCardTexture = new THREE.CanvasTexture(canvas);
    gardenLeafCardTexture.colorSpace = THREE.SRGBColorSpace;
    gardenLeafCardTexture.needsUpdate = true;
  }

  GARDEN_LEAF_CARD_MATERIAL.map = gardenLeafCardTexture;
  GARDEN_LEAF_CARD_MATERIAL.needsUpdate = true;
  return GARDEN_LEAF_CARD_MATERIAL;
}

function setCylinderBetween(
  mesh: THREE.InstancedMesh,
  index: number,
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
  dummy: THREE.Object3D,
): void {
  const direction = end.clone().sub(start);
  const length = direction.length();
  if (length <= 0.001) return;

  dummy.position.copy(start).add(end).multiplyScalar(0.5);
  dummy.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.multiplyScalar(1 / length),
  );
  dummy.scale.set(radius, length, radius);
  dummy.updateMatrix();
  mesh.setMatrixAt(index, dummy.matrix);
}

function createSpotlights(): THREE.Group {
  const group = new THREE.Group();

  // 4 holofotes, um em cada canto do edifício
  const corners: [number, number][] = [
    [-0.35, -0.35],
    [0.35, -0.35],
    [-0.35, 0.35],
    [0.35, 0.35],
  ];

  for (const [cx, cz] of corners) {
    const spot = new THREE.Group();

    // Base cilíndrica
    const base = new THREE.Mesh(
      SPOTLIGHT_BASE_GEOMETRY,
      SPOTLIGHT_HOUSING_MATERIAL,
    );
    base.position.y = 0.025 * SPOTLIGHT_SCALE;
    setShadowRole(base, true, true);
    spot.add(base);

    // Corpo do holofote (cilindro cônico apontando para cima)
    const housing = new THREE.Mesh(
      SPOTLIGHT_HOUSING_GEOMETRY,
      SPOTLIGHT_HOUSING_MATERIAL,
    );
    housing.position.y = 0.11 * SPOTLIGHT_SCALE;
    setShadowRole(housing, true, true);
    spot.add(housing);

    // Lente emissiva no topo do holofote
    const lens = new THREE.Mesh(
      SPOTLIGHT_LENS_GEOMETRY,
      SPOTLIGHT_LENS_MATERIAL,
    );
    lens.rotation.x = -Math.PI / 2;
    lens.position.y = 0.17 * SPOTLIGHT_SCALE;
    setShadowRole(lens, false, false);
    spot.add(lens);

    // Feixe de luz com fade gradual (opaco na fonte, transparente no topo)
    const beam = new THREE.Mesh(SPOTLIGHT_BEAM_GEOMETRY, SPOTLIGHT_BEAM_MATERIAL);
    beam.rotation.x = Math.PI;
    beam.position.y = lens.position.y + SPOTLIGHT_BEAM_HEIGHT / 2;
    setShadowRole(beam, false, false);
    spot.add(beam);

    spot.position.set(cx, 0, cz);
    group.add(spot);
  }

  return group;
}

function createHelipad(footprint?: RooftopFootprint): THREE.Group {
  const group = new THREE.Group();
  const width = Math.max(1, footprint?.width ?? 1);
  const depth = Math.max(1, footprint?.depth ?? 1);
  const radius = THREE.MathUtils.clamp(Math.min(width, depth) * 0.34, 0.34, 0.88);
  const deckTopY = HELIPAD_ROOF_CLEARANCE + HELIPAD_DECK_HEIGHT;
  const paintY = deckTopY + HELIPAD_PAINT_THICKNESS / 2 + 0.001;

  const deck = new THREE.Mesh(HELIPAD_DECK_GEOMETRY, HELIPAD_DECK_MATERIAL);
  deck.scale.set(radius, 1, radius);
  deck.position.y = HELIPAD_ROOF_CLEARANCE + HELIPAD_DECK_HEIGHT / 2;
  setShadowRole(deck, true, true);
  group.add(deck);

  const rim = new THREE.Mesh(HELIPAD_RIM_GEOMETRY, HELIPAD_RIM_MATERIAL);
  rim.rotation.x = Math.PI / 2;
  rim.scale.set(radius, radius, radius);
  rim.position.y = deckTopY + 0.006;
  setShadowRole(rim, true, true);
  group.add(rim);

  const outerRing = new THREE.Mesh(HELIPAD_OUTER_RING_GEOMETRY, HELIPAD_PAINT_MATERIAL);
  outerRing.rotation.x = -Math.PI / 2;
  outerRing.scale.set(radius, radius, 1);
  outerRing.position.y = paintY;
  setShadowRole(outerRing, false, true);
  group.add(outerRing);

  const addPaintStrip = (
    widthScale: number,
    depthScale: number,
    x: number,
    z: number,
  ) => {
    const strip = new THREE.Mesh(HELIPAD_STRIP_GEOMETRY, HELIPAD_PAINT_MATERIAL);
    strip.scale.set(widthScale, 1, depthScale);
    strip.position.set(x, paintY + 0.002, z);
    setShadowRole(strip, false, true);
    group.add(strip);
  };

  const hBarWidth = radius * 0.16;
  const hBarLength = radius * 0.92;
  const hBarOffset = radius * 0.24;
  addPaintStrip(hBarWidth, hBarLength, -hBarOffset, 0);
  addPaintStrip(hBarWidth, hBarLength, hBarOffset, 0);
  addPaintStrip(hBarOffset * 2 + hBarWidth, hBarWidth, 0, 0);

  // Luzes de borda instanciadas: 2 draw calls (base + lente) em vez de 24 meshes.
  const lightCount = 12;
  const lightBaseRadius = THREE.MathUtils.clamp(radius * 0.035, 0.012, 0.026);
  const lightBases = new THREE.InstancedMesh(
    HELIPAD_LIGHT_BASE_GEOMETRY,
    HELIPAD_LIGHT_BASE_MATERIAL,
    lightCount,
  );
  const lightLenses = new THREE.InstancedMesh(
    HELIPAD_LIGHT_LENS_GEOMETRY,
    HELIPAD_GREEN_LENS_MATERIAL,
    lightCount,
  );
  const lightMatrix = new THREE.Matrix4();
  const lightQuat = new THREE.Quaternion();
  const lightPos = new THREE.Vector3();
  const lightScale = new THREE.Vector3();
  for (let i = 0; i < lightCount; i++) {
    const angle = (i / lightCount) * Math.PI * 2;
    const x = Math.cos(angle) * radius * 0.97;
    const z = Math.sin(angle) * radius * 0.97;

    lightPos.set(x, deckTopY + 0.009, z);
    lightScale.set(lightBaseRadius, 1, lightBaseRadius);
    lightMatrix.compose(lightPos, lightQuat, lightScale);
    lightBases.setMatrixAt(i, lightMatrix);

    lightPos.set(x, deckTopY + 0.024, z);
    lightScale.set(lightBaseRadius * 0.72, 1, lightBaseRadius * 0.72);
    lightMatrix.compose(lightPos, lightQuat, lightScale);
    lightLenses.setMatrixAt(i, lightMatrix);
  }
  lightBases.computeBoundingSphere();
  lightLenses.computeBoundingSphere();
  group.add(lightBases);
  group.add(lightLenses);

  const hatchHeight = 0.035;
  const hatch = new THREE.Mesh(HELIPAD_UTILITY_GEOMETRY, HELIPAD_UTILITY_MATERIAL);
  hatch.scale.set(radius * 0.34, hatchHeight, radius * 0.2);
  hatch.position.set(-radius * 0.42, HELIPAD_ROOF_CLEARANCE + hatchHeight / 2, radius * 1.18);
  setShadowRole(hatch, true, true);
  group.add(hatch);

  group.userData.helipadRadius = radius;
  return group;
}

function createGarden(footprint?: RooftopFootprint): THREE.Group {
  const group = new THREE.Group();
  const width = Math.max(1, footprint?.width ?? 1);
  const depth = Math.max(1, footprint?.depth ?? 1);
  const gardenW = THREE.MathUtils.clamp(width * 0.82, 0.72, 1.9);
  const gardenD = THREE.MathUtils.clamp(depth * 0.82, 0.72, 1.9);
  const deckTopY = GARDEN_ROOF_CLEARANCE + GARDEN_DECK_HEIGHT;
  const surfaceY = deckTopY + 0.004;
  const innerW = Math.max(0.38, gardenW - GARDEN_PLANTER_WIDTH * 2.4);
  const innerD = Math.max(0.38, gardenD - GARDEN_PLANTER_WIDTH * 2.4);

  const addBox = (
    material: THREE.Material,
    scale: [number, number, number],
    position: [number, number, number],
    castsShadow = true,
    receivesShadow = true,
  ) => {
    const mesh = new THREE.Mesh(GARDEN_BOX_GEOMETRY, material);
    mesh.scale.set(scale[0], scale[1], scale[2]);
    mesh.position.set(position[0], position[1], position[2]);
    setShadowRole(mesh, castsShadow, receivesShadow);
    group.add(mesh);
    return mesh;
  };

  addBox(
    GARDEN_DECK_MATERIAL,
    [gardenW, GARDEN_DECK_HEIGHT, gardenD],
    [0, GARDEN_ROOF_CLEARANCE + GARDEN_DECK_HEIGHT / 2, 0],
  );

  addBox(
    getGardenGrassMaterial(),
    [innerW, 0.01, innerD],
    [0, surfaceY + 0.002, 0],
    false,
    true,
  );

  const planterY = deckTopY + GARDEN_PLANTER_HEIGHT / 2;
  const soilY = deckTopY + GARDEN_PLANTER_HEIGHT + GARDEN_SOIL_HEIGHT / 2 + 0.002;
  const frontZ = gardenD / 2 - GARDEN_PLANTER_WIDTH / 2;
  const sideX = gardenW / 2 - GARDEN_PLANTER_WIDTH / 2;
  addBox(GARDEN_PLANTER_MATERIAL, [gardenW, GARDEN_PLANTER_HEIGHT, GARDEN_PLANTER_WIDTH], [0, planterY, frontZ]);
  addBox(GARDEN_PLANTER_MATERIAL, [gardenW, GARDEN_PLANTER_HEIGHT, GARDEN_PLANTER_WIDTH], [0, planterY, -frontZ]);
  addBox(GARDEN_PLANTER_MATERIAL, [GARDEN_PLANTER_WIDTH, GARDEN_PLANTER_HEIGHT, gardenD], [sideX, planterY, 0]);
  addBox(GARDEN_PLANTER_MATERIAL, [GARDEN_PLANTER_WIDTH, GARDEN_PLANTER_HEIGHT, gardenD], [-sideX, planterY, 0]);
  addBox(GARDEN_SOIL_MATERIAL, [gardenW * 0.88, GARDEN_SOIL_HEIGHT, GARDEN_PLANTER_WIDTH * 0.56], [0, soilY, frontZ]);
  addBox(GARDEN_SOIL_MATERIAL, [gardenW * 0.88, GARDEN_SOIL_HEIGHT, GARDEN_PLANTER_WIDTH * 0.56], [0, soilY, -frontZ]);
  addBox(GARDEN_SOIL_MATERIAL, [GARDEN_PLANTER_WIDTH * 0.56, GARDEN_SOIL_HEIGHT, gardenD * 0.68], [sideX, soilY, 0]);
  addBox(GARDEN_SOIL_MATERIAL, [GARDEN_PLANTER_WIDTH * 0.56, GARDEN_SOIL_HEIGHT, gardenD * 0.68], [-sideX, soilY, 0]);

  const poolW = innerW * 0.42;
  const poolD = innerD * 0.3;
  const poolX = innerW * 0.23;
  const poolZ = -innerD * 0.22;
  const poolY = surfaceY + 0.01;
  const coping = 0.045;
  addBox(
    GARDEN_POOL_COPING_MATERIAL,
    [poolW + coping * 2, 0.018, poolD + coping * 2],
    [poolX, poolY, poolZ],
    true,
    true,
  );
  addBox(
    getGardenPoolTileMaterial(),
    [poolW, 0.018, poolD],
    [poolX, poolY + 0.004, poolZ],
    false,
    true,
  );
  addBox(
    getGardenPoolCausticMaterial(),
    [poolW * 0.9, 0.006, poolD * 0.82],
    [poolX, poolY + 0.017, poolZ],
    false,
    false,
  );
  addBox(
    getGardenPoolWaterMaterial(),
    [poolW * 0.92, 0.014, poolD * 0.84],
    [poolX, poolY + 0.026, poolZ],
    false,
    false,
  );

  const benchZ = innerD * 0.18;
  const woodMaterial = getGardenWoodMaterial();
  addBox(woodMaterial, [innerW * 0.34, 0.025, 0.055], [-innerW * 0.23, deckTopY + 0.075, benchZ]);
  addBox(woodMaterial, [innerW * 0.34, 0.08, 0.025], [-innerW * 0.23, deckTopY + 0.105, benchZ - 0.045]);
  addBox(woodMaterial, [0.025, 0.07, 0.025], [-innerW * 0.36, deckTopY + 0.035, benchZ]);
  addBox(woodMaterial, [0.025, 0.07, 0.025], [-innerW * 0.1, deckTopY + 0.035, benchZ]);

  const pergolaX = -innerW * 0.24;
  const pergolaZ = -innerD * 0.24;
  const pergolaH = 0.28;
  for (const x of [-0.12, 0.12]) {
    for (const z of [-0.1, 0.1]) {
      addBox(woodMaterial, [0.025, pergolaH, 0.025], [pergolaX + x, deckTopY + pergolaH / 2, pergolaZ + z]);
    }
  }
  addBox(woodMaterial, [0.32, 0.025, 0.025], [pergolaX, deckTopY + pergolaH, pergolaZ - 0.1]);
  addBox(woodMaterial, [0.32, 0.025, 0.025], [pergolaX, deckTopY + pergolaH, pergolaZ + 0.1]);
  addBox(woodMaterial, [0.025, 0.025, 0.28], [pergolaX - 0.12, deckTopY + pergolaH + 0.03, pergolaZ]);
  addBox(woodMaterial, [0.025, 0.025, 0.28], [pergolaX + 0.12, deckTopY + pergolaH + 0.03, pergolaZ]);

  const trunkMesh = new THREE.InstancedMesh(
    GARDEN_TRUNK_GEOMETRY,
    GARDEN_TRUNK_MATERIAL,
    GARDEN_TREE_COUNT,
  );
  const branchMesh = new THREE.InstancedMesh(
    GARDEN_BRANCH_GEOMETRY,
    GARDEN_TRUNK_MATERIAL,
    GARDEN_TREE_COUNT * GARDEN_BRANCHES_PER_TREE,
  );
  const leafCardMesh = new THREE.InstancedMesh(
    GARDEN_LEAF_CARD_GEOMETRY,
    getGardenLeafCardMaterial(),
    GARDEN_TREE_COUNT * GARDEN_LEAF_CARDS_PER_TREE,
  );
  const treePositions: Array<[number, number, number]> = [
    [-sideX, deckTopY + GARDEN_PLANTER_HEIGHT, -frontZ],
    [sideX, deckTopY + GARDEN_PLANTER_HEIGHT, -frontZ],
    [-sideX, deckTopY + GARDEN_PLANTER_HEIGHT, frontZ],
    [sideX, deckTopY + GARDEN_PLANTER_HEIGHT, frontZ],
  ];
  const dummy = new THREE.Object3D();
  let branchIndex = 0;
  let leafCardIndex = 0;
  treePositions.forEach(([x, y, z], index) => {
    const trunkH = 0.16 + (index % 2) * 0.035;
    const trunkBase = new THREE.Vector3(x * 0.9, y, z * 0.88);
    const trunkTop = new THREE.Vector3(x * 0.9, y + trunkH, z * 0.88);
    const treeYaw = index * 0.72;

    setCylinderBetween(trunkMesh, index, trunkBase, trunkTop, 0.02, dummy);

    for (let branch = 0; branch < GARDEN_BRANCHES_PER_TREE; branch++) {
      const angle = treeYaw + branch * 1.26;
      const branchStart = trunkBase.clone().setY(y + trunkH * (0.48 + branch * 0.085));
      const branchLength = 0.12 + (branch % 2) * 0.035;
      const branchEnd = new THREE.Vector3(
        trunkBase.x + Math.cos(angle) * branchLength,
        branchStart.y + 0.055 + (branch % 3) * 0.012,
        trunkBase.z + Math.sin(angle) * branchLength,
      );

      setCylinderBetween(
        branchMesh,
        branchIndex,
        branchStart,
        branchEnd,
        0.009 - branch * 0.0009,
        dummy,
      );
      branchIndex += 1;

      for (let card = 0; card < 3; card++) {
        const cardYaw = angle + card * 1.05;
        const cardLift = (card - 1) * 0.018;
        dummy.position.set(
          branchEnd.x + Math.cos(cardYaw) * 0.025,
          branchEnd.y + cardLift,
          branchEnd.z + Math.sin(cardYaw) * 0.025,
        );
        dummy.rotation.set(
          -0.16 + card * 0.15,
          cardYaw + Math.PI / 2,
          (card - 1) * 0.42,
        );
        dummy.scale.set(0.2 + card * 0.018, 0.15 + (branch % 2) * 0.02, 1);
        dummy.updateMatrix();
        leafCardMesh.setMatrixAt(leafCardIndex, dummy.matrix);
        leafCardIndex += 1;
      }
    }
  });
  trunkMesh.instanceMatrix.needsUpdate = true;
  branchMesh.instanceMatrix.needsUpdate = true;
  leafCardMesh.instanceMatrix.needsUpdate = true;
  setShadowRole(trunkMesh, true, true);
  setShadowRole(branchMesh, true, true);
  setShadowRole(leafCardMesh, false, false);
  group.add(trunkMesh, branchMesh, leafCardMesh);

  const shrubCount = 18;
  const shrubsDark = new THREE.InstancedMesh(
    GARDEN_SHRUB_GEOMETRY,
    GARDEN_LEAF_DARK_MATERIAL,
    Math.ceil(shrubCount / 2),
  );
  const shrubsLight = new THREE.InstancedMesh(
    GARDEN_SHRUB_GEOMETRY,
    GARDEN_LEAF_LIGHT_MATERIAL,
    Math.floor(shrubCount / 2),
  );
  let darkShrubIndex = 0;
  let lightShrubIndex = 0;
  for (let i = 0; i < shrubCount; i++) {
    const t = i / (shrubCount - 1);
    const side = i % 4;
    const edgeT = -0.42 + (t % 0.5) * 1.68;
    const x = side < 2 ? edgeT * gardenW : (side === 2 ? -sideX : sideX) * 0.96;
    const z = side < 2 ? (side === 0 ? -frontZ : frontZ) * 0.93 : edgeT * gardenD;
    const radius = 0.035 + (i % 3) * 0.009;
    dummy.position.set(x, deckTopY + GARDEN_PLANTER_HEIGHT + radius * 0.6, z);
    dummy.scale.set(radius * 1.2, radius * 0.75, radius);
    dummy.updateMatrix();
    if (i % 2 === 0) {
      shrubsDark.setMatrixAt(darkShrubIndex, dummy.matrix);
      darkShrubIndex += 1;
    } else {
      shrubsLight.setMatrixAt(lightShrubIndex, dummy.matrix);
      lightShrubIndex += 1;
    }
  }
  shrubsDark.instanceMatrix.needsUpdate = true;
  shrubsLight.instanceMatrix.needsUpdate = true;
  setShadowRole(shrubsDark, true, true);
  setShadowRole(shrubsLight, true, true);
  group.add(shrubsDark, shrubsLight);

  const lightCount = 8;
  const gardenLights = new THREE.InstancedMesh(GARDEN_LIGHT_GEOMETRY, GARDEN_WARM_LIGHT_MATERIAL, lightCount);
  for (let i = 0; i < lightCount; i++) {
    const angle = (i / lightCount) * Math.PI * 2 + Math.PI / 8;
    dummy.position.set(
      Math.cos(angle) * gardenW * 0.43,
      deckTopY + GARDEN_RAIL_HEIGHT * 0.8,
      Math.sin(angle) * gardenD * 0.43,
    );
    dummy.scale.set(0.018, 0.018, 0.018);
    dummy.updateMatrix();
    gardenLights.setMatrixAt(i, dummy.matrix);
  }
  gardenLights.instanceMatrix.needsUpdate = true;
  setShadowRole(gardenLights, false, false);
  group.add(gardenLights);

  const postCount = 16;
  const railPosts = new THREE.InstancedMesh(GARDEN_BOX_GEOMETRY, GARDEN_PLANTER_MATERIAL, postCount);
  for (let i = 0; i < postCount; i++) {
    const t = (i % 4) / 3 - 0.5;
    const side = Math.floor(i / 4);
    const x = side < 2 ? t * gardenW : (side === 2 ? -gardenW / 2 : gardenW / 2);
    const z = side < 2 ? (side === 0 ? -gardenD / 2 : gardenD / 2) : t * gardenD;
    dummy.position.set(x, deckTopY + GARDEN_RAIL_HEIGHT / 2, z);
    dummy.scale.set(0.018, GARDEN_RAIL_HEIGHT, 0.018);
    dummy.updateMatrix();
    railPosts.setMatrixAt(i, dummy.matrix);
  }
  railPosts.instanceMatrix.needsUpdate = true;
  setShadowRole(railPosts, true, true);
  group.add(railPosts);
  addBox(GARDEN_PLANTER_MATERIAL, [gardenW, 0.018, 0.018], [0, deckTopY + GARDEN_RAIL_HEIGHT, -gardenD / 2]);
  addBox(GARDEN_PLANTER_MATERIAL, [gardenW, 0.018, 0.018], [0, deckTopY + GARDEN_RAIL_HEIGHT, gardenD / 2]);
  addBox(GARDEN_PLANTER_MATERIAL, [0.018, 0.018, gardenD], [-gardenW / 2, deckTopY + GARDEN_RAIL_HEIGHT, 0]);
  addBox(GARDEN_PLANTER_MATERIAL, [0.018, 0.018, gardenD], [gardenW / 2, deckTopY + GARDEN_RAIL_HEIGHT, 0]);

  return group;
}

function createHelicopter(footprint?: RooftopFootprint): THREE.Group {
  const group = new THREE.Group();
  const width = Math.max(1, footprint?.width ?? 1);
  const depth = Math.max(1, footprint?.depth ?? 1);
  const roofSpan = Math.min(width, depth);
  const size = THREE.MathUtils.clamp(roofSpan * 0.82, 0.78, 1.66);
  const fuselageLength = size * 0.72;
  const bodyWidth = size * 0.28;
  const bodyHeight = size * 0.23;
  const tailLength = size * 0.7;
  const rotorDiameter = THREE.MathUtils.clamp(roofSpan * 1.04, 0.98, 2.06);
  const rotorChord = Math.max(0.018, rotorDiameter * 0.035);
  const bodyY = HELICOPTER_ROOF_CLEARANCE + bodyHeight * 0.72;
  const rotorY = HELICOPTER_ROOF_CLEARANCE + bodyHeight * 1.38 + HELICOPTER_MAST_HEIGHT;
  const tailRootX = -fuselageLength * 0.44;
  const tailEndX = tailRootX - tailLength;
  const tailCenterY = bodyY + bodyHeight * 0.13;

  const addBox = (
    material: THREE.Material,
    scale: [number, number, number],
    position: [number, number, number],
    castsShadow = true,
    receivesShadow = true,
  ) => {
    const mesh = new THREE.Mesh(HELICOPTER_BOX_GEOMETRY, material);
    mesh.scale.set(scale[0], scale[1], scale[2]);
    mesh.position.set(position[0], position[1], position[2]);
    setShadowRole(mesh, castsShadow, receivesShadow);
    group.add(mesh);
    return mesh;
  };

  const addCylinder = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    scale: [number, number, number],
    position: [number, number, number],
    rotation: [number, number, number],
    castsShadow = true,
    receivesShadow = true,
  ) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.scale.set(scale[0], scale[1], scale[2]);
    mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    mesh.position.set(position[0], position[1], position[2]);
    setShadowRole(mesh, castsShadow, receivesShadow);
    group.add(mesh);
    return mesh;
  };

  const addCylinderBetween = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    start: THREE.Vector3,
    end: THREE.Vector3,
    radius: number,
    castsShadow = true,
    receivesShadow = true,
  ) => {
    const direction = end.clone().sub(start);
    const length = direction.length();
    if (length <= 0.001) return null;

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(start).add(end).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.multiplyScalar(1 / length),
    );
    mesh.scale.set(radius, length, radius);
    setShadowRole(mesh, castsShadow, receivesShadow);
    group.add(mesh);
    return mesh;
  };

  const body = new THREE.Mesh(HELICOPTER_BODY_GEOMETRY, HELICOPTER_BODY_MATERIAL);
  body.scale.set(fuselageLength, bodyHeight, bodyWidth);
  body.position.set(-fuselageLength * 0.04, bodyY, 0);
  setShadowRole(body, true, true);
  group.add(body);

  const cabinHull = new THREE.Mesh(HELICOPTER_CABIN_GEOMETRY, HELICOPTER_BODY_MATERIAL);
  cabinHull.scale.set(fuselageLength * 0.68, bodyHeight * 1.06, bodyWidth * 1.08);
  cabinHull.position.set(fuselageLength * 0.16, bodyY + bodyHeight * 0.01, 0);
  cabinHull.rotation.z = -0.04;
  setShadowRole(cabinHull, true, true);
  group.add(cabinHull);

  for (const geometry of [
    HELICOPTER_RIGHT_WINDSHIELD_GEOMETRY,
    HELICOPTER_LEFT_WINDSHIELD_GEOMETRY,
    HELICOPTER_RIGHT_SIDE_WINDOW_GEOMETRY,
    HELICOPTER_RIGHT_REAR_WINDOW_GEOMETRY,
    HELICOPTER_LEFT_SIDE_WINDOW_GEOMETRY,
    HELICOPTER_LEFT_REAR_WINDOW_GEOMETRY,
  ]) {
    const windowPanel = new THREE.Mesh(geometry, HELICOPTER_WINDOW_MATERIAL);
    windowPanel.renderOrder = 2;
    setShadowRole(windowPanel, false, false);
    cabinHull.add(windowPanel);
  }

  const frontPillar = addBox(
    HELICOPTER_TRIM_MATERIAL,
    [0.01, bodyHeight * 0.43, 0.01],
    [fuselageLength * 0.392, bodyY + bodyHeight * 0.2, 0],
    true,
    true,
  );
  frontPillar.rotation.z = -0.42;

  addBox(
    HELICOPTER_TRIM_MATERIAL,
    [fuselageLength * 0.56, bodyHeight * 0.035, bodyWidth * 1.04],
    [-fuselageLength * 0.02, bodyY - bodyHeight * 0.08, 0],
    true,
    true,
  );

  const engineCowling = new THREE.Mesh(HELICOPTER_BODY_GEOMETRY, HELICOPTER_BODY_MATERIAL);
  engineCowling.scale.set(fuselageLength * 0.32, bodyHeight * 0.52, bodyWidth * 0.72);
  engineCowling.position.set(-fuselageLength * 0.3, bodyY + bodyHeight * 0.18, 0);
  setShadowRole(engineCowling, true, true);
  group.add(engineCowling);

  const tailFairing = new THREE.Mesh(HELICOPTER_BODY_GEOMETRY, HELICOPTER_BODY_MATERIAL);
  tailFairing.scale.set(fuselageLength * 0.22, bodyHeight * 0.46, bodyWidth * 0.58);
  tailFairing.position.set(tailRootX + fuselageLength * 0.04, tailCenterY, 0);
  tailFairing.rotation.z = 0.06;
  setShadowRole(tailFairing, true, true);
  group.add(tailFairing);

  addCylinderBetween(
    HELICOPTER_TAIL_BOOM_GEOMETRY,
    HELICOPTER_BODY_MATERIAL,
    new THREE.Vector3(tailRootX, tailCenterY, 0),
    new THREE.Vector3(tailEndX, tailCenterY + bodyHeight * 0.08, 0),
    bodyWidth * 0.24,
  );

  const finX = tailEndX + tailLength * 0.04;
  const finY = tailCenterY + bodyHeight * 0.28;
  addBox(
    HELICOPTER_BODY_MATERIAL,
    [tailLength * 0.09, bodyHeight * 0.82, bodyWidth * 0.055],
    [finX, finY, 0],
  );

  addBox(
    HELICOPTER_TRIM_MATERIAL,
    [tailLength * 0.18, bodyHeight * 0.055, bodyWidth * 0.56],
    [tailEndX + tailLength * 0.16, tailCenterY - bodyHeight * 0.02, 0],
  );

  const rotorDisc = new THREE.Mesh(
    HELICOPTER_ROTOR_DISC_GEOMETRY,
    HELICOPTER_ROTOR_BLUR_MATERIAL,
  );
  rotorDisc.rotation.x = -Math.PI / 2;
  rotorDisc.scale.set(rotorDiameter * 0.5, rotorDiameter * 0.5, 1);
  rotorDisc.position.set(0, rotorY + 0.003, 0);
  setShadowRole(rotorDisc, false, false);
  group.add(rotorDisc);

  for (let blade = 0; blade < 3; blade++) {
    const bladeMesh = addBox(
      HELICOPTER_ROTOR_MATERIAL,
      [rotorDiameter, Math.max(0.006, size * 0.006), rotorChord],
      [0, rotorY + blade * 0.002, 0],
      true,
      false,
    );
    bladeMesh.rotation.y = (blade * Math.PI) / 3 + Math.PI * 0.04;
  }

  const hub = new THREE.Mesh(HELICOPTER_MAST_GEOMETRY, HELICOPTER_SKID_MATERIAL);
  hub.scale.set(size * 0.045, size * 0.035, size * 0.045);
  hub.position.set(0, rotorY - size * 0.005, 0);
  setShadowRole(hub, true, true);
  group.add(hub);

  const mast = new THREE.Mesh(HELICOPTER_MAST_GEOMETRY, HELICOPTER_SKID_MATERIAL);
  mast.scale.set(HELICOPTER_MAST_RADIUS, HELICOPTER_MAST_HEIGHT, HELICOPTER_MAST_RADIUS);
  mast.position.set(0, bodyY + bodyHeight * 0.74, 0);
  setShadowRole(mast, true, true);
  group.add(mast);

  const skidLength = fuselageLength * 0.92;
  const skidY = HELICOPTER_ROOF_CLEARANCE + HELICOPTER_SKID_RADIUS;
  const skidZ = bodyWidth * 0.62;
  for (const z of [-skidZ, skidZ]) {
    addCylinder(
      HELICOPTER_SKID_GEOMETRY,
      HELICOPTER_SKID_MATERIAL,
      [HELICOPTER_SKID_RADIUS, skidLength, HELICOPTER_SKID_RADIUS],
      [fuselageLength * 0.02, skidY, z],
      [0, 0, Math.PI / 2],
    );

    for (const x of [-fuselageLength * 0.26, fuselageLength * 0.26]) {
      addCylinderBetween(
        HELICOPTER_SKID_GEOMETRY,
        HELICOPTER_SKID_MATERIAL,
        new THREE.Vector3(x, skidY + HELICOPTER_SKID_RADIUS, z),
        new THREE.Vector3(x, bodyY - bodyHeight * 0.28, z * 0.58),
        HELICOPTER_SKID_RADIUS * 0.68,
      );
    }
  }

  const tailRotorRadius = size * 0.14;
  const tailRotorX = finX - tailLength * 0.02;
  const tailRotorY = finY + bodyHeight * 0.02;
  const tailRotorZ = bodyWidth * 0.34;
  const tailRotorDisc = new THREE.Mesh(
    HELICOPTER_ROTOR_DISC_GEOMETRY,
    HELICOPTER_ROTOR_BLUR_MATERIAL,
  );
  tailRotorDisc.scale.set(tailRotorRadius, tailRotorRadius, 1);
  tailRotorDisc.position.set(tailRotorX, tailRotorY, tailRotorZ + 0.004);
  setShadowRole(tailRotorDisc, false, false);
  group.add(tailRotorDisc);

  addBox(
    HELICOPTER_SKID_MATERIAL,
    [tailLength * 0.05, bodyHeight * 0.16, bodyWidth * 0.1],
    [tailRotorX, tailRotorY, bodyWidth * 0.16],
    true,
    true,
  );
  addCylinderBetween(
    HELICOPTER_SKID_GEOMETRY,
    HELICOPTER_SKID_MATERIAL,
    new THREE.Vector3(tailRotorX, tailRotorY, bodyWidth * 0.04),
    new THREE.Vector3(tailRotorX, tailRotorY, tailRotorZ),
    size * 0.014,
  );
  addCylinder(
    HELICOPTER_MAST_GEOMETRY,
    HELICOPTER_SKID_MATERIAL,
    [size * 0.028, bodyWidth * 0.1, size * 0.028],
    [tailRotorX, tailRotorY, tailRotorZ],
    [Math.PI / 2, 0, 0],
    true,
    true,
  );

  addBox(
    HELICOPTER_ROTOR_MATERIAL,
    [tailRotorRadius * 2, 0.014, 0.012],
    [tailRotorX, tailRotorY, tailRotorZ],
    true,
    false,
  );
  const tailBlade = addBox(
    HELICOPTER_ROTOR_MATERIAL,
    [0.014, tailRotorRadius * 2, 0.012],
    [tailRotorX, tailRotorY, tailRotorZ],
    true,
    false,
  );
  tailBlade.rotation.z = Math.PI * 0.18;

  const navLight = new THREE.Mesh(HELICOPTER_LIGHT_GEOMETRY, HELICOPTER_NAV_LIGHT_MATERIAL);
  navLight.scale.set(size * 0.018, size * 0.018, size * 0.018);
  navLight.position.set(fuselageLength * 0.36, bodyY + bodyHeight * 0.04, 0);
  setShadowRole(navLight, false, false);
  group.add(navLight);

  group.rotation.y = -Math.PI / 10;
  group.userData.helicopterSize = size;
  return group;
}

const FACTORIES: Record<Exclude<RooftopType, "none">, RooftopFactory> = {
  spotlights: createSpotlights,
  helipad: createHelipad,
  garden: createGarden,
  helicopter: createHelicopter,
};

/**
 * Cria um Group Three.js para o acessório de topo do edifício.
 * Retorna null se o tipo for "none".
 * O grupo é posicionado com Y=0 na base (topo do edifício).
 */
export function createRooftopMesh(
  type: RooftopType,
  footprint?: RooftopFootprint,
): THREE.Group | null {
  if (type === "none") return null;
  const factory = FACTORIES[type];
  const group = factory(footprint);
  group.userData.rooftopType = type;

  return group;
}

/** Libera referências do grupo. Geometrias e materiais são compartilhados no módulo. */
export function disposeRooftopMesh(group: THREE.Group): void {
  for (const child of group.children) {
    if (child instanceof THREE.InstancedMesh) child.dispose();
  }
  group.clear();
}

/** Descarta todos os recursos compartilhados. Chamar apenas no dispose final do manager. */
export function disposeRooftopSharedResources(): void {
  for (const geometry of SHARED_ROOFTOP_GEOMETRIES) {
    geometry.dispose();
  }
  for (const material of SHARED_ROOFTOP_MATERIALS) {
    material.dispose();
  }
  gardenGrassTexture?.dispose();
  gardenGrassTexture = null;
  gardenWoodTexture?.dispose();
  gardenWoodTexture = null;
  gardenPoolTileTexture?.dispose();
  gardenPoolTileTexture = null;
  gardenPoolWaterNormalTexture?.dispose();
  gardenPoolWaterNormalTexture = null;
  gardenPoolCausticTexture?.dispose();
  gardenPoolCausticTexture = null;
  gardenLeafCardTexture?.dispose();
  gardenLeafCardTexture = null;
}

/** @deprecated Use disposeRooftopSharedResources. Mantido para compatibilidade. */
export function disposeRooftopMaterials(): void {
  disposeRooftopSharedResources();
}
