import { useCallback, useEffect, useRef, useState } from "react";
import { CitySceneCanvas, type CitySceneCanvasHandle } from "./three/CitySceneCanvas";
import { BuildingHeightInput } from "./html/BuildingHeightInput";
import { PaymentSimulation, type Payment } from "./html/PaymentSimulation";
import { BuildingCustomizePanel } from "./html/BuildingCustomizePanel";
import { CityControlPanel } from "./html/CityControlPanel";
import { DonationInfoSection } from "./html/DonationInfoSection";
import { KeyboardShortcutsHelp } from "./html/KeyboardShortcutsHelp";
import {
  useKeyboardShortcuts,
  type KeyboardShortcut,
} from "./hooks/useKeyboardShortcuts";
import { DEFAULT_SCENE_STATS } from "../scene/config/citySceneConfig";
import { createDefaultBlockLayoutSettings } from "../scene/config/blockLayoutConfig";
import { createDefaultBuildingSettings } from "../scene/config/buildingConfig";
import { createDefaultEnvironmentSettings } from "../scene/config/environmentConfig";
import { createDefaultGroundSettings } from "../scene/config/groundConfig";
import { createDefaultTerrainSettings } from "../scene/config/terrainConfig";
import { createDefaultLightSettings } from "../scene/config/lightConfig";
import { createDefaultRenderDirectionSettings } from "../scene/config/renderDirectionConfig";
import { createDefaultShadowSettings } from "../scene/config/shadowConfig";
import { createDefaultTextureSettings } from "../scene/config/textureConfig";
import { createDefaultHorizonSettings } from "../scene/config/horizonConfig";
import {
  loadUIVisibilitySettings,
  saveUIVisibilitySettings,
} from "../scene/config/uiVisibilityConfig";
import type {
  BuildingCustomization,
  BuildingShape,
  CameraDebugInfo,
  EdgeLightType,
  RooftopType,
  SceneStats,
} from "../scene/types";
import {
  DEFAULT_BUILDING_TEXTURE_TRANSFORM,
  DEFAULT_HOLOGRAM_COLOR,
  DEFAULT_HOLOGRAM_OPACITY,
} from "../scene/types";
import { getLightMetrics } from "../scene/utils/lighting";

// Cena começa com um único edifício (modelo padrão/quadrado).
// Novos edifícios entram via seta direita com tamanho aleatório.
const INITIAL_TEST_DONATIONS = [500] as const;

const INITIAL_DONATION_TOTAL = INITIAL_TEST_DONATIONS.reduce((sum, v) => sum + v, 0);

// Faixa de valores sorteados a cada seta direita (define a altura proporcional).
const RANDOM_DONATION_MIN = 50;
const RANDOM_DONATION_MAX = 1000;

const randomDonationValue = () =>
  Math.round(RANDOM_DONATION_MIN + Math.random() * (RANDOM_DONATION_MAX - RANDOM_DONATION_MIN));

// Sem customizações iniciais — todos os edifícios usam o formato padrão.
const createInitialBuildingCustomizations = () =>
  new Map<number, BuildingCustomization>();

const INITIAL_TEST_BUILDING_CUSTOMIZATIONS = createInitialBuildingCustomizations();

const formatCameraValue = (value: number) => value.toFixed(2);

export function CitySceneEditor() {
  const canvasRef = useRef<CitySceneCanvasHandle>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Total arrecadado e número de doações — alimentam a seção de informações abaixo da cena.
  const [donationTotal, setDonationTotal] = useState(INITIAL_DONATION_TOTAL);
  const [donationCount, setDonationCount] = useState<number>(INITIAL_TEST_DONATIONS.length);
  // `inInfo` = usuário rolou para a seção de informações (esconde CTA da cena, mostra "voltar").
  const [inInfo, setInInfo] = useState(false);

  const [buildingSettings, setBuildingSettings] = useState(createDefaultBuildingSettings);
  const [textureSettings, setTextureSettings] = useState(createDefaultTextureSettings);
  const [groundSettings, setGroundSettings] = useState(createDefaultGroundSettings);
  const [terrainSettings, setTerrainSettings] = useState(createDefaultTerrainSettings);
  const [lightSettings, setLightSettings] = useState(createDefaultLightSettings);
  const [shadowSettings, setShadowSettings] = useState(createDefaultShadowSettings);
  const [renderDirectionSettings, setRenderDirectionSettings] = useState(
    createDefaultRenderDirectionSettings,
  );
  const [environmentSettings, setEnvironmentSettings] = useState(createDefaultEnvironmentSettings);
  const [horizonSettings, setHorizonSettings] = useState(createDefaultHorizonSettings);
  const [blockLayoutSettings, setBlockLayoutSettings] = useState(createDefaultBlockLayoutSettings);
  const [sceneStats, setSceneStats] = useState<SceneStats>({ ...DEFAULT_SCENE_STATS });
  const [cameraDebugInfo, setCameraDebugInfo] = useState<CameraDebugInfo | null>(null);
  const [hoverInfo, setHoverInfo] = useState<{ value: number; x: number; y: number } | null>(null);
  const [showControlPanel, setShowControlPanel] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [uiVisibility, setUIVisibility] = useState(loadUIVisibilitySettings);
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null);
  const [buildingCustomizations, setBuildingCustomizations] = useState<Map<number, BuildingCustomization>>(
    createInitialBuildingCustomizations,
  );

  // Simulação de pagamento: um cartão por vez. `payment` guarda o ativo;
  // `paymentBusyRef` bloqueia novas setas até o cartão sair de tela.
  const [payment, setPayment] = useState<Payment | null>(null);
  const paymentIdRef = useRef(0);
  const paymentBusyRef = useRef(false);

  const lightMetrics = getLightMetrics(lightSettings);

  useEffect(() => {
    saveUIVisibilitySettings(uiVisibility);
  }, [uiVisibility]);

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

  const handleDonation = (value: number) => {
    canvasRef.current?.addDonation(value);
    setDonationTotal((t) => t + value);
    setDonationCount((c) => c + 1);
  };

  const handleBulkDonation = (values: number[]) => {
    canvasRef.current?.addDonations(values);
    setDonationTotal((t) => t + values.reduce((sum, v) => sum + v, 0));
    setDonationCount((c) => c + values.length);
  };

  // Seta direita → inicia a simulação de pagamento de um valor aleatório.
  // Ignora novas chamadas enquanto um cartão ainda está na tela.
  const startPayment = useCallback(() => {
    if (paymentBusyRef.current) return;
    paymentBusyRef.current = true;
    paymentIdRef.current += 1;
    setPayment({ id: paymentIdRef.current, amount: randomDonationValue() });
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
      } else {
        canvasRef.current?.clearFocus();
      }
      setSelectedBuildingId(donationId);
    },
    [],
  );

  const handleCloseCustomizePanel = useCallback(() => {
    canvasRef.current?.clearFocus();
    setSelectedBuildingId(null);
  }, []);

  const getExistingCustomization = useCallback(
    (donationId: number) => {
      const existing = buildingCustomizations.get(donationId);
      return {
        color: existing?.color ?? buildingSettings.color,
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
      className="h-screen w-full overflow-y-auto overflow-x-hidden bg-[#05070a]"
    >
      <section className="relative h-screen w-full overflow-hidden bg-[#05070a]">
      <CitySceneCanvas
        ref={canvasRef}
        initialDonations={INITIAL_TEST_DONATIONS}
        initialBuildingCustomizations={INITIAL_TEST_BUILDING_CUSTOMIZATIONS}
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
        onConfirmed={handleDonation}
        onDone={() => setPayment(null)}
        onExited={() => {
          paymentBusyRef.current = false;
        }}
      />
      {selectedBuildingId !== null && (() => {
        const c = getExistingCustomization(selectedBuildingId);
        return (
          <BuildingCustomizePanel
            key={selectedBuildingId}
            donationId={selectedBuildingId}
            initialColor={c.color}
            initialBuildingShape={c.buildingShape}
            initialRooftopType={c.rooftopType}
            initialSignText={c.signText}
            initialSignSides={c.signSides}
            initialEdgeLightType={c.edgeLightType}
            initialHologramImage={c.hologramImage}
            initialHologramColor={c.hologramColor}
            initialHologramOpacity={c.hologramOpacity}
            onColorChange={handleBuildingColorChange}
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
          onEnvironmentSettingsChange={setEnvironmentSettings}
          onHorizonSettingsChange={setHorizonSettings}
          onUIVisibilityChange={setUIVisibility}
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
          title="Para onde vai sua doação"
          aria-label="Ver para onde vão as doações"
        >
          <span className="hidden sm:inline">Para onde vai sua doação</span>
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
