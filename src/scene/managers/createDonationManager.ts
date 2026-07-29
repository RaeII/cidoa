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
import { setEmpireBuildingMeshColor } from "../builders/createEmpireBuildingMesh";
import {
  createBuildingShapeMesh,
  createUnitBuildingGeometry,
  disposeBuildingShapeSharedResources,
  groupBoxGeometryByTop,
} from "../builders/createBuildingShapeMesh";
import { seeded } from "../utils/random";

import {
  initFacadeTextureLoader,
  loadFacadeTextureSet,
  peekFacadeTextureSet,
  type FacadeTextureSet,
} from "../textures/facadeTextureLoader";
import { resolveFacadeFolder } from "../textures/facadeTextureManifest";

// Pasta de fachada usada quando o catálogo aponta pra um asset que não existe mais.
const DEFAULT_FACADE_FOLDER = "Facade006_1K-mirrored-PNG";
// Topo dos prédios (concreto). Não faz parte do catálogo de fachada, mas passa
// pelo mesmo loader — ganha KTX2, lazy e cache compartilhado de graça.
const TOP_TEXTURE_FOLDER = "Concrete024_1K-JPG";

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
  /** Giro horizontal do envMap na fachada/topo (graus). Muda a direção amostrada, não a captura. */
  setEnvMapRotation: (yDeg: number) => void;
  /** 0–0.95: achata o vetor de reflexão em direção ao horizonte, igual em toda fachada. */
  setEnvHorizon: (amount: number) => void;
  /** Piso de rugosidade aplicado ao reflexo distante. */
  setReflectionRoughnessFloor: (roughness: number) => void;
  /** Faixa horizontal onde o reflexo desaparece conforme a distância da câmera. */
  setReflectionDistanceRange: (start: number, end: number) => void;
  /** `includeCityFloor`: mantém asfalto/calçada/lotes visíveis durante a captura do cube. */
  beginEnvCapture: (includeCityFloor: boolean) => void;
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
  // 4 é suficiente visualmente; anisotropia máxima (16) castiga o fill rate.
  const maxAniso = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  initFacadeTextureLoader(renderer);

  // Textura é assíncrona: nada é baixado no construtor. `peek` devolve o set se
  // ele já estiver no cache do loader (recriação do manager, ou troca de volta
  // pra uma textura já vista) — nesse caso a cena nasce texturizada, sem 1 frame
  // cinza. Se não, o material sobe sem mapas e recebe os mapas quando chegarem.
  //
  // Fachada: vem do catálogo (global, trocável em runtime via textureKey), e por
  // edifício via `customization.textureKey` (ver materialFacadeSets).
  // Emissive reusa o color map — evita uma 2ª cópia da mesma imagem na GPU.
  let facadeSet: FacadeTextureSet | null = peekFacadeTextureSet(textureSettings.textureKey);
  let topSet: FacadeTextureSet | null = peekFacadeTextureSet(TOP_TEXTURE_FOLDER);

  // Set de fachada por material. Ausente = usa o `facadeSet` global. Só os clones
  // de prédio com textura própria entram aqui. WeakMap, não userData: Material.copy
  // serializa userData com JSON, o que estouraria com THREE.Texture dentro.
  const materialFacadeSets = new WeakMap<THREE.Material, FacadeTextureSet>();
  const facadeSetFor = (material: THREE.Material): FacadeTextureSet | null =>
    materialFacadeSets.get(material) ?? facadeSet;

  const tilingUniform = { value: textureSettings.tilingScale };
  const topTilingUniform = { value: textureSettings.top.tilingScale };
  // Compartilhado por todos os materiais triplanares (inclui clones de custom shape).
  const envHorizonUniform = { value: 0 };
  const reflectionRoughnessFloorUniform = { value: 0 };
  const reflectionDistanceStartUniform = { value: 0 };
  const reflectionDistanceEndUniform = { value: 1 };

  // Geometria 1×1×1 — escala via instanceMatrix
  const buildingGeometry = createUnitBuildingGeometry();

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
        // Projeção COM SINAL. Sem o sinal, +X e +Z leem a textura com handedness oposta
        // (visto de fora, +u aponta pra esquerda numa face e pra direita na outra): o
        // tangent frame derivado de vNormalMapUv espelha junto, e com normalScale alto o
        // normal map inverte os bumps → face frontal e lateral com padrão diferente.
        vec3 triAbsN = abs(aProjNormal);
        vec2 triUV;
        if (triAbsN.y >= triAbsN.x && triAbsN.y >= triAbsN.z) {
          triUV = vec2(triWp.x, triWp.z * (aProjNormal.y < 0.0 ? -1.0 : 1.0));
        } else if (triAbsN.x >= triAbsN.z) {
          triUV = vec2(-triWp.z * (aProjNormal.x < 0.0 ? -1.0 : 1.0), triWp.y);
        } else {
          triUV = vec2(triWp.x * (aProjNormal.z < 0.0 ? -1.0 : 1.0), triWp.y);
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
      shader.uniforms.uEnvHorizon = envHorizonUniform;
      shader.uniforms.uReflectionRoughnessFloor = reflectionRoughnessFloorUniform;
      shader.uniforms.uReflectionDistanceStart = reflectionDistanceStartUniform;
      shader.uniforms.uReflectionDistanceEnd = reflectionDistanceEndUniform;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <common>",
        `#include <common>
        uniform float uEnvHorizon;
        uniform float uReflectionRoughnessFloor;
        uniform float uReflectionDistanceStart;
        uniform float uReflectionDistanceEnd;
        varying vec3 vTriplanarWorldPos;
        varying vec3 vTriplanarObjNormal;`,
      );
      const ROUGHNESS_ANCHOR = "#include <roughnessmap_fragment>";
      if (import.meta.env.DEV && !shader.fragmentShader.includes(ROUGHNESS_ANCHOR)) {
        console.warn("[donationManager] âncora de roughness sumiu — suavização por altura inativa");
      }
      shader.fragmentShader = shader.fragmentShader.replace(
        ROUGHNESS_ANCHOR,
        `${ROUGHNESS_ANCHOR}
        roughnessFactor = max(roughnessFactor, uReflectionRoughnessFloor);`,
      );
      // Achata o vetor de reflexão em direção ao horizonte. Rotação rígida (envMapRotation)
      // NÃO serve aqui: girar no X quase não mexe nas direções ±X e gira ±Z inteiro — a
      // própria correção fica dependente da face. Escalar só o Y é simétrico no eixo
      // vertical, então toda fachada vertical amostra a MESMA faixa de elevação do cube.
      const IBL_ANCHOR = "reflectVec = inverseTransformDirection( reflectVec, viewMatrix );";
      if (import.meta.env.DEV && !shader.fragmentShader.includes(IBL_ANCHOR)) {
        console.warn("[donationManager] âncora do getIBLRadiance sumiu — uEnvHorizon inativo");
      }
      shader.fragmentShader = shader.fragmentShader.replace(
        IBL_ANCHOR,
        `${IBL_ANCHOR}
        reflectVec = normalize(vec3(reflectVec.x, reflectVec.y * (1.0 - uEnvHorizon), reflectVec.z));`,
      );
      const IBL_IRRADIANCE_ANCHOR =
        "vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );";
      shader.fragmentShader = shader.fragmentShader.replace(
        IBL_IRRADIANCE_ANCHOR,
        `if (envMapIntensity <= 0.0) return vec3(0.0);
        ${IBL_IRRADIANCE_ANCHOR}`,
      );
      const IBL_SAMPLE_ANCHOR =
        "vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );";
      if (import.meta.env.DEV && !shader.fragmentShader.includes(IBL_SAMPLE_ANCHOR)) {
        console.warn("[donationManager] amostragem do getIBLRadiance sumiu — alcance inativo");
      }
      shader.fragmentShader = shader.fragmentShader.replace(
        IBL_SAMPLE_ANCHOR,
        `if (envMapIntensity <= 0.0) return vec3(0.0);
        vec2 reflectionDelta = vTriplanarWorldPos.xz - cameraPosition.xz;
        float reflectionDistanceSq = dot(reflectionDelta, reflectionDelta);
        float reflectionEndSq = uReflectionDistanceEnd * uReflectionDistanceEnd;
        if (reflectionDistanceSq >= reflectionEndSq) return vec3(0.0);
        float reflectionProximity = 1.0;
        float reflectionStartSq = uReflectionDistanceStart * uReflectionDistanceStart;
        if (reflectionDistanceSq > reflectionStartSq) {
          reflectionProximity = 1.0 - smoothstep(
            uReflectionDistanceStart,
            uReflectionDistanceEnd,
            sqrt(reflectionDistanceSq)
          );
        }
        ${IBL_SAMPLE_ANCHOR}`,
      );
      const IBL_RETURN_ANCHOR = "return envMapColor.rgb * envMapIntensity;";
      if (import.meta.env.DEV && !shader.fragmentShader.includes(IBL_RETURN_ANCHOR)) {
        console.warn("[donationManager] retorno do getIBLRadiance sumiu — alcance inativo");
      }
      shader.fragmentShader = shader.fragmentShader.replace(
        IBL_RETURN_ANCHOR,
        "return envMapColor.rgb * envMapIntensity * reflectionProximity;",
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
    envMapIntensity: 1.8,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0,
  });
  applyTriplanarShader(facadeMaterial, "donation-facade-triplanar", tilingUniform);

  const topMaterial = new THREE.MeshPhysicalMaterial({
    color: buildingSettings.color,
    roughness: buildingSettings.roughness,
    metalness: buildingSettings.metalness,
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
  // Dois grupos reais: laterais/base e topo. Remapear só materialIndex manteria
  // os 6 draw calls originais do BoxGeometry.
  groupBoxGeometryByTop(sidewalkGeometry, 1, 0);
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
    attribute float aDashCoord;
    varying float vDashCoord;
    void main() {
      vDashCoord = aDashCoord;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;
  const dashFS = /* glsl */`
    varying float vDashCoord;
    uniform float dashRepeat;   // ciclos de tracejado ao longo da via
    uniform float roadLen;      // comprimento físico da via (unidades de mundo)
    uniform float blockSpacing; // distância entre cruzamentos
    uniform float interHalf;    // meia-largura do cruzamento (zona sem faixa)

    void main() {
      // Apaga a faixa nos cruzamentos pra ela não conflitar com a faixa da via
      // perpendicular. Via centrada na origem; cruzamentos em (k+0.5)*blockSpacing.
      // distInter = distância física ao cruzamento mais próximo.
      float along = (vDashCoord - 0.5) * roadLen;
      float u = along / blockSpacing - 0.5;
      float distInter = abs(fract(u + 0.5) - 0.5) * blockSpacing;
      if (distInter < interHalf) discard;

      // Padrão de tracejado: 15% cheio, 85% vazio
      if (fract(vDashCoord * dashRepeat) > 0.15) discard;

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
    // O shader antigo rasterizava a pista inteira e descartava 98% da largura.
    // Agora a própria geometria já tem a largura final da faixa.
    const dashWidth = roadWidth * 0.02;
    const asphaltPositions: number[] = [];
    const asphaltIndices: number[] = [];
    const dashPositions: number[] = [];
    const dashIndices: number[] = [];
    const dashCoords: number[] = [];

    const pushQuad = (
      positions: number[],
      indices: number[],
      xMin: number,
      xMax: number,
      zMin: number,
      zMax: number,
      y: number,
      coords?: readonly [number, number, number, number],
    ) => {
      const base = positions.length / 3;
      positions.push(
        xMin, y, zMin,
        xMax, y, zMin,
        xMin, y, zMax,
        xMax, y, zMax,
      );
      indices.push(base, base + 2, base + 1, base + 2, base + 3, base + 1);
      if (coords) dashCoords.push(...coords);
    };

    // Faixas longitudinais (direção Z), entre colunas de blocos (separação em X)
    for (let bx = -r; bx < r; bx++) {
      const x = (bx + 0.5) * blockSpacing;
      pushQuad(
        asphaltPositions,
        asphaltIndices,
        x - roadWidth / 2,
        x + roadWidth / 2,
        -totalLen / 2,
        totalLen / 2,
        roadY,
      );
      pushQuad(
        dashPositions,
        dashIndices,
        x - dashWidth / 2,
        x + dashWidth / 2,
        -totalLen / 2,
        totalLen / 2,
        dashY,
        [1, 1, 0, 0],
      );
    }

    // Faixas transversais (direção X), entre linhas de blocos (separação em Z)
    for (let bz = -r; bz < r; bz++) {
      const z = (bz + 0.5) * blockSpacing;
      pushQuad(
        asphaltPositions,
        asphaltIndices,
        -totalLen / 2,
        totalLen / 2,
        z - roadWidth / 2,
        z + roadWidth / 2,
        roadY,
      );
      pushQuad(
        dashPositions,
        dashIndices,
        -totalLen / 2,
        totalLen / 2,
        z - dashWidth / 2,
        z + dashWidth / 2,
        dashY,
        [0, 1, 0, 1],
      );
    }

    const asphaltGeometry = new THREE.BufferGeometry();
    asphaltGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(asphaltPositions, 3),
    );
    asphaltGeometry.setIndex(asphaltIndices);
    asphaltGeometry.computeVertexNormals();
    asphaltGeometry.computeBoundingSphere();
    const asphaltMesh = new THREE.Mesh(asphaltGeometry, asphaltMaterial);
    scene.add(asphaltMesh);
    roadMeshes.push(asphaltMesh);

    const dashGeometry = new THREE.BufferGeometry();
    dashGeometry.setAttribute("position", new THREE.Float32BufferAttribute(dashPositions, 3));
    dashGeometry.setAttribute("aDashCoord", new THREE.Float32BufferAttribute(dashCoords, 1));
    dashGeometry.setIndex(dashIndices);
    dashGeometry.computeBoundingSphere();
    const dashMaterial = new THREE.ShaderMaterial({
      vertexShader: dashVS,
      fragmentShader: dashFS,
      uniforms: {
        dashRepeat: { value: totalLen / dashSpacing },
        roadLen: { value: totalLen },
        blockSpacing: { value: blockSpacing },
        interHalf: { value: interHalf },
      },
      transparent: true,
      depthWrite: false,
    });
    const dashMesh = new THREE.Mesh(dashGeometry, dashMaterial);
    scene.add(dashMesh);
    roadMeshes.push(dashMesh);

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
  // Cull de distância dos prédios: o buffer renderizado é compactado para que
  // `mesh.count` contenha só instâncias visíveis (zero-scale ainda gastaria vértices).
  let renderDistanceSq = Infinity;
  let backDistanceSq = Infinity;
  let logicalInstanceCount = 0;
  let instanceHidden = new Uint8Array(0);
  let useInstanceColors = false;
  let logicalInstanceColorArray = new Float32Array(0);
  let renderInstanceColorArray = new Float32Array(0);
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
  const customShapesHiddenBeforeCapture: number[] = [];
  const currentBuildingColor = new THREE.Color(buildingSettings.color);
  // No shader, instanceColor é MULTIPLICADO pela cor do material
  // (`diffuseColor *= vColor`). Logo, enquanto o InstancedMesh tiver instanceColor,
  // a base dos materiais tem que ser branca — senão a cor sai ao quadrado e todos
  // os prédios escurecem no instante em que um único recebe cor customizada.
  const INSTANCE_COLOR_BASE = new THREE.Color(0xffffff);
  const setInstancedBaseColor = (color: THREE.Color) => {
    facadeMaterial.color.copy(color);
    topMaterial.color.copy(color);
  };
  const tmpTransformMatrix = new THREE.Matrix4();
  const tmpTransformPosition = new THREE.Vector3();
  const tmpTransformQuaternion = new THREE.Quaternion();
  const tmpTransformScale = new THREE.Vector3();

  const compactVisibleInstances = (includeCulled = false) => {
    let renderIndex = 0;
    for (let logicalIndex = 0; logicalIndex < logicalInstanceCount; logicalIndex++) {
      if (!includeCulled && instanceHidden[logicalIndex]) continue;

      tmpTransformPosition.set(
        instPosX[logicalIndex],
        instPosY[logicalIndex],
        instPosZ[logicalIndex],
      );
      tmpTransformScale.set(
        instHalfX[logicalIndex] * 2,
        instHalfY[logicalIndex] * 2,
        instHalfZ[logicalIndex] * 2,
      );
      tmpTransformQuaternion.identity();
      tmpTransformMatrix.compose(
        tmpTransformPosition,
        tmpTransformQuaternion,
        tmpTransformScale,
      );
      mesh.setMatrixAt(renderIndex, tmpTransformMatrix);

      if (useInstanceColors) {
        const source = logicalIndex * 3;
        const target = renderIndex * 3;
        renderInstanceColorArray[target] = logicalInstanceColorArray[source];
        renderInstanceColorArray[target + 1] = logicalInstanceColorArray[source + 1];
        renderInstanceColorArray[target + 2] = logicalInstanceColorArray[source + 2];
      }
      renderIndex++;
    }

    mesh.count = renderIndex;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.boundingSphere = null;
    if (useInstanceColors) {
      if (
        !mesh.instanceColor ||
        mesh.instanceColor.array !== renderInstanceColorArray
      ) {
        mesh.instanceColor = new THREE.InstancedBufferAttribute(
          renderInstanceColorArray,
          3,
        );
        mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
      }
      mesh.instanceColor.needsUpdate = true;
    }
  };

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

  const textureDefineMask = (mat: THREE.MeshPhysicalMaterial) =>
    Number(Boolean(mat.map)) |
    (Number(Boolean(mat.normalMap)) << 1) |
    (Number(Boolean(mat.roughnessMap)) << 2) |
    (Number(Boolean(mat.metalnessMap)) << 3) |
    (Number(Boolean(mat.bumpMap)) << 4) |
    (Number(Boolean(mat.displacementMap)) << 5) |
    (Number(Boolean(mat.emissiveMap)) << 6);

  // Um material só. Chamado em lote (applyTextureToFacade) e isolado quando o set
  // de um prédio específico chega do loader.
  const applyFacadeMaterial = (
    mat: THREE.MeshPhysicalMaterial,
    settings: TextureSettings,
  ) => {
    const set = facadeSetFor(mat);
    const textureless = isTexturelessMaterial(mat);
    const previousMask = textureDefineMask(mat);
    if (settings.enabled && !textureless && set) {
      mat.map = set.color;
      mat.normalMap = settings.normalScale !== 0 ? set.normal : null;
      mat.normalScale.set(settings.normalScale, settings.normalScale);
      mat.roughnessMap = settings.roughnessIntensity > 0 ? set.roughness : null;
      mat.metalnessMap = settings.metalnessIntensity !== 0 ? set.metalness : null;
      mat.roughness = settings.roughnessIntensity;
      mat.metalness = settings.metalnessIntensity;
      mat.bumpMap = null;
      // Com scale 0 o displacement é um fetch de vértice inútil — só liga quando ativo.
      mat.displacementMap = settings.displacementScale > 0 ? set.displacement : null;
      mat.displacementScale = settings.displacementScale;
      mat.emissiveMap = settings.emissiveIntensity > 0 ? set.color : null;
    } else {
      mat.map = null;
      mat.normalMap = null;
      mat.roughnessMap = null;
      mat.metalnessMap = null;
      mat.bumpMap = null;
      mat.displacementMap = null;
      mat.displacementScale = 0;
      mat.emissiveMap = null;
    }
    mat.emissiveIntensity = textureless ? 0 : settings.emissiveIntensity;
    if (!textureless) {
      mat.envMapIntensity = settings.envMapIntensity;
    }
    if (previousMask !== textureDefineMask(mat)) mat.needsUpdate = true;
  };

  const applyTextureToFacade = (settings: TextureSettings) => {
    for (const mat of getAllFacadeMaterials()) applyFacadeMaterial(mat, settings);
  };

  const applyTextureToTop = (settings: TextureSettings) => {
    const top = settings.top;
    const targets = getAllTopMaterials();
    for (const mat of targets) {
      const textureless = isTexturelessMaterial(mat);
      const previousMask = textureDefineMask(mat);
      if (settings.enabled && !textureless && topSet) {
        mat.map = topSet.color;
        mat.normalMap = top.normalScale !== 0 ? topSet.normal : null;
        mat.normalScale.set(top.normalScale, top.normalScale);
        mat.roughnessMap = top.roughnessIntensity > 0 ? topSet.roughness : null;
        mat.roughness = top.roughnessIntensity;
        mat.metalness = top.metalnessIntensity;
        mat.bumpMap = null;
        mat.displacementMap = top.displacementScale > 0 ? topSet.displacement : null;
        mat.displacementScale = top.displacementScale;
      } else {
        mat.map = null;
        mat.normalMap = null;
        mat.roughnessMap = null;
        mat.bumpMap = null;
        mat.displacementMap = null;
        mat.displacementScale = 0;
      }
      if (!textureless) {
        mat.envMapIntensity = top.envMapIntensity;
      }
      if (previousMask !== textureDefineMask(mat)) mat.needsUpdate = true;
    }
  };

  // Troca da textura GLOBAL de fachada. O token descarta resolução de uma seleção
  // que já foi superada por outra (usuário clicando rápido no seletor).
  let facadeRequestToken = 0;
  const requestGlobalFacadeSet = (value: string) => {
    const token = ++facadeRequestToken;
    const cached = peekFacadeTextureSet(value);
    if (cached) {
      facadeSet = cached;
      applyTextureToFacade(currentTextureSettings);
      return;
    }
    void loadFacadeTextureSet(value, maxAniso)
      .then((set) => {
        // Pasta inexistente: cai no padrão em vez de deixar a cidade sem textura.
        if (set || resolveFacadeFolder(value) === DEFAULT_FACADE_FOLDER) return set;
        return loadFacadeTextureSet(DEFAULT_FACADE_FOLDER, maxAniso);
      })
      .then((set) => {
        if (!set || token !== facadeRequestToken) return;
        facadeSet = set;
        applyTextureToFacade(currentTextureSettings);
      });
  };

  applyTextureToFacade(textureSettings);
  applyTextureToTop(textureSettings);
  if (!facadeSet) requestGlobalFacadeSet(textureSettings.textureKey);
  if (!topSet) {
    void loadFacadeTextureSet(TOP_TEXTURE_FOLDER, maxAniso).then((set) => {
      if (!set) return;
      topSet = set;
      applyTextureToTop(currentTextureSettings);
    });
  }

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
    if (hasOwnFacadeTexture(c)) return true;
    return false;
  };

  // Textura por edifício só custa um mesh dedicado quando difere da global — quem
  // escolheu justamente a textura da cena continua dentro do InstancedMesh.
  // ponytail: prédio com textura própria = 1 mesh dedicado. Serve pro catálogo
  // curado atual; se a maioria passar a ter textura própria, agrupar em um
  // InstancedMesh por textura (draws = nº de texturas/grupos, não de prédios).
  const hasOwnFacadeTexture = (c?: BuildingCustomization): boolean => {
    if (!c?.textureKey) return false;
    return (
      resolveFacadeFolder(c.textureKey) !==
      resolveFacadeFolder(currentTextureSettings.textureKey)
    );
  };

  // Aplica a textura própria de UM prédio no material clonado dele.
  // "" = herda a global. Idempotente: rechamar com a mesma pasta não faz nada,
  // então syncCustomShapes pode chamar em todo rebuild sem custo.
  const materialFacadeKeys = new WeakMap<THREE.Material, string>();
  const applyBuildingFacadeTexture = (
    facadeMat: THREE.MeshPhysicalMaterial,
    customization?: BuildingCustomization,
  ) => {
    const desired = hasOwnFacadeTexture(customization)
      ? resolveFacadeFolder(customization!.textureKey)
      : "";
    if (materialFacadeKeys.get(facadeMat) === desired) return;
    materialFacadeKeys.set(facadeMat, desired);

    if (!desired) {
      materialFacadeSets.delete(facadeMat);
      applyFacadeMaterial(facadeMat, currentTextureSettings);
      return;
    }
    const cached = peekFacadeTextureSet(desired);
    if (cached) {
      materialFacadeSets.set(facadeMat, cached);
      applyFacadeMaterial(facadeMat, currentTextureSettings);
      return;
    }
    void loadFacadeTextureSet(desired, maxAniso).then((set) => {
      // Seleção mudou enquanto baixava — descarta o resultado velho.
      if (!set || materialFacadeKeys.get(facadeMat) !== desired) return;
      materialFacadeSets.set(facadeMat, set);
      applyFacadeMaterial(facadeMat, currentTextureSettings);
    });
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
    if (logicalInstanceColorArray.length < capacity * 3) {
      logicalInstanceColorArray = new Float32Array(capacity * 3);
      renderInstanceColorArray = new Float32Array(capacity * 3);
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

    logicalInstanceCount = instanceIdx;
    mesh.count = logicalInstanceCount;
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
    setInstancedBaseColor(currentBuildingColor);
    useInstanceColors = false;
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

    focusHighlightMesh = new THREE.Mesh(buildingGeometry, [focusFacadeMaterial, focusTopMaterial]);
    focusHighlightMesh.applyMatrix4(tmpTransformMatrix);
    scene.add(focusHighlightMesh);
  };

  const applyInstanceColors = () => {
    if (logicalInstanceCount === 0) return;

    // Em foco, as instâncias ficam sem cor própria (só o mesh destacado tem).
    // Verificar se alguma doação tem customização
    const hasAnyCustom = focusedDonationId === null && donations.some((d) => d.customization);
    if (!hasAnyCustom) {
      // Sem customizações: remover instanceColor para usar cor do material
      setInstancedBaseColor(currentBuildingColor);
      useInstanceColors = false;
      mesh.instanceColor = null;
      return;
    }

    // Cor real vai toda no instanceColor → base branca (ver INSTANCE_COLOR_BASE).
    setInstancedBaseColor(INSTANCE_COLOR_BASE);
    useInstanceColors = true;
    const donationById = new Map<number, DonationEntry>();
    for (const d of donations) donationById.set(d.id, d);

    for (let i = 0; i < logicalInstanceCount; i++) {
      const donId = instanceToDonationId[i];
      const donation = donationById.get(donId);
      if (donation?.customization) {
        tmpColor.set(donation.customization.color);
      } else {
        tmpColor.copy(currentBuildingColor);
      }
      logicalInstanceColorArray[i * 3] = tmpColor.r;
      logicalInstanceColorArray[i * 3 + 1] = tmpColor.g;
      logicalInstanceColorArray[i * 3 + 2] = tmpColor.b;
    }

    compactVisibleInstances();
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

        // Shape `default` aqui = precisa de mesh próprio por outro motivo
        // (ex: tiling customizado) — reusa a geometria caixa do InstancedMesh.
        const sceneMesh = createBuildingShapeMesh(shape, facadeMat, topMat, buildingGeometry);
        if (shape === "empire") {
          tmpColor.set(customization.color);
          if (!tmpColor.equals(currentBuildingColor)) {
            setEmpireBuildingMeshColor(sceneMesh, customization.color);
          }
        }

        sceneMesh.userData.donationId = donation.id;
        sceneMesh.userData.donationValue = donation.value;
        scene.add(sceneMesh);

        entry = { mesh: sceneMesh, facadeMat, topMat, shape };
        customShapeMeshes.set(donation.id, entry);
      }

      // Fora do bloco de criação: a textura própria do prédio também muda quando
      // a textura GLOBAL muda (o mesmo textureKey deixa de ser "igual à global").
      applyBuildingFacadeTexture(entry.facadeMat, donation.customization);

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
        }
        for (const mat of getAllTopMaterials()) {
          mat.roughness = settings.roughness;
          mat.metalness = settings.metalness;
        }
      }
      applyInstanceColors();
    },
    updateTextureSettings(settings) {
      const folderChanged =
        resolveFacadeFolder(settings.textureKey) !==
        resolveFacadeFolder(currentTextureSettings.textureKey);
      currentTextureSettings = { ...settings };
      tilingUniform.value = settings.tilingScale;
      topTilingUniform.value = settings.top.tilingScale;
      if (folderChanged) requestGlobalFacadeSet(settings.textureKey);
      applyTextureToFacade(settings); // relê facadeSet (inclui clones custom)
      applyTextureToTop(settings);
      // Prédio com textura própria entra/sai do InstancedMesh conforme ela passe
      // a coincidir (ou não) com a nova textura global.
      if (folderChanged) rebuildInstances();
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
    setEnvMapRotation(yDeg) {
      // Só Y: rotação no eixo vertical gira o azimute de TODA fachada igualmente. Girar no
      // X quebraria a simetria (deixa ±X quase parado e vira ±Z inteiro).
      // envMapRotation vira uniform a cada frame (WebGLMaterials) — sem needsUpdate.
      // Clones de custom shape nascem de facadeMaterial/topMaterial e copiam o Euler.
      const y = THREE.MathUtils.degToRad(yDeg);
      for (const mat of getAllFacadeMaterials()) mat.envMapRotation.set(0, y, 0);
      for (const mat of getAllTopMaterials()) mat.envMapRotation.set(0, y, 0);
    },
    setEnvHorizon(amount) {
      // Clamp em 0.95: com 1.0 um reflexo apontando reto pra cima vira vec3(0) → NaN.
      envHorizonUniform.value = THREE.MathUtils.clamp(amount, 0, 0.95);
    },
    setReflectionRoughnessFloor(roughness) {
      reflectionRoughnessFloorUniform.value = THREE.MathUtils.clamp(roughness, 0, 1);
    },
    setReflectionDistanceRange(start, end) {
      reflectionDistanceStartUniform.value = Math.max(0, start);
      reflectionDistanceEndUniform.value = Math.max(reflectionDistanceStartUniform.value + 1, end);
    },
    beginEnvCapture(includeCityFloor) {
      for (const mat of getAllFacadeMaterials()) mat.envMapIntensity = 0;
      for (const mat of getAllTopMaterials()) mat.envMapIntensity = 0;
      // O probe é fixo na cidade: captura o dataset completo, independente do
      // culling da câmera principal, e restaura o buffer compacto ao terminar.
      compactVisibleInstances(true);
      customShapesHiddenBeforeCapture.length = 0;
      for (const [donationId, entry] of customShapeMeshes) {
        if (entry.mesh.visible) continue;
        customShapesHiddenBeforeCapture.push(donationId);
        entry.mesh.visible = true;
      }
      // O controle pode retirar o piso da cidade (asfalto, calçada, lotes) para liberar o
      // hemisfério de baixo do cube ao céu e destacar o skyline na fachada.
      if (includeCityFloor) return;
      for (const m of roadMeshes) m.visible = false;
      if (sidewalkMesh) sidewalkMesh.visible = false;
      if (lotMesh) lotMesh.visible = false;
    },
    endEnvCapture() {
      for (const mat of getAllFacadeMaterials()) {
        mat.envMapIntensity = currentTextureSettings.envMapIntensity;
      }
      for (const mat of getAllTopMaterials()) {
        mat.envMapIntensity = currentTextureSettings.top.envMapIntensity;
      }
      compactVisibleInstances();
      for (const donationId of customShapesHiddenBeforeCapture) {
        const entry = customShapeMeshes.get(donationId);
        if (entry) entry.mesh.visible = false;
      }
      customShapesHiddenBeforeCapture.length = 0;
      for (const m of roadMeshes) m.visible = true;
      if (sidewalkMesh) sidewalkMesh.visible = true;
      if (lotMesh) lotMesh.visible = true;
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
      const prevTextureKey = prevCustomization?.textureKey ?? null;
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

      // Troca de textura em prédio que JÁ tem mesh próprio (ex: já era twisted):
      // só recarrega o material, sem rebuild. A transição instanced <-> mesh
      // próprio já saiu acima, pelo needsCustomMesh.
      if (customization.textureKey !== prevTextureKey) {
        const entry = customShapeMeshes.get(donationId);
        if (entry) applyBuildingFacadeTexture(entry.facadeMat, customization);
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

      // Prédios instanciados: o buffer é compactado e `mesh.count` passa a conter
      // somente os visíveis. Assim o cull reduz fragmentos E vertex shaders.
      // Arrays lógicos continuam estáveis para picking/metadados.
      let changed = false;
      for (let i = 0; i < logicalInstanceCount; i++) {
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
        changed = true;
      }
      if (changed) compactVisibleInstances();
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
      disposeBuildingShapeSharedResources();
      focusFacadeMaterial.dispose();
      focusTopMaterial.dispose();
      scene.remove(mesh);
      mesh.dispose();
      buildingGeometry.dispose();
      facadeMaterial.dispose();
      topMaterial.dispose();
      // Nenhuma textura é descartada aqui: fachada E topo vêm do cache compartilhado
      // do loader, reusado entre recriações do manager.
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
