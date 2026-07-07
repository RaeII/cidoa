import * as THREE from "three";
import { CITY_SCENE_CONFIG } from "../config/citySceneConfig";
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
  const geometry = new THREE.PlaneGeometry(CITY_SCENE_CONFIG.groundSize, CITY_SCENE_CONFIG.groundSize);
  const material = new THREE.MeshStandardMaterial({
    color: groundSettings.color,
    roughness: groundMaterialValues.roughness,
    metalness: groundMaterialValues.metalness,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  // Chão infinito: fica logo ABAIXO do piso do relevo (TERRAIN_GROUND_Y = -0.04) pra não brigar
  // (z-fighting). Onde há relevo, o terreno cobre; além da borda do relevo, este plano preenche
  // o vazio. Segue a câmera no runtime (setPosition) → nunca acaba ao mover a câmera.
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
