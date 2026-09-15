import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import spiritUrl from "../../assets/plane/b2-spirit.glb?url";
import type { SpiritFlightState } from "../types";
import { createSpiritGamepad } from "./createSpiritGamepad";
import { createSpiritCourse } from "./createSpiritCourse";
import { createSpiritCombat, type SpiritCombatWorld } from "./createSpiritCombat";

const CRUISE_SPEED = 12;
const BOOST_SPEED = 38;
const WINGSPAN = 6.8;
const ENTRY_DURATION = 2.6;
const RETURN_DURATION = 0.85;
const FLIGHT_KEYS = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "Space", "KeyF", "KeyG", "KeyQ", "KeyE"]);

function disposeModel(model: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const bitmaps = new Set<ImageBitmap>();
  model.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) {
          textures.add(value);
          if (typeof ImageBitmap !== "undefined" && value.image instanceof ImageBitmap) {
            bitmaps.add(value.image);
          }
        }
      }
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => texture.dispose());
  bitmaps.forEach((bitmap) => bitmap.close());
  model.removeFromParent();
}

export function createSpiritFlight({
  scene,
  camera,
  controls,
  onChange,
  onStartRequest,
  combatWorld,
}: {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  onChange?: (state: SpiritFlightState) => void;
  onStartRequest?: () => void;
  combatWorld?: SpiritCombatWorld;
}) {
  const jet = new THREE.Group();
  jet.name = "B-2 Spirit";
  jet.visible = false;
  jet.rotation.order = "YXZ";
  scene.add(jet);

  // Um único draw call de linhas; camada 1 exclui voo e efeito do probe de reflexo.
  const streakPositions = new Float32Array(64 * 6);
  const streakGeometry = new THREE.BufferGeometry();
  const streakAttribute = new THREE.BufferAttribute(streakPositions, 3).setUsage(THREE.DynamicDrawUsage);
  streakGeometry.setAttribute("position", streakAttribute);
  const streakMaterial = new THREE.LineBasicMaterial({
    color: "#b6eaff", transparent: true, opacity: 0, depthWrite: false,
    depthTest: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false,
  });
  const streaks = new THREE.LineSegments(streakGeometry, streakMaterial);
  streaks.name = "Spirit speed streaks";
  streaks.layers.set(1);
  streaks.frustumCulled = false;
  streaks.visible = false;
  scene.add(streaks);
  for (let i = 0; i < streakPositions.length; i += 6) {
    const angle = i * 2.39996;
    const radius = 4 + (i % 7);
    streakPositions[i] = streakPositions[i + 3] = Math.cos(angle) * radius;
    streakPositions[i + 1] = streakPositions[i + 4] = Math.sin(angle) * radius;
    streakPositions[i + 2] = -4 - (i % 47);
    streakPositions[i + 5] = streakPositions[i + 2] - 1;
  }

  let state: SpiritFlightState = {
    phase: "idle", boosted: false, score: 0, rings: 0, hits: 0, feedback: null, gamepad: "disconnected",
    buildingsDestroyed: 0, targetsDestroyed: 0,
  };
  const gamepad = createSpiritGamepad();
  let feedbackTime = 0;
  const patchState = (patch: Partial<SpiritFlightState>) => {
    state = { ...state, ...patch };
    onChange?.(state);
  };
  const course = createSpiritCourse(scene, (progress) => {
    feedbackTime = 1.4;
    patchState(progress);
  });
  const combat = createSpiritCombat(scene, combatWorld, (buildings, targets) => {
    feedbackTime = 1.4;
    patchState({
      buildingsDestroyed: state.buildingsDestroyed + buildings,
      targetsDestroyed: state.targetsDestroyed + targets,
      feedback: targets ? "target" : "destroyed",
    });
  });
  let disposed = false;
  let model: THREE.Group | null = null;
  let loading: Promise<void> | null = null;
  const keys = new Set<string>();
  const up = new THREE.Vector3(0, 1, 0);
  const forward = new THREE.Vector3();
  const lookDir = new THREE.Vector3();
  const previousPosition = new THREE.Vector3();
  const right = new THREE.Vector3();
  const desiredCamera = new THREE.Vector3();
  const desiredTarget = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();
  const desiredQuaternion = new THREE.Quaternion();
  const rotationMatrix = new THREE.Matrix4();
  const savedPosition = new THREE.Vector3();
  const savedTarget = new THREE.Vector3();
  const savedQuaternion = new THREE.Quaternion();
  const returnPosition = new THREE.Vector3();
  const returnTarget = new THREE.Vector3();
  const returnQuaternion = new THREE.Quaternion();
  const entry = new THREE.CubicBezierCurve3();
  let savedFov = camera.fov;
  let savedLayers = camera.layers.mask;
  let savedControlsEnabled = controls.enabled;
  let savedAutoRotate = controls.autoRotate;
  let returnFov = camera.fov;
  let elapsed = 0;
  let yaw = 0;
  let turn = 0;
  let climb = 0;
  let speed = 0;
  let boost = 0;
  let lookYaw = 0;
  let lookPitch = 0;
  let bombRequested = false;
  let dodgeRequested = 0;
  let dodgeDirection = 0;
  let dodgeTime = 0.45;
  let dodgeCooldown = 0;
  const dodgeAxis = new THREE.Vector3();

  const isActive = () => state.phase !== "idle" && state.phase !== "error";
  const publish = (phase: SpiritFlightState["phase"], boosted = false) => {
    patchState({ phase, boosted });
  };
  // Mantém as asas enquadradas também em telas estreitas.
  const followDistance = () => Math.max(13, WINGSPAN / (Math.tan(THREE.MathUtils.degToRad(savedFov / 2)) * camera.aspect));
  const restore = () => {
    camera.position.copy(savedPosition);
    camera.quaternion.copy(savedQuaternion);
    camera.fov = savedFov;
    camera.layers.mask = savedLayers;
    camera.updateProjectionMatrix();
    controls.target.copy(savedTarget);
    controls.enabled = savedControlsEnabled;
    controls.autoRotate = savedAutoRotate;
  };

  const beginEntry = () => {
    camera.getWorldDirection(forward).setY(0);
    if (forward.lengthSq() < 0.0001) forward.set(0, 0, -1);
    forward.normalize();
    right.crossVectors(forward, up);
    yaw = Math.atan2(-forward.x, -forward.z);
    entry.v0.copy(savedPosition).addScaledVector(forward, -12).addScaledVector(right, -6).addScaledVector(up, 1);
    entry.v1.copy(savedPosition).addScaledVector(forward, 3).addScaledVector(right, -4).addScaledVector(up, 2);
    entry.v3.copy(savedPosition).addScaledVector(forward, 16);
    entry.v3.y = Math.max(10, entry.v3.y);
    entry.v2.copy(entry.v3).addScaledVector(forward, -4);
    jet.position.copy(entry.v0);
    jet.rotation.set(0, yaw, 0, "YXZ");
    jet.visible = true;
    elapsed = turn = climb = speed = boost = lookYaw = lookPitch = 0;
    bombRequested = false;
    dodgeRequested = dodgeDirection = dodgeCooldown = 0;
    dodgeTime = 0.45;
    publish("entering");
  };

  const loadModel = () => {
    loading ??= new GLTFLoader().loadAsync(spiritUrl).then((gltf) => {
      if (disposed) {
        disposeModel(gltf.scene);
        return;
      }
      model = gltf.scene;
      // Asset aponta para +X, asas em Z. Voo usa -Z, asas em X.
      model.rotation.y = Math.PI / 2;
      model.traverse((object) => {
        object.layers.set(1);
        // Versão de voo: trem recolhido e tampa fechada já presentes no GLB.
        if (/^LG|LandingOn/.test(object.name)) object.visible = false;
      });
      model.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(model.getObjectByName("B-2-airframe_0") ?? model);
      const scale = WINGSPAN / bounds.getSize(new THREE.Vector3()).x;
      model.scale.setScalar(scale);
      model.position.copy(bounds.getCenter(new THREE.Vector3())).multiplyScalar(-scale);
      jet.add(model);
    }).finally(() => { loading = null; });
    return loading;
  };

  const start = () => {
    if (disposed || isActive()) return;
    // Esvazia a inércia pendente antes de entregar a câmera ao voo.
    savedAutoRotate = controls.autoRotate;
    const damping = controls.enableDamping;
    controls.autoRotate = false;
    controls.enableDamping = false;
    controls.update();
    controls.enableDamping = damping;
    savedPosition.copy(camera.position);
    savedQuaternion.copy(camera.quaternion);
    savedTarget.copy(controls.target);
    savedFov = camera.fov;
    savedLayers = camera.layers.mask;
    savedControlsEnabled = controls.enabled;
    controls.enabled = false;
    camera.layers.enable(1);
    keys.clear();
    patchState({ score: 0, rings: 0, hits: 0, feedback: null, buildingsDestroyed: 0, targetsDestroyed: 0 });
    publish("loading");
    if (model) {
      beginEntry();
    } else {
      void loadModel().then(() => {
        if (!disposed && state.phase === "loading") beginEntry();
      }).catch(() => {
        if (!disposed && state.phase === "loading") {
          restore();
          publish("error");
        }
      });
    }
  };

  const stop = () => {
    if (!isActive() || state.phase === "returning") return;
    keys.clear();
    jet.visible = streaks.visible = false;
    course.stop();
    combat.stop();
    if (state.phase === "loading") {
      restore();
      publish("idle");
      return;
    }
    returnPosition.copy(camera.position);
    returnQuaternion.copy(camera.quaternion);
    returnTarget.copy(controls.target);
    returnFov = camera.fov;
    elapsed = 0;
    publish("returning");
  };

  const clearKeys = () => { keys.clear(); bombRequested = false; dodgeRequested = 0; };
  const onKeyDown = (event: KeyboardEvent) => {
    if (!isActive()) return;
    if (event.code === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      stop();
      return;
    }
    const target = event.target;
    if (target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, select, button, [role='dialog']"))) return;
    if (event.ctrlKey || event.metaKey || event.altKey || !FLIGHT_KEYS.has(event.code)) return;
    event.preventDefault();
    if (state.phase !== "flying") return;
    if (event.code === "Space") {
      if (!event.repeat) publish("flying", !state.boosted);
    } else if (event.code === "KeyG") {
      if (!event.repeat) bombRequested = true;
    } else if (event.code === "KeyQ" || event.code === "KeyE") {
      if (!event.repeat) dodgeRequested = event.code === "KeyQ" ? -1 : 1;
    } else {
      keys.add(event.code);
    }
  };
  const onKeyUp = (event: KeyboardEvent) => { keys.delete(event.code); };
  window.addEventListener("keydown", onKeyDown, { capture: true });
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", clearKeys);
  document.addEventListener("visibilitychange", clearKeys);

  const update = (delta: number) => {
    if (disposed) return;
    const pad = gamepad.read();
    if (pad.status !== state.gamepad) patchState({ gamepad: pad.status });
    if (pad.stopPressed && isActive()) stop();
    else if (pad.startPressed && !isActive()) (onStartRequest ?? start)();
    else if (pad.boostPressed && state.phase === "flying") publish("flying", !state.boosted);
    if (!isActive() || state.phase === "loading") return;
    const dt = Math.min(Math.max(delta, 0), 0.05);
    elapsed += dt;
    if (state.phase === "returning") {
      const t = THREE.MathUtils.smootherstep(elapsed / RETURN_DURATION, 0, 1);
      camera.position.lerpVectors(returnPosition, savedPosition, t);
      camera.quaternion.slerpQuaternions(returnQuaternion, savedQuaternion, t);
      controls.target.lerpVectors(returnTarget, savedTarget, t);
      camera.fov = THREE.MathUtils.lerp(returnFov, savedFov, t);
      camera.updateProjectionMatrix();
      if (elapsed >= RETURN_DURATION) {
        restore();
        publish("idle");
      }
      return;
    }

    if (state.phase === "entering") {
      const t = THREE.MathUtils.smootherstep(elapsed / ENTRY_DURATION, 0, 1);
      entry.getPoint(t, jet.position);
      jet.rotation.z = Math.sin(t * Math.PI * 2) * 0.18;
      desiredCamera.copy(entry.v3).addScaledVector(forward, -followDistance()).addScaledVector(up, 4.5);
      desiredTarget.copy(entry.v3).addScaledVector(forward, 8);
      camera.position.lerpVectors(savedPosition, desiredCamera, t);
      rotationMatrix.lookAt(desiredCamera, desiredTarget, up);
      desiredQuaternion.setFromRotationMatrix(rotationMatrix);
      camera.quaternion.slerpQuaternions(savedQuaternion, desiredQuaternion, t);
      controls.target.lerpVectors(savedTarget, desiredTarget, t);
      lookTarget.copy(controls.target);
      if (elapsed >= ENTRY_DURATION) {
        elapsed = 0;
        course.start(jet.position, forward);
        combat.start(jet.position, forward);
        publish("flying");
      }
      return;
    }

    const keyboardTurn = Number(keys.has("KeyA")) - Number(keys.has("KeyD"));
    const keyboardClimb = Number(keys.has("KeyW")) - Number(keys.has("KeyS"));
    turn = THREE.MathUtils.damp(turn, keyboardTurn || pad.turn, 7, dt);
    climb = THREE.MathUtils.damp(climb, keyboardClimb || pad.climb, 8, dt);
    boost = THREE.MathUtils.damp(boost, Number(state.boosted), 3, dt);
    speed = THREE.MathUtils.damp(speed, state.boosted ? BOOST_SPEED : CRUISE_SPEED, 2.5, dt);
    yaw += turn * 0.8 * dt;
    forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    const pitch = climb * Math.PI / 3;
    previousPosition.copy(jet.position);
    dodgeCooldown = Math.max(0, dodgeCooldown - dt);
    const requestedDodge = dodgeRequested || (Number(pad.dodgeRightPressed) - Number(pad.dodgeLeftPressed));
    dodgeRequested = 0;
    if (requestedDodge && dodgeCooldown === 0) {
      dodgeDirection = requestedDodge;
      dodgeTime = 0;
      dodgeCooldown = 0.85;
      dodgeAxis.crossVectors(forward, up).normalize();
    }
    if (dodgeTime < 0.45) {
      const before = THREE.MathUtils.smootherstep(dodgeTime / 0.45, 0, 1);
      dodgeTime = Math.min(0.45, dodgeTime + dt);
      const after = THREE.MathUtils.smootherstep(dodgeTime / 0.45, 0, 1);
      jet.position.addScaledVector(dodgeAxis, dodgeDirection * 8 * (after - before));
    }
    jet.position.addScaledVector(forward, speed * Math.cos(pitch) * dt);
    jet.position.y = THREE.MathUtils.clamp(jet.position.y + Math.sin(pitch) * speed * 1.8 * dt, 3.5, 400);
    jet.rotation.set(pitch + Math.sin(elapsed * 1.6) * 0.008, yaw,
      turn * 0.5 - dodgeDirection * Math.sin(dodgeTime / 0.45 * Math.PI) * 1.1, "YXZ");
    if (course.update(previousPosition, jet.position, forward, dt)) speed *= 0.35;
    combat.update(dt, jet, forward, speed, keys.has("KeyF") || pad.fireHeld, bombRequested || pad.bombPressed);
    bombRequested = false;
    if (feedbackTime > 0) {
      feedbackTime -= dt;
      if (feedbackTime <= 0) patchState({ feedback: null });
    }

    // Analógico direito orbita a câmera em torno do jato; solto, volta para trás da cauda.
    lookYaw = THREE.MathUtils.damp(lookYaw, pad.lookX * 2.4, 6, dt);
    lookPitch = THREE.MathUtils.damp(lookPitch, -pad.lookY * 0.9, 6, dt);
    const orbit = followDistance() + boost * 2;
    lookDir.copy(forward).applyAxisAngle(up, -lookYaw);
    desiredCamera.copy(jet.position)
      .addScaledVector(lookDir, -orbit * Math.cos(lookPitch))
      .addScaledVector(up, 4.5 + orbit * Math.sin(lookPitch));
    // Olhar para baixo não enterra a câmera no chão.
    desiredCamera.y = Math.max(desiredCamera.y, 1.5);
    camera.position.lerp(desiredCamera, 1 - Math.exp(-4 * dt));
    camera.position.y = THREE.MathUtils.damp(camera.position.y, desiredCamera.y, 4, dt);
    // Com o olhar deslocado a mira sai da dianteira e volta para o próprio jato.
    desiredTarget.copy(jet.position).addScaledVector(forward, 8 * (1 - Math.min(1, Math.hypot(lookYaw, lookPitch) / 0.5)));
    lookTarget.lerp(desiredTarget, 1 - Math.exp(-6 * dt));
    camera.lookAt(lookTarget);
    controls.target.copy(lookTarget);
    camera.fov = savedFov + boost * 16;
    camera.updateProjectionMatrix();

    streaks.visible = boost > 0.01;
    streakMaterial.opacity = boost * 0.42;
    if (streaks.visible) {
      streaks.position.copy(camera.position);
      streaks.quaternion.copy(camera.quaternion);
      for (let i = 0; i < streakPositions.length; i += 6) {
        streakPositions[i + 2] += speed * dt * 2;
        if (streakPositions[i + 2] > -1) streakPositions[i + 2] -= 50;
        streakPositions[i + 5] = streakPositions[i + 2] - 0.5 - boost * 2.5;
      }
      streakAttribute.needsUpdate = true;
    }
  };

  return {
    start, stop, update, isActive,
    dispose() {
      disposed = true;
      if (isActive()) restore();
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clearKeys);
      document.removeEventListener("visibilitychange", clearKeys);
      keys.clear();
      course.dispose();
      combat.dispose();
      if (model) disposeModel(model);
      jet.removeFromParent();
      streaks.removeFromParent();
      streakGeometry.dispose();
      streakMaterial.dispose();
    },
  };
}
