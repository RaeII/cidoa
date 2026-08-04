import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CitySceneCanvas, type CitySceneCanvasHandle } from "./three/CitySceneCanvas";
import { BuildingHeightInput } from "./html/BuildingHeightInput";
import { PaymentSimulation, type Payment } from "./html/PaymentSimulation";
import { BuildingCustomizePanel } from "./html/BuildingCustomizePanel";
import { BuildingInfoModal } from "./html/BuildingInfoModal";
import { CityControlPanel } from "./html/CityControlPanel";
import { DonationInfoSection } from "./html/DonationInfoSection";
import { KeyboardShortcutsHelp } from "./html/KeyboardShortcutsHelp";
import {
  useKeyboardShortcuts,
  type KeyboardShortcut,
} from "./hooks/useKeyboardShortcuts";
import { DEFAULT_SCENE_STATS } from "../scene/config/citySceneConfig";
import {
  applySceneSlot,
  clearPersistedScene,
  createDefaultPersistedSettings,
  deleteSceneSlot,
  getActiveSceneSlot,
  listSceneSlots,
  loadPersistedScene,
  savePersistedScene,
  saveSceneSlot,
  type PersistedScene,
} from "../scene/config/scenePersistence";
import {
  clearUIVisibilitySettings,
  loadUIVisibilitySettings,
  saveUIVisibilitySettings,
} from "../scene/config/uiVisibilityConfig";
import type {
  BuildingCustomization,
  BuildingShape,
  CameraDebugInfo,
  EdgeLightType,
  FacadeStyle,
  RooftopType,
  SceneStats,
} from "../scene/types";
import {
  DEFAULT_BUILDING_TEXTURE_TRANSFORM,
  DEFAULT_HOLOGRAM_COLOR,
  DEFAULT_HOLOGRAM_OPACITY,
} from "../scene/types";
import { getLightMetrics } from "../scene/utils/lighting";
import { randomFacadeStyle } from "../scene/utils/facadeStyle";

// Cena começa com um único edifício (modelo padrão/quadrado).
// Novos edifícios entram via seta direita, sempre superando o mais alto atual.
const INITIAL_TEST_DONATIONS = [30] as const;

// Estado salvo em localStorage (edifícios + personalizações + settings). Lido uma
// única vez no módulo: `initialDonations` precisa de referência estável, senão o
// efeito de semeadura do canvas reexecuta a cada render.
const STORED_SCENE = loadPersistedScene();

const INITIAL_DONATIONS: readonly number[] = STORED_SCENE?.donations ?? INITIAL_TEST_DONATIONS;

const INITIAL_DONATION_TOTAL = INITIAL_DONATIONS.reduce((sum, v) => sum + v, 0);

// Cada seta direita gera um edifício que supera o maior valor atual da cidade
// (vira o mais alto e assume o centro da espiral), até o teto de DONATION_MAX_VALUE.
// O sorteio define só quanto ele ultrapassa o líder.
const DONATION_INCREMENT_MIN = 10;
const DONATION_INCREMENT_MAX = 40;
// Teto do valor gerado pelo botão/seta — nenhuma doação simulada passa disso.
const DONATION_MAX_VALUE = 150;

const randomDonationIncrement = () =>
  Math.round(
    DONATION_INCREMENT_MIN + Math.random() * (DONATION_INCREMENT_MAX - DONATION_INCREMENT_MIN),
  );

const INITIAL_MAX_DONATION = Math.max(0, ...INITIAL_DONATIONS);

// Personalizações salvas vêm alinhadas por índice com `donations`. O donation
// manager numera os edifícios do lote inicial na mesma ordem (id = índice), então
// o índice vira o id de runtime.
const createInitialBuildingCustomizations = () => {
  const map = new Map<number, BuildingCustomization>();
  STORED_SCENE?.customizations.forEach((customization, index) => {
    if (customization) map.set(index, customization);
  });
  return map;
};

const INITIAL_BUILDING_CUSTOMIZATIONS = createInitialBuildingCustomizations();

const INITIAL_SETTINGS = STORED_SCENE?.settings ?? createDefaultPersistedSettings();

const formatCameraValue = (value: number) => value.toFixed(2);

export function CitySceneEditor() {
  const canvasRef = useRef<CitySceneCanvasHandle>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Total arrecadado e número de doações — alimentam a seção de informações abaixo da cena.
  const [donationTotal, setDonationTotal] = useState(INITIAL_DONATION_TOTAL);
  const [donationCount, setDonationCount] = useState<number>(INITIAL_DONATIONS.length);
  // `inInfo` = usuário rolou para a seção de informações (esconde CTA da cena, mostra "voltar").
  const [inInfo, setInInfo] = useState(false);

  const [buildingSettings, setBuildingSettings] = useState(INITIAL_SETTINGS.building);
  const [textureSettings, setTextureSettings] = useState(INITIAL_SETTINGS.texture);
  const [groundSettings, setGroundSettings] = useState(INITIAL_SETTINGS.ground);
  const [terrainSettings, setTerrainSettings] = useState(INITIAL_SETTINGS.terrain);
  const [lightSettings, setLightSettings] = useState(INITIAL_SETTINGS.light);
  const [shadowSettings, setShadowSettings] = useState(INITIAL_SETTINGS.shadow);
  const [renderDirectionSettings, setRenderDirectionSettings] = useState(
    INITIAL_SETTINGS.renderDirection,
  );
  const [environmentSettings, setEnvironmentSettings] = useState(INITIAL_SETTINGS.environment);
  const [horizonSettings, setHorizonSettings] = useState(INITIAL_SETTINGS.horizon);
  const [blockLayoutSettings, setBlockLayoutSettings] = useState(INITIAL_SETTINGS.blockLayout);
  const [sceneStats, setSceneStats] = useState<SceneStats>({ ...DEFAULT_SCENE_STATS });
  const [cameraDebugInfo, setCameraDebugInfo] = useState<CameraDebugInfo | null>(null);
  const [hoverInfo, setHoverInfo] = useState<{ value: number; x: number; y: number } | null>(null);
  const [showControlPanel, setShowControlPanel] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [uiVisibility, setUIVisibility] = useState(loadUIVisibilitySettings);
  const [sceneSlots, setSceneSlots] = useState(listSceneSlots);
  const [activeSceneSlot, setActiveSceneSlot] = useState(getActiveSceneSlot);
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null);
  // Edifício clicado: mostra modal de info (dono + valor). `null` = fechado.
  const [infoBuilding, setInfoBuilding] = useState<{ id: number; value: number } | null>(null);
  const [buildingCustomizations, setBuildingCustomizations] = useState<Map<number, BuildingCustomization>>(
    createInitialBuildingCustomizations,
  );

  // Edifícios que vão para o localStorage. Guarda o id de runtime junto do valor
  // para casar com `buildingCustomizations` na hora de salvar. Doações da
  // simulação de pagamento (seta direita) ficam de fora — só existem na sessão.
  const [persistedDonations, setPersistedDonations] = useState<
    Array<{ id: number; value: number }>
  >(() => INITIAL_DONATIONS.map((value, id) => ({ id, value })));

  // Espelha o contador de ids do donation manager. Todo edifício nasce aqui
  // (lote inicial → handleDonation/handleBulkDonation), e o manager numera
  // sequencialmente na ordem de chegada, então os contadores não divergem.
  const nextDonationIdRef = useRef(INITIAL_DONATIONS.length);

  // Simulação de pagamento: um cartão por vez. `payment` guarda o ativo;
  // `paymentBusyRef` bloqueia novas setas até o cartão sair de tela.
  const [payment, setPayment] = useState<Payment | null>(null);
  const paymentIdRef = useRef(0);
  const paymentBusyRef = useRef(false);
  // Maior doação já registrada — base para o próximo edifício da seta direita.
  const maxDonationRef = useRef(INITIAL_MAX_DONATION);

  const lightMetrics = getLightMetrics(lightSettings);

  useEffect(() => {
    saveUIVisibilitySettings(uiVisibility);
  }, [uiVisibility]);

  // Cena serializável do momento — alimenta o autosave e os estados nomeados.
  const currentScene = useMemo<PersistedScene>(
    () => ({
      donations: persistedDonations.map((d) => d.value),
      customizations: persistedDonations.map((d) => buildingCustomizations.get(d.id) ?? null),
      settings: {
        building: buildingSettings,
        texture: textureSettings,
        ground: groundSettings,
        terrain: terrainSettings,
        light: lightSettings,
        shadow: shadowSettings,
        renderDirection: renderDirectionSettings,
        environment: environmentSettings,
        horizon: horizonSettings,
        blockLayout: blockLayoutSettings,
      },
    }),
    [
      persistedDonations,
      buildingCustomizations,
      buildingSettings,
      textureSettings,
      groundSettings,
      terrainSettings,
      lightSettings,
      shadowSettings,
      renderDirectionSettings,
      environmentSettings,
      horizonSettings,
      blockLayoutSettings,
    ],
  );

  useEffect(() => {
    savePersistedScene(currentScene);
  }, [currentScene]);

  const handleSaveSceneSlot = useCallback(
    (name: string) => {
      if (!saveSceneSlot(name, currentScene)) {
        window.alert("Não foi possível salvar: armazenamento do navegador cheio ou bloqueado.");
        return;
      }
      setSceneSlots(listSceneSlots());
      setActiveSceneSlot(name);
    },
    [currentScene],
  );

  const handleDeleteSceneSlot = useCallback((name: string) => {
    if (!window.confirm(`Excluir o estado "${name}"?`)) return;
    deleteSceneSlot(name);
    setSceneSlots(listSceneSlots());
    setActiveSceneSlot(getActiveSceneSlot());
  }, []);

  // Abrir estado = copiar para a cena ativa e recarregar. Reconstruir o runtime
  // em memória seria bem mais código que um reload (mesmo caminho do "limpar").
  // Antes de trocar, grava o progresso no estado atual — trocar pelo select não
  // pode perder o que mudou desde o último save. Cena que não veio de nenhum
  // estado não tem onde ser gravada: aí sim confirma.
  const handleLoadSceneSlot = useCallback(
    (name: string) => {
      if (name === activeSceneSlot) return;
      if (activeSceneSlot) {
        saveSceneSlot(activeSceneSlot, currentScene);
      } else if (
        !window.confirm(
          "A cena atual não está salva em nenhum estado e será substituída. Continuar?",
        )
      ) {
        return;
      }
      if (applySceneSlot(name)) window.location.reload();
    },
    [activeSceneSlot, currentScene],
  );

  // Limpa tudo que a cena guarda em localStorage e recarrega: reconstruir o
  // runtime a partir do zero em memória seria bem mais código que um reload.
  const handleClearStorage = useCallback(() => {
    if (!window.confirm("Apagar edifícios e personalizações salvos? A página vai recarregar.")) {
      return;
    }
    clearPersistedScene();
    clearUIVisibilitySettings();
    window.location.reload();
  }, []);

  const scrollToInfo = useCallback(() => {
    const el = scrollRef.current;
    el?.scrollTo({ top: el.clientHeight, behavior: "smooth" });
  }, []);

  const scrollToScene = useCallback(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // Controla a navegação por roda do mouse: na cena, rolar para baixo só pelo botão
  // (evita sair da cena sem querer). Na seção de info, rolar para cima no topo
  // volta para a cena de forma suave e automática.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onWheel = (event: WheelEvent) => {
      // Painéis flutuantes (controles, customização, ajuda) ficam dentro deste
      // container. Se a roda está sobre um overlay rolável, deixa ele rolar e
      // não sequestra o gesto para navegar cena↔info (senão preventDefault
      // trava a rolagem interna do painel).
      let node = event.target instanceof HTMLElement ? event.target : null;
      while (node && node !== el) {
        const overflowY = getComputedStyle(node).overflowY;
        if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) {
          return;
        }
        node = node.parentElement;
      }

      const viewport = el.clientHeight;
      const atScene = el.scrollTop < viewport / 2;
      if (atScene) {
        if (event.deltaY > 0) event.preventDefault();
        return;
      }
      if (event.deltaY < 0 && el.scrollTop <= viewport) {
        event.preventDefault();
        el.scrollTo({ top: 0, behavior: "smooth" });
      }
    };

    const onScroll = () => {
      setInInfo(el.scrollTop > el.clientHeight / 2);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("scroll", onScroll);
    };
  }, []);

  // `persist = false` para a simulação de pagamento: o edifício aparece na cena
  // mas não entra no localStorage.
  const handleDonation = (value: number, persist = true) => {
    const id = nextDonationIdRef.current++;
    canvasRef.current?.addDonation(value);
    maxDonationRef.current = Math.max(maxDonationRef.current, value);
    setDonationTotal((t) => t + value);
    setDonationCount((c) => c + 1);
    if (persist) setPersistedDonations((prev) => [...prev, { id, value }]);
  };

  const handleBulkDonation = (values: number[]) => {
    const firstId = nextDonationIdRef.current;
    nextDonationIdRef.current += values.length;
    canvasRef.current?.addDonations(values);
    maxDonationRef.current = Math.max(maxDonationRef.current, ...values);
    setDonationTotal((t) => t + values.reduce((sum, v) => sum + v, 0));
    setDonationCount((c) => c + values.length);
    setPersistedDonations((prev) => [
      ...prev,
      ...values.map((value, i) => ({ id: firstId + i, value })),
    ]);
  };

  // Seta direita → inicia a simulação de pagamento. Valor = maior doação atual +
  // incremento sorteado, limitado a DONATION_MAX_VALUE: o edifício novo é o mais
  // alto da cidade enquanto o teto não chegar, e nunca passa dele.
  // Ignora novas chamadas enquanto um cartão ainda está na tela.
  const startPayment = useCallback(() => {
    if (paymentBusyRef.current) return;
    paymentBusyRef.current = true;
    paymentIdRef.current += 1;
    const amount = Math.min(
      DONATION_MAX_VALUE,
      maxDonationRef.current + randomDonationIncrement(),
    );
    setPayment({ id: paymentIdRef.current, amount });
  }, []);

  const handleHoverChange = useCallback(
    (value: number | null, x: number, y: number) => {
      setHoverInfo(value !== null ? { value, x, y } : null);
    },
    [],
  );

  const handleBuildingClick = useCallback(
    (donationId: number | null) => {
      if (donationId !== null) {
        canvasRef.current?.focusOnDonation(donationId);
        const value = canvasRef.current?.getDonationValue(donationId) ?? 0;
        // Clique abre o modal de info; personalização sai do fluxo do clique.
        setSelectedBuildingId(null);
        setInfoBuilding({ id: donationId, value });
      } else {
        canvasRef.current?.clearFocus();
        setSelectedBuildingId(null);
        setInfoBuilding(null);
      }
    },
    [],
  );

  const handleCloseInfo = useCallback(() => {
    canvasRef.current?.clearFocus();
    setInfoBuilding(null);
  }, []);

  // Modal de info → painel de personalização. Mantém o foco/zoom no edifício.
  const handleCustomizeFromInfo = useCallback(() => {
    if (infoBuilding) setSelectedBuildingId(infoBuilding.id);
    setInfoBuilding(null);
  }, [infoBuilding]);

  const handleCloseCustomizePanel = useCallback(() => {
    canvasRef.current?.clearFocus();
    setSelectedBuildingId(null);
  }, []);

  const getExistingCustomization = useCallback(
    (donationId: number) => {
      const existing = buildingCustomizations.get(donationId);
      return {
        color: existing?.color ?? buildingSettings.color,
        // Sem customização o prédio já mostra a fachada sorteada — o painel abre nela,
        // então mexer só na cor não troca a textura do edifício.
        facadeStyle: existing?.facadeStyle ?? randomFacadeStyle(donationId),
        tilingScale: existing?.tilingScale ?? 1,
        buildingShape: existing?.buildingShape ?? "default" as const,
        rooftopType: existing?.rooftopType ?? "none" as const,
        signText: existing?.signText ?? "",
        signSides: existing?.signSides ?? 1,
        edgeLightType: existing?.edgeLightType ?? "none" as const,
        hologramImage: existing?.hologramImage ?? null,
        hologramColor: existing?.hologramColor ?? DEFAULT_HOLOGRAM_COLOR,
        hologramOpacity: existing?.hologramOpacity ?? DEFAULT_HOLOGRAM_OPACITY,
      };
    },
    [buildingCustomizations, buildingSettings.color],
  );

  const updateCustomization = useCallback(
    (donationId: number, patch: Partial<BuildingCustomization>) => {
      setBuildingCustomizations((prev) => {
        const next = new Map(prev);
        const existing = next.get(donationId);
        const updated: BuildingCustomization = {
          color: existing?.color ?? buildingSettings.color,
          facadeStyle: existing?.facadeStyle ?? randomFacadeStyle(donationId),
          buildingShape: existing?.buildingShape ?? "default",
          tilingScale: existing?.tilingScale ?? 1,
          textureTransform: existing?.textureTransform ?? { ...DEFAULT_BUILDING_TEXTURE_TRANSFORM },
          rooftopType: existing?.rooftopType ?? "none",
          signText: existing?.signText ?? "",
          signSides: existing?.signSides ?? 1,
          edgeLightType: existing?.edgeLightType ?? "none",
          hologramImage: existing?.hologramImage ?? null,
          hologramColor: existing?.hologramColor ?? DEFAULT_HOLOGRAM_COLOR,
          hologramOpacity: existing?.hologramOpacity ?? DEFAULT_HOLOGRAM_OPACITY,
          ...patch,
        };
        next.set(donationId, updated);
        canvasRef.current?.updateDonationCustomization(donationId, updated);
        return next;
      });
    },
    [buildingSettings.color],
  );

  const handleBuildingColorChange = useCallback(
    (donationId: number, color: string) => updateCustomization(donationId, { color }),
    [updateCustomization],
  );

  const handleFacadeStyleChange = useCallback(
    (donationId: number, facadeStyle: FacadeStyle) =>
      updateCustomization(donationId, { facadeStyle }),
    [updateCustomization],
  );

  const handleTilingScaleChange = useCallback(
    (donationId: number, tilingScale: number) =>
      updateCustomization(donationId, { tilingScale }),
    [updateCustomization],
  );

  const handleRooftopChange = useCallback(
    (donationId: number, rooftopType: RooftopType) => updateCustomization(donationId, { rooftopType }),
    [updateCustomization],
  );

  const handleSignTextChange = useCallback(
    (donationId: number, signText: string) => updateCustomization(donationId, { signText }),
    [updateCustomization],
  );

  const handleSignSidesChange = useCallback(
    (donationId: number, signSides: number) => updateCustomization(donationId, { signSides }),
    [updateCustomization],
  );

  const handleEdgeLightTypeChange = useCallback(
    (donationId: number, edgeLightType: EdgeLightType) =>
      updateCustomization(donationId, { edgeLightType }),
    [updateCustomization],
  );

  const handleBuildingShapeChange = useCallback(
    (donationId: number, buildingShape: BuildingShape) =>
      updateCustomization(donationId, { buildingShape }),
    [updateCustomization],
  );

  const handleHologramImageChange = useCallback(
    (donationId: number, hologramImage: string | null) =>
      updateCustomization(donationId, { hologramImage }),
    [updateCustomization],
  );

  const handleHologramColorChange = useCallback(
    (donationId: number, hologramColor: string) =>
      updateCustomization(donationId, { hologramColor }),
    [updateCustomization],
  );

  const handleHologramOpacityChange = useCallback(
    (donationId: number, hologramOpacity: number) =>
      updateCustomization(donationId, { hologramOpacity }),
    [updateCustomization],
  );

  const shortcuts: KeyboardShortcut[] = [
    {
      key: "ArrowRight",
      description: "Adicionar edifício (simula pagamento)",
      handler: () => startPayment(),
    },
    {
      key: "m",
      ctrl: true,
      description: "Abrir/fechar painel de controle",
      handler: () => setShowControlPanel((open) => !open),
    },
    {
      key: "b",
      ctrl: true,
      description: "Mostrar/esconder input de doação",
      handler: () =>
        setUIVisibility((prev) => ({ ...prev, donationInput: !prev.donationInput })),
    },
    {
      key: "j",
      ctrl: true,
      description: "Mostrar/esconder log da câmera",
      handler: () => setUIVisibility((prev) => ({ ...prev, cameraLog: !prev.cameraLog })),
    },
    {
      key: "?",
      shift: true,
      description: "Mostrar/esconder esta ajuda",
      handler: () => setShowShortcutsHelp((open) => !open),
    },
    {
      key: "Escape",
      allowInInput: true,
      description: "Fechar painel aberto",
      handler: () => {
        if (showShortcutsHelp) {
          setShowShortcutsHelp(false);
        } else if (infoBuilding !== null) {
          handleCloseInfo();
        } else if (selectedBuildingId !== null) {
          handleCloseCustomizePanel();
        } else {
          setShowControlPanel(false);
        }
      },
    },
  ];

  useKeyboardShortcuts(shortcuts);

  return (
    <div
      ref={scrollRef}
      className="scrollbar-hidden h-screen w-full overflow-y-auto overflow-x-hidden bg-[#05070a]"
    >
      <section className="relative h-screen w-full overflow-hidden bg-[#05070a]">
      <CitySceneCanvas
        ref={canvasRef}
        initialDonations={INITIAL_DONATIONS}
        initialBuildingCustomizations={INITIAL_BUILDING_CUSTOMIZATIONS}
        buildingSettings={buildingSettings}
        textureSettings={textureSettings}
        groundSettings={groundSettings}
        terrainSettings={terrainSettings}
        lightSettings={lightSettings}
        shadowSettings={shadowSettings}
        renderDirectionSettings={renderDirectionSettings}
        environmentSettings={environmentSettings}
        horizonSettings={horizonSettings}
        blockLayoutSettings={blockLayoutSettings}
        onStatsChange={setSceneStats}
        onCameraDebugChange={setCameraDebugInfo}
        onHoverChange={handleHoverChange}
        onBuildingClick={handleBuildingClick}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to from-black/35 to-transparent" />
      {/* Troca rápida de estado. Esconde quando painel de controle ou de
          personalização ocupa o canto direito. */}
      {sceneSlots.length > 0 && !showControlPanel && selectedBuildingId === null && (
        <select
          value={activeSceneSlot ?? ""}
          onChange={(event) => {
            if (event.target.value) handleLoadSceneSlot(event.target.value);
          }}
          className="absolute right-4 top-4 z-30 h-10 max-w-[14rem] cursor-pointer rounded-xl border border-white/10 bg-black/60 px-3 text-sm text-white/80 shadow-lg outline-none backdrop-blur-md transition-colors hover:bg-white/10 hover:text-white focus:border-white/25"
          title="Trocar estado da cidade"
          aria-label="Trocar estado da cidade"
        >
          {!activeSceneSlot && (
            <option value="" className="bg-[#05070a] text-white">
              Cena atual (não salva)
            </option>
          )}
          {sceneSlots.map((name) => (
            <option key={name} value={name} className="bg-[#05070a] text-white">
              {name}
            </option>
          ))}
        </select>
      )}
      {uiVisibility.cameraLog && cameraDebugInfo && (
        <div className="absolute bottom-4 left-4 z-30 w-[min(21rem,calc(100vw-2rem))] select-text rounded-lg border border-white/10 bg-black/70 px-3 py-2 font-mono text-[11px] leading-5 text-white/80 shadow-lg backdrop-blur-md">
          <div className="mb-1 font-sans text-xs font-semibold text-white">Camera default</div>
          <div>
            initialCameraPosition: {"{"} x: {formatCameraValue(cameraDebugInfo.position.x)}, y:{" "}
            {formatCameraValue(cameraDebugInfo.position.y)}, z:{" "}
            {formatCameraValue(cameraDebugInfo.position.z)} {"}"}
          </div>
          <div>
            controlTarget: {"{"} x: {formatCameraValue(cameraDebugInfo.target.x)}, y:{" "}
            {formatCameraValue(cameraDebugInfo.target.y)}, z:{" "}
            {formatCameraValue(cameraDebugInfo.target.z)} {"}"}
          </div>
        </div>
      )}
      {hoverInfo && (
        <div
          className="pointer-events-none fixed z-50 rounded-lg border border-white/10 bg-black/80 px-3 py-1.5 text-sm text-white backdrop-blur-sm"
          style={{ left: hoverInfo.x + 14, top: hoverInfo.y - 14 }}
        >
          {hoverInfo.value.toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </div>
      )}
      <BuildingHeightInput
        onSubmit={handleDonation}
        onBulkSubmit={handleBulkDonation}
        blockLayoutSettings={blockLayoutSettings}
        onBlockLayoutChange={setBlockLayoutSettings}
        visibility={uiVisibility}
      />
      <PaymentSimulation
        payment={payment}
        onConfirmed={(amount) => handleDonation(amount, false)}
        onDone={() => setPayment(null)}
        onExited={() => {
          paymentBusyRef.current = false;
        }}
      />
      {infoBuilding !== null && (
        <BuildingInfoModal
          value={infoBuilding.value}
          onCustomize={handleCustomizeFromInfo}
          onClose={handleCloseInfo}
        />
      )}
      {selectedBuildingId !== null && (() => {
        const c = getExistingCustomization(selectedBuildingId);
        return (
          <BuildingCustomizePanel
            key={selectedBuildingId}
            donationId={selectedBuildingId}
            initialColor={c.color}
            initialFacadeStyle={c.facadeStyle}
            initialTilingScale={c.tilingScale}
            initialBuildingShape={c.buildingShape}
            initialRooftopType={c.rooftopType}
            initialSignText={c.signText}
            initialSignSides={c.signSides}
            initialEdgeLightType={c.edgeLightType}
            initialHologramImage={c.hologramImage}
            initialHologramColor={c.hologramColor}
            initialHologramOpacity={c.hologramOpacity}
            onColorChange={handleBuildingColorChange}
            onFacadeStyleChange={handleFacadeStyleChange}
            onTilingScaleChange={handleTilingScaleChange}
            onBuildingShapeChange={handleBuildingShapeChange}
            onRooftopChange={handleRooftopChange}
            onSignTextChange={handleSignTextChange}
            onSignSidesChange={handleSignSidesChange}
            onEdgeLightTypeChange={handleEdgeLightTypeChange}
            onHologramImageChange={handleHologramImageChange}
            onHologramColorChange={handleHologramColorChange}
            onHologramOpacityChange={handleHologramOpacityChange}
            onClose={handleCloseCustomizePanel}
          />
        );
      })()}
      {showControlPanel && (
        <CityControlPanel
          buildingSettings={buildingSettings}
          textureSettings={textureSettings}
          groundSettings={groundSettings}
          blockLayoutSettings={blockLayoutSettings}
          terrainSettings={terrainSettings}
          lightSettings={lightSettings}
          shadowSettings={shadowSettings}
          renderDirectionSettings={renderDirectionSettings}
          sceneStats={sceneStats}
          lightMetrics={lightMetrics}
          onBuildingSettingsChange={setBuildingSettings}
          onTextureSettingsChange={setTextureSettings}
          onGroundSettingsChange={setGroundSettings}
          onBlockLayoutSettingsChange={setBlockLayoutSettings}
          onTerrainSettingsChange={setTerrainSettings}
          onLightSettingsChange={setLightSettings}
          onShadowSettingsChange={setShadowSettings}
          onRenderDirectionSettingsChange={setRenderDirectionSettings}
          environmentSettings={environmentSettings}
          horizonSettings={horizonSettings}
          uiVisibility={uiVisibility}
          sceneSlots={sceneSlots}
          onEnvironmentSettingsChange={setEnvironmentSettings}
          onHorizonSettingsChange={setHorizonSettings}
          onUIVisibilityChange={setUIVisibility}
          onSaveSceneSlot={handleSaveSceneSlot}
          onLoadSceneSlot={handleLoadSceneSlot}
          onDeleteSceneSlot={handleDeleteSceneSlot}
          onClearStorage={handleClearStorage}
          onClose={() => setShowControlPanel(false)}
        />
      )}
      {showShortcutsHelp && (
        <KeyboardShortcutsHelp
          shortcuts={shortcuts}
          onClose={() => setShowShortcutsHelp(false)}
        />
      )}
      {!showControlPanel && (
        <button
          onClick={() => setShowControlPanel(true)}
          className="absolute bottom-4 right-4 z-30 flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-black/60 text-white/70 shadow-lg backdrop-blur-md transition-colors hover:bg-white/10 hover:text-white"
          title="Configurações da cena"
          aria-label="Abrir painel de configurações"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 5.889c-.502.21-.974.483-1.405.81L5.83 5.95a1.875 1.875 0 0 0-2.342.806L2.566 8.344a1.875 1.875 0 0 0 .417 2.446l1.715 1.339c-.04.31-.06.626-.06.946 0 .32.02.636.06.946l-1.715 1.339a1.875 1.875 0 0 0-.417 2.446l.922 1.588a1.875 1.875 0 0 0 2.342.806l1.815-.749c.43.327.903.6 1.405.81l.178 2.072c.151.904.933 1.567 1.85 1.567h1.844c.917 0 1.699-.663 1.85-1.567l.178-2.072c.502-.21.975-.483 1.405-.81l1.815.749a1.875 1.875 0 0 0 2.342-.806l.922-1.588a1.875 1.875 0 0 0-.417-2.446l-1.715-1.339c.04-.31.06-.626.06-.946 0-.32-.02-.636-.06-.946l1.715-1.339a1.875 1.875 0 0 0 .417-2.446l-.922-1.588a1.875 1.875 0 0 0-2.342-.806l-1.815.749a7.5 7.5 0 0 0-1.405-.81l-.178-2.072a1.875 1.875 0 0 0-1.85-1.567h-1.844ZM12 15.75a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z"
              fill="currentColor"
            />
          </svg>
        </button>
      )}

      {/* CTA: rola para a seção de informações abaixo da cena */}
      {!showControlPanel && (
        <button
          onClick={scrollToInfo}
          className="absolute bottom-[4.75rem] right-4 z-30 flex items-center gap-2 rounded-full border border-white/10 bg-black/60 px-4 py-2.5 text-sm font-medium text-[#e9e6df]/80 shadow-lg backdrop-blur-md transition-colors hover:border-[#c9a86a]/50 hover:text-[#c9a86a]"
          title="Para onde vai o seu investimento"
          aria-label="Ver para onde vai o seu investimento"
        >
          <span className="hidden sm:inline">Para onde vai o seu investimento</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 5v14M5 12l7 7 7-7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
      </section>

      <DonationInfoSection totalRaised={donationTotal} donationCount={donationCount} />

      {/* Voltar para a cena — visível apenas na seção de informações */}
      {inInfo && (
        <button
          onClick={scrollToScene}
          className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full border border-black/10 bg-white/90 px-4 py-2.5 text-sm font-medium text-[#14161c] shadow-lg backdrop-blur-md transition-colors hover:border-[#a8814a]/60 hover:text-[#a8814a]"
          title="Voltar para a cena"
          aria-label="Voltar para a cena"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 19V5M5 12l7-7 7 7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="hidden sm:inline">Voltar para a cena</span>
        </button>
      )}
    </div>
  );
}
