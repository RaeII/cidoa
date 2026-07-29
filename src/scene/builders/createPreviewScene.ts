import * as THREE from "three";
import {
  createBuildingShapeMesh,
  createUnitBuildingGeometry,
  isBuildingShape,
} from "./createBuildingShapeMesh";
import {
  createEdgeLightMesh,
  disposeEdgeLightMesh,
  isEdgeLightType,
} from "./createEdgeLightMesh";
import {
  createRooftopMesh,
  disposeRooftopMesh,
  isRooftopType,
} from "./createRooftopMesh";
import type { BuildingShape, EdgeLightType, RooftopType } from "../types";

/** O que mostrar. `key` vem do catálogo — pode não ter builder no front. */
export type PreviewSubject = {
  kind: "shape" | "rooftop" | "edgeLight";
  key: string;
};

export type ResolvedSubject =
  | { kind: "shape"; shape: BuildingShape }
  | { kind: "rooftop"; type: Exclude<RooftopType, "none"> }
  | { kind: "edgeLight"; type: Exclude<EdgeLightType, "none"> };

// Prédio-base e elevação da câmera por tipo. O alvo tem que dominar o quadro:
// topo pede prédio baixo com câmera alta; formato pede prédio alto (geometria é
// 1×1×1 — sem esticar, Empire/Chrysler viram cubos).
const VIEW: Record<PreviewSubject["kind"], { height: number; elevation: number }> = {
  shape: { height: 3, elevation: 0.42 },
  rooftop: { height: 0.8, elevation: 0.95 },
  edgeLight: { height: 2.2, elevation: 0.55 },
};

const FOV = 32;

/**
 * Key do catálogo -> builder. `null` = sem builder no front, ou `none`
 * (ausência de acessório) — quem chama mostra placeholder em vez de canvas.
 */
export function resolveSubject({ kind, key }: PreviewSubject): ResolvedSubject | null {
  if (kind === "shape") return isBuildingShape(key) ? { kind, shape: key } : null;
  if (kind === "rooftop") {
    return isRooftopType(key) && key !== "none" ? { kind, type: key } : null;
  }
  return isEdgeLightType(key) && key !== "none" ? { kind, type: key } : null;
}

/** Prédio + acessório, prontos pra cena. */
function buildSubject(resolved: ResolvedSubject) {
  const { height } = VIEW[resolved.kind];
  const shape = resolved.kind === "shape" ? resolved.shape : "default";
  const accessory =
    resolved.kind === "rooftop"
      ? createRooftopMesh(resolved.type, { width: 1, depth: 1 })
      : resolved.kind === "edgeLight"
        ? createEdgeLightMesh(resolved.type, { width: 1, depth: 1, height }, shape)
        : null;

  const facadeMat = new THREE.MeshStandardMaterial({
    color: 0x9aa3ab,
    roughness: 0.72,
    metalness: 0.1,
  });
  const topMat = new THREE.MeshStandardMaterial({
    color: 0x6d7378,
    roughness: 0.86,
    metalness: 0.04,
  });
  const boxGeometry = createUnitBuildingGeometry();
  const building = createBuildingShapeMesh(shape, facadeMat, topMat, boxGeometry);
  building.scale.set(1, height, 1);

  const root = new THREE.Group();
  root.add(building);
  if (accessory) {
    // Topo do prédio pro rooftop, base pro LED (o grupo cresce até `height`).
    accessory.position.setY(resolved.kind === "rooftop" ? height / 2 : -height / 2);
    root.add(accessory);
  }

  const dispose = () => {
    const materials = Array.isArray(building.material) ? building.material : [building.material];
    for (const material of new Set(materials)) material.dispose();
    // Só a caixa é nossa: geometrias de formato/acessório são cache dos builders.
    boxGeometry.dispose();
    if (accessory) {
      (resolved.kind === "rooftop" ? disposeRooftopMesh : disposeEdgeLightMesh)(accessory);
    }
  };

  return { root, dispose };
}

/**
 * Caixa que manda no enquadramento, ignorando volumétrico (transparente sem
 * depthWrite): o feixe do holofote tem 10 unidades e deixaria o prédio um ponto.
 */
export function frameBox(root: THREE.Object3D): THREE.Box3 {
  const box = new THREE.Box3();
  root.updateWorldMatrix(false, true);
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (materials.every((m) => m.transparent && m.depthWrite === false)) return;
    box.expandByObject(mesh);
  });
  return box;
}

/**
 * Cena mínima com o assunto, pro preview do admin ([[personalizacoes]]). Fora da
 * cena 3D não há HDRI nem ambiente, então traz luz própria (sem sombra — mesma
 * regra do resto do projeto). Quem chama cuida do renderer e do dispose.
 */
export function createPreviewScene(resolved: ResolvedSubject) {
  const built = buildSubject(resolved);

  const scene = new THREE.Scene();
  // Halo do LED é aditivo: some em fundo claro.
  if (resolved.kind === "edgeLight") scene.background = new THREE.Color(0x14161a);
  scene.add(new THREE.AmbientLight(0xffffff, 1.2));
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(4, 6, 5);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xb9d0ff, 0.9);
  fill.position.set(-5, 2, -4);
  scene.add(fill);
  scene.add(built.root);

  const sphere = frameBox(built.root).getBoundingSphere(new THREE.Sphere());
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 100);

  /** Aplica a proporção e devolve a distância que faz a esfera envolvente caber. */
  const frame = (aspect: number) => {
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    const halfFov = THREE.MathUtils.degToRad(FOV) / 2;
    // Aspecto < 1 corta na horizontal: afasta na mesma proporção.
    return (sphere.radius / Math.sin(halfFov) / Math.min(1, aspect)) * 1.06;
  };

  /** Câmera na diagonal padrão. Separado de `frame` pra resize não matar o orbit. */
  const place = (distance: number) => {
    camera.position
      .set(1, VIEW[resolved.kind].elevation, 1)
      .normalize()
      .multiplyScalar(distance)
      .add(sphere.center);
    camera.lookAt(sphere.center);
  };

  return { scene, camera, center: sphere.center, frame, place, dispose: built.dispose };
}
