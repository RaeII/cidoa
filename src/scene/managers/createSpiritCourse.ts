import * as THREE from "three";
import type { SpiritFlightState } from "../types";

const RING_RADIUS = 8;
const RING_TUBE = 0.3;
// Folga para as asas (6,8 u): o centro precisa cruzar dentro da abertura útil.
const PASS_RADIUS = RING_RADIUS - RING_TUBE - 3.4;
const HIT_RADIUS = 2.4;
const SPACING = 48;

type Progress = Pick<SpiritFlightState, "score" | "rings" | "hits" | "feedback">;

export function createSpiritCourse(scene: THREE.Scene, onProgress: (progress: Progress) => void) {
  const root = new THREE.Group();
  root.name = "Spirit challenge";
  root.visible = false;
  scene.add(root);
  const ringGeometry = new THREE.TorusGeometry(RING_RADIUS, RING_TUBE, 8, 64);
  const obstacleGeometry = new THREE.BoxGeometry(1, 1, 1);
  const ringMaterial = new THREE.MeshBasicMaterial({ color: "#42e8ff", toneMapped: false });
  const obstacleMaterial = new THREE.MeshStandardMaterial({
    color: "#ff832e", emissive: "#d63508", emissiveIntensity: 0.6, roughness: 0.4, metalness: 0.2,
  });
  const stages = Array.from({ length: 6 }, (_, index) => {
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.name = `Spirit ring ${index + 1}`;
    const obstacle = new THREE.Mesh(obstacleGeometry, obstacleMaterial);
    obstacle.name = `Spirit obstacle ${index + 1}`;
    ring.layers.set(1);
    obstacle.layers.set(1);
    root.add(ring, obstacle);
    return {
      ring, obstacle, normal: new THREE.Vector3(), right: new THREE.Vector3(),
      inverseRotation: new THREE.Quaternion(), anchor: new THREE.Vector3(),
      previousObstacle: new THREE.Vector3(), passed: false, hit: false, moving: false, serial: 0,
    };
  });
  const up = new THREE.Vector3(0, 1, 0);
  const zAxis = new THREE.Vector3(0, 0, 1);
  const relative = new THREE.Vector3();
  const crossing = new THREE.Vector3();
  const localStart = new THREE.Vector3();
  const localEnd = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const hitPoint = new THREE.Vector3();
  const box = new THREE.Box3();
  const ray = new THREE.Ray();
  let serial = 0;
  let time = 0;
  let score = 0;
  let rings = 0;
  let hits = 0;

  const place = (stage: typeof stages[number], position: THREE.Vector3, forward: THREE.Vector3, distance: number) => {
    stage.serial = serial++;
    stage.normal.copy(forward).setY(0).normalize();
    stage.right.crossVectors(stage.normal, up);
    stage.ring.position.copy(position).addScaledVector(stage.normal, distance)
      .addScaledVector(stage.right, Math.sin(stage.serial * 1.3) * 13);
    stage.ring.position.y = THREE.MathUtils.clamp(position.y + Math.sin(stage.serial * 0.9) * 13, 18, 380);
    stage.ring.quaternion.setFromUnitVectors(zAxis, stage.normal);
    stage.obstacle.quaternion.copy(stage.ring.quaternion);
    stage.inverseRotation.copy(stage.ring.quaternion).invert();
    stage.anchor.copy(stage.ring.position).addScaledVector(stage.normal, -SPACING / 2);
    stage.moving = stage.serial % 2 === 1;
    stage.obstacle.scale.set(stage.moving ? 16 : 5, stage.moving ? 2 : 14, 2);
    // Primeiro portão livre; obstáculo lateral ensina a leitura do percurso.
    stage.anchor.addScaledVector(stage.right, stage.serial === 0 ? 13 : Math.cos(stage.serial * 1.7) * 5);
    stage.obstacle.position.copy(stage.anchor);
    stage.previousObstacle.copy(stage.anchor);
    stage.ring.visible = stage.obstacle.visible = true;
    stage.passed = stage.hit = false;
  };
  const report = (feedback: Progress["feedback"]) => onProgress({ score, rings, hits, feedback });

  return {
    start(position: THREE.Vector3, forward: THREE.Vector3) {
      serial = time = score = rings = hits = 0;
      stages.forEach((stage, index) => place(stage, position, forward, 48 + index * SPACING));
      root.visible = true;
      report(null);
    },
    stop() { root.visible = false; },
    update(previous: THREE.Vector3, position: THREE.Vector3, forward: THREE.Vector3, delta: number) {
      if (!root.visible) return false;
      time += delta;
      let collided = false;
      for (const stage of stages) {
        if (!stage.passed) {
          const before = relative.copy(previous).sub(stage.ring.position).dot(stage.normal);
          const after = relative.copy(position).sub(stage.ring.position).dot(stage.normal);
          // Interseção do segmento com o plano: turbo não salta anéis entre frames.
          if (before < 0 && after >= 0) {
            crossing.lerpVectors(previous, position, -before / (after - before)).sub(stage.ring.position);
            stage.passed = true;
            stage.ring.visible = false;
            if (crossing.lengthSq() <= PASS_RADIUS * PASS_RADIUS) {
              score += 100;
              rings++;
              report("ring");
            } else {
              report("miss");
            }
          }
        }

        stage.previousObstacle.copy(stage.obstacle.position);
        stage.obstacle.position.copy(stage.anchor);
        if (stage.moving) stage.obstacle.position.y += Math.sin(time * 1.4 + stage.serial) * 6;
        if (!stage.hit) {
          // Colisão relativa à barra móvel, com volume simples para o avião.
          localStart.copy(previous).sub(stage.previousObstacle).applyQuaternion(stage.inverseRotation);
          localEnd.copy(position).sub(stage.obstacle.position).applyQuaternion(stage.inverseRotation);
          box.max.copy(stage.obstacle.scale).multiplyScalar(0.5).addScalar(HIT_RADIUS);
          box.min.copy(box.max).negate();
          direction.subVectors(localEnd, localStart);
          const distance = direction.length();
          ray.set(localStart, direction.normalize());
          if (box.containsPoint(localStart) || (distance > 0 && ray.intersectBox(box, hitPoint) && hitPoint.distanceTo(localStart) <= distance)) {
            stage.hit = collided = true;
            stage.obstacle.visible = false;
            score = Math.max(0, score - 50);
            hits++;
            report("hit");
          }
        }
      }
      // Pool fixo: repõe atrás/fora de alcance à frente do rumo atual, sem crescer a cena.
      for (const stage of stages) {
        const distance = stage.ring.position.distanceTo(position);
        const behind = relative.copy(stage.ring.position).sub(position).dot(forward) < -55;
        if (behind || distance > 350) {
          const farthest = Math.max(0, ...stages.filter((other) => other !== stage)
            .map((other) => relative.copy(other.ring.position).sub(position).dot(forward)));
          place(stage, position, forward, Math.min(288, Math.max(48, farthest + SPACING)));
        }
      }
      return collided;
    },
    dispose() {
      root.removeFromParent();
      ringGeometry.dispose();
      obstacleGeometry.dispose();
      ringMaterial.dispose();
      obstacleMaterial.dispose();
    },
  };
}
