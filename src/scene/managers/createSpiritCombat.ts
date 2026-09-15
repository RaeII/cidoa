import * as THREE from "three";

export type SpiritCombatWorld = {
  traceBuilding: (from: THREE.Vector3, to: THREE.Vector3) => { donationId: number; point: THREE.Vector3 } | null;
  getBuildingsInRadius: (center: THREE.Vector3, radius: number) => number[];
  destroyBuildings: (ids: readonly number[]) => THREE.Vector3[];
};

/** Armas arcade, alvos e efeitos em pools limitados; sem mudanças no backend. */
export function createSpiritCombat(scene: THREE.Scene, world: SpiritCombatWorld | undefined,
  onHit: (buildings: number, targets: number) => void) {
  const root = new THREE.Group();
  root.name = "Spirit combat";
  root.visible = false;
  scene.add(root);
  const shotGeometry = new THREE.SphereGeometry(0.13, 6, 4);
  const bombGeometry = new THREE.SphereGeometry(0.4, 8, 6);
  const shotMaterial = new THREE.MeshBasicMaterial({ color: "#fff6a1", toneMapped: false });
  const bombMaterial = new THREE.MeshStandardMaterial({ color: "#313947", emissive: "#e86f11", emissiveIntensity: 0.5 });
  const targetGeometry = new THREE.IcosahedronGeometry(2.2, 0);
  const targetMaterial = new THREE.MeshBasicMaterial({ color: "#ff58cb", wireframe: true, toneMapped: false });
  const haloGeometry = new THREE.TorusGeometry(2.8, 0.12, 6, 32);
  const haloMaterial = new THREE.MeshBasicMaterial({ color: "#ffe4f8", toneMapped: false });
  const blastGeometry = new THREE.SphereGeometry(1, 12, 8);
  const shardGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
  const projectiles = Array.from({ length: 38 }, (_, index) => {
    const bomb = index >= 32;
    const mesh = new THREE.Mesh(bomb ? bombGeometry : shotGeometry, bomb ? bombMaterial : shotMaterial);
    mesh.name = bomb ? "Spirit bomb" : "Spirit shot";
    mesh.visible = false;
    root.add(mesh);
    return { mesh, bomb, velocity: new THREE.Vector3(), life: 0 };
  });
  const targets = Array.from({ length: 8 }, (_, index) => {
    const mesh = new THREE.Mesh(targetGeometry, targetMaterial);
    mesh.name = `Spirit air target ${index + 1}`;
    mesh.add(new THREE.Mesh(haloGeometry, haloMaterial));
    root.add(mesh);
    return { mesh, cooldown: 0 };
  });
  const explosions = Array.from({ length: 16 }, () => {
    const material = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false });
    const group = new THREE.Group();
    group.name = "Spirit explosion";
    group.visible = false;
    const fire = new THREE.Mesh(blastGeometry, material);
    const shards = new THREE.InstancedMesh(shardGeometry, material, 12);
    shards.frustumCulled = false;
    group.add(fire, shards);
    root.add(group);
    return { group, fire, shards, material, age: 0, radius: 1 };
  });
  const reticle = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.05, 4, 24), shotMaterial);
  reticle.name = "Spirit aim";
  root.add(reticle);
  root.traverse((object) => object.layers.set(1));
  const previous = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const shotDirection = new THREE.Vector3();
  const point = new THREE.Vector3();
  const hitPoint = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const sphere = new THREE.Sphere(new THREE.Vector3(), 2.8);
  const ray = new THREE.Ray();
  const dummy = new THREE.Object3D();
  let serial = 0;
  let explosionIndex = 0;
  let fireCooldown = 0;
  let bombCooldown = 0;

  const placeTarget = (target: typeof targets[number], position: THREE.Vector3, forward: THREE.Vector3, distance: number) => {
    right.crossVectors(forward, up).normalize();
    target.mesh.position.copy(position).addScaledVector(forward, distance).addScaledVector(right, Math.sin(serial * 1.8) * 18);
    target.mesh.position.y = Math.max(24, position.y + Math.sin(serial++ * 1.2) * 14);
    target.mesh.visible = true;
    target.cooldown = 0;
  };
  const explode = (position: THREE.Vector3, radius: number) => {
    const effect = explosions[explosionIndex++ % explosions.length];
    effect.group.position.copy(position);
    effect.group.visible = true;
    effect.age = 0;
    effect.radius = radius;
  };
  const destroy = (ids: number[]) => {
    const centers = world?.destroyBuildings(ids) ?? [];
    for (const center of centers) explode(center, 5);
    if (centers.length) onHit(centers.length, 0);
  };

  return {
    start(position: THREE.Vector3, forward: THREE.Vector3) {
      serial = fireCooldown = bombCooldown = 0;
      projectiles.forEach((p) => { p.life = 0; p.mesh.visible = false; });
      explosions.forEach((effect) => { effect.group.visible = false; });
      targets.forEach((target, index) => placeTarget(target, position, forward, 65 + index * 24));
      root.visible = true;
    },
    stop() { root.visible = false; },
    update(dt: number, jet: THREE.Object3D, forward: THREE.Vector3, speed: number, fire: boolean, dropBomb: boolean) {
      if (!root.visible) return;
      fireCooldown = Math.max(0, fireCooldown - dt);
      bombCooldown = Math.max(0, bombCooldown - dt);
      shotDirection.set(0, 0, -1).applyQuaternion(jet.quaternion).normalize();
      reticle.position.copy(jet.position).addScaledVector(shotDirection, 45);
      reticle.quaternion.copy(jet.quaternion);
      const launch = (bomb: boolean) => {
        const projectile = projectiles.find((p) => p.bomb === bomb && p.life <= 0);
        if (!projectile) return;
        projectile.mesh.position.copy(jet.position);
        projectile.mesh.visible = true;
        projectile.life = bomb ? 10 : 3;
        if (bomb) {
          projectile.mesh.position.y -= 0.9;
          projectile.velocity.copy(forward).multiplyScalar(speed * 0.65);
          projectile.velocity.y = -3;
        } else {
          projectile.mesh.scale.set(1, 1, 6);
          projectile.mesh.quaternion.copy(jet.quaternion);
          projectile.mesh.position.addScaledVector(shotDirection, 2);
          projectile.velocity.copy(shotDirection).multiplyScalar(140);
        }
      };
      if (fire && fireCooldown === 0) { launch(false); fireCooldown = 0.12; }
      if (dropBomb && bombCooldown === 0) { launch(true); bombCooldown = 0.9; }
      for (const target of targets) {
        target.cooldown = Math.max(0, target.cooldown - dt);
        if ((!target.mesh.visible && target.cooldown === 0) || target.mesh.position.distanceTo(jet.position) > 320 || direction.copy(target.mesh.position).sub(jet.position).dot(forward) < -40) {
          placeTarget(target, jet.position, forward, 100 + (serial % 5) * 24);
        }
        target.mesh.rotation.y += dt * 0.7;
      }
      for (const projectile of projectiles) {
        if (projectile.life <= 0) continue;
        previous.copy(projectile.mesh.position);
        if (projectile.bomb) projectile.velocity.y -= 26 * dt;
        projectile.mesh.position.addScaledVector(projectile.velocity, dt);
        const end = projectile.mesh.position;
        let building = world?.traceBuilding(previous, end) ?? null;
        let distance = building ? previous.distanceTo(building.point) : Infinity;
        let impact = !!building;
        if (building) hitPoint.copy(building.point);
        if (end.y <= 0 && previous.y > 0) {
          point.lerpVectors(previous, end, previous.y / (previous.y - end.y));
          if (previous.distanceTo(point) < distance) {
            building = null; distance = previous.distanceTo(point); hitPoint.copy(point); impact = true;
          }
        }
        let airTarget: typeof targets[number] | undefined;
        if (!projectile.bomb) {
          const length = previous.distanceTo(end);
          ray.set(previous, direction.subVectors(end, previous).normalize());
          for (const target of targets) {
            if (!target.mesh.visible) continue;
            sphere.center.copy(target.mesh.position);
            if (!ray.intersectSphere(sphere, point)) continue;
            const d = previous.distanceTo(point);
            if (d <= length && d < distance) {
              distance = d; hitPoint.copy(point); airTarget = target; impact = true;
            }
          }
        }
        if (impact) {
          if (projectile.bomb) {
            destroy(world?.getBuildingsInRadius(hitPoint, 9) ?? []);
          } else if (airTarget) {
            airTarget.mesh.visible = false; airTarget.cooldown = 3;
            onHit(0, 1);
          } else if (building) destroy([building.donationId]);
          explode(hitPoint, projectile.bomb ? 9 : 2.8);
          projectile.life = 0;
        } else projectile.life -= dt;
        projectile.mesh.visible = projectile.life > 0;
      }
      for (const effect of explosions) {
        if (!effect.group.visible) continue;
        effect.age += dt;
        const t = effect.age / 1.1;
        effect.group.visible = t < 1;
        effect.fire.scale.setScalar(0.2 + effect.radius * Math.sin(Math.min(1, t) * Math.PI / 2));
        effect.material.color.setHSL(0.12 * (1 - t), 1 - t * 0.7, 0.65 - t * 0.45);
        effect.material.opacity = Math.max(0, 1 - t);
        for (let i = 0; i < 12; i++) {
          const angle = i * 2.39996;
          dummy.position.set(Math.cos(angle) * effect.radius * t * 2, (1 + i % 4) * t - 5 * t * t, Math.sin(angle) * effect.radius * t * 2);
          dummy.rotation.set(t * 5 + i, t * 3, i);
          dummy.scale.setScalar(1 + effect.radius * 0.15);
          dummy.updateMatrix(); effect.shards.setMatrixAt(i, dummy.matrix);
        }
        effect.shards.instanceMatrix.needsUpdate = true;
      }
    },
    dispose() {
      root.removeFromParent();
      for (const geometry of [shotGeometry, bombGeometry, targetGeometry, haloGeometry, blastGeometry, shardGeometry, reticle.geometry]) geometry.dispose();
      for (const material of [shotMaterial, bombMaterial, targetMaterial, haloMaterial]) material.dispose();
      for (const effect of explosions) { effect.material.dispose(); effect.shards.dispose(); }
    },
  };
}
