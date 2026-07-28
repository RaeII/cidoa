/**
 * Checagem dos formatos de edifício: todo formato do catálogo tem que produzir
 * mesh com geometria real e os 2 slots de material (fachada/topo). Roda sem
 * navegador — só matemática de BufferGeometry, nada de WebGL.
 *
 * Uso: node scripts/check-building-shapes.mjs
 */
import assert from "node:assert/strict";
import * as THREE from "three";
import { createServer } from "vite";

const server = await createServer({ server: { middlewareMode: true } });
const { BUILDING_SHAPES, createBuildingShapeMesh, createUnitBuildingGeometry } =
  await server.ssrLoadModule("/src/scene/builders/createBuildingShapeMesh.ts");

const box = new THREE.Box3();
for (const shape of BUILDING_SHAPES) {
  const facade = new THREE.MeshStandardMaterial();
  const top = new THREE.MeshStandardMaterial();
  const mesh = createBuildingShapeMesh(shape, facade, top, createUnitBuildingGeometry());
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const size = box.setFromObject(mesh).getSize(new THREE.Vector3());

  assert.ok(materials[0] === facade && materials[1] === top, `${shape}: slots de material trocados`);
  assert.ok(size.x > 0 && size.y > 0 && size.z > 0, `${shape}: geometria degenerada (${size.toArray()})`);
  // Unitária: quem escala é a cena. Folga pra antena/coroamento passar do topo.
  assert.ok(size.y > 0.5 && size.y < 1.5, `${shape}: altura ${size.y} — geometria não é unitária`);
  console.log(`ok ${shape} — ${size.toArray().map((n) => n.toFixed(2)).join(" × ")}`);
}

await server.close();
console.log(`\n${BUILDING_SHAPES.length} formatos OK`);
