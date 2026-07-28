import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  createBuildingShapeMesh,
  createUnitBuildingGeometry,
  isBuildingShape,
} from "@/scene/builders/createBuildingShapeMesh";
import {
  createEdgeLightMesh,
  disposeEdgeLightMesh,
  isEdgeLightType,
} from "@/scene/builders/createEdgeLightMesh";
import {
  createRooftopMesh,
  disposeRooftopMesh,
  isRooftopType,
} from "@/scene/builders/createRooftopMesh";
import type { BuildingShape } from "@/scene/types";

/** O que mostrar. `key` vem do catálogo — pode não ter builder no front. */
export type PreviewSubject = {
  kind: "shape" | "rooftop" | "edgeLight";
  key: string;
};

// Prédio-base e elevação da câmera por tipo. O alvo tem que dominar o quadro:
// topo pede prédio baixo com câmera alta; formato pede prédio alto (geometria é
// 1×1×1 — sem esticar, Empire/Chrysler viram cubos).
const VIEW: Record<PreviewSubject["kind"], { height: number; elevation: number }> = {
  shape: { height: 3, elevation: 0.42 },
  rooftop: { height: 0.8, elevation: 0.95 },
  edgeLight: { height: 2.2, elevation: 0.55 },
};

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

type Resolved =
  | { kind: "shape"; shape: BuildingShape }
  | { kind: "rooftop"; type: Exclude<RooftopType, "none"> }
  | { kind: "edgeLight"; type: Exclude<EdgeLightType, "none"> };

/**
 * Key do catálogo -> builder. `null` = sem builder no front, ou `none`
 * (ausência de acessório) — quem chama mostra placeholder em vez de canvas.
 */
function resolveSubject({ kind, key }: PreviewSubject): Resolved | null {
  if (kind === "shape") return isBuildingShape(key) ? { kind, shape: key } : null;
  if (kind === "rooftop") {
    return isRooftopType(key) && key !== "none" ? { kind, type: key } : null;
  }
  return isEdgeLightType(key) && key !== "none" ? { kind, type: key } : null;
}

/** Prédio + acessório, prontos pra cena. */
function buildSubject(resolved: Resolved) {
  const { height } = VIEW[resolved.kind];
  const shape = resolved.kind === "shape" ? resolved.shape : "default";
  const accessory =
    resolved.kind === "rooftop"
      ? createRooftopMesh(resolved.type, { width: 1, depth: 1 })
      : resolved.kind === "edgeLight"
        ? createEdgeLightMesh(resolved.type, { width: 1, depth: 1, height }, shape)
        : null;

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
  const building = createBuildingShapeMesh(shape, facadeMat, topMat, boxGeometry);
  building.scale.set(1, height, 1);

  const root = new THREE.Group();
  root.add(building);
  if (accessory) {
    // Topo do prédio pro rooftop, base pro LED (o grupo cresce até `height`).
    accessory.position.setY(resolved.kind === "rooftop" ? height / 2 : -height / 2);
    root.add(accessory);
  }

  const dispose = () => {
    const materials = Array.isArray(building.material) ? building.material : [building.material];
    for (const material of new Set(materials)) material.dispose();
    // Só a caixa é nossa: geometrias de formato/acessório são cache dos builders.
    boxGeometry.dispose();
    if (accessory) {
      (resolved.kind === "rooftop" ? disposeRooftopMesh : disposeEdgeLightMesh)(accessory);
    }
  };

  return { root, dispose };
}

/**
 * Caixa que manda no enquadramento, ignorando volumétrico (transparente sem
 * depthWrite): o feixe do holofote tem 10 unidades e deixaria o prédio um ponto.
 */
function frameBox(root: THREE.Object3D): THREE.Box3 {
  const box = new THREE.Box3();
  root.updateWorldMatrix(false, true);
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (materials.every((m) => m.transparent && m.depthWrite === false)) return;
    box.expandByObject(mesh);
  });
  return box;
}

/**
 * Cena mínima com o assunto. Fora da cena 3D não há HDRI nem ambiente, então o
 * preview traz luz própria (sem sombra — mesma regra do resto do projeto).
 */
function createPreviewScene(subject: PreviewSubject) {
  const built = buildSubject(subject);
  if (!built) return null;

  const scene = new THREE.Scene();
  // Halo do LED é aditivo: some em fundo claro.
  if (subject.kind === "edgeLight") scene.background = new THREE.Color(0x14161a);
  scene.add(new THREE.AmbientLight(0xffffff, 1.2));
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(4, 6, 5);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xb9d0ff, 0.9);
  fill.position.set(-5, 2, -4);
  scene.add(fill);
  scene.add(built.root);

  const sphere = frameBox(built.root).getBoundingSphere(new THREE.Sphere());
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
      .set(1, VIEW[subject.kind].elevation, 1)
      .normalize()
      .multiplyScalar(distance)
      .add(sphere.center);
    camera.lookAt(sphere.center);
  };

  return { scene, camera, center: sphere.center, frame, place, dispose: built.dispose };
}

// PNG por assunto. Um render só por assunto na vida da aba — a lista inteira
// custa um punhado de frames e depois é só <img>. "" = falhou / sem preview.
const thumbCache = new Map<string, string>();

function renderThumb(subject: PreviewSubject): string {
  const cacheKey = `${subject.kind}:${subject.key}`;
  const cached = thumbCache.get(cacheKey);
  if (cached !== undefined) return cached;

  let url = "";
  let renderer: THREE.WebGLRenderer | null = null;
  let view: ReturnType<typeof createPreviewScene> = null;
  try {
    view = createPreviewScene(subject);
    if (view) {
      renderer = createRenderer(true);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(THUMB_SIZE, THUMB_SIZE, false);
      view.place(view.frame(1));
      renderer.render(view.scene, view.camera);
      url = renderer.domElement.toDataURL("image/png");
    }
  } catch {
    url = "";
  } finally {
    view?.dispose();
    renderer?.dispose();
  }
  thumbCache.set(cacheKey, url);
  return url;
}

/** Miniatura estática (lista do admin). */
export function CustomizationThumb({
  subject,
  className,
}: {
  subject: PreviewSubject;
  className?: string;
}) {
  const { kind, key } = subject;
  const [url, setUrl] = useState(() => thumbCache.get(`${kind}:${key}`) ?? "");

  useEffect(() => {
    // rAF: render sai do commit do React — lista com 10 itens não trava o paint.
    const id = requestAnimationFrame(() => setUrl(renderThumb({ kind, key })));
    return () => cancelAnimationFrame(id);
  }, [kind, key]);

  if (!url) return <div className={className} aria-hidden />;
  return <img src={url} alt="" className={className} draggable={false} />;
}

/** Preview interativo (arrastar pra girar). Um contexto WebGL enquanto montado. */
export function CustomizationPreview({
  subject,
  className,
}: {
  subject: PreviewSubject;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [unsupported, setUnsupported] = useState(false);
  const { kind, key } = subject;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const view = createPreviewScene({ kind, key });
    if (!view) {
      setUnsupported(true);
      return;
    }

    const renderer = createRenderer(false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";

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
  }, [kind, key]);

  if (unsupported) {
    return (
      <div className={className}>
        <p className="flex size-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
          Sem preview 3D para esta opção.
        </p>
      </div>
    );
  }
  return <div ref={containerRef} className={className} />;
}
