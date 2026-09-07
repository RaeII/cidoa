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
import { build } from "esbuild";

// Bundle em memória: não cria servidor, watcher ou porta de teste.
const bundle = await build({
  stdin: {
    contents: ["createBuildingShapeMesh", "createEdgeLightMesh", "createPreviewScene"]
      .map((name) => `export * from './src/scene/builders/${name}.ts';`).join("\n"),
    resolveDir: process.cwd(),
  },
  bundle: true, format: "esm", platform: "node", write: false,
});
const { BUILDING_SHAPES, createBuildingShapeMesh, createUnitBuildingGeometry,
  disposeBuildingShapeSharedResources, createEdgeLightMesh, resolveSubject, frameBox } =
  await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`);

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
  if (shape === "yachthouse") {
    for (const axis of ["x", "y", "z"]) {
      assert.ok(Math.abs(size[axis] - 1) < 1e-6, `yachthouse: dimensão ${axis} fora do lote`);
    }
    assert.equal(mesh.geometry.groups.length, 2, "yachthouse: só dois draw calls");
    for (const name of ["position", "normal", "aProjPosition", "aProjNormal"]) {
      const attribute = mesh.geometry.getAttribute(name);
      assert.equal(attribute.count, mesh.geometry.getAttribute("position").count);
      assert.ok(attribute.array.every(Number.isFinite), `yachthouse: ${name} inválido`);
    }
    // Vão real entre torres; fachada dos dois lados responde ao picking.
    mesh.updateMatrixWorld(true);
    const cast = (x, y) => new THREE.Raycaster(new THREE.Vector3(x, y, 2), new THREE.Vector3(0, 0, -1)).intersectObject(mesh);
    assert.equal(cast(0, 0).length, 0, "yachthouse: vão central fechado");
    assert.ok(cast(-0.255, 0).length > 0 && cast(0.255, 0).length > 0, "yachthouse: torre ausente");
    assert.ok(cast(0, -0.45).length > 0, "yachthouse: embasamento ausente");
    const second = createBuildingShapeMesh(shape, facade, top, createUnitBuildingGeometry());
    assert.equal(second.geometry, mesh.geometry, "yachthouse: cache não compartilhado");
    let disposed = false;
    mesh.geometry.addEventListener("dispose", () => { disposed = true; });
    disposeBuildingShapeSharedResources();
    assert.ok(disposed, "yachthouse: dispose não libera geometria");
    assert.notEqual(createBuildingShapeMesh(shape, facade, top, createUnitBuildingGeometry()).geometry, mesh.geometry);
  }
  console.log(`ok ${shape} — ${size.toArray().map((n) => n.toFixed(2)).join(" × ")}`);
}

// --- LED de arestas ---
// Regressão: buildInstancedGroup chamava a si mesma no lugar de `return group`,
// estourando a pilha em TODO LED. Cada formato tem que devolver os 3 InstancedMesh
// (core + halo + haloOuter) com pelo menos 1 segmento.
const LED_FOOTPRINT = { width: 1, depth: 1.4, height: 3 };
for (const shape of BUILDING_SHAPES) {
  const led = createEdgeLightMesh("led", LED_FOOTPRINT, shape);
  const instanced = led.children.filter((child) => child.isInstancedMesh);
  assert.equal(instanced.length, 3, `${shape}: LED devia ter 3 InstancedMesh`);
  assert.ok(
    instanced.every((mesh) => mesh.count > 0),
    `${shape}: LED sem segmentos`,
  );
}
assert.equal(createEdgeLightMesh("none", LED_FOOTPRINT), null, "`none` devia dar null");
console.log(`ok LED — ${BUILDING_SHAPES.length} formatos`);

// --- Âncoras do shader que tiram o especular da luz do LED ---
// Sem elas o patch de createDonationManager vira no-op SILENCIOSO em produção e a
// PointLight do LED volta a desenhar um ponto brilhante na fachada do vizinho.
assert.ok(
  THREE.ShaderLib.physical.fragmentShader.includes("#include <lights_physical_pars_fragment>"),
  "meshphysical não inclui mais lights_physical_pars_fragment",
);
assert.ok(
  THREE.ShaderChunk.lights_physical_pars_fragment.includes(
    "reflectedLight.directSpecular += irradiance * BRDF_GGX_Multiscatter( directLight.direction, geometryViewDir, geometryNormal, material );",
  ),
  "âncora do directSpecular mudou — atualizar DIRECT_SPECULAR_ANCHOR em createDonationManager",
);
console.log("ok âncoras do shader — especular direto removível");

// --- Preview do admin ---

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

disposeBuildingShapeSharedResources();
console.log(`\n${BUILDING_SHAPES.length} formatos OK`);
