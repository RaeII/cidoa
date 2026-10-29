import * as THREE from "three";

type RenderObject = THREE.Mesh | THREE.Points | THREE.Line | THREE.Sprite;

const optimizedLighting = new WeakSet<THREE.Material["onBeforeCompile"]>();
const directLightCall = "RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );";
const focusedLightingChunk = THREE.ShaderChunk.lights_fragment_begin.replace(
  directLightCall,
  `if ( directLight.visible ) { ${directLightCall} }`,
);

// A atenuação já decidiu que a luz não contribui; evita pagar o BRDF de cor zero.
function preparePointLighting(material: THREE.Material) {
  if (!(material as THREE.MeshStandardMaterial).isMeshStandardMaterial || optimizedLighting.has(material.onBeforeCompile)) return;
  const original = material.onBeforeCompile;
  const cacheKey = material.customProgramCacheKey;
  const compile: THREE.Material["onBeforeCompile"] = function (this: THREE.Material, shader, renderer) {
    original.call(this, shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace("#include <lights_fragment_begin>", focusedLightingChunk);
  };
  material.onBeforeCompile = compile;
  material.customProgramCacheKey = function () {
    const previous = cacheKey === THREE.Material.prototype.customProgramCacheKey
      ? original.toString() : cacheKey.call(this);
    return `${previous}:skip-inactive-point-lights`;
  };
  optimizedLighting.add(compile);
}

/** Prepara somente variantes alteradas; recursos compartilhados entram uma vez por passe. */
export function createScenePreparer(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
  const prepared = new WeakMap<THREE.Object3D, string>();
  const uploaded = new WeakMap<THREE.Texture, number>();

  const materialsOf = (object: RenderObject) =>
    Array.isArray(object.material) ? object.material : [object.material];

  const signature = (object: RenderObject, environment: string) => {
    const mesh = object as THREE.InstancedMesh;
    const geometry = object.geometry;
    return [environment, object.type, geometry?.uuid, Boolean(mesh.isInstancedMesh),
      Boolean((object as THREE.SkinnedMesh).isSkinnedMesh),
      Object.keys(geometry?.attributes ?? {}).join(","),
      Boolean(mesh.instanceColor), Boolean(mesh.morphTexture),
      ...materialsOf(object).map((mat) => `${mat.uuid}:${mat.version}`),
    ].join("|");
  };

  return {
    async prepare(
      camera: THREE.Camera,
      cubeTarget: THREE.WebGLRenderTarget | null,
      cubeCamera: THREE.Camera,
      isDisposed: () => boolean,
      focusTarget: THREE.WebGLRenderTarget | null = null,
    ) {
      const lights: string[] = [];
      const lightObjects: THREE.Object3D[] = [];
      scene.traverseVisible((object) => {
        if ((object as THREE.Light).isLight) {
          lights.push(`${object.uuid}:${object.layers.mask}:${object.castShadow}`);
          lightObjects.push(object);
        }
      });
      // compileAsync coleta luzes do targetScene. Evita N travessias da cidade para N materiais.
      const lightingScene = Object.create(scene) as THREE.Scene;
      lightingScene.traverseVisible = (callback) => lightObjects.forEach(callback);
      const environment = [scene.environment?.uuid, scene.environment?.mapping,
        scene.fog?.constructor.name, cubeTarget?.texture.uuid, focusTarget?.texture.uuid, ...lights].join("|");
      const objects: RenderObject[] = [];
      scene.traverse((object) => {
        const candidate = object as RenderObject;
        if (candidate.material) objects.push(candidate);
      });
      const pending: Promise<unknown>[] = [];
      const seen = new Set<string>();
      const seenMaterials = new Set<THREE.Material>();
      let sliceStart = performance.now();
      const yieldIfNeeded = async () => {
        if (performance.now() - sliceStart < 4) return;
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        sliceStart = performance.now();
      };
      const compile = (object: RenderObject, target: THREE.WebGLRenderTarget | null, view: THREE.Camera) => {
        // Objeto plano: os filhos já estão no inventário, não repetir a travessia.
        const batch = {
          traverse: (callback: (object: THREE.Object3D) => void) => callback(object),
          traverseVisible: () => {},
        } as unknown as THREE.Object3D;
        const previous = renderer.getRenderTarget();
        try {
          renderer.setRenderTarget(target);
          pending.push(renderer.compileAsync(batch, view, lightingScene));
        } finally {
          renderer.setRenderTarget(previous);
        }
      };
      for (const object of objects) {
        if (isDisposed()) return;
        if (!object.parent) continue;
        for (const material of materialsOf(object)) preparePointLighting(material);
        const key = signature(object, environment);
        if (prepared.get(object) !== key && !seen.has(key)) {
          if (cubeTarget) compile(object, cubeTarget, cubeCamera);
          if (focusTarget) compile(object, focusTarget, camera);
          compile(object, null, camera);
        }
        seen.add(key);
        seen.add(signature(object, environment));
        // compile pode incrementar version de materiais transparentes double-sided.
        prepared.set(object, signature(object, environment));
        for (const material of materialsOf(object)) {
          if (seenMaterials.has(material)) continue;
          seenMaterials.add(material);
          const values = Object.values(material);
          if ((material as THREE.ShaderMaterial).isShaderMaterial) {
            for (const uniform of Object.values((material as THREE.ShaderMaterial).uniforms)) values.push(uniform.value);
          }
          for (const value of values) {
            const texture = value as THREE.Texture | null;
            if (!texture?.isTexture || !texture.image || texture.isRenderTargetTexture) continue;
            if (uploaded.get(texture) === texture.version) continue;
            renderer.initTexture(texture);
            uploaded.set(texture, texture.version);
            await yieldIfNeeded();
            if (isDisposed()) return;
          }
        }
        await yieldIfNeeded();
      }
      // Mantém a saída de emergência do runtime para material descartado durante o polling.
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          Promise.all(pending),
          new Promise<void>((resolve) => { timeout = setTimeout(resolve, 5000); }),
        ]);
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
