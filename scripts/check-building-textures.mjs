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
manager.dispose();
console.log("ok texturas — destaque, grupo, global, automática, isolamento e reutilização de meshes/cache");
