import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  createPreviewScene,
  resolveSubject,
  type PreviewSubject,
} from "@/scene/builders/createPreviewScene";

const THUMB_SIZE = 128;

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

// PNG por assunto. Um render só por assunto na vida da aba — a lista inteira
// custa um punhado de frames e depois é só <img>. "" = falhou / sem preview.
const thumbCache = new Map<string, string>();

function renderThumb(subject: PreviewSubject): string {
  const cacheKey = `${subject.kind}:${subject.key}`;
  const cached = thumbCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const resolved = resolveSubject(subject);
  let url = "";
  let renderer: THREE.WebGLRenderer | null = null;
  let view: ReturnType<typeof createPreviewScene> | null = null;
  try {
    if (resolved) {
      view = createPreviewScene(resolved);
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
  const { kind, key } = subject;
  const resolved = resolveSubject(subject);

  useEffect(() => {
    const container = containerRef.current;
    const resolved = resolveSubject({ kind, key });
    if (!container || !resolved) return;

    const view = createPreviewScene(resolved);
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

  if (!resolved) {
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
