// node scripts/check-spirit.mjs — GLB real e voo sem servidor, navegador ou GPU.
import assert from "node:assert/strict";
import { getEventListeners } from "node:events";
import { readFile } from "node:fs/promises";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { build } from "esbuild";

globalThis.window = new EventTarget();
globalThis.document = new EventTarget();
globalThis.HTMLElement = class {
  constructor(editable = false) { this.isContentEditable = editable; }
  closest() { return null; }
};
globalThis.ImageBitmap = class {
  closed = 0;
  close() { this.closed++; }
};
globalThis.spiritCheck = { requests: [] };
const threeUrl = import.meta.resolve("three");
const bundle = await build({
  stdin: {
    contents: "export * from './src/scene/managers/createSpiritFlight.ts'; export * from './src/scene/managers/createSpiritCourse.ts';",
    resolveDir: process.cwd(),
  },
  bundle: true, format: "esm", platform: "node", write: false,
  plugins: [{
    name: "flight-io",
    setup(builder) {
      builder.onResolve({ filter: /^three$/ }, () => ({ path: threeUrl, external: true }));
      builder.onResolve({ filter: /GLTFLoader|\.glb\?url$/ }, ({ path }) => ({ path, namespace: "flight-io" }));
      builder.onLoad({ filter: /.*/, namespace: "flight-io" }, ({ path }) => ({
        contents: path.includes("GLTFLoader")
          ? `export class GLTFLoader {
              loadAsync(url) { return new Promise((resolve, reject) => globalThis.spiritCheck.requests.push({ url, resolve, reject })); }
            }`
          : 'export default "b2-spirit.glb";',
      }));
    },
  }],
});
const { createSpiritFlight, createSpiritCourse } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`);
const glb = await readFile(new URL("../src/assets/plane/b2-spirit.glb", import.meta.url));
const parseModel = () => new GLTFLoader().register(() => ({
  name: "headless-textures",
  // Decodificação de imagem exige DOM; geometria, materiais e hierarquia continuam reais.
  loadTexture: () => Promise.resolve(new THREE.Texture(new ImageBitmap())),
})).parseAsync(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength), "");
const flush = () => new Promise((resolve) => setImmediate(resolve));
const keyboard = (code, options = {}, type = "keydown") => {
  const event = new Event(type, { cancelable: true });
  Object.assign(event, { code, repeat: false, ctrlKey: false, altKey: false, metaKey: false }, options);
  window.dispatchEvent(event);
  return event;
};
const setup = (aspect = 16 / 9) => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(58, aspect, 0.1, 600);
  camera.position.set(-13, 19, -15);
  const controls = {
    enabled: true, autoRotate: false, enableDamping: true,
    target: new THREE.Vector3(0, 9, 0),
    update() { camera.lookAt(this.target); },
  };
  controls.update();
  let state;
  const flight = createSpiritFlight({ scene, camera, controls, onChange: (next) => { state = next; } });
  const jet = scene.getObjectByName("B-2 Spirit");
  const streaks = scene.getObjectByName("Spirit speed streaks");
  const advance = (seconds, fps = 60) => {
    for (let i = 0; i < Math.round(seconds * fps); i++) flight.update(1 / fps);
  };
  const savedPosition = camera.position.clone();
  const savedTarget = controls.target.clone();
  const savedQuaternion = camera.quaternion.clone();
  const checkRestored = () => {
    assert(camera.position.distanceTo(savedPosition) < 1e-8, "Posição não restaurada");
    assert(controls.target.distanceTo(savedTarget) < 1e-8, "Alvo não restaurado");
    assert(camera.quaternion.angleTo(savedQuaternion) < 1e-7, "Rotação não restaurada");
    assert.equal(camera.fov, 58);
    assert.equal(camera.layers.mask, 1);
    assert(controls.enabled && !controls.autoRotate);
    assert(!jet.visible && !streaks.visible);
  };
  return { scene, camera, controls, flight, jet, streaks, advance, checkRestored, get state() { return state; } };
};

const context = setup();
const { flight, camera, controls, jet, streaks, advance } = context;
assert.equal(spiritCheck.requests.length, 0, "Asset deve carregar só ao ativar");
assert(!keyboard("Space").defaultPrevented, "Tecla capturada fora do voo");
flight.start();
flight.start();
assert.equal(spiritCheck.requests.length, 1, "Cliques duplicaram download");
assert.equal(context.state.phase, "loading");
assert(!controls.enabled);
const gltf = await parseModel();
spiritCheck.requests.shift().resolve(gltf);
await flush();
assert.equal(context.state.phase, "entering");
assert(jet.position.clone().sub(camera.position).dot(camera.getWorldDirection(new THREE.Vector3())) < 0,
  "Entrada precisa começar atrás da câmera");
jet.updateMatrixWorld(true);
const body = jet.getObjectByName("B-2-airframe_0");
const canopy = jet.getObjectByName("B-2-canopy_1");
assert(body && canopy);
const localBounds = new THREE.Box3().setFromObject(body);
assert(localBounds.getSize(new THREE.Vector3()).length() < 10, "Escala original gigante");
const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(jet.quaternion);
const cockpit = new THREE.Box3().setFromObject(canopy).getCenter(new THREE.Vector3());
assert(cockpit.sub(jet.position).dot(forward) > 0, "Jato está voando de ré");
gltf.scene.traverse((object) => {
  assert.equal(object.layers.mask, 2, "Jato entrou no reflexo estático");
  if (/^LG|LandingOn/.test(object.name)) assert(!object.visible, "Trem de pouso exposto");
});
keyboard("Space");
assert(!context.state.boosted, "Turbo liberado durante entrada");
advance(2.7);
assert.equal(context.state.phase, "flying");
camera.updateMatrixWorld(true);
jet.updateMatrixWorld(true);
const projected = jet.position.clone().project(camera);
assert(Math.abs(projected.x) < 0.5 && Math.abs(projected.y) < 0.5 && projected.z < 1, "Jato fora do quadro");

const initialY = jet.position.y;
const initialYaw = jet.rotation.y;
keyboard("KeyW"); keyboard("KeyA"); advance(1);
assert(jet.position.y > initialY + 9 && jet.rotation.y > initialYaw + 0.4, "W/A não manobram com resposta ampliada");
assert(jet.rotation.x > 0.9, "Nariz não acompanha subida acentuada");
keyboard("KeyW", {}, "keyup"); keyboard("KeyA", {}, "keyup");
const turningY = jet.position.y;
const turningYaw = jet.rotation.y;
keyboard("KeyS"); keyboard("KeyD"); advance(2);
assert(jet.position.y < turningY && jet.rotation.y < turningYaw, "S/D não manobram");
window.dispatchEvent(new Event("blur"));
advance(3);
const releasedYaw = jet.rotation.y;
advance(1);
assert(Math.abs(jet.rotation.y - releasedYaw) < 0.001, "Tecla presa após perder foco");
keyboard("Space", { ctrlKey: true });
assert(!context.state.boosted, "Atalho com modificador acionou turbo");
const inputEvent = new Event("keydown", { cancelable: true });
Object.defineProperties(inputEvent, { code: { value: "Space" }, target: { value: new HTMLElement(true) } });
window.dispatchEvent(inputEvent);
assert(!inputEvent.defaultPrevented && !context.state.boosted, "Campo editável acionou turbo");

const cruiseStart = jet.position.clone(); advance(1);
const cruiseDistance = jet.position.distanceTo(cruiseStart);
assert(keyboard("Space").defaultPrevented);
keyboard("Space", { repeat: true });
assert(context.state.boosted, "Repetição desativou turbo");
advance(3);
const boostStart = jet.position.clone(); advance(1);
assert(jet.position.distanceTo(boostStart) > cruiseDistance * 2.8, "Turbo não acelera deslocamento");
assert(camera.fov > 72 && streaks.visible && streaks.material.opacity > 0.3, "Efeito de velocidade ausente");
keyboard("Space"); advance(4);
assert(!context.state.boosted && camera.fov < 58.01 && !streaks.visible, "Turbo não retorna ao normal");
keyboard("KeyS"); advance(40);
assert(jet.position.y >= 3.5, "Jato atravessou o chão");
document.dispatchEvent(new Event("visibilitychange"));
keyboard("Escape");
assert.equal(context.state.phase, "returning");
advance(1);
context.checkRestored();
assert.equal(context.state.phase, "idle");

// Reabrir usa o modelo já carregado; fechar funciona também durante a chegada.
flight.start();
assert.equal(spiritCheck.requests.length, 0);
assert.equal(context.state.phase, "entering");
advance(0.4); flight.stop(); advance(1); context.checkRestored();
const resources = new Set([streaks.geometry, streaks.material]);
const images = new Set();
gltf.scene.traverse((object) => {
  if (!object.isMesh) return;
  resources.add(object.geometry);
  for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
    resources.add(material);
    for (const value of Object.values(material)) if (value instanceof THREE.Texture) {
      resources.add(value); images.add(value.image);
    }
  }
});
let disposals = 0;
resources.forEach((resource) => resource.addEventListener("dispose", () => disposals++));
flight.dispose();
assert.equal(disposals, resources.size, "Recursos GLB/efeito vazaram ou foram descartados duas vezes");
images.forEach((bitmap) => assert.equal(bitmap.closed, 1));
assert.equal(context.scene.children.length, 0);
assert.equal(getEventListeners(window, "keydown").length, 0);
assert.equal(getEventListeners(document, "visibilitychange").length, 0);

// Cancelamento, erro/retry e download concluído depois de desmontar.
const pending = setup();
pending.flight.start(); pending.flight.stop(); pending.checkRestored();
const late = await parseModel();
spiritCheck.requests.shift().resolve(late); await flush();
assert.equal(pending.state.phase, "idle", "Download reativou voo cancelado");
pending.flight.start(); pending.flight.stop(); pending.advance(1); pending.flight.dispose();
const failed = setup();
failed.flight.start(); spiritCheck.requests.shift().reject(new Error("offline")); await flush();
assert.equal(failed.state.phase, "error"); failed.checkRestored();
failed.flight.start();
const afterDispose = await parseModel();
let lateDisposals = 0;
afterDispose.scene.traverse((object) => {
  if (object.isMesh) object.geometry.addEventListener("dispose", () => lateDisposals++);
});
failed.flight.dispose();
spiritCheck.requests.shift().resolve(afterDispose); await flush();
assert(lateDisposals > 0, "Download tardio vazou geometria");
assert.equal(getEventListeners(window, "keydown").length, 0);

// Mesma trajetória em 30/60/120 FPS; câmera estreita conserva o modelo no quadro.
const trajectories = [];
for (const fps of [30, 60, 120]) {
  const sample = setup(9 / 16);
  sample.flight.start(); spiritCheck.requests.shift().resolve(await parseModel()); await flush();
  // Mesma entrada em todos os casos; variamos FPS só no trecho controlado.
  sample.advance(3);
  keyboard("KeyW"); keyboard("KeyA"); keyboard("Space");
  sample.advance(2, fps);
  trajectories.push(sample.jet.position.clone());
  sample.camera.updateMatrixWorld(true);
  sample.jet.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(sample.jet.getObjectByName("B-2-airframe_0"));
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    const point = new THREE.Vector3(x, y, z).project(sample.camera);
    assert(Math.abs(point.x) < 1 && Math.abs(point.y) < 1 && point.z < 1, "Asas cortadas na câmera vertical");
  }
  sample.flight.stop(); sample.advance(1); sample.flight.dispose();
}
assert(trajectories[0].distanceTo(trajectories[2]) < 1.2, "Movimento depende excessivamente do FPS");

// Percurso real: atravessar, passar por fora, não farmar, colisão contínua e pool limitado.
const courseScene = new THREE.Scene();
let progress;
const course = createSpiritCourse(courseScene, (value) => { progress = value; });
const origin = new THREE.Vector3(0, 70, 0);
const heading = new THREE.Vector3(0, 0, -1);
course.start(origin, heading);
const courseRoot = courseScene.getObjectByName("Spirit challenge");
const rings = courseRoot.children.filter((object) => object.name.startsWith("Spirit ring"));
const obstacles = courseRoot.children.filter((object) => object.name.startsWith("Spirit obstacle"));
assert.equal(rings.length, 6); assert.equal(obstacles.length, 6);
const crossRing = (ring, offset = 0) => {
  const start = ring.position.clone().add(new THREE.Vector3(offset, 0, 4));
  const end = ring.position.clone().add(new THREE.Vector3(offset, 0, -4));
  return course.update(start, end, heading, 1 / 30);
};
crossRing(rings[0]);
assert.equal(progress.score, 100); assert.equal(progress.rings, 1);
assert(!rings[0].visible);
crossRing(rings[0]);
assert.equal(progress.score, 100, "Mesmo anel pontuou novamente");
crossRing(rings[1], 6);
assert.equal(progress.score, 100, "Passar por fora da abertura contou ponto");
assert.equal(progress.feedback, "miss");

const hazard = obstacles[2];
const beforeHit = hazard.position.clone().add(new THREE.Vector3(0, 0, 12));
const afterHit = hazard.position.clone().add(new THREE.Vector3(0, 0, -12));
assert(course.update(beforeHit, afterHit, heading, 1 / 30), "Turbo atravessou obstáculo sem colisão");
assert.equal(progress.score, 50); assert.equal(progress.hits, 1);
assert(!hazard.visible);
assert(!course.update(beforeHit, afterHit, heading, 1 / 30));
assert.equal(progress.hits, 1, "Mesmo obstáculo penalizou repetidamente");
// Tangente fora do volume não deve colidir.
const clearHazard = obstacles[4];
const clearance = clearHazard.scale.x / 2 + 3;
const clearStart = clearHazard.position.clone().add(new THREE.Vector3(clearance, 0, 8));
const clearEnd = clearHazard.position.clone().add(new THREE.Vector3(clearance, 0, -8));
assert(!course.update(clearStart, clearEnd, heading, 1 / 30), "Passagem lateral segura colidiu");
const moving = obstacles[3].position.clone();
course.update(origin, origin, heading, 0.2);
assert(!moving.equals(obstacles[3].position), "Barra móvel ficou estática");
assert(courseRoot.children.every((object) => object.layers.mask === 2));
const uniqueResources = new Set(courseRoot.children.flatMap((object) => [object.geometry, object.material]));
assert.equal(uniqueResources.size, 4, "Percurso duplicou recursos compartilhados");
for (let i = 0; i < 100; i++) {
  const far = new THREE.Vector3(i * 20, 70, -i * 35);
  course.update(far, far, heading, 1 / 60);
}
assert.equal(courseRoot.children.length, 12, "Percurso cresceu sem limite");
course.stop();
assert(!courseRoot.visible);
const stoppedScore = progress.score;
crossRing(rings[0]); assert.equal(progress.score, stoppedScore);
course.start(origin, heading);
assert.equal(progress.score, 0); assert.equal(progress.hits, 0); assert.equal(progress.rings, 0);
// Sentido contrário não pontua; depois cruzar corretamente continua funcionando.
course.update(rings[0].position.clone().addScaledVector(heading, 3), rings[0].position.clone().addScaledVector(heading, -3), heading, 1 / 60);
assert.equal(progress.score, 0);
crossRing(rings[0]); assert.equal(progress.score, 100);
let courseDisposals = 0;
uniqueResources.forEach((resource) => resource.addEventListener("dispose", () => courseDisposals++));
course.dispose(); assert.equal(courseDisposals, 4); assert.equal(courseScene.children.length, 0);

// Xbox simulado na API real de entrada: standard, conexão, zona morta, bordas e foco.
const xbox = {
  index: 0, id: "Xbox Wireless Controller", connected: true, mapping: "standard",
  axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
};
let pads = [null, xbox];
Object.defineProperty(navigator, "getGamepads", { configurable: true, value: () => pads });
const controller = setup();
controller.advance(0.1);
assert.equal(controller.state.gamepad, "connected");
assert(!controller.flight.isActive());
xbox.buttons[9].pressed = true; controller.advance(0.1);
assert.equal(controller.state.phase, "loading", "Menu não iniciou voo");
assert.equal(spiritCheck.requests.length, 1);
xbox.buttons[9].pressed = false;
spiritCheck.requests.shift().resolve(await parseModel()); await flush();
controller.advance(3);
const neutralYaw = controller.jet.rotation.y;
const neutralY = controller.jet.position.y;
xbox.axes = [0.1, -0.1]; controller.advance(1);
assert.equal(controller.jet.rotation.y, neutralYaw); assert.equal(controller.jet.position.y, neutralY);
// Manche de jato: analógico para trás (+1) sobe, à frente (-1) desce.
xbox.axes = [0.75, 1]; controller.advance(1);
assert(controller.jet.rotation.y < neutralYaw - 0.3 && controller.jet.position.y > neutralY + 14, "Analógico para trás não controla curva/subida");
xbox.axes = [-1, -1]; const high = controller.jet.position.y; controller.advance(2);
assert(controller.jet.position.y < high - 20, "Analógico à frente não desce");
xbox.axes = [0, 0, 0, 0];

// Analógico direito orbita a câmera; o rumo do jato não muda e o enquadramento recentra.
const sideOffset = () => {
  const yaw = controller.jet.rotation.y;
  return controller.camera.position.clone().sub(controller.jet.position)
    .dot(new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)));
};
controller.advance(2);
assert(Math.abs(sideOffset()) < 1.5, "Câmera não repousa atrás da cauda");
const restYaw = controller.jet.rotation.y;
const restHeight = controller.camera.position.y - controller.jet.position.y;
// Para a direita: câmera vai para o lado esquerdo do jato e a vista gira para a direita.
xbox.axes = [0, 0, 1, 0]; controller.advance(2);
assert(sideOffset() < -7, "Analógico direito não girou a câmera");
xbox.axes = [0, 0, 0, -1]; controller.advance(2);
assert(controller.camera.position.y - controller.jet.position.y > restHeight + 8, "Analógico direito não elevou a câmera");
assert(Math.abs(controller.jet.rotation.y - restYaw) < 0.05, "Analógico direito desviou o rumo do jato");
// Olhar para baixo mantém a câmera acima do chão.
xbox.axes = [0, 0, 0, 1]; controller.advance(3);
assert(controller.camera.position.y >= 1.5, "Câmera afundou no chão");
xbox.axes = [0, 0, 0, 0]; controller.advance(2);
assert(Math.abs(sideOffset()) < 1.5, "Câmera não recentrou ao soltar o analógico direito");
xbox.buttons[0].pressed = true; controller.advance(1);
assert(controller.state.boosted, "A mantido pressionado alternou repetidamente");
xbox.buttons[0].pressed = false; controller.advance(0.1);
xbox.buttons[0].pressed = true; controller.advance(0.1);
assert(!controller.state.boosted, "Nova pressão de A não desativou turbo");
xbox.buttons[0].pressed = false;
document.hidden = true;
xbox.buttons[0].pressed = true; controller.advance(0.2);
assert(!controller.state.boosted, "Controle atuou em aba oculta");
document.hidden = false; controller.advance(0.1);
assert(!controller.state.boosted, "Retorno à aba acionou botão ainda pressionado");
xbox.buttons[0].pressed = false; controller.advance(0.1);
document.activeElement = new HTMLElement(true);
xbox.buttons[0].pressed = true; controller.advance(0.1);
assert(!controller.state.boosted, "Campo editável recebeu atalho do controle");
document.activeElement = null; controller.advance(0.1);
xbox.axes = [1, 0]; controller.advance(0.5);
pads = []; controller.advance(2);
assert.equal(controller.state.gamepad, "disconnected");
const disconnectedYaw = controller.jet.rotation.y; controller.advance(1);
assert(Math.abs(controller.jet.rotation.y - disconnectedYaw) < 0.001, "Analógico ficou preso ao desconectar");
// Teclado permanece funcional após desconectar.
keyboard("KeyW"); const keyboardY = controller.jet.position.y; controller.advance(1);
assert(controller.jet.position.y > keyboardY + 12); keyboard("KeyW", {}, "keyup");
pads = [xbox]; xbox.axes = [0, 0]; xbox.buttons[0].pressed = true;
controller.advance(0.1); assert(!controller.state.boosted, "Reconexão acionou turbo sozinho");
xbox.buttons[1].pressed = true; controller.advance(0.1);
assert.equal(controller.state.phase, "returning", "B não fechou voo");
controller.advance(1); controller.checkRestored();
xbox.buttons[0].pressed = xbox.buttons[1].pressed = xbox.buttons[9].pressed = false; controller.advance(0.1);
xbox.buttons[0].pressed = true; controller.advance(3);
assert.equal(controller.state.phase, "flying", "A não iniciou o voo ou botão mantido o reiniciou");
assert(!controller.state.boosted, "A da partida também ligou o turbo");
xbox.buttons[0].pressed = false;
assert.equal(controller.state.score, 0, "Novo voo herdou pontos");
const liveRing = controller.scene.getObjectByName("Spirit ring 1");
const liveForward = new THREE.Vector3(0, 0, 1).applyQuaternion(liveRing.quaternion);
controller.jet.position.copy(liveRing.position).addScaledVector(liveForward, -0.1);
controller.flight.update(0.05);
assert.equal(controller.state.score, 100, "Ponto do percurso não chegou ao HUD");
assert.equal(controller.state.feedback, "ring");
const liveObstacle = controller.scene.getObjectByName("Spirit obstacle 3");
controller.jet.position.copy(liveObstacle.position).addScaledVector(liveForward, -0.1);
controller.flight.update(0.05);
assert.equal(controller.state.hits, 1); assert.equal(controller.state.score, 50);
assert.equal(controller.state.feedback, "hit");
controller.advance(2);
assert.equal(controller.state.feedback, null, "Feedback de colisão não desapareceu");
// LB/RB: impulso lateral de 8 u, bank transitório e uma esquiva por pressão.
controller.jet.position.set(1000, 100, 1000);
controller.advance(1);
const dodgeRight = new THREE.Vector3().crossVectors(liveForward, new THREE.Vector3(0, 1, 0)).normalize();
let dodgeStart = controller.jet.position.clone();
xbox.buttons[4].pressed = true; controller.advance(0.23);
assert(controller.jet.rotation.z > 0.8, "LB não inclinou o jato");
controller.advance(1);
assert(Math.abs(controller.jet.position.clone().sub(dodgeStart).dot(dodgeRight) + 8) < 0.01, "LB repetiu ou não esquivou 8 u para esquerda");
assert(Math.abs(controller.jet.rotation.z) < 0.01, "Bank não voltou ao normal");
xbox.buttons[4].pressed = false; controller.advance(0.1);
dodgeStart = controller.jet.position.clone();
xbox.buttons[5].pressed = true; controller.advance(1);
assert(Math.abs(controller.jet.position.clone().sub(dodgeStart).dot(dodgeRight) - 8) < 0.01, "RB não esquivou para direita");
xbox.buttons[5].pressed = false;
const activeWeapon = (name) => controller.scene.getObjectByName("Spirit combat").children.filter((o) => o.name === name && o.visible);
xbox.buttons[7].value = 1; controller.advance(0.2);
assert(activeWeapon("Spirit shot").length > 0, "RT não atirou");
xbox.buttons[6].value = 1; controller.advance(1.2);
assert.equal(activeWeapon("Spirit bomb").length, 1, "LT segurado repetiu bombas");
xbox.buttons[6].value = 0; controller.advance(0.1);
xbox.buttons[6].value = 1; controller.advance(0.1);
assert.equal(activeWeapon("Spirit bomb").length, 2, "LT não soltou segunda bomba");
document.hidden = true; controller.advance(4);
assert.equal(activeWeapon("Spirit shot").length, 0, "RT continuou atirando com aba oculta");
document.hidden = false;
xbox.buttons[6].value = xbox.buttons[7].value = 0; controller.advance(0.1);
keyboard("KeyF"); controller.advance(0.2);
assert(activeWeapon("Spirit shot").length > 0, "F não atirou");
keyboard("KeyF", {}, "keyup");
keyboard("KeyG"); controller.advance(0.1);
assert(activeWeapon("Spirit bomb").length > 0, "G não lançou bomba");
keyboard("KeyE"); dodgeStart = controller.jet.position.clone(); controller.advance(1);
assert(Math.abs(controller.jet.position.clone().sub(dodgeStart).dot(dodgeRight) - 8) < 0.01, "E não esquivou");
controller.flight.stop(); controller.advance(1);
xbox.mapping = ""; controller.advance(0.1);
assert.equal(controller.state.gamepad, "unsupported");
Object.defineProperty(navigator, "getGamepads", { configurable: true, value: () => { throw new Error("blocked"); } });
controller.advance(0.1); assert.equal(controller.state.gamepad, "unavailable");
controller.flight.dispose(); delete navigator.getGamepads;
assert.equal(getEventListeners(window, "keydown").length, 0);
console.log("Spirit OK: voo, GLB, anéis/pontos, obstáculos móveis/colisão contínua, pool, Xbox (manche invertido, câmera no direito, A inicia), foco, FPS e descarte.");
