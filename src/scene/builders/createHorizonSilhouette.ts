import * as THREE from "three";
import { seeded } from "../utils/random";

// O far plane está em 260u — ficar em 248 garante que os prédios não são clipados.

// A fileira se estende lateralmente além dos limites do FOV (58° horizontal ~= ±245u a 248u de distância).
// ±580u garante cobertura mesmo em qualquer ângulo de órbita.
const ROW_HALF_WIDTH = 580;

// Quantidade de prédios na fileira: 1160u / ~4.5u de largura média ≈ 258 prédios
const COUNT = 260;

const MIN_HEIGHT = 2;
const MAX_HEIGHT = 14;
const MIN_WIDTH = 3;
const MAX_WIDTH = 6.5;
const DEPTH = 3;
const GROUND_Y = -0.03;

const _matrix = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _scale = new THREE.Vector3();
const _forward = new THREE.Vector3();

type Bundle = {
  mesh: THREE.InstancedMesh;
  geometry: THREE.BoxGeometry;
  material: THREE.MeshBasicMaterial;
};

function updateInstances(mesh: THREE.InstancedMesh, cameraShift: number) {
  const spacing = (ROW_HALF_WIDTH * 2) / (COUNT - 1);
  const centerIndex = Math.round(cameraShift / spacing);
  const halfCount = Math.floor(COUNT / 2);

  for (let i = 0; i < COUNT; i++) {
    const globalIndex = centerIndex - halfCount + i;
    const canonicalX = globalIndex * spacing;

    const localX = canonicalX - cameraShift;

    const width = MIN_WIDTH + seeded(globalIndex, 41, 1) * (MAX_WIDTH - MIN_WIDTH);
    const heightT = seeded(globalIndex, 41, 2);
    // Distribuição quadrática: maioria de prédios baixos, alguns bem altos
    const height = MIN_HEIGHT + heightT * heightT * (MAX_HEIGHT - MIN_HEIGHT);

    // localZ = 0: o mesh é rotacionado no frame para ficar perpendicular à câmera
    _pos.set(localX, height / 2, 0);
    _euler.set(0, 0, 0);
    _quat.setFromEuler(_euler);
    _scale.set(width, height, DEPTH);
    _matrix.compose(_pos, _quat, _scale);
    mesh.setMatrixAt(i, _matrix);
  }

  mesh.instanceMatrix.needsUpdate = true;
}

function build(scene: THREE.Scene, initialColor: string): Bundle {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshBasicMaterial({ color: initialColor, fog: true });
  const mesh = new THREE.InstancedMesh(geometry, material, COUNT);
  mesh.frustumCulled = false;

  const zeroScale = new THREE.Vector3(0, 0, 0);
  for (let i = 0; i < COUNT; i++) {
    _matrix.identity().scale(zeroScale);
    mesh.setMatrixAt(i, _matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.position.y = GROUND_Y;
  scene.add(mesh);

  return { mesh, geometry, material };
}

export type HorizonSilhouette = {
  update: (camera: THREE.Camera) => void;
  updateSettings: (settings: { enabled: boolean; distance: number; color: string }) => void;
  dispose: () => void;
};

export function createHorizonSilhouette(
  scene: THREE.Scene,
  initialSettings: { enabled: boolean; distance: number; color: string }
): HorizonSilhouette {
  const bundle = build(scene, initialSettings.color);
  let previousYaw: number | null = null;
  let continuousYaw = 0;
  let currentDistance = initialSettings.distance;
  let enabled = initialSettings.enabled;
  let lastAppliedShift: number | null = null;
  bundle.mesh.visible = enabled;

  return {
    update(camera) {
      if (!enabled) return;
      // Direção da câmera projetada no plano XZ
      camera.getWorldDirection(_forward);
      _forward.y = 0;
      if (_forward.lengthSq() < 1e-6) return;
      _forward.normalize();

      // Posiciona a fileira à distância configurada da câmera, ao nível do chão
      bundle.mesh.position.set(
        camera.position.x + _forward.x * currentDistance,
        GROUND_Y,
        camera.position.z + _forward.z * currentDistance,
      );

      bundle.mesh.rotation.y = Math.atan2(-_forward.x, -_forward.z);

      const rightX = -_forward.z;
      const rightZ = _forward.x;
      
      const currentYaw = Math.atan2(_forward.x, _forward.z);
      if (previousYaw === null) previousYaw = currentYaw;

      let yawDelta = currentYaw - previousYaw;
      if (yawDelta > Math.PI) yawDelta -= 2 * Math.PI;
      if (yawDelta < -Math.PI) yawDelta += 2 * Math.PI;
      
      continuousYaw += yawDelta;
      previousYaw = currentYaw;

      const translationShift = camera.position.x * rightX + camera.position.z * rightZ;
      const rotationShift = continuousYaw * currentDistance;
      const cameraShift = translationShift - rotationShift;

      // Câmera parada = shift idêntico; pula reescrita das 260 matrizes + upload.
      if (lastAppliedShift !== null && Math.abs(cameraShift - lastAppliedShift) < 1e-4) return;
      lastAppliedShift = cameraShift;

      updateInstances(bundle.mesh, cameraShift);
    },

    updateSettings(settings) {
      enabled = settings.enabled;
      bundle.mesh.visible = enabled;
      currentDistance = settings.distance;
      bundle.material.color.set(settings.color);
    },

    dispose() {
      scene.remove(bundle.mesh);
      bundle.geometry.dispose();
      bundle.material.dispose();
    },
  };
}
