// node scripts/check-horizon.mjs — runtime real, sem servidor, navegador ou GPU.
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import * as THREE from "three";
import { build } from "esbuild";

// Só as bordas de I/O são substituídas: cena, câmera, terreno e culling são reais.
const threeUrl = import.meta.resolve("three");
const mocks = {
  three: `
    export * from ${JSON.stringify(threeUrl)};
    export class WebGLRenderer {
      capabilities = { getMaxAnisotropy: () => 4 };
      domElement = {};
      setPixelRatio() {}
      setSize() {}
      render(scene, camera) { globalThis.horizonCheck.frame = { scene, camera }; }
      dispose() {}
    }
  `,
  OrbitControls: `
    import { Vector3 } from ${JSON.stringify(threeUrl)};
    export class OrbitControls {
      target = new Vector3();
      constructor(camera) { this.camera = camera; }
      update() { this.camera.lookAt(this.target); }
      dispose() {}
    }
  `,
  loadEnvironment: `
    export const loadEnvironment = () => ({
      updateSettings() {}, updatePosition() {}, setRadius() {}, setStarsVisible() {}, dispose() {}
    });
  `,
  facadeTextureLoader: `
    export const initFacadeTextureLoader = () => {};
    export const peekFacadeTextureSet = () => null;
    export const loadFacadeTextureSet = async () => null;
  `,
  facadeTextureManifest: `
    export const resolveFacadeFolder = (value) => value;
    export const getFacadeMapUrls = () => null;
  `,
};
const bundle = await build({
  stdin: {
    contents: [
      "export * from './src/scene/runtime/createCitySceneRuntime.ts';",
      ...["cityScene", "building", "texture", "ground", "terrain", "light", "horizon", "environment", "reflection", "blockLayout"]
        .map((name) => `export * from './src/scene/config/${name}Config.ts';`),
    ].join("\n"),
    resolveDir: process.cwd(),
  },
  bundle: true, format: "esm", platform: "node", write: false,
  external: [threeUrl],
  define: { "import.meta.env.DEV": "false" },
  plugins: [{
    name: "headless-io",
    setup(builder) {
      builder.onResolve({ filter: /three$|OrbitControls|loadEnvironment|facadeTexture(Loader|Manifest)/ }, ({ path }) => {
        const key = path === "three" ? path : path.split("/").at(-1).replace(/\.js$/, "");
        return key in mocks ? { path: key, namespace: "headless" } : undefined;
      });
      builder.onLoad({ filter: /.*/, namespace: "headless" }, ({ path }) => ({ contents: mocks[path] }));
    },
  }],
});
const api = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`);
globalThis.horizonCheck = {};
globalThis.window = { devicePixelRatio: 1, addEventListener() {}, removeEventListener() {} };
globalThis.requestAnimationFrame = (callback) => { globalThis.horizonCheck.nextFrame = callback; return 1; };
globalThis.cancelAnimationFrame = () => {};
let stats;
const settings = Object.fromEntries(
  ["Building", "Texture", "Ground", "Terrain", "Light", "Horizon", "Environment", "Reflection", "BlockLayout"]
    .map((name) => [`${name[0].toLowerCase()}${name.slice(1)}Settings`, api[`createDefault${name}Settings`]()]),
);
settings.reflectionSettings.enabled = false; // Sem captura GPU; alcance do probe verificado abaixo.
const runtime = api.createCitySceneRuntime({
  ...settings,
  mount: { clientWidth: 1920, clientHeight: 1080, appendChild() {}, contains: () => false },
  onStatsChange: (value) => { stats = value; },
});
let time = performance.now();
const advance = () => {
  for (let i = 0; i < 6; i++) globalThis.horizonCheck.nextFrame(time += 50);
};
const { scene, camera } = globalThis.horizonCheck.frame;
runtime.addDonations(Array.from({ length: 500 }, (_, i) => i + 1));
const ground = scene.children.find((mesh) => mesh.isMesh && mesh.position.y === -0.05);
const terrain = scene.children.find((mesh) => mesh.isMesh && !mesh.isInstancedMesh && mesh.geometry.attributes.color);
const terrainPositions = terrain.geometry.attributes.position.array.slice();
const terrainColors = terrain.geometry.attributes.color.array.slice();
const projection = camera.projectionMatrix.clone();
assert.equal(ground.geometry.attributes.position.count, 4, "Chão ganhou vértices");
assert.equal(ground.geometry.index.count, 6, "Chão deve continuar com dois triângulos");
assert(ground.position.y < Math.min(...terrainPositions.filter((_, i) => i % 3 === 1)));
assert.equal(ground.children.length, 0, "Camada cinza adicional voltou atrás das montanhas");
assert(camera.far <= 2000, "Câmera voltou a usar alcance excessivo");
const probe = scene.children.find((object) => object.type === "CubeCamera");
assert(probe.children.every((face) => face.far === 260), "Alcance do reflexo foi ampliado");

// Encurtar e reabrir a distância só deve mudar os prédios enviados ao render.
camera.position.set(0, 30, 200);
const counts = [];
for (const distance of [600, 100, 600]) {
  runtime.updateHorizonSettings({ ...settings.horizonSettings, distance, fogDensity: 0 });
  advance();
  assert(camera.projectionMatrix.equals(projection), "Slider alterou a projeção da câmera");
  assert.deepEqual(terrain.geometry.attributes.position.array, terrainPositions, "Slider alterou as montanhas");
  assert.deepEqual(terrain.geometry.attributes.color.array, terrainColors, "Slider recoloriu as montanhas");
  assert(terrain.visible && ground.visible);
  counts.push({
    culled: stats.culled,
    instances: scene.children.filter((mesh) => mesh.isInstancedMesh && mesh.visible)
      .reduce((sum, mesh) => sum + mesh.count, 0),
  });
}
assert(counts[1].culled > counts[0].culled, "Distância não ocultou prédios");
assert(counts[0].instances - counts[1].instances >= counts[1].culled - counts[0].culled,
  "Culling deve reduzir as instâncias enviadas à GPU");
assert.deepEqual(counts[2], counts[0], "Prédios não reapareceram ao ampliar a distância");

camera.position.set(0, 30, 0);
runtime.updateHorizonSettings({ ...settings.horizonSettings, distance: 600, backDistance: 10 });
advance();
const hiddenBehind = stats.culled;
runtime.updateHorizonSettings({ ...settings.horizonSettings, distance: 600, backDistance: 600 });
advance();
assert(stats.culled < hiddenBehind, "Controle traseiro não restaurou os prédios");
// Os formatos compartilham material e reutilizam as duas geometrias.
const planeGeometry = ground.geometry;
let circleGeometry;
for (const groundEdgeMode of ["circular", "square", "straight", "circular", "straight"]) {
  for (const groundDistance of [40, 300, 2200]) {
    runtime.updateHorizonSettings({ ...settings.horizonSettings, groundEdgeMode, groundDistance });
    advance();
    if (groundEdgeMode === "circular") {
      circleGeometry ??= ground.geometry;
      assert.equal(ground.geometry, circleGeometry);
      assert.equal(ground.geometry.type, "CircleGeometry");
    } else {
      assert.equal(ground.geometry, planeGeometry);
    }
    if (groundEdgeMode !== "straight") assert.equal(ground.scale.x, groundDistance * 2);
    assert.equal(camera.far, settings.horizonSettings.renderDistance, "Modo do chão mexeu no far");
    assert.deepEqual(terrain.geometry.attributes.position.array, terrainPositions);
    assert(ground.visible);
  }
}

// Raios na imagem: todo ponto antes do corte reto deve ter chão; depois deve ficar vazio.
// Cobre orientação, pan, inclinação, aspecto, zoom e distância sem servidor/navegador/GPU.
const groundSurface = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.05);
const raycaster = new THREE.Raycaster();
let checkedRays = 0;
for (const aspect of [9 / 16, 16 / 9, 32 / 9]) {
  for (const zoom of [0.75, 1, 2]) {
    camera.aspect = aspect;
    camera.zoom = zoom;
    for (const renderDistance of [60, 600, 2000]) {
      for (const groundDistance of [20, 300, 2200]) {
        runtime.updateHorizonSettings({ ...settings.horizonSettings, renderDistance, groundDistance });
        for (let yaw = 0; yaw < Math.PI * 2; yaw += Math.PI / 4) {
          camera.position.set(Math.sin(yaw) * 23 + 5, yaw < Math.PI ? 19 : 70, Math.cos(yaw) * 23 - 5);
          advance();
          camera.updateMatrixWorld(true);
          ground.updateMatrixWorld(true);
          const forward = camera.getWorldDirection(new THREE.Vector3());
          forward.y = 0;
          forward.normalize();
          const edge = [-0.5, 0.5].map((x) => new THREE.Vector3(x, 0.5, 0).applyMatrix4(ground.matrixWorld));
          for (const point of edge) {
            assert(Math.abs(point.clone().sub(camera.position).dot(forward) - groundDistance) < 1e-6,
              "Distância não posicionou a borda à frente da câmera");
          }
          assert(Math.abs(edge[0].project(camera).y - edge[1].project(camera).y) < 1e-6,
            "Borda deixou de ser horizontal na tela");
          for (const x of [-0.999, -0.75, 0, 0.75, 0.999]) {
            for (const y of [-0.999, -0.75, -0.5, 0, 0.5, 0.999]) {
              raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
              const point = raycaster.ray.intersectPlane(groundSurface, new THREE.Vector3());
              if (!point) continue;
              const depth = -point.clone().applyMatrix4(camera.matrixWorldInverse).z;
              if (depth < camera.near || depth > camera.far) continue;
              const shouldHit = point.clone().sub(camera.position).dot(forward) < groundDistance;
              assert.equal(raycaster.intersectObject(ground).length > 0, shouldHit,
                `Quina/buraco: aspect=${aspect}, zoom=${zoom}, far=${renderDistance}, chão=${groundDistance}, yaw=${yaw}`);
              checkedRays++;
            }
          }
        }
      }
    }
  }
}
assert(checkedRays > 1000, "Amostragem insuficiente do frustum");
camera.aspect = 16 / 9;
camera.zoom = 1;
runtime.updateHorizonSettings(settings.horizonSettings);
advance();
// O cull do relevo é RADIAL: o arco só some se o raio passar do canto do frustum (~1.55*far
// com FOV 58° em 16:9). Amarrado ao alcance dos EDIFÍCIOS (208), o arco cortava as colinas.
const terrainCullRadius = () => Math.sqrt(terrain.material.userData.cullUniforms.uCullFrontSq.value);
const terrainCullBackRadius = () => Math.sqrt(terrain.material.userData.cullUniforms.uCullBackSq.value);
for (const renderDistance of [60, 200, 600, 2000]) {
  // groundDistance no padrão de fábrica (1.1*horizonte) = chão acompanhando o horizonte.
  runtime.updateHorizonSettings({
    ...settings.horizonSettings,
    renderDistance,
    groundDistance: renderDistance * 1.1,
  });
  advance();
  assert.equal(camera.far, renderDistance, "camera.far não seguiu o horizonte");
  assert(ground.scale.x / 2 > camera.far, "Laterais do chão encolheram");
  assert(terrainCullRadius() > camera.far * 1.6, `Arco do relevo entrou no frustum (${renderDistance})`);
  assert(terrainCullBackRadius() > camera.far * 1.6, `Arco traseiro do relevo entrou no frustum (${renderDistance})`);
}
// Slider de edifício não pode mais encolher o arco do relevo — o painel promete isso.
runtime.updateHorizonSettings({ ...settings.horizonSettings, distance: 100, backDistance: 10 });
advance();
assert(terrainCullRadius() > camera.far * 1.6, "Distância dos edifícios voltou a cortar o relevo");
assert(terrainCullBackRadius() > camera.far * 1.6, "Distância traseira voltou a cortar o relevo");
runtime.updateHorizonSettings(settings.horizonSettings);
advance();
runtime.updateGroundSettings(settings.groundSettings);
runtime.updateHorizonSettings(settings.horizonSettings);
advance();

runtime.updateTerrainSettings({ ...settings.terrainSettings, enabled: false });
await delay(100); // Rebuild do terreno tem debounce de 60ms.
advance();
assert(ground.visible && !terrain.visible, "Desligar montanhas removeu o chão");

// Regressão Float32: triângulos de 1 milhão de unidades deformavam mais que a folga de 0.01u.
const f = Math.fround;
function floatViewPosition(vector, matrix) {
  const v = [vector.x, vector.y, vector.z, 1].map(f);
  const e = matrix.elements.map(f);
  return new THREE.Vector3(...[0, 1, 2].map((row) =>
    v.reduce((sum, n, column) => f(sum + f(n * e[column * 4 + row])), 0)));
}
ground.position.set(0, -0.05, 0);
ground.updateMatrixWorld(true);
// Três vértices distintos do plano; repetir um vértice produz normal zero e falso positivo.
const planeSample = [0, 1, 2];
let worstError = 0;
for (let yaw = 0; yaw < Math.PI * 2; yaw += 0.03) {
  camera.position.set(Math.sin(yaw) * 23, 19, Math.cos(yaw) * 23);
  camera.lookAt(0, 9, 0);
  camera.updateMatrixWorld(true);
  const modelView = new THREE.Matrix4().multiplyMatrices(camera.matrixWorldInverse, ground.matrixWorld);
  const points = planeSample.map((i) => floatViewPosition(
    new THREE.Vector3().fromBufferAttribute(ground.geometry.attributes.position, i), modelView));
  const roundedPlane = new THREE.Plane().setFromCoplanarPoints(...points);
  assert(roundedPlane.normal.lengthSq() > 0.99, "Amostra Float32 degenerada");
  const center = ground.position.clone().applyMatrix4(camera.matrixWorldInverse);
  worstError = Math.max(worstError, Math.abs(roundedPlane.distanceToPoint(center)));
}
assert(worstError < 0.001, `Plano invade a folga até o terreno: erro ${worstError}`);
const resources = [planeGeometry, circleGeometry, ground.material];
let disposed = 0;
resources.forEach((resource) => resource.addEventListener("dispose", () => { disposed++; }));
runtime.dispose();
assert.equal(disposed, resources.length);
console.log(`Raios verificados: ${checkedRays}`);
console.log("Horizonte OK: modos reto/circular/quadrado, sem fundo cinza adicional, precisão Float32, montanhas, culling, reflexos e dispose.");
