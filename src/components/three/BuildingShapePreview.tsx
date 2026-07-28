import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  createBuildingShapeMesh,
  createUnitBuildingGeometry,
} from "@/scene/builders/createBuildingShapeMesh";
import type { BuildingShape } from "@/scene/types";

// Prédio real é alto: a geometria é 1×1×1 e a cena estica no Y. Sem esticar aqui,
// Empire/Chrysler viram cubos e o admin não reconhece o formato.
const PREVIEW_HEIGHT_SCALE = 3;
const THUMB_SIZE = 128;
const FOV = 32;

function createRenderer(canvasLess: boolean) {
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    // Thumb lê o buffer com toDataURL depois do render.
    preserveDrawingBuffer: canvasLess,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  return renderer;
}

/**
 * Cena mínima com um prédio. Fora da cena 3D não há HDRI nem ambiente, então o
 * preview traz luz própria (sem sombra — mesma regra do resto do projeto).
 */
function createPreviewScene(shape: BuildingShape) {
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 1.2));
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(4, 6, 5);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xb9d0ff, 0.9);
  fill.position.set(-5, 2, -4);
  scene.add(fill);

  const facadeMat = new THREE.MeshStandardMaterial({
    color: 0x9aa3ab,
    roughness: 0.72,
    metalness: 0.1,
  });
  const topMat = new THREE.MeshStandardMaterial({
    color: 0x6d7378,
    roughness: 0.86,
    metalness: 0.04,
  });
  const boxGeometry = createUnitBuildingGeometry();
  const mesh = createBuildingShapeMesh(shape, facadeMat, topMat, boxGeometry);
  mesh.scale.set(1, PREVIEW_HEIGHT_SCALE, 1);
  scene.add(mesh);

  const sphere = new THREE.Box3()
    .setFromObject(mesh)
    .getBoundingSphere(new THREE.Sphere());
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 100);

  /** Aplica a proporção e devolve a distância que faz a esfera envolvente caber. */
  const frame = (aspect: number) => {
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    const halfFov = THREE.MathUtils.degToRad(FOV) / 2;
    // Aspecto < 1 corta na horizontal: afasta na mesma proporção.
    return (sphere.radius / Math.sin(halfFov) / Math.min(1, aspect)) * 1.06;
  };

  /** Câmera na diagonal padrão. Separado de `frame` pra resize não matar o orbit. */
  const place = (distance: number) => {
    camera.position
      .set(1, 0.42, 1)
      .normalize()
      .multiplyScalar(distance)
      .add(sphere.center);
    camera.lookAt(sphere.center);
  };

  const dispose = () => {
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of new Set(materials)) material.dispose();
    // Só a caixa é nossa: as demais geometrias são cache compartilhado dos builders.
    boxGeometry.dispose();
  };

  return { scene, camera, center: sphere.center, frame, place, dispose };
}

// PNG por formato. Um render só por formato na vida da aba — a lista inteira
// custa um punhado de frames e depois é só <img>. "" = falhou (sem WebGL).
const thumbCache = new Map<string, string>();

function renderThumb(shape: BuildingShape): string {
  const cached = thumbCache.get(shape);
  if (cached !== undefined) return cached;

  let url = "";
  let renderer: THREE.WebGLRenderer | null = null;
  let view: ReturnType<typeof createPreviewScene> | null = null;
  try {
    renderer = createRenderer(true);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(THUMB_SIZE, THUMB_SIZE, false);
    view = createPreviewScene(shape);
    view.place(view.frame(1));
    renderer.render(view.scene, view.camera);
    url = renderer.domElement.toDataURL("image/png");
  } catch {
    url = "";
  } finally {
    view?.dispose();
    renderer?.dispose();
  }
  thumbCache.set(shape, url);
  return url;
}

/** Miniatura estática do formato (lista do admin). */
export function BuildingShapeThumb({
  shape,
  className,
}: {
  shape: BuildingShape;
  className?: string;
}) {
  const [url, setUrl] = useState(() => thumbCache.get(shape) ?? "");

  useEffect(() => {
    // rAF: render sai do commit do React — lista com 10 formatos não trava o paint.
    const id = requestAnimationFrame(() => setUrl(renderThumb(shape)));
    return () => cancelAnimationFrame(id);
  }, [shape]);

  if (!url) return <div className={className} aria-hidden />;
  return <img src={url} alt="" className={className} draggable={false} />;
}

/** Preview interativo (arrastar pra girar). Um contexto WebGL enquanto montado. */
export function BuildingShapePreview({
  shape,
  className,
}: {
  shape: BuildingShape;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = createRenderer(false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";

    const view = createPreviewScene(shape);
    const controls = new OrbitControls(view.camera, renderer.domElement);
    controls.target.copy(view.center);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.4;

    let placed = false;
    const resize = () => {
      const { clientWidth: w, clientHeight: h } = container;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h, false);
      const distance = view.frame(w / h);
      controls.minDistance = distance * 0.4;
      controls.maxDistance = distance * 2.2;
      // Só enquadra na primeira medida válida — resize depois disso não pode
      // jogar a câmera de volta e desfazer o giro do usuário.
      if (!placed) {
        view.place(distance);
        placed = true;
      }
      controls.update();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      controls.update();
      renderer.render(view.scene, view.camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      controls.dispose();
      view.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [shape]);

  return <div ref={containerRef} className={className} />;
}
