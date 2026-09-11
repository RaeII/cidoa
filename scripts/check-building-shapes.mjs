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
    contents: ["createBuildingShapeMesh", "createEdgeLightMesh", "createPreviewScene", "createParapetMesh"]
      .map((name) => `export * from './src/scene/builders/${name}.ts';`).join("\n"),
    resolveDir: process.cwd(),
  },
  bundle: true, format: "esm", platform: "node", write: false,
});
const { BUILDING_SHAPES, createBuildingShapeMesh, createUnitBuildingGeometry,
  disposeBuildingShapeSharedResources, createEdgeLightMesh, resolveSubject, frameBox,
  createParapetGeometry, getParapetHeightScale, createBuildingParapets } =
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

// --- Platibandas: vão livre, contorno real, escala, instancing e ciclo de vida ---
const flatRoofs = ["default", "twisted", "octagonal", "setback", "tapered", "hearst"];
const trimMaterial = new THREE.MeshStandardMaterial();
for (const shape of BUILDING_SHAPES) {
  for (let variant = 0; variant < 3; variant++) {
    const geometry = createParapetGeometry(shape, variant);
    if (!flatRoofs.includes(shape)) {
      assert.equal(geometry, null, `${shape}: coroamento existente deve ser preservado`);
      continue;
    }
    const mesh = new THREE.Mesh(geometry, trimMaterial);
    const trimBox = new THREE.Box3().setFromObject(mesh);
    assert.ok(Math.abs(trimBox.min.y) < 1e-6, `${shape}: platibanda flutuante`);
    assert.ok(trimBox.max.y > 0 && trimBox.max.y < 0.12, `${shape}: platibanda desproporcional`);
    for (const name of ["position", "normal", "color", "aProjPosition", "aProjNormal"]) {
      assert.ok(geometry.getAttribute(name).array.every(Number.isFinite), `${shape}: ${name} inválido`);
    }
    assert.deepEqual(geometry.getAttribute("aProjPosition").array, geometry.getAttribute("position").array);
    assert.deepEqual(geometry.getAttribute("aProjNormal").array, geometry.getAttribute("normal").array);
    const cast = (x, z) => new THREE.Raycaster(new THREE.Vector3(x, 1, z), new THREE.Vector3(0, -1, 0)).intersectObject(mesh);
    assert.equal(cast(0, 0).length, 0, `${shape}: centro da cobertura fechado`);
    const edgeX = trimBox.max.x / (variant === 2 ? 1.045 : variant === 1 ? 1.025 : 1.018);
    assert.ok(cast(edgeX * 0.97, 0).length > 0, `${shape}: borda ausente`);
    if (shape === "octagonal") assert.equal(cast(0.48, 0.48).length, 0, "octagonal: canto quadrado indevido");
    const expectedWidth = shape === "setback" ? 0.54 : shape === "tapered" ? 0.36 : 1;
    assert.ok(Math.abs(edgeX * 2 - expectedWidth) < 1e-6, `${shape}: contorno fora da fachada`);
    geometry.dispose();
  }
}
trimMaterial.dispose();
assert.equal(getParapetHeightScale(new THREE.Vector3(2, 30, 2)), 2, "acabamento esticado pela altura do prédio");
assert.ok(getParapetHeightScale(new THREE.Vector3(2, 0.5, 2)) * 0.115 < 0.06, "acabamento grande demais em prédio baixo");

const trimScene = new THREE.Scene();
const parapets = createBuildingParapets(trimScene);
// Textura chega depois da criação; normal/foco recebem os mesmos mapas, sem reflexo.
const roofMaterial = new THREE.MeshPhysicalMaterial({
  color: "#b9b6b1", map: new THREE.Texture(), normalMap: new THREE.Texture(),
  bumpMap: new THREE.Texture(), roughness: 0, metalness: 1, clearcoat: 1, envMapIntensity: 5,
});
roofMaterial.normalScale.set(3, 3);
roofMaterial.bumpScale = 0.2;
parapets.updateTexture(roofMaterial);
for (const material of parapets.materials) {
  assert.equal(material.map, roofMaterial.map);
  assert.equal(material.normalMap, roofMaterial.normalMap);
  assert.equal(material.bumpMap, roofMaterial.bumpMap);
  assert.deepEqual(material.normalScale.toArray(), [3, 3]);
  assert.equal(material.bumpScale, 0.2);
  assert.ok(Math.abs(material.color.r - roofMaterial.color.r * 0.8) < 1e-8);
  assert.equal(material.roughness, 1);
  for (const key of ["metalness", "clearcoat", "specularIntensity", "envMapIntensity"]) assert.equal(material[key], 0);
}
const roofMaps = [roofMaterial.map, roofMaterial.normalMap, roofMaterial.bumpMap];
roofMaterial.map = roofMaterial.normalMap = roofMaterial.bumpMap = null;
parapets.updateTexture(roofMaterial);
for (const material of parapets.materials) {
  assert.equal(material.map, null, "desativar texturas deixou mapa na platibanda");
  assert.equal(material.normalMap, null);
  assert.equal(material.bumpMap, null);
}
// Reativar antes do dispose verifica que recursos compartilhados continuam vivos.
[roofMaterial.map, roofMaterial.normalMap, roofMaterial.bumpMap] = roofMaps;
parapets.updateTexture(roofMaterial);
let roofTextureDisposed = false;
roofMaterial.map.addEventListener("dispose", () => { roofTextureDisposed = true; });
const trimBuildings = Array.from({ length: 120 }, (_, id) => ({
  id, shape: "default", position: new THREE.Vector3(id * 3, 5, 0), scale: new THREE.Vector3(2, 10, 2),
}));
parapets.rebuild(trimBuildings);
const batches = () => trimScene.children.filter((mesh) => mesh.isInstancedMesh);
const instanceCount = () => batches().reduce((count, mesh) => count + mesh.count, 0);
assert.equal(batches().length, 3, "cidade deve usar três modelos em três draw calls");
assert.equal(instanceCount(), 120);
const batchForId = (id) => {
  const matrix = new THREE.Matrix4();
  for (const mesh of batches()) {
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix);
      if (matrix.elements[12] === id * 3) {
        assert.equal(matrix.elements[13], 10, "platibanda fora da cobertura");
        assert.equal(matrix.elements[5], 2, "altura do prédio deformou acabamento");
        return mesh.geometry;
      }
    }
  }
};
const originalVariant = batchForId(7);
parapets.rebuild([...trimBuildings].reverse());
assert.equal(batchForId(7), originalVariant, "reordenar doações mudou modelo");
parapets.updateVisibility((position) => position.x < 30);
assert.equal(instanceCount(), 10, "culling não compactou platibandas");
parapets.setFocus(7);
assert.equal(instanceCount(), 9, "edifício focado duplicado no batch");
assert.ok(trimScene.children.some((mesh) => !mesh.isInstancedMesh && mesh.visible && mesh.position.x === 21));
parapets.updateVisibility(() => false);
assert.equal(instanceCount(), 0);
assert.ok(trimScene.children.filter((mesh) => !mesh.isInstancedMesh).every((mesh) => !mesh.visible));
parapets.rebuild([]);
assert.equal(batches().length, 0, "dataset vazio deixou acabamentos antigos");
let trimDisposed = false;
originalVariant.addEventListener("dispose", () => { trimDisposed = true; });
parapets.dispose();
assert.equal(roofTextureDisposed, false, "platibanda descartou textura compartilhada da laje");
for (const map of roofMaps) map.dispose();
roofMaterial.dispose();
assert.ok(trimDisposed, "dispose não liberou geometria da platibanda");
assert.equal(trimScene.children.length, 0);
console.log("ok platibandas — 3 modelos, 6 contornos, vão livre, escala, culling, foco e dispose");

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
