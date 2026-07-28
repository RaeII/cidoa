import * as THREE from "three";
import type { BuildingShape } from "../types";
import {
  createTwistedBuildingMesh,
  disposeTwistedBuildingSharedResources,
} from "./createTwistedBuildingMesh";
import {
  createOctagonalBuildingMesh,
  disposeOctagonalBuildingSharedResources,
} from "./createOctagonalBuildingMesh";
import {
  createSetbackBuildingMesh,
  disposeSetbackBuildingSharedResources,
} from "./createSetbackBuildingMesh";
import {
  createTaperedBuildingMesh,
  disposeTaperedBuildingSharedResources,
} from "./createTaperedBuildingMesh";
import {
  createChryslerBuildingMesh,
  disposeChryslerBuildingSharedResources,
} from "./createChryslerBuildingMesh";
import {
  createHearstBuildingMesh,
  disposeHearstBuildingSharedResources,
} from "./createHearstBuildingMesh";
import {
  createEmpireBuildingMesh,
  disposeEmpireBuildingSharedResources,
} from "./createEmpireBuildingMesh";
import {
  createTaipeiBuildingMesh,
  disposeTaipeiBuildingSharedResources,
} from "./createTaipeiBuildingMesh";
import {
  createOneTradeBuildingMesh,
  disposeOneTradeBuildingSharedResources,
} from "./createOneTradeBuildingMesh";

type ShapeMeshBuilder = (
  facadeMaterial: THREE.Material,
  topMaterial: THREE.Material,
) => THREE.Mesh;

/**
 * Formato -> builder. Todo builder devolve Mesh 1×1×1 com 2 slots de material
 * (0 = fachada, 1 = topo) — o chamador escala. `default` fica fora do mapa:
 * usa a caixa de `createUnitBuildingGeometry`.
 */
const SHAPE_BUILDERS: Record<Exclude<BuildingShape, "default">, ShapeMeshBuilder> = {
  twisted: createTwistedBuildingMesh,
  octagonal: createOctagonalBuildingMesh,
  setback: createSetbackBuildingMesh,
  tapered: createTaperedBuildingMesh,
  chrysler: createChryslerBuildingMesh,
  hearst: createHearstBuildingMesh,
  empire: createEmpireBuildingMesh,
  taipei: createTaipeiBuildingMesh,
  "one-trade": createOneTradeBuildingMesh,
};

/** Toda key de formato conhecida pelo front (inclui `default`). */
export const BUILDING_SHAPES = ["default", ...Object.keys(SHAPE_BUILDERS)] as BuildingShape[];

/** Guard pra keys vindas do catálogo (banco pode ter opção sem builder). */
export function isBuildingShape(key: string): key is BuildingShape {
  return key === "default" || key in SHAPE_BUILDERS;
}

/**
 * Caixa 1×1×1 do formato `default`: grupos remapeados (topo = material 1, resto
 * = 0) + atributos de projeção que o shader triplanar consome. Devolve instância
 * nova — quem cria descarta.
 */
export function createUnitBuildingGeometry(): THREE.BoxGeometry {
  const geometry = new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  for (const group of geometry.groups) {
    group.materialIndex = group.materialIndex === 2 ? 1 : 0;
  }
  // Cópia da posição/normal axis-aligned. Geometria torcida sobrescreve esses
  // atributos com os valores PRÉ-twist (ver createTwistedBuildingMesh).
  geometry.setAttribute(
    "aProjPosition",
    new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.array), 3),
  );
  geometry.setAttribute(
    "aProjNormal",
    new THREE.BufferAttribute(new Float32Array(geometry.attributes.normal.array), 3),
  );
  return geometry;
}

/**
 * Mesh do formato pedido. `defaultGeometry` só é usada quando shape = `default`
 * (o chamador reaproveita a geometria que já tem em mãos).
 */
export function createBuildingShapeMesh(
  shape: BuildingShape,
  facadeMaterial: THREE.Material,
  topMaterial: THREE.Material,
  defaultGeometry: THREE.BufferGeometry,
): THREE.Mesh {
  if (shape === "default") {
    return new THREE.Mesh(defaultGeometry, [facadeMaterial, topMaterial]);
  }
  return SHAPE_BUILDERS[shape](facadeMaterial, topMaterial);
}

/** Descarta as geometrias compartilhadas (cache module-level) de todos os formatos. */
export function disposeBuildingShapeSharedResources(): void {
  disposeTwistedBuildingSharedResources();
  disposeOctagonalBuildingSharedResources();
  disposeSetbackBuildingSharedResources();
  disposeTaperedBuildingSharedResources();
  disposeChryslerBuildingSharedResources();
  disposeHearstBuildingSharedResources();
  disposeEmpireBuildingSharedResources();
  disposeTaipeiBuildingSharedResources();
  disposeOneTradeBuildingSharedResources();
}
