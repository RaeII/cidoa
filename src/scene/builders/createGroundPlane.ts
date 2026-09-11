import * as THREE from "three";
import type { GroundSettings } from "../types";
import { getGroundMaterialValues } from "../utils/materials";

export type GroundPlaneRig = {
  mesh: THREE.Mesh;
  update: (settings: GroundSettings) => void;
  setPosition: (x: number, z: number) => void;
  dispose: () => void;
};

export function createGroundPlane(
  scene: THREE.Scene,
  groundSettings: GroundSettings,
): GroundPlaneRig {
  const groundMaterialValues = getGroundMaterialValues(
    groundSettings.roughness,
    groundSettings.metalness,
    groundSettings.materialType,
  );
  // Plano local: coordenadas pequenas preservam a separação de 0.01u do relevo na GPU.
  // Unitário + escala: mudar o tamanho não recria geometria nem re-envia buffer à GPU.
  const geometry = new THREE.PlaneGeometry(1, 1);
  const material = new THREE.MeshStandardMaterial({
    color: groundSettings.color,
    roughness: groundMaterialValues.roughness,
    metalness: groundMaterialValues.metalness,
  });
  const mesh = new THREE.Mesh(geometry, material);
  // Escala no espaço local do plano (X/Y), aplicada antes da rotação → vira X/Z no mundo.
  mesh.scale.set(groundSettings.size, groundSettings.size, 1);
  mesh.rotation.x = -Math.PI / 2;
  // Chão local abaixo do relevo (TERRAIN_GROUND_Y = -0.04), seguindo a câmera.
  // Não estender com fundo cinza: essa camada aparece como uma elevação atrás das montanhas.
  mesh.position.y = -0.05;
  scene.add(mesh);

  return {
    mesh,
    update(settings) {
      const values = getGroundMaterialValues(
        settings.roughness,
        settings.metalness,
        settings.materialType,
      );
      material.color.set(settings.color);
      material.roughness = values.roughness;
      material.metalness = values.metalness;
      material.needsUpdate = true;
      mesh.scale.set(settings.size, settings.size, 1);
    },
    setPosition(x, z) {
      mesh.position.x = x;
      mesh.position.z = z;
    },
    dispose() {
      scene.remove(mesh);
      geometry.dispose();
      material.dispose();
    },
  };
}
