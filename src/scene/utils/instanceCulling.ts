import * as THREE from "three";

/**
 * Cull de distância para InstancedMesh do chão da cidade (lotes, calçadas, postes,
 * asfalto). Mesmo esquema dos prédios: as matrizes ficam num snapshot lógico e o
 * buffer renderizado é compactado só com as visíveis, então `count` corta vértices
 * de verdade — não é `visible = false` por objeto nem zero-scale.
 *
 * Meshes de um mesmo grupo compartilham o índice lógico (poste + luminária + mancha
 * de luz são a MESMA instância vista de três meshes) e somem juntos.
 */
export type InstanceCullGroup = {
  meshes: ReadonlyArray<THREE.InstancedMesh | null>;
  /** Matrizes lógicas por mesh (count * 16 floats). */
  logical: Float32Array[];
  /** Posição XZ de cada instância, lida da translação do primeiro mesh do grupo. */
  posX: Float32Array;
  posZ: Float32Array;
  count: number;
};

// Índices visíveis do passe atual. Módulo-level pra não alocar a cada cull.
let keepScratch = new Int32Array(0);

/** Congela as matrizes já escritas nos meshes. Chamar no fim de cada rebuild. */
export function snapshotInstances(
  meshes: ReadonlyArray<THREE.InstancedMesh | null>,
  count: number,
): InstanceCullGroup | null {
  const first = meshes[0];
  if (!first || count === 0) return null;
  const logical = meshes.map((m) =>
    m ? (m.instanceMatrix.array as Float32Array).slice(0, count * 16) : new Float32Array(0),
  );
  const posX = new Float32Array(count);
  const posZ = new Float32Array(count);
  const src = logical[0];
  for (let i = 0; i < count; i++) {
    posX[i] = src[i * 16 + 12];
    posZ[i] = src[i * 16 + 14];
  }
  return { meshes, logical, posX, posZ, count };
}

function writeCompact(group: InstanceCullGroup, kept: number): void {
  for (let mi = 0; mi < group.meshes.length; mi++) {
    const mesh = group.meshes[mi];
    if (!mesh) continue;
    const src = group.logical[mi];
    const dst = mesh.instanceMatrix.array as Float32Array;
    for (let k = 0; k < kept; k++) {
      const s = keepScratch[k] * 16;
      const d = k * 16;
      for (let f = 0; f < 16; f++) dst[d + f] = src[s + f];
    }
    mesh.count = kept;
    mesh.instanceMatrix.needsUpdate = true;
  }
}

/** Compacta o grupo com as instâncias aprovadas por `visible`. Retorna quantas sumiram. */
export function cullInstances(
  group: InstanceCullGroup | null,
  visible: (x: number, z: number) => boolean,
): number {
  if (!group) return 0;
  if (keepScratch.length < group.count) keepScratch = new Int32Array(group.count);
  let kept = 0;
  for (let i = 0; i < group.count; i++) {
    if (visible(group.posX[i], group.posZ[i])) keepScratch[kept++] = i;
  }
  writeCompact(group, kept);
  return group.count - kept;
}

/** Devolve todas as instâncias — o probe de reflexo captura a cidade inteira. */
export function restoreInstances(group: InstanceCullGroup | null): void {
  if (!group) return;
  for (let mi = 0; mi < group.meshes.length; mi++) {
    const mesh = group.meshes[mi];
    if (!mesh) continue;
    (mesh.instanceMatrix.array as Float32Array).set(group.logical[mi]);
    mesh.count = group.count;
    mesh.instanceMatrix.needsUpdate = true;
  }
}
