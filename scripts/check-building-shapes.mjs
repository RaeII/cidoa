/**
 * Checagem dos formatos de edifício (todo formato do catálogo produz mesh com
 * geometria real e os 2 slots de material) + do preview do admin (keys do
 * catálogo resolvem pro builder certo; enquadramento ignora volumétrico).
 * Roda sem navegador — só matemática de BufferGeometry, nada de WebGL.
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

// --- Preview do admin ---
const { resolveSubject, frameBox } = await server.ssrLoadModule(
  "/src/scene/builders/createPreviewScene.ts",
);

// Keys semeadas na migration 0008. `none` = ausência de acessório: sem preview.
const SUBJECTS = [
  ...BUILDING_SHAPES.map((key) => ["shape", key, true]),
  ["rooftop", "spotlights", true],
  ["rooftop", "helipad", true],
  ["rooftop", "garden", true],
  ["rooftop", "helicopter", true],
  ["rooftop", "none", false],
  ["edgeLight", "led", true],
  ["edgeLight", "none", false],
  ["shape", "inexistente", false],
  ["rooftop", "inexistente", false],
];

for (const [kind, key, expected] of SUBJECTS) {
  const resolved = resolveSubject({ kind, key });
  assert.equal(Boolean(resolved), expected, `${kind}:${key}: resolveSubject devia dar ${expected}`);
}
console.log(`ok resolveSubject — ${SUBJECTS.length} keys`);

// Feixe de holofote tem 10 unidades e não pode mandar no enquadramento.
const root = new THREE.Group();
root.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial()));
const beam = new THREE.Mesh(
  new THREE.BoxGeometry(1, 10, 1),
  new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }),
);
beam.position.y = 5;
root.add(beam);
const framed = frameBox(root).getSize(new THREE.Vector3());
assert.ok(framed.y <= 1.001, `enquadramento pegou o volumétrico (altura ${framed.y})`);
console.log("ok frameBox — volumétrico ignorado");

await server.close();
console.log(`\n${BUILDING_SHAPES.length} formatos OK`);
