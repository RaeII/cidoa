// node scripts/check-spirit-combat.mjs — armas e cidade reais; sem GPU/servidor/navegador.
import assert from "node:assert/strict";
import * as THREE from "three";
import { build } from "esbuild";

process.on("uncaughtException", (error) => {
  console.error(error.stack?.replace(/data:text\/javascript;base64,[A-Za-z0-9+/=]+/g, "combat-bundle"));
  process.exit(1);
});

const threeUrl = import.meta.resolve("three");
const bundle = await build({
  stdin: { resolveDir: process.cwd(), contents: `
    export * from './src/scene/managers/createDonationManager.ts';
    export * from './src/scene/managers/createSpiritCombat.ts';
    export * from './src/scene/config/buildingConfig.ts';
    export * from './src/scene/config/textureConfig.ts';
    export * from './src/scene/config/blockLayoutConfig.ts';
  ` },
  bundle: true, format: "esm", platform: "node", write: false,
  define: { "import.meta.env.DEV": "false" },
  plugins: [{ name: "headless-textures", setup(builder) {
    builder.onResolve({ filter: /^three$/ }, () => ({ path: threeUrl, external: true }));
    builder.onResolve({ filter: /facadeTexture(Loader|Manifest)$/ }, ({ path }) => ({ path, namespace: "textures" }));
    builder.onLoad({ filter: /.*/, namespace: "textures" }, ({ path }) => ({ contents: path.endsWith("Loader")
      ? "export const initFacadeTextureLoader = () => {}; export const peekFacadeTextureSet = () => null; export const loadFacadeTextureSet = async () => null;"
      : "export const resolveFacadeFolder = (value) => value; export const getFacadeMapUrls = () => null;" }));
  } }],
});
const api = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`);
const scene = new THREE.Scene();
const textureSettings = api.createDefaultTextureSettings();
const layout = api.createDefaultBlockLayoutSettings();
const city = api.createDonationManager({ scene, renderer: { capabilities: { getMaxAnisotropy: () => 4 } },
  buildingSettings: api.createDefaultBuildingSettings(), textureSettings, blockLayoutSettings: layout });
const entries = Array.from({ length: 80 }, (_, i) => ({ id: i + 1, value: i + 1 }));
city.setDonations(entries);
const neighbor = city.getDonationWorldPosition(1).clone();
const top = city.getDonationWorldPosition(80);
const trace = (id) => {
  const position = city.getDonationWorldPosition(id);
  return city.traceBuilding(position.clone().add(new THREE.Vector3(0, 6, 0)), position.clone().setY(-1));
};
assert.equal(trace(80).donationId, 80);
const from = top.clone().add(new THREE.Vector3(0, 6, 0));
assert.equal(city.traceBuilding(from, from.clone().add(new THREE.Vector3(0, -1, 0))), null, "Raio atingiu além do segmento");
const instanceCount = () => scene.children.filter((o) => o.isInstancedMesh).reduce((n, o) => n + o.count, 0);
city.beginEnvCapture(true); const before = instanceCount(); city.endEnvCapture();
assert.equal(city.destroyBuildings([80, 80]).length, 1);
assert.equal(city.getDonationCount(), 79);
assert.equal(city.getDonationWorldPosition(80), null);
assert(city.getDonationWorldPosition(1).equals(neighbor), "Destruição reorganizou vizinhos");
assert.equal(city.traceBuilding(from, top.clone().setY(-1)), null);
assert.equal(city.destroyBuildings([80]).length, 0);
city.beginEnvCapture(true); assert(instanceCount() < before, "Captura restaurou prédio/platibanda"); city.endEnvCapture();
city.setRenderDistance(0, 0); city.updateDistanceCulling(new THREE.Vector3(), new THREE.Vector3(0, 0, -1));
city.setRenderDistance(1000, 1000); city.updateDistanceCulling(new THREE.Vector3(), new THREE.Vector3(0, 0, -1));
assert.equal(city.traceBuilding(from, top.clone().setY(-1)), null, "Culling restaurou alvo destruído");
const customization = {
  color: "#4488ff", buildingShape: "twisted", tilingScale: 1, textureKey: null,
  rooftopType: "helicopter", signText: "", signSides: 1, edgeLightType: "led", hologramImage: null,
};
city.updateDonationCustomization(79, customization);
assert.equal(trace(79).donationId, 79, "Raio não atinge formato customizado");
const custom = scene.children.find((o) => o.userData.donationId === 79);
assert(custom);
const customPosition = city.getDonationWorldPosition(79).clone();
city.destroyBuildings([79]);
assert(!scene.children.includes(custom));
city.updateDonationCustomization(79, customization);
city.updateBlockLayout({ ...layout, streetWidth: layout.streetWidth + 0.1 });
city.updateTextureSettings({ ...textureSettings, textureKey: "test-facade" });
city.addDonation(99);
assert.equal(city.getDonationWorldPosition(79), null);
assert.equal(city.getDonationWorldPosition(80), null, "Rebuild restaurou destruídos");
city.setDonations(entries);
assert.equal(city.getDonationCount(), 78, "Snapshot restaurou destruídos");
assert(!city.getBuildingsInRadius(customPosition, 1000).includes(79));

// Projéteis reais contra o manager da cidade; alvos e explosões também reais.
let buildings = 0, targets = 0;
const combat = api.createSpiritCombat(scene, city, (b, t) => { buildings += b; targets += t; });
const jet = new THREE.Group();
const forward = new THREE.Vector3(0, 0, -1);
const root = scene.getObjectByName("Spirit combat");
const startAt = (position) => {
  jet.position.copy(position); jet.quaternion.identity();
  combat.start(jet.position, forward);
};
const step = (seconds, fire = false, bomb = false) => {
  for (let i = 0; i < seconds * 60; i++) combat.update(1 / 60, jet, forward, 0, fire, bomb && i === 0);
};
startAt(new THREE.Vector3(0, 90, 0));
step(0.6, true);
assert.equal(targets, 1, "Tiro não abateu alvo aéreo na mira");
const firstTarget = scene.getObjectByName("Spirit air target 1");
assert(!firstTarget.visible);
assert(root.children.some((o) => o.name === "Spirit explosion" && o.visible));
step(3.1); assert(firstTarget.visible, "Alvo não reapareceu");

// Tiro para baixo: impacto remove um prédio e aciona efeito/contador.
const shotTop = city.getDonationWorldPosition(78);
startAt(shotTop.clone().add(new THREE.Vector3(0, 7, 0)));
jet.rotation.x = -Math.PI / 2;
step(0.1, true);
assert.equal(city.getDonationWorldPosition(78), null);
assert.equal(buildings, 1);
// Bombardeio de uma quadra: gravidade + dano em área eliminam vários edifícios.
const bombTop = city.getDonationWorldPosition(77);
startAt(bombTop.clone().add(new THREE.Vector3(0, 9, 0)));
const countBeforeBomb = city.getDonationCount();
step(2, false, true);
assert(city.getDonationCount() < countBeforeBomb - 1, "Bomba não destruiu área");
assert(buildings > 2);
const afterBomb = buildings;
combat.stop(); step(2, true, true);
assert.equal(buildings, afterBomb, "Armas continuam ativas fora do voo");
assert(!root.visible);
startAt(new THREE.Vector3(1000, 90, 1000));
const objectCount = root.children.length;
step(20, true, true);
assert.equal(root.children.length, objectCount, "Pools cresceram sem limite");
assert(root.children.filter((o) => o.name === "Spirit shot").length === 32);
assert(root.children.filter((o) => o.name === "Spirit bomb").length === 6);
root.traverse((o) => assert.equal(o.layers.mask, 2));
const resources = new Set();
root.traverse((o) => { if (o.isMesh) { resources.add(o.geometry); resources.add(o.material); } });
let disposed = 0;
resources.forEach((r) => r.addEventListener("dispose", () => disposed++));
combat.dispose(); assert.equal(disposed, resources.size);
city.dispose();
console.log("Combate OK: tiros, gravidade, explosão em área, alvos, pools, descarte e remoção estável em culling/reflexos/rebuilds.");
