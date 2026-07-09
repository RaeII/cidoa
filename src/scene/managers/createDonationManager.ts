import * as THREE from "three";
import { DEFAULT_BUILDING_TEXTURE_TRANSFORM } from "../types";
import type {
  BlockLayoutSettings,
  BuildingCustomization,
  BuildingShape,
  BuildingTextureTransform,
  BuildingSettings,
  DonationEntry,
  EdgeLightType,
  RooftopType,
  TextureSettings,
} from "../types";
import {
  createRooftopMesh,
  disposeRooftopMesh,
  disposeRooftopSharedResources,
} from "../builders/createRooftopMesh";
import {
  createSignMesh,
  disposeSignMesh,
} from "../builders/createSignMesh";
import {
  createEdgeLightMesh,
  disposeEdgeLightMesh,
  disposeEdgeLightSharedResources,
} from "../builders/createEdgeLightMesh";
import {
  createHologramMesh,
  disposeHologramMesh,
  positionHologram,
  setHologramImage,
  setHologramOpacity,
  setHologramTint,
  tickHologram,
  type HologramEntry,
} from "../builders/createHologramMesh";
import { DEFAULT_HOLOGRAM_COLOR, DEFAULT_HOLOGRAM_OPACITY } from "../types";
import {
  createTwistedBuildingMesh,
  disposeTwistedBuildingSharedResources,
} from "../builders/createTwistedBuildingMesh";
import {
  createOctagonalBuildingMesh,
  disposeOctagonalBuildingSharedResources,
} from "../builders/createOctagonalBuildingMesh";
import {
  createSetbackBuildingMesh,
  disposeSetbackBuildingSharedResources,
} from "../builders/createSetbackBuildingMesh";
import {
  createTaperedBuildingMesh,
  disposeTaperedBuildingSharedResources,
} from "../builders/createTaperedBuildingMesh";
import {
  createChryslerBuildingMesh,
  disposeChryslerBuildingSharedResources,
} from "../builders/createChryslerBuildingMesh";
import {
  createHearstBuildingMesh,
  disposeHearstBuildingSharedResources,
} from "../builders/createHearstBuildingMesh";
import {
  createEmpireBuildingMesh,
  disposeEmpireBuildingSharedResources,
  setEmpireBuildingMeshColor,
} from "../builders/createEmpireBuildingMesh";
import {
  createTaipeiBuildingMesh,
  disposeTaipeiBuildingSharedResources,
} from "../builders/createTaipeiBuildingMesh";
import {
  createOneTradeBuildingMesh,
  disposeOneTradeBuildingSharedResources,
} from "../builders/createOneTradeBuildingMesh";
import { seeded } from "../utils/random";

import colorTextureSrc from "../../assets/texture/Facade006_1K-mirrored-PNG/Facade006_1K-PNG_Color.png";
import normalTextureSrc from "../../assets/texture/Facade006_1K-mirrored-PNG/Facade006_1K-PNG_NormalGL.png";
import roughnessTextureSrc from "../../assets/texture/Facade006_1K-mirrored-PNG/Facade006_1K-PNG_Roughness.png";
import metalnessTextureSrc from "../../assets/texture/Facade006_1K-mirrored-PNG/Facade006_1K-PNG_Metalness.png";
import displacementTextureSrc from "../../assets/texture/Facade006_1K-mirrored-PNG/Facade006_1K-PNG_Displacement.png";
import concreteColorSrc from "../../assets/texture/Concrete024_1K-JPG/Concrete024_1K-JPG_Color.jpg";
import concreteNormalSrc from "../../assets/texture/Concrete024_1K-JPG/Concrete024_1K-JPG_NormalGL.jpg";
import concreteRoughnessSrc from "../../assets/texture/Concrete024_1K-JPG/Concrete024_1K-JPG_Roughness.jpg";
import concreteDisplacementSrc from "../../assets/texture/Concrete024_1K-JPG/Concrete024_1K-JPG_Displacement.jpg";

// Configuração de layout do visualizador de doações
export const DONATION_LAYOUT = {
  maxSceneHeight: 16,     // Altura máxima visual na cena
  minBuildingHeight: 0.5, // Mínimo visual para qualquer doação
  buildingWidth: 2.0,
  buildingDepth: 2.0,
  slotSize: 3.2,          // Distância entre centros de cada prédio
} as const;

// Piso mínimo do loteamento, em anéis de quadras. r=1 → grade 3×3 de quadras
// sempre presente (asfalto + lotes vazios), mesmo com 0 doações, pra cena nunca
// ficar vazia. Cresce além disso conforme as doações exigem mais quadras.
const MIN_LOTEAMENTO_RADIUS = 1;

// Distância (mundo) além da qual acessórios de detalhe deixam de renderizar.
// Fog denso já os torna ilegíveis nessa faixa — só a silhueta do prédio importa.
const ACCESSORY_DETAIL_DISTANCE = 80;
const ACCESSORY_DETAIL_DISTANCE_SQ = ACCESSORY_DETAIL_DISTANCE * ACCESSORY_DETAIL_DISTANCE;

// Precomputa posições em espiral quadrada a partir do centro.
// Índice 0 = centro (doação mais alta), depois cresce em anéis.
// Cada anel adiciona 8*(ring) posições a distância crescente do centro.
function generateSpiralPositions(count: number): ReadonlyArray<[number, number]> {
  const positions: Array<[number, number]> = [[0, 0]];
  let ring = 1;
  while (positions.length < count) {
    for (let x = -ring; x < ring && positions.length < count; x++) {
      positions.push([x, -ring]);
    }
    for (let z = -ring; z < ring && positions.length < count; z++) {
      positions.push([ring, z]);
    }
    for (let x = ring; x > -ring && positions.length < count; x--) {
      positions.push([x, ring]);
    }
    for (let z = ring; z > -ring && positions.length < count; z--) {
      positions.push([-ring, z]);
    }
    ring++;
  }
  return positions;
}

let spiralPositions = generateSpiralPositions(512);

// Retorna os offsets de slot dentro de um bloco, ordenados do centro para fora.
// O índice 0 é sempre o slot mais próximo do centro do bloco (para o prédio mais alto).
function getBlockSlotOffsets(blockSize: number): ReadonlyArray<[number, number]> {
  const offsets: Array<[number, number]> = [];
  const half = (blockSize - 1) / 2;
  for (let row = 0; row < blockSize; row++) {
    for (let col = 0; col < blockSize; col++) {
      offsets.push([
        (col - half) * DONATION_LAYOUT.slotSize,
        (row - half) * DONATION_LAYOUT.slotSize,
      ]);
    }
  }
  offsets.sort((a, b) => a[0] ** 2 + a[1] ** 2 - (b[0] ** 2 + b[1] ** 2));
  return offsets;
}

// Fisher-Yates determinístico usando seeded random com blockIndex como semente.
function shuffleBlockSlots(
  slots: ReadonlyArray<[number, number]>,
  blockIndex: number,
): Array<[number, number]> {
  const result: Array<[number, number]> = slots.map((s) => [s[0], s[1]]);
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(seeded(blockIndex, i) * (i + 1));
    const tmp = result[i];
    result[i] = result[j];
    result[j] = tmp;
  }
  return result;
}

type DonationManagerOptions = {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  buildingSettings: BuildingSettings;
  textureSettings: TextureSettings;
  blockLayoutSettings: BlockLayoutSettings;
};

export type DonationManager = {
  addDonation: (value: number) => void;
  addDonations: (values: number[]) => void;
  /** Replace-all com o dataset do backend (IDs preservados). Usado no load inicial e ao trocar filtro. */
  setDonations: (entries: ReadonlyArray<{ id: number; value: number }>) => void;
  updateBuildingSettings: (settings: BuildingSettings) => void;
  updateTextureSettings: (settings: TextureSettings) => void;
  updateBlockLayout: (settings: BlockLayoutSettings) => void;
  setEnvMap: (envMap: THREE.Texture | null) => void;
  beginEnvCapture: () => void;
  endEnvCapture: () => void;
  getDonationCount: () => number;
  getCityRadius: () => number;
  getHoveredValue: (event: MouseEvent, camera: THREE.Camera, domElement: HTMLElement) => number | null;
  getClickedDonationId: (event: MouseEvent, camera: THREE.Camera, domElement: HTMLElement) => number | null;
  getDonationWorldPosition: (donationId: number) => THREE.Vector3 | null;
  setFocusedDonation: (donationId: number | null) => void;
  updateDonationCustomization: (donationId: number, customization: BuildingCustomization) => void;
  tickAnimations: (elapsedSeconds: number, deltaMs: number) => void;
  setRenderDistance: (distance: number, backDistance: number) => void;
  /** Retorna quantos prédios ficaram ocultos pelo cull de distância (frontal + traseiro). */
  updateDistanceCulling: (cameraPos: THREE.Vector3, cameraForward: THREE.Vector3) => number;
  dispose: () => void;
};

function loadTexture(src: string): THREE.Texture {
  const loader = new THREE.TextureLoader();
  const texture = loader.load(src);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function loadDataTexture(src: string): THREE.Texture {
  const loader = new THREE.TextureLoader();
  const texture = loader.load(src);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function isTexturelessMaterial(material: THREE.Material): boolean {
  return material.userData.textureless === true;
}

export function createDonationManager({
  scene,
  renderer,
  buildingSettings,
  textureSettings,
  blockLayoutSettings,
}: DonationManagerOptions): DonationManager {
  const colorMap = loadTexture(colorTextureSrc);
  const normalMap = loadDataTexture(normalTextureSrc);
  const roughnessMap = loadDataTexture(roughnessTextureSrc);
  const metalnessMap = loadDataTexture(metalnessTextureSrc);
  const displacementMap = loadDataTexture(displacementTextureSrc);
  // Emissive reusa o color map (mesmo arquivo) — evita segunda cópia na GPU.
  const emissiveMap = colorMap;

  const concreteColorMap = loadTexture(concreteColorSrc);
  const concreteNormalMap = loadDataTexture(concreteNormalSrc);
  const concreteRoughnessMap = loadDataTexture(concreteRoughnessSrc);
  const concreteDisplacementMap = loadDataTexture(concreteDisplacementSrc);

  const allTextures = [
    colorMap, normalMap, roughnessMap, metalnessMap, displacementMap,
    concreteColorMap, concreteNormalMap, concreteRoughnessMap, concreteDisplacementMap,
  ];

  // 4 é suficiente visualmente; anisotropia máxima (16) castiga o fill rate.
  const maxAniso = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  for (const tex of allTextures) {
    tex.anisotropy = maxAniso;
  }

  const tilingUniform = { value: textureSettings.tilingScale };
  const topTilingUniform = { value: textureSettings.top.tilingScale };

  // Geometria 1×1×1 — escala via instanceMatrix
  const buildingGeometry = new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  for (const group of buildingGeometry.groups) {
    group.materialIndex = group.materialIndex === 2 ? 1 : 0;
  }
  // Atributos de projeção (cópia da posição/normal axis-aligned). O shader triplanar
  // os consome unificadamente — geometria torcida sobrescreve essas atribuições com
  // os valores PRÉ-twist (ver createTwistedBuildingMesh).
  buildingGeometry.setAttribute(
    "aProjPosition",
    new THREE.BufferAttribute(new Float32Array(buildingGeometry.attributes.position.array), 3),
  );
  buildingGeometry.setAttribute(
    "aProjNormal",
    new THREE.BufferAttribute(new Float32Array(buildingGeometry.attributes.normal.array), 3),
  );

  // Shader triplanar: aplica textura usando coordenadas de mundo, não UV locais.
  // Necessário para instanced mesh onde cada prédio tem escala/posição diferente.
  // Cria um uniform `uTilingMultiplier` (default 1.0) por material — guardado em
  // `material.userData.tilingMultiplier` para permitir override per-edifício em clones.
  const applyTriplanarShader = (
    material: THREE.MeshPhysicalMaterial,
    cacheKey: string,
    tiling: { value: number },
  ) => {
    const tilingMultiplier = { value: 1.0 };
    const textureTransform = {
      value: new THREE.Vector4(
        DEFAULT_BUILDING_TEXTURE_TRANSFORM.scaleX,
        DEFAULT_BUILDING_TEXTURE_TRANSFORM.scaleY,
        DEFAULT_BUILDING_TEXTURE_TRANSFORM.offsetX,
        DEFAULT_BUILDING_TEXTURE_TRANSFORM.offsetY,
      ),
    };
    material.userData.tilingMultiplier = tilingMultiplier;
    material.userData.textureTransform = textureTransform;
    material.customProgramCacheKey = () => cacheKey;
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTiling = tiling;
      shader.uniforms.uTilingMultiplier = tilingMultiplier;
      shader.uniforms.uTextureTransform = textureTransform;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <common>",
        `#include <common>
        uniform float uTiling;
        uniform float uTilingMultiplier;
        uniform vec4 uTextureTransform;
        attribute vec3 aProjPosition;
        attribute vec3 aProjNormal;
        varying vec3 vTriplanarWorldPos;
        varying vec3 vTriplanarObjNormal;`,
      );
      shader.vertexShader = shader.vertexShader.replace(
        "#include <fog_vertex>",
        `#include <fog_vertex>
        // Usa posição/normal de projeção (axis-aligned, pré-twist) para evitar
        // costura no meio do edifício torcido. Em geometria default, esses
        // atributos são cópias diretas de position/normal, então o
        // comportamento é idêntico ao anterior.
        #ifdef USE_INSTANCING
          vec4 triWp = modelMatrix * instanceMatrix * vec4(aProjPosition, 1.0);
        #else
          vec4 triWp = modelMatrix * vec4(aProjPosition, 1.0);
        #endif
        vTriplanarWorldPos = triWp.xyz;
        vTriplanarObjNormal = aProjNormal;
        vec3 triAbsN = abs(aProjNormal);
        vec2 triUV;
        if (triAbsN.y >= triAbsN.x && triAbsN.y >= triAbsN.z) {
          triUV = triWp.xz;
        } else if (triAbsN.x >= triAbsN.z) {
          triUV = triWp.zy;
        } else {
          triUV = triWp.xy;
        }
        triUV *= uTiling * uTilingMultiplier;
        triUV = triUV * uTextureTransform.xy + uTextureTransform.zw;
        #ifdef USE_MAP
          vMapUv = triUV;
        #endif
        #ifdef USE_NORMALMAP
          vNormalMapUv = triUV;
        #endif
        #ifdef USE_ROUGHNESSMAP
          vRoughnessMapUv = triUV;
        #endif
        #ifdef USE_METALNESSMAP
          vMetalnessMapUv = triUV;
        #endif
        #ifdef USE_BUMPMAP
          vBumpMapUv = triUV;
        #endif
        #ifdef USE_DISPLACEMENTMAP
          vDisplacementMapUv = triUV;
        #endif
        #ifdef USE_EMISSIVEMAP
          vEmissiveMapUv = triUV;
        #endif`,
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <common>",
        `#include <common>
        varying vec3 vTriplanarWorldPos;
        varying vec3 vTriplanarObjNormal;`,
      );
    };
  };

  // Sem clearcoat: segundo lobo especular dobra o custo de shading do material
  // mais caro do three.js na superfície que domina a tela. EnvMap + roughness
  // baixa já dão o brilho de vidro/fachada.
  const facadeMaterial = new THREE.MeshPhysicalMaterial({
    color: buildingSettings.color,
    roughness: buildingSettings.roughness,
    metalness: buildingSettings.metalness,
    bumpMap: displacementMap,
    envMapIntensity: 1.8,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0,
  });
  applyTriplanarShader(facadeMaterial, "donation-facade-triplanar", tilingUniform);

  const topMaterial = new THREE.MeshPhysicalMaterial({
    color: buildingSettings.color,
    roughness: buildingSettings.roughness,
    metalness: buildingSettings.metalness,
    bumpMap: concreteDisplacementMap,
    envMapIntensity: 1.8,
  });
  applyTriplanarShader(topMaterial, "donation-top-triplanar", topTilingUniform);

  // Materiais clonados para o edifício em destaque (opacidade total, independente do instanced)
  const focusFacadeMaterial = facadeMaterial.clone();
  const focusTopMaterial = topMaterial.clone();
  applyTriplanarShader(focusFacadeMaterial, "focus-facade-triplanar", tilingUniform);
  applyTriplanarShader(focusTopMaterial, "focus-top-triplanar", topTilingUniform);

  let capacity = 512;
  let mesh = new THREE.InstancedMesh(
    buildingGeometry,
    [facadeMaterial, topMaterial],
    capacity,
  );
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.count = 0;
  scene.add(mesh);

  // --- Rede de estradas (asfalto entre blocos) ---
  const asphaltMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x18191c),
    roughness: 0.92,
    metalness: 0.01,
  });

  // --- Calçadas (concreto elevado, meio-fio em volta de cada quadra) ---
  // Calçada estreita no vão entre a borda dos lotes e a borda do asfalto,
  // elevada acima do chão e do asfalto. Box instanciado = 1 draw call pra todas.
  const SIDEWALK_RESERVE = 3.6;       // recuo do asfalto (rua − recuo = largura do asfalto)
  const SIDEWALK_GAP = 0.25;          // respiro de chão livre entre a quadra e a calçada
  const SIDEWALK_BOTTOM = -0.08;      // fundo do box, abaixo do terreno (-0.04) p/ não flutuar; topo vem de sidewalkHeight
  const sidewalkGeometry = new THREE.BoxGeometry(1, 1, 1);
  // Remapeia os grupos de face: topo (+y, índice 2) → material 0; laterais + base → material 1.
  // Assim a lateral pode ter cor mais escura (efeito de sombra) e a altura fica visível.
  for (const group of sidewalkGeometry.groups) {
    group.materialIndex = group.materialIndex === 2 ? 0 : 1;
  }
  const sidewalkTopMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(blockLayoutSettings.sidewalkColor),
    roughness: 0.95,
    metalness: 0.0,
  });
  const sidewalkSideMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(blockLayoutSettings.sidewalkSideColor),
    roughness: 0.95,
    metalness: 0.0,
  });
  const sidewalkDummy = new THREE.Object3D();
  let sidewalkCapacity = 0;
  let sidewalkMesh: THREE.InstancedMesh | null = null;

  // Desenha uma moldura de calçada (4 tiras) em volta de cada quadra. As molduras
  // quebram naturalmente nos cruzamentos (cantos das quadras), deixando o asfalto
  // perpendicular passar livre. Tira N/S cobre os cantos; L/O fica entre eles.
  const rebuildSidewalks = (
    r: number,
    blockSpacing: number,
    streetWidth: number,
    roadWidth: number,
  ) => {
    const blockFootprint = blockSpacing - streetWidth;
    // Calçada estreita: ocupa o vão entre a borda externa dos lotes e a borda do
    // asfalto, com SIDEWALK_GAP de chão livre antes da quadra (respiro). Não sobe na
    // quadra nem invade o asfalto. innerHalf = lote + respiro, outerHalf = asfalto.
    const lotEdge = blockFootprint / 2 + (DONATION_LAYOUT.slotSize - 0.5) / 2;    // borda externa dos lotes
    const innerHalf = lotEdge + SIDEWALK_GAP;                                     // após o respiro
    const outerHalf = blockSpacing / 2 - roadWidth / 2;                          // borda do asfalto
    const sidewalkWidth = outerHalf - innerHalf;
    if (sidewalkWidth <= 0.01 || blockFootprint <= 0) {
      if (sidewalkMesh) sidewalkMesh.count = 0;
      return;
    }
    const midHalf = (innerHalf + outerHalf) / 2;
    const blocksPerSide = 2 * r + 1;
    const needed = blocksPerSide * blocksPerSide * 4; // 4 tiras por quadra

    let m = sidewalkMesh;
    if (!m || needed > sidewalkCapacity) {
      if (m) {
        scene.remove(m);
        m.dispose();
      }
      sidewalkCapacity = Math.max(64, Math.ceil(needed * 1.5));
      m = new THREE.InstancedMesh(
        sidewalkGeometry,
        [sidewalkTopMaterial, sidewalkSideMaterial],
        sidewalkCapacity,
      );
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(m);
      sidewalkMesh = m;
    }

    // Altura configurável: topo em sidewalkHeight, fundo fixo abaixo do terreno.
    const swTop = currentBlockLayout.sidewalkHeight;
    const swBoxHeight = swTop - SIDEWALK_BOTTOM;
    const swCenterY = (swTop + SIDEWALK_BOTTOM) / 2;

    let idx = 0;
    const addStrip = (cx: number, cz: number, sx: number, sz: number) => {
      sidewalkDummy.position.set(cx, swCenterY, cz);
      sidewalkDummy.scale.set(sx, swBoxHeight, sz);
      sidewalkDummy.updateMatrix();
      m!.setMatrixAt(idx++, sidewalkDummy.matrix);
    };

    for (let bx = -r; bx <= r; bx++) {
      for (let bz = -r; bz <= r; bz++) {
        const cx = bx * blockSpacing;
        const cz = bz * blockSpacing;
        addStrip(cx, cz + midHalf, 2 * outerHalf, sidewalkWidth); // norte
        addStrip(cx, cz - midHalf, 2 * outerHalf, sidewalkWidth); // sul
        addStrip(cx + midHalf, cz, sidewalkWidth, 2 * innerHalf); // leste
        addStrip(cx - midHalf, cz, sidewalkWidth, 2 * innerHalf); // oeste
      }
    }

    m.count = idx;
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  };

  // Shader de linhas pontilhadas centrais (divisória de pistas)
  const dashVS = /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;
  const dashFS = /* glsl */`
    varying vec2 vUv;
    uniform float dashRepeat;   // ciclos de tracejado ao longo da via
    uniform float dashAlong;    // 1.0 = traceja em UV.y (longitudinal), 0.0 = UV.x (transversal)
    uniform float roadLen;      // comprimento físico da via (unidades de mundo)
    uniform float blockSpacing; // distância entre cruzamentos
    uniform float interHalf;    // meia-largura do cruzamento (zona sem faixa)

    void main() {
      float dashCoord  = mix(vUv.x, vUv.y, dashAlong);
      float stripCoord = mix(vUv.y, vUv.x, dashAlong);

      // Faixa central estreita (10% da largura da pista)
      if (abs(stripCoord - 0.5) > 0.01) discard;

      // Apaga a faixa nos cruzamentos pra ela não conflitar com a faixa da via
      // perpendicular. Via centrada na origem; cruzamentos em (k+0.5)*blockSpacing.
      // distInter = distância física ao cruzamento mais próximo.
      float along = (dashCoord - 0.5) * roadLen;
      float u = along / blockSpacing - 0.5;
      float distInter = abs(fract(u + 0.5) - 0.5) * blockSpacing;
      if (distInter < interHalf) discard;

      // Padrão de tracejado: 15% cheio, 85% vazio
      if (fract(dashCoord * dashRepeat) > 0.15) discard;

      gl_FragColor = vec4(0.92, 0.88, 0.55, 0.7); // amarelo-creme
    }
  `;

  const roadMeshes: THREE.Mesh[] = [];
  let lastRoadR = -1;
  let lastRoadBlockSpacing = 0;
  let lastRoadStreetWidth = 0;

  const rebuildRoads = (r: number, blockSpacing: number, streetWidth: number) => {
    if (
      r === lastRoadR &&
      blockSpacing === lastRoadBlockSpacing &&
      streetWidth === lastRoadStreetWidth
    ) return;
    lastRoadR = r;
    lastRoadBlockSpacing = blockSpacing;
    lastRoadStreetWidth = streetWidth;

    for (const m of roadMeshes) {
      scene.remove(m);
      m.geometry.dispose();
      if (m.material !== asphaltMaterial) (m.material as THREE.Material).dispose();
    }
    roadMeshes.length = 0;

    if (r === 0) {
      if (sidewalkMesh) sidewalkMesh.count = 0;
      return; // bloco único, sem estradas entre blocos
    }

    // Asfalto: rua menos a reserva das calçadas (`SIDEWALK_RESERVE`) — fica mais
    // estreito que antes. A calçada (`rebuildSidewalks`) preenche o resto da rua.
    const roadWidth = Math.max(1.0, streetWidth - SIDEWALK_RESERVE);
    // Meia-largura do cruzamento onde a faixa central é apagada (= largura da via
    // perpendicular, + folga) — evita o conflito de faixas no cruzamento.
    const interHalf = roadWidth / 2 + 0.15;

    // Comprimento: estende até a borda EXTERNA das quadras mais externas, pra o asfalto
    // chegar ao final do loteamento (não parar nas interseções internas).
    // blockFootprint = blockSpacing - streetWidth; meia-extensão = r*blockSpacing + blockFootprint/2,
    // então o comprimento total = 2*(r*blockSpacing + blockFootprint/2) = 2*r*blockSpacing + blockFootprint.
    const blockFootprint = blockSpacing - streetWidth;
    const totalLen = 2 * r * blockSpacing + blockFootprint;
    const roadY = -0.015;
    const dashY = roadY + 0.005;
    const dashSpacing = 1.0; // espaçamento físico (unidades) de cada ciclo traço+vão

    const addRoad = (w: number, h: number, x: number, z: number, dashAlong: number) => {
      // Plano de asfalto
      const geo = new THREE.PlaneGeometry(w, h);
      const m = new THREE.Mesh(geo, asphaltMaterial);
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, roadY, z);
      scene.add(m);
      roadMeshes.push(m);

      // Plano de tracejado central
      const roadLen = dashAlong === 1.0 ? h : w;
      const dashGeo = new THREE.PlaneGeometry(w, h);
      const dashMat = new THREE.ShaderMaterial({
        vertexShader: dashVS,
        fragmentShader: dashFS,
        uniforms: {
          dashRepeat:   { value: roadLen / dashSpacing },
          dashAlong:    { value: dashAlong },
          roadLen:      { value: roadLen },
          blockSpacing: { value: blockSpacing },
          interHalf:    { value: interHalf },
        },
        transparent: true,
        depthWrite: false,
      });
      const dashMesh = new THREE.Mesh(dashGeo, dashMat);
      dashMesh.rotation.x = -Math.PI / 2;
      dashMesh.position.set(x, dashY, z);
      scene.add(dashMesh);
      roadMeshes.push(dashMesh);
    };

    // Faixas longitudinais (direção Z), entre colunas de blocos (separação em X)
    for (let bx = -r; bx < r; bx++) {
      addRoad(roadWidth, totalLen, (bx + 0.5) * blockSpacing, 0, 1.0);
    }

    // Faixas transversais (direção X), entre linhas de blocos (separação em Z)
    for (let bz = -r; bz < r; bz++) {
      addRoad(totalLen, roadWidth, 0, (bz + 0.5) * blockSpacing, 0.0);
    }

    // Calçadas elevadas em volta de cada quadra, preenchendo o resto da rua
    rebuildSidewalks(r, blockSpacing, streetWidth, roadWidth);
  };

  // --- Lotes vazios (loteamento esperando edifícios) ---
  // Cada slot de quadra sem edifício recebe um tile de chão demarcado. Junto com o
  // asfalto, isso deixa a cena povoada mesmo com poucas/zero doações e some sob os
  // prédios conforme o loteamento é preenchido. InstancedMesh = 1 draw call pra todos.
  const LOT_TILE_SIZE = DONATION_LAYOUT.slotSize - 0.5; // gap entre tiles = divisão dos lotes
  const LOT_HALF = (LOT_TILE_SIZE / 2).toFixed(4);
  const LOT_Y = -0.012; // acima da zona plana do relevo (-0.04) e do plano cinza (-0.03)
  const lotGeometry = new THREE.PlaneGeometry(LOT_TILE_SIZE, LOT_TILE_SIZE);
  lotGeometry.rotateX(-Math.PI / 2); // deita o plano no chão; matriz de instância só translada
  const lotMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(blockLayoutSettings.lotColor), // cor configurável das quadras
    roughness: 0.98,
    metalness: 0.0,
  });
  // Borda escura demarcando cada lote (estilo planta de loteamento). Injetada no
  // MeshStandardMaterial pra manter iluminação + recebimento de sombra do pipeline.
  lotMaterial.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      `#include <common>
      varying vec2 vLotPos;`,
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      vLotPos = position.xz;`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      `#include <common>
      varying vec2 vLotPos;`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
      vec2 lotA = abs(vLotPos) / ${LOT_HALF};
      float lotBorder = smoothstep(0.80, 0.96, max(lotA.x, lotA.y));
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.42, lotBorder);`,
    );
  };

  const lotDummy = new THREE.Object3D();
  let lotCapacity = 0;
  let lotMesh: THREE.InstancedMesh | null = null;

  const rebuildLots = (positions: ReadonlyArray<[number, number]>) => {
    const needed = positions.length;
    if (needed === 0) {
      if (lotMesh) lotMesh.count = 0;
      return;
    }
    let m = lotMesh;
    if (!m || needed > lotCapacity) {
      if (m) {
        scene.remove(m);
        m.dispose();
      }
      lotCapacity = Math.max(64, Math.ceil(needed * 1.5));
      m = new THREE.InstancedMesh(lotGeometry, lotMaterial, lotCapacity);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(m);
      lotMesh = m;
    }
    for (let i = 0; i < needed; i++) {
      lotDummy.position.set(positions[i][0], LOT_Y, positions[i][1]);
      lotDummy.updateMatrix();
      m.setMatrixAt(i, lotDummy.matrix);
    }
    m.count = needed;
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  };

  const donations: DonationEntry[] = [];
  let nextId = 0;
  // Meio-extensão (mundo) da cidade construída. Consumido pelo relevo para abrir a zona plana.
  let cityHalfExtent = 0;
  let currentTextureSettings = { ...textureSettings };
  let currentBlockLayout = { ...blockLayoutSettings };
  const dummy = new THREE.Object3D();
  // Cull de distância dos prédios: instância além da distância vira matriz zero-scale
  // (camera.far sozinho não poupa GPU — InstancedMesh processa todos vértices sempre).
  let renderDistanceSq = Infinity;
  let backDistanceSq = Infinity;
  let instanceHidden = new Uint8Array(0);
  const hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
  const raycaster = new THREE.Raycaster();
  const mouseVec = new THREE.Vector2();
  const instanceToValue: number[] = [];
  const instanceToDonationId: number[] = [];
  const donationIdToInstanceIndex = new Map<number, number>();
  const donationTransforms = new Map<number, { position: THREE.Vector3; scale: THREE.Vector3 }>();
  // Arrays paralelos por índice de instância (posição + meia-extensão do AABB).
  // Culling e picking a 100k leem daqui — donationTransforms.get() por instância
  // a cada tick custava 100k lookups de Map (hitches de vários ms).
  let instPosX = new Float32Array(0);
  let instPosY = new Float32Array(0);
  let instPosZ = new Float32Array(0);
  let instHalfX = new Float32Array(0);
  let instHalfY = new Float32Array(0);
  let instHalfZ = new Float32Array(0);
  // Picking: 1 AABB por quadra + faixa contígua de instâncias (preenchidas quadra
  // a quadra no rebuildInstances). Raycast testa ~centenas de quadras, depois só
  // as instâncias das quadras atingidas — prédio default é caixa, AABB é hit exato.
  type PickBlock = {
    minX: number; maxX: number; minZ: number; maxZ: number; maxY: number;
    start: number; end: number;
  };
  const pickBlocks: PickBlock[] = [];
  // Prédios com formato customizado (ex: twisted) renderizam como Mesh próprio
  // — pulam alocação no InstancedMesh e mantêm clones de material por edifício.
  type CustomShapeEntry = {
    mesh: THREE.Mesh;
    facadeMat: THREE.MeshPhysicalMaterial;
    topMat: THREE.MeshPhysicalMaterial;
    shape: BuildingShape;
  };
  const customShapeMeshes = new Map<number, CustomShapeEntry>();
  const currentBuildingColor = new THREE.Color(buildingSettings.color);
  const tmpTransformMatrix = new THREE.Matrix4();
  const tmpTransformPosition = new THREE.Vector3();
  const tmpTransformQuaternion = new THREE.Quaternion();
  const tmpTransformScale = new THREE.Vector3();

  const setInstanceMetadata = (
    instanceIndex: number,
    donationId: number,
    value: number,
  ) => {
    instanceToValue[instanceIndex] = value;
    instanceToDonationId[instanceIndex] = donationId;
    donationIdToInstanceIndex.set(donationId, instanceIndex);
    // dummy já está posicionado/escalado pelo chamador (rebuildInstances)
    instPosX[instanceIndex] = dummy.position.x;
    instPosY[instanceIndex] = dummy.position.y;
    instPosZ[instanceIndex] = dummy.position.z;
    instHalfX[instanceIndex] = dummy.scale.x / 2;
    instHalfY[instanceIndex] = dummy.scale.y / 2;
    instHalfZ[instanceIndex] = dummy.scale.z / 2;
  };

  // Lê position/scale lógicos da doação a partir de um map, independentemente
  // de o prédio ser renderizado via InstancedMesh ou como mesh customizado (twisted).
  // Acessórios (rooftop, sign, edge light) usam essa rota única para sincronização.
  const readDonationTransform = (donationId: number) => {
    const transform = donationTransforms.get(donationId);
    if (!transform) return false;
    tmpTransformPosition.copy(transform.position);
    tmpTransformScale.copy(transform.scale);
    tmpTransformQuaternion.identity();
    tmpTransformMatrix.compose(
      tmpTransformPosition,
      tmpTransformQuaternion,
      tmpTransformScale,
    );
    return true;
  };

  // Picking sem raycast no InstancedMesh: three itera as 100k instâncias por
  // mousemove (O(n) interno) — trava o hover. Aqui: intersectsBox nos ~1,6k AABBs
  // de quadra (µs), depois Ray.intersectBox só nas instâncias das quadras atingidas
  // (~dezenas). Custom shapes (poucos) seguem raycaster normal; vence o mais perto.
  const pickBox = new THREE.Box3();
  const pickPoint = new THREE.Vector3();

  const pickAt = (
    event: MouseEvent,
    camera: THREE.Camera,
    domElement: HTMLElement,
  ): { donationId: number; value: number } | null => {
    const rect = domElement.getBoundingClientRect();
    mouseVec.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseVec.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouseVec, camera);
    const ray = raycaster.ray;

    let bestIndex = -1;
    let bestDist = Infinity;
    for (const blk of pickBlocks) {
      pickBox.min.set(blk.minX, 0, blk.minZ);
      pickBox.max.set(blk.maxX, blk.maxY, blk.maxZ);
      if (!ray.intersectsBox(pickBox)) continue;
      for (let i = blk.start; i < blk.end; i++) {
        if (instanceHidden[i]) continue; // culled = invisível = não pickável
        pickBox.min.set(instPosX[i] - instHalfX[i], instPosY[i] - instHalfY[i], instPosZ[i] - instHalfZ[i]);
        pickBox.max.set(instPosX[i] + instHalfX[i], instPosY[i] + instHalfY[i], instPosZ[i] + instHalfZ[i]);
        if (!ray.intersectBox(pickBox, pickPoint)) continue;
        const dist = pickPoint.distanceTo(ray.origin);
        if (dist < bestDist) {
          bestDist = dist;
          bestIndex = i;
        }
      }
    }

    // Custom shapes: geometria não é caixa — raycaster normal (poucas unidades)
    let customHit: THREE.Intersection | null = null;
    if (customShapeMeshes.size > 0) {
      const targets: THREE.Object3D[] = [];
      for (const entry of customShapeMeshes.values()) targets.push(entry.mesh);
      const hits = raycaster.intersectObjects(targets, false);
      if (hits.length > 0) customHit = hits[0];
    }

    if (bestIndex >= 0 && (!customHit || bestDist <= customHit.distance)) {
      return { donationId: instanceToDonationId[bestIndex], value: instanceToValue[bestIndex] };
    }
    if (customHit) {
      const id = customHit.object.userData.donationId;
      const value = customHit.object.userData.donationValue;
      if (typeof id === "number" && typeof value === "number") return { donationId: id, value };
    }
    return null;
  };

  const getAllFacadeMaterials = (): THREE.MeshPhysicalMaterial[] => {
    const list: THREE.MeshPhysicalMaterial[] = [facadeMaterial, focusFacadeMaterial];
    for (const entry of customShapeMeshes.values()) list.push(entry.facadeMat);
    return list;
  };

  const getAllTopMaterials = (): THREE.MeshPhysicalMaterial[] => {
    const list: THREE.MeshPhysicalMaterial[] = [topMaterial, focusTopMaterial];
    for (const entry of customShapeMeshes.values()) list.push(entry.topMat);
    return list;
  };

  const applyTextureToFacade = (settings: TextureSettings) => {
    const targets = getAllFacadeMaterials();
    for (const mat of targets) {
      const textureless = isTexturelessMaterial(mat);
      if (settings.enabled && !textureless) {
        mat.map = colorMap;
        mat.normalMap = normalMap;
        mat.normalScale.set(settings.normalScale, settings.normalScale);
        mat.roughnessMap = roughnessMap;
        mat.metalnessMap = metalnessMap;
        mat.roughness = settings.roughnessIntensity;
        mat.metalness = settings.metalnessIntensity;
        mat.bumpMap = displacementMap;
        // Com scale 0 o displacement é um fetch de vértice inútil — só liga quando ativo.
        mat.displacementMap = settings.displacementScale > 0 ? displacementMap : null;
        mat.displacementScale = settings.displacementScale;
        mat.emissiveMap = emissiveMap;
      } else {
        mat.map = null;
        mat.normalMap = null;
        mat.roughnessMap = null;
        mat.metalnessMap = null;
        mat.bumpMap = textureless ? null : displacementMap;
        mat.displacementMap = null;
        mat.displacementScale = 0;
        mat.emissiveMap = null;
      }
      mat.emissiveIntensity = textureless ? 0 : settings.emissiveIntensity;
      if (!textureless) {
        mat.envMapIntensity = settings.envMapIntensity;
      }
      mat.needsUpdate = true;
    }
  };

  const applyTextureToTop = (settings: TextureSettings) => {
    const top = settings.top;
    const targets = getAllTopMaterials();
    for (const mat of targets) {
      const textureless = isTexturelessMaterial(mat);
      if (settings.enabled && !textureless) {
        mat.map = concreteColorMap;
        mat.normalMap = concreteNormalMap;
        mat.normalScale.set(top.normalScale, top.normalScale);
        mat.roughnessMap = concreteRoughnessMap;
        mat.roughness = top.roughnessIntensity;
        mat.metalness = top.metalnessIntensity;
        mat.bumpMap = concreteDisplacementMap;
        mat.displacementMap = top.displacementScale > 0 ? concreteDisplacementMap : null;
        mat.displacementScale = top.displacementScale;
      } else {
        mat.map = null;
        mat.normalMap = null;
        mat.roughnessMap = null;
        mat.bumpMap = textureless ? null : concreteDisplacementMap;
        mat.displacementMap = null;
        mat.displacementScale = 0;
      }
      if (!textureless) {
        mat.envMapIntensity = top.envMapIntensity;
      }
      mat.needsUpdate = true;
    }
  };

  applyTextureToFacade(textureSettings);
  applyTextureToTop(textureSettings);

  // Expande o InstancedMesh e as posições de espiral quando o total excede a capacidade atual.
  const growIfNeeded = (needed: number) => {
    if (needed <= capacity) return;
    while (capacity < needed) capacity = Math.ceil(capacity * 1.5);
    if (spiralPositions.length < capacity) {
      spiralPositions = generateSpiralPositions(capacity);
    }
    scene.remove(mesh);
    mesh.dispose();
    mesh = new THREE.InstancedMesh(buildingGeometry, [facadeMaterial, topMaterial], capacity);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(mesh);
  };

  // Sistema de 2 camadas: torres + base urbana.
  //
  // Torres (top towerRatio%) usam o range completo de altura e ocupam os N slots
  // mais centrais de cada quadra (towersPerBlock por quadra), em espiral.
  //
  // Base urbana (restante) usa teto de altura reduzido (baseHeightCap × maxSceneHeight)
  // e é embaralhada deterministicamente nos slots restantes de todas as quadras.
  // Define se a doação precisa virar um Mesh dedicado (saindo do InstancedMesh).
  // Dispara quando o formato é diferente de "default" ou quando há customização
  // que exige estado de material próprio (ex: tilingScale ≠ 1.0).
  const needsCustomMesh = (c?: BuildingCustomization): boolean => {
    if (!c) return false;
    if (c.buildingShape !== "default") return true;
    if (Math.abs(c.tilingScale - 1) > 0.001) return true;
    if (!isDefaultTextureTransform(c.textureTransform)) return true;
    return false;
  };

  const isDefaultTextureTransform = (textureTransform?: BuildingTextureTransform): boolean => {
    const transform = textureTransform ?? DEFAULT_BUILDING_TEXTURE_TRANSFORM;
    return (
      Math.abs(transform.scaleX - DEFAULT_BUILDING_TEXTURE_TRANSFORM.scaleX) <= 0.001 &&
      Math.abs(transform.scaleY - DEFAULT_BUILDING_TEXTURE_TRANSFORM.scaleY) <= 0.001 &&
      Math.abs(transform.offsetX - DEFAULT_BUILDING_TEXTURE_TRANSFORM.offsetX) <= 0.001 &&
      Math.abs(transform.offsetY - DEFAULT_BUILDING_TEXTURE_TRANSFORM.offsetY) <= 0.001
    );
  };

  const sameTextureTransform = (
    a?: BuildingTextureTransform,
    b?: BuildingTextureTransform,
  ): boolean => {
    const ta = a ?? DEFAULT_BUILDING_TEXTURE_TRANSFORM;
    const tb = b ?? DEFAULT_BUILDING_TEXTURE_TRANSFORM;
    return (
      Math.abs(ta.scaleX - tb.scaleX) <= 0.001 &&
      Math.abs(ta.scaleY - tb.scaleY) <= 0.001 &&
      Math.abs(ta.offsetX - tb.offsetX) <= 0.001 &&
      Math.abs(ta.offsetY - tb.offsetY) <= 0.001
    );
  };

  const setMaterialTextureTransform = (
    material: THREE.MeshPhysicalMaterial,
    textureTransform?: BuildingTextureTransform,
  ) => {
    const transform = textureTransform ?? DEFAULT_BUILDING_TEXTURE_TRANSFORM;
    const uniform = material.userData.textureTransform as
      | { value: THREE.Vector4 }
      | undefined;
    uniform?.value.set(
      transform.scaleX,
      transform.scaleY,
      transform.offsetX,
      transform.offsetY,
    );
  };

  const recordTransform = (donationId: number) => {
    let transform = donationTransforms.get(donationId);
    if (!transform) {
      transform = { position: new THREE.Vector3(), scale: new THREE.Vector3() };
      donationTransforms.set(donationId, transform);
    }
    transform.position.copy(dummy.position);
    transform.scale.copy(dummy.scale);
  };

  const rebuildInstances = () => {
    donationTransforms.clear();
    instanceToValue.length = 0;
    instanceToDonationId.length = 0;
    donationIdToInstanceIndex.clear();
    pickBlocks.length = 0;
    if (instPosX.length < capacity) {
      instPosX = new Float32Array(capacity);
      instPosY = new Float32Array(capacity);
      instPosZ = new Float32Array(capacity);
      instHalfX = new Float32Array(capacity);
      instHalfY = new Float32Array(capacity);
      instHalfZ = new Float32Array(capacity);
    }

    const { blockSize, streetWidth, towerRatio, towersPerBlock, baseHeightCap } = currentBlockLayout;
    const tpb = Math.max(1, Math.min(towersPerBlock, blockSize * blockSize));
    const buildingsPerBlock = blockSize * blockSize;
    const blockFootprint = (blockSize - 1) * DONATION_LAYOUT.slotSize;
    const blockSpacing = blockFootprint + streetWidth;
    const slotOffsets = getBlockSlotOffsets(blockSize);

    // Loteamento: a cena sempre mostra a grade de quadras (asfalto + lotes vazios)
    // mesmo com poucas/zero doações. Com 0 doação, só renderiza o loteamento vazio.
    const hasDonations = donations.length > 0;
    const maxValue = hasDonations ? donations[0].value : 1;
    const towerCount = hasDonations ? Math.max(1, Math.round(donations.length * towerRatio)) : 0;
    const baseMaxHeight = DONATION_LAYOUT.maxSceneHeight * baseHeightCap;

    // Mínimo de quadras necessárias para acomodar torres e base
    const towerBlockCount = Math.ceil(towerCount / tpb);
    const baseSlotsPerBlock = buildingsPerBlock - tpb;
    const baseCount = Math.max(0, donations.length - towerCount);
    const baseBlocksNeeded = baseSlotsPerBlock > 0 ? Math.ceil(baseCount / baseSlotsPerBlock) : 0;
    const totalBlocksMin = Math.max(towerBlockCount, baseBlocksNeeded);

    // Expandir para o próximo anel completo: (2R+1)² garante formato quadrado.
    // Sem isso, blocos parcialmente preenchidos no anel externo criam assimetria visual.
    // Piso MIN_LOTEAMENTO_RADIUS: o loteamento nunca encolhe abaixo desse raio, então
    // a cena já começa povoada e cresce conforme as doações exigem mais quadras.
    let r = MIN_LOTEAMENTO_RADIUS;
    while ((2 * r + 1) ** 2 < totalBlocksMin) r++;
    // Meio-extensão da cidade: centro do bloco mais externo + meia quadra + folga de um slot.
    cityHalfExtent = r * blockSpacing + blockFootprint / 2 + DONATION_LAYOUT.slotSize;
    const expandedBlocks = (2 * r + 1) ** 2;
    const innerBlocks = r === 0 ? 0 : (2 * (r - 1) + 1) ** 2;
    const outerRingSize = expandedBlocks - innerBlocks; // 8R posições no anel externo

    // Garantir que spiralPositions cobre todos os blocos expandidos
    if (spiralPositions.length < expandedBlocks) {
      spiralPositions = generateSpiralPositions(expandedBlocks + 64);
    }

    // Ordenar posições do anel externo por distância Manhattan decrescente da origem.
    // Cantos têm |bx|+|bz| = 2R, meios das arestas têm |bx|+|bz| = R.
    // Assim, ao preencher parcialmente o anel, os cantos ficam preenchidos primeiro,
    // evitando o padrão [8,8,8]/[8,8,0] onde um canto fica vazio.
    // Cantos têm |bx|+|bz| = 2R (maior Manhattan), meios das arestas têm |bx|+|bz| = R.
    // Ordem decrescente → cantos preenchidos primeiro ao preencher o anel parcialmente.
    const outerRingOrder = Array.from({ length: outerRingSize }, (_, i) => innerBlocks + i).sort(
      (a, b) => {
        const [ax, az] = spiralPositions[a];
        const [bx, bz] = spiralPositions[b];
        return (Math.abs(bx) + Math.abs(bz)) - (Math.abs(ax) + Math.abs(az));
      },
    ).reverse();

    const blocks: Array<{ towers: number[]; base: number[] }> = Array.from(
      { length: expandedBlocks },
      () => ({ towers: [], base: [] }),
    );

    // Distribuir torres: tpb por quadra; anel interno em ordem espiral, externo por outerRingOrder
    for (let t = 0; t < towerCount; t++) {
      const linearBlock = Math.floor(t / tpb);
      const b = linearBlock < innerBlocks
        ? linearBlock
        : outerRingOrder[linearBlock - innerBlocks];
      if (b !== undefined) blocks[b].towers.push(t);
    }

    // Shuffle determinístico da base (Fisher-Yates com seeded random)
    const baseIndices: number[] = [];
    for (let i = towerCount; i < donations.length; i++) baseIndices.push(i);
    for (let i = baseIndices.length - 1; i > 0; i--) {
      const j = Math.floor(seeded(i, baseIndices.length, 42) * (i + 1));
      const tmp = baseIndices[i]; baseIndices[i] = baseIndices[j]; baseIndices[j] = tmp;
    }

    // Etapa A: preencher anel interno até a capacidade normal
    let basePtr = 0;
    for (let b = 0; b < innerBlocks && basePtr < baseIndices.length; b++) {
      const slotsAvailable = buildingsPerBlock - blocks[b].towers.length;
      for (let s = 0; s < slotsAvailable && basePtr < baseIndices.length; s++) {
        blocks[b].base.push(baseIndices[basePtr++]);
      }
    }

    // Etapa B: distribuir base restante uniformemente pelo anel externo.
    // Cada posição do anel recebe floor(remaining/outerRingSize) prédios,
    // com o restante (remainder) distribuído às primeiras posições (+1 cada).
    const baseForOuter = baseIndices.length - basePtr;
    if (outerRingSize > 0 && baseForOuter > 0) {
      const perBlock = Math.floor(baseForOuter / outerRingSize);
      const remainder = baseForOuter % outerRingSize;
      for (let i = 0; i < outerRingOrder.length && basePtr < baseIndices.length; i++) {
        const b = outerRingOrder[i];
        const count = perBlock + (i < remainder ? 1 : 0);
        for (let s = 0; s < count && basePtr < baseIndices.length; s++) {
          blocks[b].base.push(baseIndices[basePtr++]);
        }
      }
    }

    // --- Posicionar instâncias ---
    let instanceIdx = 0;
    const maxBaseValue = donations[towerCount]?.value ?? maxValue;
    // Slots de quadra sem edifício → coletados como lotes demarcados (loteamento esperando).
    const emptyLots: Array<[number, number]> = [];

    for (let b = 0; b < blocks.length; b++) {
      const block = blocks[b];
      const [bx, bz] = spiralPositions[b];
      const blockCenterX = bx * blockSpacing;
      const blockCenterZ = bz * blockSpacing;
      const blockStartInstance = instanceIdx;

      const occupiedSlots = block.towers.length + block.base.length;
      const isComplete = occupiedSlots === buildingsPerBlock;

      // Bloco completo: slots aleatórios (embaralhados).
      // Bloco incompleto: torres no slot mais próximo ao centro da cena para evitar
      // prédios isolados flutuando longe dos vizinhos. orderedSlots guarda a ordem
      // usada (ocupados primeiro) pra saber quais sobram como lote vazio.
      let towerSlots: Array<[number, number]>;
      let shuffledBaseSlots: Array<[number, number]>;
      let orderedSlots: ReadonlyArray<[number, number]>;

      if (isComplete) {
        const allSlots = shuffleBlockSlots(slotOffsets, b);
        towerSlots = allSlots.slice(0, block.towers.length);
        shuffledBaseSlots = allSlots.slice(block.towers.length);
        orderedSlots = allSlots;
      } else {
        const slotsByOriginDist = [...slotOffsets].sort(
          (a, bSlot) =>
            (blockCenterX + a[0]) ** 2 + (blockCenterZ + a[1]) ** 2 -
            ((blockCenterX + bSlot[0]) ** 2 + (blockCenterZ + bSlot[1]) ** 2),
        );
        towerSlots = slotsByOriginDist.slice(0, block.towers.length);
        shuffledBaseSlots = slotsByOriginDist.slice(block.towers.length);
        orderedSlots = slotsByOriginDist;
      }

      // Torres nos slots mais próximos da origem da cena
      for (let t = 0; t < block.towers.length; t++) {
        const donIdx = block.towers[t];
        const [ox, oz] = towerSlots[t];
        const height =
          DONATION_LAYOUT.minBuildingHeight +
          (donations[donIdx].value / maxValue) *
            (DONATION_LAYOUT.maxSceneHeight - DONATION_LAYOUT.minBuildingHeight);
        const id = donations[donIdx].id;
        dummy.position.set(blockCenterX + ox, height / 2, blockCenterZ + oz);
        dummy.scale.set(1.0 + seeded(id, 1) * 1.6, height, 1.0 + seeded(id, 2) * 1.6);
        dummy.updateMatrix();
        recordTransform(id);
        // Prédios com customização que exige estado de material próprio
        // (formato torcido, tilingScale ≠ 1.0, etc) pulam alocação no InstancedMesh —
        // são desenhados como Mesh próprio em syncCustomShapes.
        if (!needsCustomMesh(donations[donIdx].customization)) {
          mesh.setMatrixAt(instanceIdx, dummy.matrix);
          setInstanceMetadata(instanceIdx, id, donations[donIdx].value);
          instanceIdx++;
        }
      }

      // Base urbana nos slots restantes
      for (let s = 0; s < block.base.length; s++) {
        const donIdx = block.base[s];
        const [ox, oz] = shuffledBaseSlots[s];
        const ratio = maxBaseValue > 0 ? donations[donIdx].value / maxBaseValue : 0;
        const height =
          DONATION_LAYOUT.minBuildingHeight +
          Math.min(ratio, 1) * (baseMaxHeight - DONATION_LAYOUT.minBuildingHeight);
        const id = donations[donIdx].id;
        dummy.position.set(blockCenterX + ox, height / 2, blockCenterZ + oz);
        dummy.scale.set(1.0 + seeded(id, 1) * 1.6, height, 1.0 + seeded(id, 2) * 1.6);
        dummy.updateMatrix();
        recordTransform(id);
        if (!needsCustomMesh(donations[donIdx].customization)) {
          mesh.setMatrixAt(instanceIdx, dummy.matrix);
          setInstanceMetadata(instanceIdx, id, donations[donIdx].value);
          instanceIdx++;
        }
      }

      // Lotes vazios: só dentro do loteamento mínimo inicial (grade 3×3 em r=1),
      // pra cena não começar vazia. Fora dele a cidade cresce por doação real —
      // não semeamos lote vazio pra ela não "crescer junto"; slots vagos do anel
      // externo ficam só chão/asfalto. Slot ocupado nunca vira lote (some sozinho).
      const withinMinLoteamento =
        Math.abs(bx) <= MIN_LOTEAMENTO_RADIUS && Math.abs(bz) <= MIN_LOTEAMENTO_RADIUS;
      if (withinMinLoteamento) {
        for (let s = occupiedSlots; s < orderedSlots.length; s++) {
          emptyLots.push([
            blockCenterX + orderedSlots[s][0],
            blockCenterZ + orderedSlots[s][1],
          ]);
        }
      }

      // AABB da quadra p/ picking: min/max XZ + altura máx. das instâncias dela.
      // Quadras só com custom shapes ficam de fora (raycast próprio em pickAt).
      if (instanceIdx > blockStartInstance) {
        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, maxY = 0;
        for (let i = blockStartInstance; i < instanceIdx; i++) {
          minX = Math.min(minX, instPosX[i] - instHalfX[i]);
          maxX = Math.max(maxX, instPosX[i] + instHalfX[i]);
          minZ = Math.min(minZ, instPosZ[i] - instHalfZ[i]);
          maxZ = Math.max(maxZ, instPosZ[i] + instHalfZ[i]);
          maxY = Math.max(maxY, instPosY[i] + instHalfY[i]);
        }
        pickBlocks.push({ minX, maxX, minZ, maxZ, maxY, start: blockStartInstance, end: instanceIdx });
      }
    }

    mesh.count = instanceIdx;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.boundingSphere = null; // força recomputação na próxima chamada de raycast

    // Layout reescreveu todas as matrizes → todas visíveis; próximo passe de cull re-esconde.
    if (instanceHidden.length < capacity) instanceHidden = new Uint8Array(capacity);
    else instanceHidden.fill(0);

    // Aplicar cores individuais (customização) por instância
    applyInstanceColors();

    // Reposicionar/criar prédios com formato customizado (twisted)
    syncCustomShapes();

    // Reposicionar acessórios de topo e letreiros
    syncRooftops();
    syncSigns();
    syncEdgeLights();
    syncHolograms();

    rebuildRoads(r, blockSpacing, streetWidth);
    rebuildLots(emptyLots);
  };

  const tmpColor = new THREE.Color();
  let focusedDonationId: number | null = null;
  let focusHighlightMesh: THREE.Mesh | null = null;

  const removeFocusHighlight = () => {
    if (focusHighlightMesh) {
      scene.remove(focusHighlightMesh);
      focusHighlightMesh = null;
    }
  };

  const setMatOpacity = (mat: THREE.Material, opacity: number) => {
    mat.transparent = opacity < 1;
    mat.opacity = opacity;
    mat.needsUpdate = true;
  };

  const getCustomShapeMaterials = (entry: CustomShapeEntry): THREE.Material[] => {
    return Array.from(
      new Set(Array.isArray(entry.mesh.material) ? entry.mesh.material : [entry.mesh.material]),
    );
  };

  const setCustomShapeOpacity = (entry: CustomShapeEntry, opacity: number) => {
    for (const material of getCustomShapeMaterials(entry)) {
      setMatOpacity(material, opacity);
    }
  };

  const applyFocus = (donationId: number | null) => {
    focusedDonationId = donationId;
    removeFocusHighlight();

    if (donationId === null) {
      setMatOpacity(facadeMaterial, 1);
      setMatOpacity(topMaterial, 1);
      for (const entry of customShapeMeshes.values()) {
        setCustomShapeOpacity(entry, 1);
      }
      applyInstanceColors();
      return;
    }

    setMatOpacity(facadeMaterial, 0.15);
    setMatOpacity(topMaterial, 0.15);
    mesh.instanceColor = null;

    for (const [donId, entry] of customShapeMeshes) {
      const opacity = donId === donationId ? 1 : 0.15;
      setCustomShapeOpacity(entry, opacity);
    }

    if (customShapeMeshes.has(donationId)) return;

    if (!readDonationTransform(donationId)) return;

    const donation = donations.find((d) => d.id === donationId);
    if (donation?.customization) {
      focusFacadeMaterial.color.set(donation.customization.color);
      focusTopMaterial.color.set(donation.customization.color);
    } else {
      focusFacadeMaterial.color.copy(currentBuildingColor);
      focusTopMaterial.color.copy(currentBuildingColor);
    }
    focusFacadeMaterial.needsUpdate = true;
    focusTopMaterial.needsUpdate = true;

    focusHighlightMesh = new THREE.Mesh(buildingGeometry, [focusFacadeMaterial, focusTopMaterial]);
    focusHighlightMesh.applyMatrix4(tmpTransformMatrix);
    scene.add(focusHighlightMesh);
  };

  // Buffer de cores reutilizado entre chamadas — realoca só quando a capacidade cresce.
  let instanceColorArray = new Float32Array(0);

  const applyInstanceColors = () => {
    if (mesh.count === 0) return;

    // Verificar se alguma doação tem customização
    const hasAnyCustom = donations.some((d) => d.customization);
    if (!hasAnyCustom) {
      // Sem customizações: remover instanceColor para usar cor do material
      mesh.instanceColor = null;
      return;
    }

    if (instanceColorArray.length < capacity * 3) {
      instanceColorArray = new Float32Array(capacity * 3);
    }
    const colors = instanceColorArray;
    const donationById = new Map<number, DonationEntry>();
    for (const d of donations) donationById.set(d.id, d);

    for (let i = 0; i < mesh.count; i++) {
      const donId = instanceToDonationId[i];
      const donation = donationById.get(donId);
      if (donation?.customization) {
        tmpColor.set(donation.customization.color);
      } else {
        tmpColor.copy(currentBuildingColor);
      }
      colors[i * 3] = tmpColor.r;
      colors[i * 3 + 1] = tmpColor.g;
      colors[i * 3 + 2] = tmpColor.b;
    }

    mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
    mesh.instanceColor.needsUpdate = true;
  };

  // --- Acessórios de topo ---
  // Mapa: donationId → { group, type }
  const rooftopMeshes = new Map<number, { group: THREE.Group; type: RooftopType }>();

  const syncRooftops = () => {
    // Reposicionar todos os acessórios existentes com base nas posições atuais dos edifícios
    for (const [donId, entry] of rooftopMeshes) {
      if (!readDonationTransform(donId)) {
        // Edifício não está visível — esconder
        entry.group.visible = false;
        continue;
      }
      // Posicionar no topo do edifício
      entry.group.position.set(
        tmpTransformPosition.x,
        tmpTransformPosition.y + tmpTransformScale.y / 2,
        tmpTransformPosition.z,
      );
      entry.group.visible = true;
    }
  };

  const setRooftop = (donationId: number, type: RooftopType) => {
    // Remover acessório anterior se existir
    const existing = rooftopMeshes.get(donationId);
    if (existing) {
      scene.remove(existing.group);
      disposeRooftopMesh(existing.group);
      rooftopMeshes.delete(donationId);
    }

    if (type === "none") return;

    const scale = getBuildingScale(donationId);
    const group = createRooftopMesh(
      type,
      scale ? { width: scale.x, depth: scale.z } : undefined,
    );
    if (!group) return;

    rooftopMeshes.set(donationId, { group, type });
    scene.add(group);

    // Posicionar imediatamente
    if (readDonationTransform(donationId)) {
      group.position.set(
        tmpTransformPosition.x,
        tmpTransformPosition.y + tmpTransformScale.y / 2,
        tmpTransformPosition.z,
      );
    }
  };

  // --- Letreiros (signs) ---
  // Mapa: donationId → { group, text, sides }. `sides` é guardado junto
  // para que `syncSigns` possa reconstruir o letreiro quando a altura ou o
  // formato do edifício mudam — sem isso, depois de um rebuildInstances o
  // letreiro fica obsoleto (yOffset/signH dependem de buildingH; a orientação
  // depende do shape twisted).
  const signMeshes = new Map<
    number,
    { group: THREE.Group; text: string; sides: number }
  >();

  const getBuildingScale = (donationId: number): THREE.Vector3 | null => {
    if (!readDonationTransform(donationId)) return null;
    return tmpTransformScale.clone();
  };

  // Reconstrói todos os letreiros existentes com as dimensões/shape atuais.
  // Chamado em rebuildInstances porque novas doações podem alterar a altura ou
  // o shape efetivo do edifício e o letreiro precisa refletir isso.
  const syncSigns = () => {
    if (signMeshes.size === 0) return;
    const snapshot: Array<{ donationId: number; text: string; sides: number }> = [];
    for (const [donId, entry] of signMeshes) {
      snapshot.push({ donationId: donId, text: entry.text, sides: entry.sides });
    }
    for (const item of snapshot) {
      setSign(item.donationId, item.text, item.sides);
    }
  };

  const setSign = (donationId: number, text: string, sides: number) => {
    // Remover sign anterior
    const existing = signMeshes.get(donationId);
    if (existing) {
      scene.remove(existing.group);
      disposeSignMesh(existing.group);
      signMeshes.delete(donationId);
    }

    const trimmed = text.trim();
    if (!trimmed) return;

    const scale = getBuildingScale(donationId);
    if (!scale) return;

    const donation = donations.find((d) => d.id === donationId);
    const shape = donation?.customization?.buildingShape ?? "default";

    const group = createSignMesh(trimmed, scale.x, scale.z, scale.y, sides, shape);
    if (!group) return;

    signMeshes.set(donationId, { group, text: trimmed, sides });
    scene.add(group);

    // Posicionar imediatamente no centro do edifício
    if (readDonationTransform(donationId)) {
      group.position.copy(tmpTransformPosition);
    }
  };

  const edgeLightMeshes = new Map<
    number,
    { group: THREE.Group; type: EdgeLightType }
  >();

  // Reconstrói todos os LEDs existentes com as dimensões atuais do edifício.
  // É chamado em rebuildInstances porque novas doações podem alterar a altura
  // de edifícios já com LED — o group precisa ser recriado para refletir scale.y.
  const syncEdgeLights = () => {
    if (edgeLightMeshes.size === 0) return;
    const snapshot: Array<{ donationId: number; type: EdgeLightType }> = [];
    for (const [donId, entry] of edgeLightMeshes) {
      snapshot.push({ donationId: donId, type: entry.type });
    }
    for (const item of snapshot) {
      setEdgeLight(item.donationId, item.type);
    }
  };

  const setEdgeLight = (
    donationId: number,
    type: EdgeLightType,
  ) => {
    const existing = edgeLightMeshes.get(donationId);
    if (existing) {
      scene.remove(existing.group);
      disposeEdgeLightMesh(existing.group);
      edgeLightMeshes.delete(donationId);
    }

    if (type === "none") return;

    const scale = getBuildingScale(donationId);
    if (!scale) return;

    const donation = donations.find((d) => d.id === donationId);
    const shape = donation?.customization?.buildingShape ?? "default";

    const group = createEdgeLightMesh(
      type,
      { width: scale.x, depth: scale.z, height: scale.y },
      shape,
    );
    if (!group) return;

    edgeLightMeshes.set(donationId, { group, type });
    scene.add(group);

    if (readDonationTransform(donationId)) {
      group.position.set(
        tmpTransformPosition.x,
        tmpTransformPosition.y - tmpTransformScale.y / 2,
        tmpTransformPosition.z,
      );
    }
  };


  // --- Hologramas ---
  // Mapa: donationId → HologramEntry. O loadToken interno do entry protege
  // contra race conditions quando o usuário troca a imagem antes do load
  // anterior completar.
  const hologramMeshes = new Map<number, HologramEntry>();

  const getBuildingFootprint = (donationId: number) => {
    if (!readDonationTransform(donationId)) return null;
    return {
      width: tmpTransformScale.x,
      depth: tmpTransformScale.z,
      height: tmpTransformScale.y,
    };
  };

  const syncHolograms = () => {
    for (const [donId, entry] of hologramMeshes) {
      const footprint = getBuildingFootprint(donId);
      if (!footprint) {
        entry.group.visible = false;
        continue;
      }
      entry.group.visible = true;
      const center = tmpTransformPosition.clone();
      positionHologram(entry, center, footprint);
    }
  };

  const setHologram = (
    donationId: number,
    dataUrl: string | null,
    color: string,
    opacity: number,
  ) => {
    const existing = hologramMeshes.get(donationId);

    if (!dataUrl) {
      if (existing) {
        scene.remove(existing.group);
        disposeHologramMesh(existing);
        hologramMeshes.delete(donationId);
      }
      return;
    }

    const footprint = getBuildingFootprint(donationId);
    if (!footprint) return;

    let entry = existing;
    if (!entry) {
      entry = createHologramMesh(footprint, { color, opacity });
      hologramMeshes.set(donationId, entry);
      scene.add(entry.group);
      const center = tmpTransformPosition.clone();
      positionHologram(entry, center, footprint);
    } else {
      setHologramTint(entry, color);
      setHologramOpacity(entry, opacity);
    }

    if (entry.imageDataUrl === dataUrl) {
      // Mesmo dataURL — reposicionar apenas (cobre rebuilds sem trocar imagem)
      const center = tmpTransformPosition.clone();
      positionHologram(entry, center, footprint);
      return;
    }

    void setHologramImage(entry, dataUrl, footprint).then(() => {
      const fp = getBuildingFootprint(donationId);
      if (!fp) return;
      const center = tmpTransformPosition.clone();
      const e = hologramMeshes.get(donationId);
      if (e) positionHologram(e, center, fp);
    });
  };

  const updateCustomShapeColor = (donationId: number, color: string) => {
    const entry = customShapeMeshes.get(donationId);
    if (!entry) return;
    if (entry.shape === "empire") {
      setEmpireBuildingMeshColor(entry.mesh, color);
      return;
    }
    entry.facadeMat.color.set(color);
    entry.topMat.color.set(color);
    entry.facadeMat.needsUpdate = true;
    entry.topMat.needsUpdate = true;
  };

  const disposeCustomShapeEntry = (entry: CustomShapeEntry) => {
    scene.remove(entry.mesh);
    for (const material of getCustomShapeMaterials(entry)) {
      if (material !== entry.facadeMat && material !== entry.topMat) {
        material.dispose();
      }
    }
    entry.facadeMat.dispose();
    entry.topMat.dispose();
  };

  // Garante que cada doação com customização que exige estado de material próprio
  // tenha um Mesh dedicado e atualizado. Cria/remove conforme as doações mudam e
  // reposiciona com base em donationTransforms.
  function syncCustomShapes() {
    const validIds = new Set<number>();

    for (const donation of donations) {
      if (!needsCustomMesh(donation.customization)) continue;

      const transform = donationTransforms.get(donation.id);
      if (!transform) continue;

      const shape = donation.customization?.buildingShape ?? "default";
      validIds.add(donation.id);
      let entry = customShapeMeshes.get(donation.id);

      if (!entry || entry.shape !== shape) {
        if (entry) {
          disposeCustomShapeEntry(entry);
          customShapeMeshes.delete(donation.id);
        }

        const customization = donation.customization!;
        const facadeMat = facadeMaterial.clone();
        const topMat = topMaterial.clone();
        // Re-aplica triplanar shader para que o clone tenha seu próprio
        // uTilingMultiplier (independente do main material).
        applyTriplanarShader(facadeMat, "donation-facade-triplanar", tilingUniform);
        applyTriplanarShader(topMat, "donation-top-triplanar", topTilingUniform);
        facadeMat.color.set(customization.color);
        topMat.color.set(customization.color);
        facadeMat.userData.tilingMultiplier.value = customization.tilingScale;
        topMat.userData.tilingMultiplier.value = customization.tilingScale;
        setMaterialTextureTransform(facadeMat, customization.textureTransform);
        setMaterialTextureTransform(topMat, customization.textureTransform);

        let sceneMesh: THREE.Mesh;
        if (shape === "twisted") {
          sceneMesh = createTwistedBuildingMesh(facadeMat, topMat);
        } else if (shape === "octagonal") {
          sceneMesh = createOctagonalBuildingMesh(facadeMat, topMat);
        } else if (shape === "setback") {
          sceneMesh = createSetbackBuildingMesh(facadeMat, topMat);
        } else if (shape === "tapered") {
          sceneMesh = createTaperedBuildingMesh(facadeMat, topMat);
        } else if (shape === "chrysler") {
          sceneMesh = createChryslerBuildingMesh(facadeMat, topMat);
        } else if (shape === "hearst") {
          sceneMesh = createHearstBuildingMesh(facadeMat, topMat);
        } else if (shape === "empire") {
          sceneMesh = createEmpireBuildingMesh(facadeMat, topMat);
          tmpColor.set(customization.color);
          if (!tmpColor.equals(currentBuildingColor)) {
            setEmpireBuildingMeshColor(sceneMesh, customization.color);
          }
        } else if (shape === "taipei") {
          sceneMesh = createTaipeiBuildingMesh(facadeMat, topMat);
        } else if (shape === "one-trade") {
          sceneMesh = createOneTradeBuildingMesh(facadeMat, topMat);
        } else {
          // Formato default mas precisa de mesh próprio (ex: tiling customizado).
          sceneMesh = new THREE.Mesh(buildingGeometry, [facadeMat, topMat]);
        }

        sceneMesh.userData.donationId = donation.id;
        sceneMesh.userData.donationValue = donation.value;
        scene.add(sceneMesh);

        entry = { mesh: sceneMesh, facadeMat, topMat, shape };
        customShapeMeshes.set(donation.id, entry);
      }

      entry.mesh.position.copy(transform.position);
      entry.mesh.scale.copy(transform.scale);
      entry.mesh.userData.donationValue = donation.value;
    }

    for (const [donId, entry] of customShapeMeshes) {
      if (!validIds.has(donId)) {
        disposeCustomShapeEntry(entry);
        customShapeMeshes.delete(donId);
      }
    }
  }

  // Render inicial: mostra o loteamento vazio (quadras + asfalto + lotes) já na
  // criação, antes de qualquer doação. Também define cityHalfExtent pro relevo abrir
  // a zona plana logo no setup do runtime.
  rebuildInstances();

  return {
    addDonation(value) {
      donations.push({ id: nextId++, value });
      donations.sort((a, b) => b.value - a.value);
      growIfNeeded(donations.length);
      rebuildInstances();
    },
    addDonations(values) {
      for (const value of values) {
        donations.push({ id: nextId++, value });
      }
      // Ordena uma vez e reconstrói uma vez para todo o lote
      donations.sort((a, b) => b.value - a.value);
      growIfNeeded(donations.length);
      rebuildInstances();
    },
    setDonations(entries) {
      // Replace-all do dataset do backend (load inicial e troca de filtro).
      // Foco não sobrevive: o id focado pode sair do dataset e a cena ficaria
      // presa no dimming (opacity 0.15) com o highlight órfão flutuando.
      applyFocus(null);

      const newIds = new Set<number>();
      for (const entry of entries) newIds.add(entry.id);

      // Acessórios (rooftop/sign/LED/holograma) são keyed por donationId e os
      // sync* só ESCONDEM, nunca deletam (remoção de doação não existia antes) —
      // dispose só dos ids que saíram do dataset; os que ficam são reposicionados
      // pelos sync* do rebuildInstances. Shared resources ficam (são reusados).
      // customShapeMeshes é limpo por syncCustomShapes (validIds).
      for (const [donId, entry] of rooftopMeshes) {
        if (newIds.has(donId)) continue;
        scene.remove(entry.group);
        disposeRooftopMesh(entry.group);
        rooftopMeshes.delete(donId);
      }
      for (const [donId, entry] of signMeshes) {
        if (newIds.has(donId)) continue;
        scene.remove(entry.group);
        disposeSignMesh(entry.group);
        signMeshes.delete(donId);
      }
      for (const [donId, entry] of edgeLightMeshes) {
        if (newIds.has(donId)) continue;
        scene.remove(entry.group);
        disposeEdgeLightMesh(entry.group);
        edgeLightMeshes.delete(donId);
      }
      for (const [donId, entry] of hologramMeshes) {
        if (newIds.has(donId)) continue;
        scene.remove(entry.group);
        disposeHologramMesh(entry);
        hologramMeshes.delete(donId);
      }

      // Customização (cor/formato/tiling) vive em donation.customization —
      // preservar p/ ids que continuam no dataset (ex.: prédio customizado que
      // sobrevive à troca de filtro), senão o replace-all a apagaria da cena
      // enquanto o painel do editor ainda a mostraria.
      const prevCustomizations = new Map<number, BuildingCustomization>();
      for (const donation of donations) {
        if (donation.customization && newIds.has(donation.id)) {
          prevCustomizations.set(donation.id, donation.customization);
        }
      }

      donations.length = 0;
      let maxId = 0;
      for (const entry of entries) {
        const donation: DonationEntry = { id: entry.id, value: entry.value };
        const customization = prevCustomizations.get(entry.id);
        if (customization) donation.customization = customization;
        donations.push(donation);
        if (entry.id > maxId) maxId = entry.id;
      }
      donations.sort((a, b) => b.value - a.value);
      // IDs vêm do backend; nextId acima do maior p/ doação manual local não colidir
      nextId = Math.max(maxId + 1, nextId);
      growIfNeeded(donations.length);
      rebuildInstances();
    },
    updateBuildingSettings(settings) {
      currentBuildingColor.set(settings.color); // manter em sync para instanceColor fallback
      facadeMaterial.color.set(settings.color);
      topMaterial.color.set(settings.color);
      // Roughness/metalness afetam todos os materiais (inclui clones twisted).
      // Cor é específica por edifício para clones — não sobrescrever aqui.
      if (!currentTextureSettings.enabled) {
        for (const mat of getAllFacadeMaterials()) {
          mat.roughness = settings.roughness;
          mat.metalness = settings.metalness;
          mat.needsUpdate = true;
        }
        for (const mat of getAllTopMaterials()) {
          mat.roughness = settings.roughness;
          mat.metalness = settings.metalness;
          mat.needsUpdate = true;
        }
      } else {
        for (const mat of getAllFacadeMaterials()) mat.needsUpdate = true;
        for (const mat of getAllTopMaterials()) mat.needsUpdate = true;
      }
      applyInstanceColors();
    },
    updateTextureSettings(settings) {
      currentTextureSettings = { ...settings };
      tilingUniform.value = settings.tilingScale;
      topTilingUniform.value = settings.top.tilingScale;
      applyTextureToFacade(settings);
      applyTextureToTop(settings);
    },
    updateBlockLayout(settings) {
      // Cores: aplicam direto nos materiais compartilhados, sem rebuild.
      lotMaterial.color.set(settings.lotColor);
      sidewalkTopMaterial.color.set(settings.sidewalkColor);
      sidewalkSideMaterial.color.set(settings.sidewalkSideColor);
      // Só os campos que afetam a geometria do layout exigem reconstruir as instâncias.
      const geometryChanged =
        settings.blockSize !== currentBlockLayout.blockSize ||
        settings.streetWidth !== currentBlockLayout.streetWidth ||
        settings.towerRatio !== currentBlockLayout.towerRatio ||
        settings.towersPerBlock !== currentBlockLayout.towersPerBlock ||
        settings.baseHeightCap !== currentBlockLayout.baseHeightCap;
      // Altura da calçada só reposiciona as tiras de calçada — rebuild localizado, sem mexer nos prédios.
      const sidewalkHeightChanged = settings.sidewalkHeight !== currentBlockLayout.sidewalkHeight;
      currentBlockLayout = { ...settings };
      if (geometryChanged) {
        rebuildInstances();
      } else if (sidewalkHeightChanged && lastRoadR >= 1) {
        const roadWidth = Math.max(1.0, lastRoadStreetWidth - SIDEWALK_RESERVE);
        rebuildSidewalks(lastRoadR, lastRoadBlockSpacing, lastRoadStreetWidth, roadWidth);
      }
    },
    setEnvMap(envMap) {
      for (const mat of getAllFacadeMaterials()) {
        mat.envMap = envMap;
        mat.needsUpdate = true;
      }
    },
    beginEnvCapture() {
      for (const mat of getAllFacadeMaterials()) mat.envMapIntensity = 0;
      for (const mat of getAllTopMaterials()) mat.envMapIntensity = 0;
    },
    endEnvCapture() {
      for (const mat of getAllFacadeMaterials()) {
        mat.envMapIntensity = currentTextureSettings.envMapIntensity;
      }
      for (const mat of getAllTopMaterials()) {
        mat.envMapIntensity = currentTextureSettings.top.envMapIntensity;
      }
    },
    getDonationCount() {
      return donations.length;
    },
    getCityRadius() {
      return cityHalfExtent;
    },
    getHoveredValue(event: MouseEvent, camera: THREE.Camera, domElement: HTMLElement) {
      return pickAt(event, camera, domElement)?.value ?? null;
    },
    getClickedDonationId(event: MouseEvent, camera: THREE.Camera, domElement: HTMLElement) {
      return pickAt(event, camera, domElement)?.donationId ?? null;
    },
    getDonationWorldPosition(donationId: number) {
      if (!readDonationTransform(donationId)) return null;
      const pos = tmpTransformPosition.clone();
      // Retornar o topo do prédio (pos.y é o centro, scale.y é a altura)
      pos.y += tmpTransformScale.y / 2;
      return pos;
    },
    setFocusedDonation(donationId: number | null) {
      applyFocus(donationId);
    },
    updateDonationCustomization(donationId: number, customization: BuildingCustomization) {
      const donation = donations.find((d) => d.id === donationId);
      if (!donation) return;

      const prevCustomization = donation.customization;
      const prevRooftop = prevCustomization?.rooftopType ?? "none";
      const prevSignText = prevCustomization?.signText ?? "";
      const prevSignSides = prevCustomization?.signSides ?? 1;
      const prevEdgeLightType = prevCustomization?.edgeLightType ?? "none";
      const prevShape = prevCustomization?.buildingShape ?? "default";
      const prevTilingScale = prevCustomization?.tilingScale ?? 1;
      const prevTextureTransform = prevCustomization?.textureTransform ??
        DEFAULT_BUILDING_TEXTURE_TRANSFORM;
      const prevHologramImage = prevCustomization?.hologramImage ?? null;
      const prevHologramColor = prevCustomization?.hologramColor ?? DEFAULT_HOLOGRAM_COLOR;
      const prevHologramOpacity = prevCustomization?.hologramOpacity ?? DEFAULT_HOLOGRAM_OPACITY;
      donation.customization = customization;

      const prevNeedsCustom = needsCustomMesh(prevCustomization);
      const nowNeedsCustom = needsCustomMesh(customization);

      // Transição de allocation: se o prédio entra ou sai do customShapeMeshes
      // (ou troca de shape), re-alocar instâncias e re-aplicar foco.
      if (prevNeedsCustom !== nowNeedsCustom || customization.buildingShape !== prevShape) {
        rebuildInstances();
        if (focusedDonationId !== null) {
          applyFocus(focusedDonationId);
        }
        return;
      }

      // Atualização de tiling em prédio que já está em customShapeMeshes:
      // só atualiza o uniform — sem rebuild.
      if (customization.tilingScale !== prevTilingScale) {
        const entry = customShapeMeshes.get(donationId);
        if (entry) {
          entry.facadeMat.userData.tilingMultiplier.value = customization.tilingScale;
          entry.topMat.userData.tilingMultiplier.value = customization.tilingScale;
        }
      }

      if (!sameTextureTransform(customization.textureTransform, prevTextureTransform)) {
        const entry = customShapeMeshes.get(donationId);
        if (entry) {
          setMaterialTextureTransform(entry.facadeMat, customization.textureTransform);
          setMaterialTextureTransform(entry.topMat, customization.textureTransform);
        }
      }

      // Atualização de cor: caminhos diferentes para custom mesh vs instanced.
      if (customShapeMeshes.has(donationId)) {
        updateCustomShapeColor(donationId, customization.color);
      } else if (focusedDonationId === donationId && focusHighlightMesh) {
        focusFacadeMaterial.color.set(customization.color);
        focusTopMaterial.color.set(customization.color);
        focusFacadeMaterial.needsUpdate = true;
        focusTopMaterial.needsUpdate = true;
      } else if (focusedDonationId === null) {
        applyInstanceColors();
      }

      // Atualizar acessório de topo se o tipo mudou
      if (customization.rooftopType !== prevRooftop) {
        setRooftop(donationId, customization.rooftopType);
      }

      // Atualizar letreiro se o texto ou número de lados mudou
      if (customization.signText !== prevSignText || customization.signSides !== prevSignSides) {
        setSign(donationId, customization.signText, customization.signSides);
      }

      // LED de arestas: type muda → rebuild
      if (customization.edgeLightType !== prevEdgeLightType) {
        setEdgeLight(donationId, customization.edgeLightType);
      }

      // Holograma: imagem muda (incluindo remoção) → recarregar.
      // Cor/opacidade só ajustam uniforms — sem reload da textura.
      if (customization.hologramImage !== prevHologramImage) {
        setHologram(
          donationId,
          customization.hologramImage,
          customization.hologramColor,
          customization.hologramOpacity,
        );
      } else {
        const entry = hologramMeshes.get(donationId);
        if (entry) {
          if (customization.hologramColor !== prevHologramColor) {
            setHologramTint(entry, customization.hologramColor);
          }
          if (customization.hologramOpacity !== prevHologramOpacity) {
            setHologramOpacity(entry, customization.hologramOpacity);
          }
        }
      }
    },
    tickAnimations(elapsedSeconds, deltaMs) {
      for (const entry of hologramMeshes.values()) {
        // Holograma culled por distância não precisa de tick (shader nem roda).
        if (entry.group.visible) tickHologram(entry, elapsedSeconds, deltaMs);
      }
    },
    setRenderDistance(distance, backDistance) {
      // Aplicado no próximo passe de updateDistanceCulling (throttle de 0.25s no runtime).
      renderDistanceSq = distance * distance;
      backDistanceSq = backDistance * backDistance;
    },
    // LOD barato: acessórios de detalhe (topo, letreiro, LED, holograma) somem além
    // da distância onde o fog já os apaga — o prédio (silhueta) continua visível.
    // Prédios (instanciados e customizados) somem além da distância de renderização.
    updateDistanceCulling(cameraPos, cameraForward) {
      // Forward projetado no plano XZ; olhando reto pra baixo não há "atrás" definido
      // → cull vira puramente radial (limite frontal pra todo mundo).
      let fx = cameraForward.x;
      let fz = cameraForward.z;
      const fLen = Math.hypot(fx, fz);
      const hasDirection = fLen > 1e-3;
      if (hasDirection) {
        fx /= fLen;
        fz /= fLen;
      }
      const distSqTo = (p: THREE.Vector3) => {
        const dx = p.x - cameraPos.x;
        const dz = p.z - cameraPos.z;
        return dx * dx + dz * dz;
      };
      // Olhando reto pra baixo (bird's eye, stop do orbit em phi≈0): forward XZ some,
      // "atrás" fica indefinido → cull radial usa a menor distância (mais agressiva),
      // pra continuar sumindo prédios mesmo com a câmera toda pra baixo.
      const fallbackSq = Math.min(renderDistanceSq, backDistanceSq);
      // Limite direcional: prédio atrás da câmera (dot < 0) usa backDistance.
      const limitSqFor = (p: THREE.Vector3) => {
        if (!hasDirection) return fallbackSq;
        const behind = (p.x - cameraPos.x) * fx + (p.z - cameraPos.z) * fz < 0;
        return behind ? backDistanceSq : renderDistanceSq;
      };
      const applyCull = (donId: number, group: THREE.Object3D) => {
        const t = donationTransforms.get(donId);
        if (!t) return; // sem transform = sync* já escondeu o group
        const d = distSqTo(t.position);
        group.visible = d <= ACCESSORY_DETAIL_DISTANCE_SQ && d <= limitSqFor(t.position);
      };
      for (const [donId, entry] of rooftopMeshes) applyCull(donId, entry.group);
      for (const [donId, entry] of signMeshes) applyCull(donId, entry.group);
      for (const [donId, entry] of edgeLightMeshes) applyCull(donId, entry.group);
      for (const [donId, entry] of hologramMeshes) applyCull(donId, entry.group);

      let culled = 0;

      // Prédios customizados: Mesh próprio, basta visible.
      for (const [donId, entry] of customShapeMeshes) {
        const t = donationTransforms.get(donId);
        if (!t) continue;
        entry.mesh.visible = distSqTo(t.position) <= limitSqFor(t.position);
        if (!entry.mesh.visible) culled++;
      }

      // Prédios instanciados: sem frustum cull por instância — zero-scale esconde de
      // verdade (some do render principal e da captura do envMap). Upload do buffer
      // só quando algum estado muda. Lê dos arrays paralelos (100k Map.get por tick
      // causava hitches); a matriz de restauração é recomposta dos mesmos arrays.
      let changed = false;
      for (let i = 0; i < mesh.count; i++) {
        const dx = instPosX[i] - cameraPos.x;
        const dz = instPosZ[i] - cameraPos.z;
        const d = dx * dx + dz * dz;
        const limit = hasDirection
          ? (dx * fx + dz * fz < 0 ? backDistanceSq : renderDistanceSq)
          : fallbackSq;
        const hidden = d > limit ? 1 : 0;
        if (hidden) culled++;
        if (instanceHidden[i] === hidden) continue;
        instanceHidden[i] = hidden;
        if (hidden) {
          mesh.setMatrixAt(i, hiddenMatrix);
        } else {
          tmpTransformPosition.set(instPosX[i], instPosY[i], instPosZ[i]);
          tmpTransformScale.set(instHalfX[i] * 2, instHalfY[i] * 2, instHalfZ[i] * 2);
          tmpTransformQuaternion.identity();
          tmpTransformMatrix.compose(tmpTransformPosition, tmpTransformQuaternion, tmpTransformScale);
          mesh.setMatrixAt(i, tmpTransformMatrix);
        }
        changed = true;
      }
      if (changed) mesh.instanceMatrix.needsUpdate = true;
      return culled;
    },
    dispose() {
      removeFocusHighlight();
      // Limpar acessórios de topo
      for (const [, entry] of rooftopMeshes) {
        scene.remove(entry.group);
        disposeRooftopMesh(entry.group);
      }
      rooftopMeshes.clear();
      disposeRooftopSharedResources();
      // Limpar letreiros
      for (const [, entry] of signMeshes) {
        scene.remove(entry.group);
        disposeSignMesh(entry.group);
      }
      signMeshes.clear();
      // Limpar LEDs de arestas
      for (const [, entry] of edgeLightMeshes) {
        scene.remove(entry.group);
        disposeEdgeLightMesh(entry.group);
      }
      edgeLightMeshes.clear();
      disposeEdgeLightSharedResources();
      // Limpar hologramas
      for (const [, entry] of hologramMeshes) {
        scene.remove(entry.group);
        disposeHologramMesh(entry);
      }
      hologramMeshes.clear();
      // Limpar prédios com formato customizado
      for (const [, entry] of customShapeMeshes) {
        disposeCustomShapeEntry(entry);
      }
      customShapeMeshes.clear();
      disposeTwistedBuildingSharedResources();
      disposeOctagonalBuildingSharedResources();
      disposeSetbackBuildingSharedResources();
      disposeTaperedBuildingSharedResources();
      disposeChryslerBuildingSharedResources();
      disposeHearstBuildingSharedResources();
      disposeEmpireBuildingSharedResources();
      disposeTaipeiBuildingSharedResources();
      disposeOneTradeBuildingSharedResources();
      focusFacadeMaterial.dispose();
      focusTopMaterial.dispose();
      scene.remove(mesh);
      mesh.dispose();
      buildingGeometry.dispose();
      facadeMaterial.dispose();
      topMaterial.dispose();
      for (const tex of allTextures) {
        tex.dispose();
      }
      for (const m of roadMeshes) {
        scene.remove(m);
        m.geometry.dispose();
        if (m.material !== asphaltMaterial) (m.material as THREE.Material).dispose();
      }
      roadMeshes.length = 0;
      asphaltMaterial.dispose();
      // Limpar calçadas
      if (sidewalkMesh) {
        scene.remove(sidewalkMesh);
        sidewalkMesh.dispose();
        sidewalkMesh = null;
      }
      sidewalkGeometry.dispose();
      sidewalkTopMaterial.dispose();
      sidewalkSideMaterial.dispose();
      // Limpar lotes vazios
      if (lotMesh) {
        scene.remove(lotMesh);
        lotMesh.dispose();
        lotMesh = null;
      }
      lotGeometry.dispose();
      lotMaterial.dispose();
    },
  };
}
