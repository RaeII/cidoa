// node scripts/check-building-textures.mjs — manager real, sem servidor, navegador ou GPU.
import assert from "node:assert/strict";
import * as THREE from "three";
import { build } from "esbuild";

const threeUrl = import.meta.resolve("three");
const bundle = await build({
  stdin: {
    contents: [
      "export * from './src/scene/managers/createDonationManager.ts';",
      ...["building", "texture", "blockLayout"].map(
        (name) => `export * from './src/scene/config/${name}Config.ts';`,
      ),
    ].join("\n"),
    resolveDir: process.cwd(),
  },
  bundle: true, format: "esm", platform: "node", write: false,
  external: [threeUrl],
  define: { "import.meta.env.DEV": "false" },
  plugins: [{
    name: "texture-io",
    setup(builder) {
      builder.onResolve({ filter: /^three$/ }, () => ({ path: threeUrl, external: true }));
      builder.onResolve({ filter: /facadeTexture(Loader|Manifest)$/ }, ({ path }) => ({
        path, namespace: "texture-io",
      }));
      builder.onLoad({ filter: /.*/, namespace: "texture-io" }, ({ path }) => ({
        contents: path.endsWith("Manifest") ? `
          export const resolveFacadeFolder = (value) => value?.replace(/^texture\\//, '') ?? '';
          export const getFacadeMapUrls = () => ({});
        ` : `
          import { Texture } from ${JSON.stringify(threeUrl)};
          const cache = new Map();
          export const initFacadeTextureLoader = () => {};
          export const peekFacadeTextureSet = (value) => {
            const folder = value.replace(/^texture\\//, '');
            if (!cache.has(folder)) {
              const color = new Texture();
              color.name = folder;
              cache.set(folder, { color, normal: null, roughness: null, metalness: null, displacement: null });
            }
            return cache.get(folder);
          };
          export const loadFacadeTextureSet = async (value) => peekFacadeTextureSet(value);
          export const loadFacadeNormals = async () => {};
        `,
      }));
    },
  }],
});
const api = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`);
const scene = new THREE.Scene();
const manager = api.createDonationManager({
  scene,
  renderer: { capabilities: { getMaxAnisotropy: () => 4 } },
  buildingSettings: api.createDefaultBuildingSettings(),
  textureSettings: { ...api.createDefaultTextureSettings(), textureKey: "texture/global" },
  blockLayoutSettings: api.createDefaultBlockLayoutSettings(),
});
manager.setFacadeTexturePool(["texture/global", "texture/saved", "texture/selected"]);
manager.setDonations([{ id: 1, value: 100 }, { id: 2, value: 50 }]);
const customization = {
  buildingShape: "default", textureKey: null, tilingScale: 1, color: "#ffffff",
  rooftopType: "none", signText: "", signSides: 1, edgeLightType: "none",
  hologramImage: null,
};
const highlight = () => scene.children.find((mesh) =>
  mesh.isMesh && !mesh.isInstancedMesh && Array.isArray(mesh.material)
  && mesh.material[0].isMeshPhysicalMaterial && mesh.visible,
);
manager.setFocusedDonation(1);
const randomTexture = highlight().material[0].map;
manager.setFocusedDonation(null);
manager.updateDonationCustomization(1, { ...customization, textureKey: "texture/saved" });
manager.setFocusedDonation(1);
const focusedMesh = highlight();
assert.equal(focusedMesh.material[0].map.name, "saved");
const childrenBefore = [...scene.children];
const geometryBefore = focusedMesh.geometry;
const matricesBefore = scene.children.filter((mesh) => mesh.isInstancedMesh)
  .map((mesh) => [mesh, mesh.instanceMatrix]);

manager.updateDonationCustomization(1, { ...customization, textureKey: "texture/selected" });
assert.equal(focusedMesh.material[0].map.name, "selected", "destaque manteve textura anterior");
assert.deepEqual(scene.children, childrenBefore, "troca recriou meshes da cidade");
assert.equal(focusedMesh.geometry, geometryBefore);
for (const [mesh, matrices] of matricesBefore) assert.equal(mesh.instanceMatrix, matrices);
const selectedGroup = scene.children.find((mesh) => mesh.isInstancedMesh
  && Array.isArray(mesh.material) && mesh.material[0].map?.name === "selected");
assert.equal(focusedMesh.material[0].map, selectedGroup.material[0].map, "cache não compartilhado");
assert.ok(selectedGroup.count > 0, "instância não migrou para textura selecionada");

manager.updateDonationCustomization(2, { ...customization, textureKey: "texture/global" });
assert.equal(focusedMesh.material[0].map.name, "selected", "outro prédio alterou destaque");
manager.updateDonationCustomization(1, { ...customization, textureKey: "texture/global" });
assert.equal(focusedMesh.material[0].map.name, "global");
manager.updateDonationCustomization(1, customization);
assert.equal(focusedMesh.material[0].map, randomTexture, "automática não restaurou textura sorteada");
manager.setFocusedDonation(null);
manager.setFocusedDonation(1);
assert.equal(highlight().material[0].map, randomTexture, "reabrir foco mudou textura");

// Batching dos formatos preserva a ordem de blending dos prédios esmaecidos no foco.
manager.setFocusedDonation(null);
for (const id of [1, 2]) {
  manager.updateDonationCustomization(id, { ...customization, buildingShape: "empire" });
}
const first = scene.children.find((mesh) => mesh.userData.donationId === 1);
const second = scene.children.find((mesh) => mesh.userData.donationId === 2);
const batched = first.geometry;
assert.equal(batched.groups.length, 8);
assert.equal(second.geometry, batched, "Empire não reutilizou geometria agrupada");
manager.setFocusedDonation(1);
assert.equal(first.geometry, batched, "Destaque opaco perdeu batching");
const original = second.geometry;
assert.equal(original.groups.length, 2293, "Transparência perdeu ordem original de desenho");
assert.ok(second.material.every((material) => material.transparent && material.opacity === 0.15));
manager.setFocusedDonation(2);
assert.equal(first.geometry, original, "Troca de foco não restaurou ordem de blending");
assert.equal(second.geometry, batched);
manager.setFocusedDonation(null);
assert.equal(first.geometry, batched);
assert.equal(second.geometry, batched);
assert.ok(first.material.every((material) => !material.transparent && material.opacity === 1));
const stableVersions = first.material.map((mat) => mat.version);
manager.setFocusedDonation(null);
assert.deepEqual(first.material.map((mat) => mat.version), stableVersions, "foco idêntico invalidou materiais");

// Frustum por quadra preserva todos os prédios que cruzam a imagem; probe restaura tudo.
manager.setDonations(Array.from({ length: 200 }, (_, i) => ({ id: 100 + i, value: 200 - i })));
manager.setRenderDistance(Infinity, Infinity, Infinity);
const buildings = () => scene.children.filter((mesh) => mesh.isInstancedMesh && Array.isArray(mesh.material) && mesh.material[0].isMeshPhysicalMaterial);
const full = buildings().map((mesh) => ({ mesh, count: mesh.count, matrices: mesh.instanceMatrix.array.slice(0, mesh.count * 16) }));
const originalMeshes = full.map(({ mesh, count, matrices }) => {
  const original = new THREE.InstancedMesh(mesh.geometry, mesh.material, count);
  original.instanceMatrix.array.set(matrices);
  return original;
});
const idsByPosition = new Map(Array.from({ length: 200 }, (_, i) => {
  const id = i + 100;
  const position = manager.getDonationWorldPosition(id);
  return [`${Math.fround(position.x)},${Math.fround(position.z)}`, id];
}));
const raycaster = new THREE.Raycaster();
const camera = new THREE.PerspectiveCamera(45, 9 / 16, 0.1, 500);
const projection = new THREE.Matrix4();
const bounds = new THREE.Box3();
const matrix = new THREE.Matrix4();
for (const [x, z] of [[0, 80], [80, 0], [0, -80], [-80, 0]]) {
  camera.position.set(x, 25, z);
  camera.lookAt(0, 8, 0);
  camera.updateMatrixWorld();
  const frustum = new THREE.Frustum().setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  let expected = 0;
  for (const { mesh, count, matrices } of full) {
    mesh.geometry.computeBoundingBox();
    for (let i = 0; i < count; i++) {
      bounds.copy(mesh.geometry.boundingBox).applyMatrix4(matrix.fromArray(matrices, i * 16));
      if (frustum.intersectsBox(bounds)) expected++;
    }
  }
  manager.updateDistanceCulling(camera.position, camera.getWorldDirection(new THREE.Vector3()), frustum);
  assert.equal(buildings().reduce((sum, mesh) => sum + mesh.count, 0), expected, "frustum perdeu prédio visível");
  for (const x of [-0.5, 0, 0.5]) {
    raycaster.setFromCamera(new THREE.Vector2(x, 0), camera);
    const hit = raycaster.intersectObjects(originalMeshes, false)[0];
    let expectedId = null;
    if (hit) {
      hit.object.getMatrixAt(hit.instanceId, matrix);
      expectedId = idsByPosition.get(`${matrix.elements[12]},${matrix.elements[14]}`);
    }
    const selected = manager.getClickedDonationId({ clientX: (x + 1) * 180, clientY: 320 }, camera,
      { getBoundingClientRect: () => ({ left: 0, top: 0, width: 360, height: 640 }) });
    assert.equal(selected, expectedId, "compactação mudou o id do prédio selecionado");
  }
  const compacted = buildings().map((mesh) => mesh.instanceMatrix.array.slice(0, mesh.count * 16));
  const versions = buildings().map((mesh) => mesh.instanceMatrix.version);
  manager.updateDistanceCulling(camera.position, camera.getWorldDirection(new THREE.Vector3()), frustum);
  assert.deepEqual(buildings().map((mesh) => mesh.instanceMatrix.version), versions);
  manager.beginEnvCapture(true);
  for (const { mesh, count, matrices } of full) {
    assert.equal(mesh.count, count);
    assert.deepEqual(mesh.instanceMatrix.array.slice(0, count * 16), matrices);
  }
  manager.endEnvCapture();
  assert.deepEqual(buildings().map((mesh) => mesh.instanceMatrix.array.slice(0, mesh.count * 16)), compacted);
}
for (const mesh of originalMeshes) mesh.dispose();

// Pool existe enquanto houver LEDs; trocar/remover um de vários não recompõe as luzes.
manager.updateDonationCustomization(100, { ...customization, edgeLightType: "led" });
const lights = scene.children.filter((object) => object.isPointLight);
assert.equal(lights.length, 8);
manager.updateDonationCustomization(101, { ...customization, edgeLightType: "led" });
manager.updateDonationCustomization(100, customization);
assert.deepEqual(scene.children.filter((object) => object.isPointLight), lights);
manager.updateDonationCustomization(101, customization);
assert.equal(scene.children.filter((object) => object.isPointLight).length, 0);
manager.updateDonationCustomization(100, { ...customization, edgeLightType: "led" });
assert.equal(scene.children.filter((object) => object.isPointLight).length, 8);
manager.setDonations([]);
assert.equal(scene.children.filter((object) => object.isPointLight).length, 0, "filtro deixou pool sem LED");
let batchDisposed = false;
batched.addEventListener("dispose", () => { batchDisposed = true; });
manager.dispose();
assert.ok(batchDisposed, "Dispose do manager não liberou geometria agrupada");
console.log("ok texturas — destaque, grupo, global, automática, isolamento e reutilização de meshes/cache");
console.log("ok batching — foco, troca de foco, transparência, restauração e dispose no manager real");
console.log("ok mobile — frustum por quadra, buffers estáveis, probe completo e ciclo das luzes LED");
