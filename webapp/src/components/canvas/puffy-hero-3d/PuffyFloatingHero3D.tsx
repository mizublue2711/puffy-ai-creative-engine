import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { ViewportMode } from "../../../types/pdp";
import { type MattressModelId } from "./mattressPresets.ts";
import {
  PUFFY_10_LAYERS,
  PUFFY_MODEL_ORDER,
  getActiveLayersForModel,
  getModelConfig,
  resolvePuffyModelKey,
  type LayerBenefitIcon,
  type MattressModelConfig as PuffyEcoModelConfig,
  type PuffyModelKey,
} from "./puffyLayersData.ts";
import { LayerCutawayPreview3D } from "./LayerCutawayPreview3D.tsx";
import {
  resolveMattressSizeSpec,
  type CameraAnglePreset,
  type TelemetryReadout,
} from "./types.ts";
import {
  WoolMeadowSceneModule,
  type SanctuaryEnvironmentMode,
} from "./WoolMeadowSceneModule.ts";
import {
  BEDROOM_STYLE_ORDER,
  BEDROOM_STYLE_PRESETS,
  type BedroomStyle,
} from "../bedroom/BedroomRegistry.ts";
import { BedroomConfiguratorDock } from "../../ui/BedroomConfiguratorDock.tsx";
import "./PuffyFloatingHero3D.css";

export interface ActiveTrustOverlay {
  label: string;
  source: string;
  src: string;
}

export interface PuffyFloatingHero3DProps {
  viewport?: ViewportMode;
  selectedSize?: string;
  selectedModel?: MattressModelId | PuffyModelKey;
  activeBadge?: ActiveTrustOverlay;
  onTelemetryUpdate?: (telemetry: TelemetryReadout) => void;
  onLayerSelect?: (layerIndex: number) => void;
}

const CAMERA_PRESETS: Array<{ id: CameraAnglePreset; label: string }> = [
  { id: "hero45", label: "Tiny Planet 60°" },
  { id: "dollyClose", label: "Dolly Close-Up" },
  { id: "topDown", label: "Top-Down Cloud" },
];

const ECO_MODEL_SWATCHES: Record<PuffyModelKey, string> = {
  cloud: "#9BC2E6",
  lux: "#3D6B99",
  royal: "#18243B",
};

function getCraftLabBadges(cfg: PuffyEcoModelConfig): string[] {
  const badges = [
    "Crafted in the USA",
    "CertiPUR-US® Certified Foams",
  ];
  if (cfg.layerIds.includes(2)) {
    badges.push("Exclusive Blended Wool");
  }
  if (cfg.layerIds.includes(8)) {
    badges.push('6" Contour-Adapt Pocket Coils');
  } else {
    badges.push(`${cfg.profileHeightInches}" All-Foam Contour Core`);
  }
  return badges;
}

function getCraftMetrics(
  cfg: PuffyEcoModelConfig
): Array<{ val: string; lbl: string }> {
  return [
    { val: "Cooler Sleep", lbl: "10x Faster Heat Dissipation" },
    cfg.layerIds.includes(7)
      ? { val: "5-Zone Support", lbl: "Cloud Breeze™ Sculpted Relief" }
      : cfg.layerIds.includes(8)
        ? { val: "Hybrid Coils", lbl: '6" Contour-Adapt Pocket Springs' }
        : { val: "Cloud Contour", lbl: "Plush Pressure-Point Cradling" },
    cfg.layerIds.includes(6)
      ? { val: "Responsive Comfort", lbl: "99.4% Reflexive Foam Rebound" }
      : { val: "Firm Support", lbl: "High-Density Anti-Sag Core" },
    {
      val: `${cfg.layersCount} Layers · ${cfg.profileHeightInches}"`,
      lbl: "Crafted in USA · Forever Warranty",
    },
  ];
}

function LayerBenefitSvg({ icon }: { icon: LayerBenefitIcon }) {
  switch (icon) {
    case "snowflake":
      return (
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d="M10 2v16M3.07 6l13.86 8M16.93 6L3.07 14M8 3.5L10 5.5l2-2M8 16.5l2-2 2 2M3.5 8.5l2-.5-.5-2M16.5 11.5l-2 .5.5 2M16.5 8.5l-2-.5.5-2M3.5 11.5l2 .5-.5 2"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "zones":
      return (
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <rect x="3" y="4" width="14" height="3" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
          <rect x="3" y="8.5" width="14" height="3" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
          <rect x="3" y="13" width="14" height="3" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      );
    case "airflow":
      return (
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d="M3 7h9.5a2 2 0 1 0-2-2M3 10.5h12.5a2 2 0 1 1-2 2M3 14h7.5a1.8 1.8 0 1 1-1.8 1.8"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      );
    case "feather":
      return (
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d="M15.5 4.5c-4.5 0-8.5 3.5-9.5 8.5L4 16l3-2c5-1 8.5-5 8.5-9.5Z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path d="M6.5 13.5L13 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    case "spark":
      return (
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d="M10 2.5l1.7 4.8 4.8 1.7-4.8 1.7L10 15.5l-1.7-4.8L3.5 9l4.8-1.7L10 2.5Z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "spine":
      return (
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d="M10 3v14M7 5.5h6M6.5 10h7M7 14.5h6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case "coil":
      return (
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <ellipse cx="10" cy="5.5" rx="4.5" ry="2" stroke="currentColor" strokeWidth="1.4" />
          <ellipse cx="10" cy="10" rx="4.5" ry="2" stroke="currentColor" strokeWidth="1.4" />
          <ellipse cx="10" cy="14.5" rx="4.5" ry="2" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      );
    case "anchor":
      return (
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="10" cy="5" r="1.8" stroke="currentColor" strokeWidth="1.4" />
          <path
            d="M10 6.8v9.7M6 10h8M4.5 12.5a5.5 5.5 0 0 0 11 0"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      );
    case "shield":
    default:
      return (
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d="M10 2.8l5.5 2.2v4.6c0 3.7-2.4 6.5-5.5 7.6-3.1-1.1-5.5-3.9-5.5-7.6V5L10 2.8Z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path
            d="M7.7 10l1.6 1.6 3.2-3.2"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
  }
}

function detectSoftwareGl(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    if (!gl) return true;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export function PuffyFloatingHero3D({
  viewport = "desktop",
  selectedSize = "Queen",
  selectedModel,
  activeBadge,
  onTelemetryUpdate,
  onLayerSelect,
}: PuffyFloatingHero3DProps) {
  const mountContainerRef = useRef<HTMLDivElement | null>(null);
  const sceneModuleRef = useRef<WoolMeadowSceneModule | null>(null);
  const craftTabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const telemetryCallbackRef = useRef(onTelemetryUpdate);
  const layerSelectCallbackRef = useRef(onLayerSelect);

  telemetryCallbackRef.current = onTelemetryUpdate;
  layerSelectCallbackRef.current = onLayerSelect;

  const [activePreset, setActivePreset] = useState<CameraAnglePreset>("hero45");
  const [currentEnvironment, setCurrentEnvironment] =
    useState<SanctuaryEnvironmentMode>("meadow");
  const [isExploded, setIsExploded] = useState<boolean>(false);
  const [, setCameraPosition] = useState<THREE.Vector3>(
    () => new THREE.Vector3(3.65, 2.38, 4.85)
  );
  const [bedroomStyle, setBedroomStyle] =
    useState<BedroomStyle>("nordic-coastal");
  const [activeLayerIndex, setActiveLayerIndex] = useState<number>(0);
  const [isCraftLabVisible, setIsCraftLabVisible] = useState<boolean>(false);
  const [previewResetSignal, setPreviewResetSignal] = useState<number>(0);
  const [isDockCollapsed, setIsDockCollapsed] = useState<boolean>(false);
  const [activeEcoModelKey, setActiveEcoModelKey] = useState<PuffyModelKey>(
    () => resolvePuffyModelKey(selectedModel)
  );

  const isMobile = viewport === "mobile";
  const currentSizeSpec = useMemo(
    () => resolveMattressSizeSpec(selectedSize),
    [selectedSize]
  );
  const ecoModelConfig = getModelConfig(activeEcoModelKey);
  const activeModelLayers = useMemo(
    () => getActiveLayersForModel(activeEcoModelKey),
    [activeEcoModelKey]
  );
  const activeLayerSequentialIdx = useMemo(() => {
    const found = activeModelLayers.findIndex(
      (layer) => layer.id - 1 === activeLayerIndex
    );
    const rawIdx = found >= 0 ? found : 0;
    return Math.max(
      0,
      Math.min(
        rawIdx,
        Math.max(0, Math.min(activeModelLayers.length, ecoModelConfig.layersCount) - 1)
      )
    );
  }, [activeModelLayers, activeLayerIndex, ecoModelConfig.layersCount]);
  const safeLayerIndex = Math.max(
    0,
    Math.min(
      activeLayerSequentialIdx,
      Math.max(0, ecoModelConfig.layersCount - 1)
    )
  );
  const activeSequentialNum = safeLayerIndex + 1;
  const activeLayer =
    activeModelLayers[safeLayerIndex] ??
    activeModelLayers[0] ??
    PUFFY_10_LAYERS[0];
  const craftLabBadges = useMemo(
    () => getCraftLabBadges(ecoModelConfig),
    [ecoModelConfig]
  );
  const craftMetrics = useMemo(
    () => getCraftMetrics(ecoModelConfig),
    [ecoModelConfig]
  );

  // Keep latest initial props available for WebGL initialization
  const initialSizeRef = useRef(currentSizeSpec);
  const initialModelRef = useRef(selectedModel ?? activeEcoModelKey);
  const hasSyncedSizeRef = useRef(false);
  const isExplodedRef = useRef(isExploded);
  initialSizeRef.current = currentSizeSpec;
  initialModelRef.current = selectedModel ?? activeEcoModelKey;
  isExplodedRef.current = isExploded;

  useEffect(() => {
    const container = mountContainerRef.current;
    if (!container) return;

    let isDisposed = false;
    let frameId = 0;
    let timeoutId = 0;

    const isSoftwareGl = detectSoftwareGl();
    const width = Math.max(300, container.clientWidth || 780);
    const height = Math.max(340, container.clientHeight || 640);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: "high-performance",
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.setSize(width, height, false);
    renderer.domElement.className = "w-full h-full";

    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);

    const sceneModule = new WoolMeadowSceneModule();
    sceneModuleRef.current = sceneModule;

    sceneModule.onTelemetry((telemetry) => {
      telemetryCallbackRef.current?.(telemetry);
    });
    sceneModule.onLayerSelect((layerIdx) => {
      setActiveLayerIndex(layerIdx);
      layerSelectCallbackRef.current?.(layerIdx);
    });
    sceneModule.onCameraPositionChange((pos) => {
      setCameraPosition(pos);
    });

    sceneModule.init({
      scene,
      camera,
      renderer,
      container,
      isSoftwareGl,
    });

    // Preserve vertical page scrolling on mobile after OrbitControls mutates touchAction
    renderer.domElement.style.touchAction = "pan-y";

    sceneModule.setMattressSize(initialSizeRef.current);
    sceneModule.setActiveModel(resolvePuffyModelKey(initialModelRef.current));

    const resizeObserver = new ResizeObserver((entries) => {
      if (isDisposed) return;
      for (const entry of entries) {
        const { width: cw, height: ch } = entry.contentRect;
        if (cw > 0 && ch > 0) {
          sceneModule.onResize(cw, ch);
        }
      }
    });
    resizeObserver.observe(container);

    const handleWindowResize = () => {
      if (isDisposed) return;
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      if (cw > 0 && ch > 0) {
        sceneModule.onResize(cw, ch);
      }
    };
    window.addEventListener("resize", handleWindowResize);

    const timer = new THREE.Timer();
    timer.connect(document);

    const afterDraw = (cb: () => void) => {
      if (isDisposed) return;
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync
        ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)
        : null;
      gl.flush();
      const poll = () => {
        if (isDisposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          timeoutId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          timeoutId = window.setTimeout(cb, 80);
        }
      };
      timeoutId = window.setTimeout(poll, 5);
    };

    const tick = (timestamp?: number) => {
      if (isDisposed) return;
      timer.update(timestamp ?? performance.now());
      const rawDelta = timer.getDelta();
      const rawElapsed = timer.getElapsed();
      const deltaTime = Number.isFinite(rawDelta) ? rawDelta : 0;
      const elapsedTime = Number.isFinite(rawElapsed) ? rawElapsed : 0;

      sceneModule.update(elapsedTime, deltaTime);
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(() => tick(performance.now()));
      } else {
        frameId = window.requestAnimationFrame(tick);
      }
    };

    tick(performance.now());

    return () => {
      isDisposed = true;
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleWindowResize);
      timer.dispose();

      sceneModule.dispose();
      sceneModuleRef.current = null;

      scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => mat.dispose());
          } else if (child.material) {
            child.material.dispose();
          }
        }
      });
      scene.clear();

      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Sync Mattress Size changes -> 3D Mesh Scale + soft compression pulse
  useEffect(() => {
    const sceneModule = sceneModuleRef.current;
    if (!sceneModule) return;
    sceneModule.setMattressSize(currentSizeSpec);
    if (hasSyncedSizeRef.current) {
      sceneModule.triggerCenterHandPress();
    } else {
      hasSyncedSizeRef.current = true;
    }
  }, [currentSizeSpec]);

  // Sync external selectedModel prop if provided
  useEffect(() => {
    if (selectedModel !== undefined) {
      const resolved = resolvePuffyModelKey(selectedModel);
      setActiveEcoModelKey(resolved);
      sceneModuleRef.current?.setActiveModel(resolved);
    }
  }, [selectedModel]);

  // Clamp activeLayerIndex to Layer 1 (index 0) when switching to a model that omits the current layer
  useEffect(() => {
    if (!ecoModelConfig.layerIds.includes(activeLayerIndex + 1)) {
      setActiveLayerIndex(0);
      if (isExplodedRef.current) {
        sceneModuleRef.current?.setActiveLayerIndex(0);
      }
    }
  }, [activeEcoModelKey, ecoModelConfig, activeLayerIndex]);

  // Keep active horizontal layer tab centered in the Craft & Specs Lab strip
  useEffect(() => {
    if (!isCraftLabVisible) return;
    const activeTab = craftTabRefs.current[safeLayerIndex];
    activeTab?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [safeLayerIndex, isCraftLabVisible]);

  // Sync Desktop/Mobile Viewport Switcher resize
  useEffect(() => {
    const container = mountContainerRef.current;
    const sceneModule = sceneModuleRef.current;
    if (!container || !sceneModule) return;

    const rafId = window.requestAnimationFrame(() => {
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      if (cw > 0 && ch > 0) {
        sceneModule.onResize(cw, ch);
      }
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [isMobile]);

  const handleToggleCraftLab = (show: boolean) => {
    setIsCraftLabVisible(show);
    sceneModuleRef.current?.setLabPaused(show);
  };

  const handleSetCameraPreset = (preset: CameraAnglePreset) => {
    if (isCraftLabVisible) {
      handleToggleCraftLab(false);
    }
    setActivePreset(preset);
    sceneModuleRef.current?.setCameraPreset(preset);
  };

  const handleToggleExplode = () => {
    if (isCraftLabVisible) {
      handleToggleCraftLab(false);
    }
    const nextExploded = !isExploded;
    setIsExploded(nextExploded);
    sceneModuleRef.current?.setExploded(nextExploded);
  };

  const handleResetCamera = () => {
    if (isCraftLabVisible) {
      handleToggleCraftLab(false);
    }
    setActivePreset("hero45");
    sceneModuleRef.current?.resetCamera();
  };

  const handleSelectLayerIn3D = (
    layerIdx: number,
    expandIn3D = true,
    closeLab = true
  ) => {
    const clamped = Math.max(0, Math.min(PUFFY_10_LAYERS.length - 1, layerIdx));
    const targetIdx = ecoModelConfig.layerIds.includes(clamped + 1) ? clamped : 0;
    setActiveLayerIndex(targetIdx);
    if (expandIn3D) {
      if (closeLab && isCraftLabVisible) {
        handleToggleCraftLab(false);
      }
      setIsExploded(true);
      sceneModuleRef.current?.setActiveLayerIndex(targetIdx);
    }
    layerSelectCallbackRef.current?.(targetIdx);
  };

  const handleToggleExplodeInLab = () => {
    const nextExploded = !isExploded;
    setIsExploded(nextExploded);
    sceneModuleRef.current?.setExploded(nextExploded);
    if (nextExploded) {
      sceneModuleRef.current?.setActiveLayerIndex(activeLayer.id - 1);
    }
  };

  const handleResetLabView = () => {
    setIsExploded(false);
    setActiveLayerIndex(0);
    setActivePreset("hero45");
    sceneModuleRef.current?.setExploded(false);
    sceneModuleRef.current?.resetCamera();
    setPreviewResetSignal((prev) => prev + 1);
  };

  const handlePressWoolPad = () => {
    if (isCraftLabVisible) {
      handleToggleCraftLab(false);
    }
    sceneModuleRef.current?.triggerCenterHandPress();
  };

  const handleToggleBedroomMode = () => {
    if (isCraftLabVisible) {
      handleToggleCraftLab(false);
    }
    const nextMode: SanctuaryEnvironmentMode =
      currentEnvironment === "bedroom" ? "meadow" : "bedroom";
    setCurrentEnvironment(nextMode);
    sceneModuleRef.current?.setEnvironmentMode(nextMode);
  };

  const handleSelectEcoModel = (newModelKey: PuffyModelKey) => {
    const nextCfg = getModelConfig(newModelKey);
    setActiveEcoModelKey(newModelKey);
    sceneModuleRef.current?.setActiveModel(newModelKey);
    if (!nextCfg.layerIds.includes(activeLayerIndex + 1)) {
      setActiveLayerIndex(0);
      if (isExploded) {
        sceneModuleRef.current?.setActiveLayerIndex(0);
      }
      layerSelectCallbackRef.current?.(0);
    }
  };

  const handleFirmnessSliderChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const stepIndex = Number(event.target.value);
    const nextModelKey = PUFFY_MODEL_ORDER[stepIndex] ?? "royal";
    handleSelectEcoModel(nextModelKey);
  };

  const handleSelectBedroomStyle = (style: BedroomStyle) => {
    setBedroomStyle(style);
    sceneModuleRef.current?.setBedroomStyle(style);
  };

  // Top badge copy based on active mode
  let badgeKicker = "CURVED HORIZON · CLAYMATION MEADOW SANCTUARY";
  let badgeTitle = `${ecoModelConfig.name} — ${ecoModelConfig.profileHeightInches}" ${ecoModelConfig.layersCount}-Layer Profile`;
  let badgeSub = `${currentSizeSpec.label} (${currentSizeSpec.dimensions}) · Scroll to dolly · Hover sheep or click pad`;

  if (isExploded) {
    badgeKicker = `${ecoModelConfig.layersCount}-LAYER CUTAWAY INSPECTOR · LAYER ${activeSequentialNum} OF ${ecoModelConfig.layersCount}`;
    badgeTitle = `Layer ${activeSequentialNum}: ${activeLayer.name} (${activeLayer.badgeLabel})`;
    badgeSub = `${activeLayer.tagline} · Click any 3D layer or L1–L${ecoModelConfig.layersCount} pill below`;
  } else if (currentEnvironment === "bedroom") {
    const activeStyleCfg = BEDROOM_STYLE_PRESETS[bedroomStyle];
    badgeKicker = `SANCTUARY BEDROOM · ${activeStyleCfg.label.toUpperCase()}`;
    badgeTitle = `${ecoModelConfig.name} (${ecoModelConfig.profileHeightInches}") — Indoor Bedroom Placement`;
    badgeSub = `${currentSizeSpec.label} (${currentSizeSpec.dimensions}) · Puffy Platform Bed · Click pad to test rebound`;
  } else if (currentEnvironment === "studio") {
    badgeKicker = "STUDIO SANCTUARY · ISOLATED PRODUCT VIEW";
    badgeTitle = `${ecoModelConfig.name} (${ecoModelConfig.profileHeightInches}") — Studio Profile`;
    badgeSub = `${currentSizeSpec.label} (${currentSizeSpec.dimensions}) · Scroll to dolly · Click pad to test rebound`;
  }

  return (
    <div
      className={`puffy-floating-hero-3d w-full h-full ${isMobile ? "mobile" : "desktop"}`}
      style={{ touchAction: "pan-y" }}
    >
      {/* 1. Minimal Top-Left Spec Badge + 3-Model Ecosystem Switcher + 4-Archetype Bedroom Switcher */}
      <div className="canvas-top-badge">
        <span className="canvas-top-badge-kicker">{badgeKicker}</span>
        <span className="canvas-top-badge-title">{badgeTitle}</span>
        <span className="canvas-top-badge-sub tabular-nums">{badgeSub}</span>

        <div
          className="puffy-model-switcher-pills"
          role="group"
          aria-label="3D Mattress Model Preset"
        >
          {PUFFY_MODEL_ORDER.map((modelKey) => {
            const cfg = getModelConfig(modelKey);
            const isSelected = modelKey === activeEcoModelKey;
            return (
              <button
                key={modelKey}
                type="button"
                className="puffy-model-pill"
                data-selected={isSelected ? "true" : "false"}
                aria-pressed={isSelected}
                onClick={() => handleSelectEcoModel(modelKey)}
              >
                <span
                  className="puffy-model-swatch"
                  style={{ backgroundColor: ECO_MODEL_SWATCHES[modelKey] }}
                  aria-hidden="true"
                />
                <span>{cfg.shortLabel}</span>
              </button>
            );
          })}
        </div>

        {currentEnvironment === "bedroom" && (
          <div
            className="puffy-model-switcher-pills"
            role="group"
            aria-label="Bedroom Interior Archetype"
          >
            {BEDROOM_STYLE_ORDER.map((styleId) => {
              const styleCfg = BEDROOM_STYLE_PRESETS[styleId];
              const isSelected = styleId === bedroomStyle;
              return (
                <button
                  key={styleId}
                  type="button"
                  className="puffy-model-pill"
                  data-selected={isSelected ? "true" : "false"}
                  onClick={() => handleSelectBedroomStyle(styleId)}
                >
                  <span
                    className="puffy-model-swatch"
                    style={{ backgroundColor: styleCfg.throwBlanket.color }}
                    aria-hidden="true"
                  />
                  <span>{styleCfg.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Optional Trust Badge Overlay */}
      {activeBadge && (
        <div className="gallery-trust-overlay">
          <img src={activeBadge.src} alt={activeBadge.label} />
          <div className="gallery-trust-text">
            <strong>{activeBadge.label}</strong>
            <span>{activeBadge.source}</span>
          </div>
        </div>
      )}

      {/* 3. Craft & Specs Lab Overlay (Dynamic Layer Interactive Cutaway) */}
      <div
        className="reference-cutout-preview"
        data-visible={isCraftLabVisible ? "true" : "false"}
        aria-hidden={!isCraftLabVisible}
      >
        <div className="craft-lab-header">
          <div>
            <div className="craft-lab-kicker">
              PUFFY MATERIAL INTEGRITY &amp; {ecoModelConfig.layersCount}-LAYER QUALITY LAB
            </div>
            <h3 className="craft-lab-title">
              Experience {ecoModelConfig.layersCount} Layers of Ultra-Plush Comfort
            </h3>
            <div className="craft-lab-badges-row">
              {craftLabBadges.map((badge) => (
                <span key={badge} className="craft-usa-badge">
                  {badge}
                </span>
              ))}
            </div>
          </div>

          <div className="craft-lab-header-actions">
            <button
              type="button"
              className="dock-btn"
              onClick={() => {
                handleToggleCraftLab(false);
                setIsExploded(true);
                sceneModuleRef.current?.setExploded(true);
              }}
            >
              View 3D Slide-Out
            </button>
            <button
              type="button"
              className="dock-btn dock-btn-accent"
              onClick={() => handleToggleCraftLab(false)}
            >
              Return to 3D Scene ✕
            </button>
          </div>
        </div>

        {/* 1. Primary Interactive Cream Card */}
        <div className="craft-cream-card">
          {/* Header Bar: Numbered Pill Tabs (1 to N) with Left/Right Scroll Arrows */}
          <div className="craft-10layer-tabs-row">
            <button
              type="button"
              className="craft-tab-arrow-btn"
              aria-label="Previous Layer"
              onClick={() => {
                const prevSeq =
                  (safeLayerIndex - 1 + activeModelLayers.length) %
                  activeModelLayers.length;
                const targetLayer = activeModelLayers[prevSeq];
                if (targetLayer) {
                  handleSelectLayerIn3D(targetLayer.id - 1, true, false);
                }
              }}
            >
              &#8249;
            </button>

            <div
              className="craft-10layer-tabs-scroll"
              role="tablist"
              aria-label={`${ecoModelConfig.layersCount} Mattress Layers`}
            >
              {activeModelLayers.map((layer, idx) => {
                const masterIdx = layer.id - 1;
                const sequentialNum = idx + 1;
                const isActive = masterIdx === activeLayer.id - 1;
                return (
                  <button
                    key={layer.id}
                    ref={(el) => {
                      craftTabRefs.current[idx] = el;
                    }}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className="craft-10layer-tab-pill"
                    data-active={isActive ? "true" : "false"}
                    onClick={() => handleSelectLayerIn3D(masterIdx, true, false)}
                  >
                    <span className="craft-tab-num-circle tabular-nums">
                      {sequentialNum}
                    </span>
                    <span className="craft-tab-short-name">
                      {layer.shortTabLabel}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              className="craft-tab-arrow-btn"
              aria-label="Next Layer"
              onClick={() => {
                const nextSeq =
                  (safeLayerIndex + 1) % activeModelLayers.length;
                const targetLayer = activeModelLayers[nextSeq];
                if (targetLayer) {
                  handleSelectLayerIn3D(targetLayer.id - 1, true, false);
                }
              }}
            >
              &#8250;
            </button>
          </div>

          {/* Cream Card Body: Left = Live 3D Layer Render, Right = Dynamic Layer Details */}
          <div className="craft-cream-card-body">
            <div className="craft-cream-visual-col">
              <LayerCutawayPreview3D
                activeLayerIndex={activeLayer.id - 1}
                isExploded={isExploded}
                activeModelKey={activeEcoModelKey}
                isVisible={isCraftLabVisible}
                resetSignal={previewResetSignal}
                onSelectLayer={(idx) => handleSelectLayerIn3D(idx, true, false)}
              />
              <div className="craft-cream-3d-caption tabular-nums">
                Layer {activeSequentialNum} of {ecoModelConfig.layersCount} · Click any layer in 3D
              </div>
            </div>

            <div className="craft-cream-details-col">
              <div className="craft-cream-badge-row">
                <span className="craft-cream-badge tabular-nums">
                  {activeLayer.badgeLabel}
                </span>
                <span className="craft-cream-subtitle">
                  {activeLayer.subtitle}
                </span>
                {activeLayer.exclusiveTag && (
                  <span className="craft-cream-exclusive">
                    {activeLayer.exclusiveTag}
                  </span>
                )}
              </div>

              <h4 className="craft-cream-headline">{activeLayer.tagline}</h4>

              <div className="craft-cream-copy-group">
                <p className="craft-cream-copy-line">
                  <strong>What it is:</strong> {activeLayer.whatItIs}
                </p>
                <p className="craft-cream-copy-line">
                  <strong>How it works:</strong> {activeLayer.howItWorks}
                </p>
              </div>

              <div className="craft-cream-benefits-row">
                {activeLayer.benefits.map((benefit) => (
                  <span key={benefit.label} className="craft-cream-benefit-pill">
                    <span className="craft-cream-benefit-icon">
                      <LayerBenefitSvg icon={benefit.icon} />
                    </span>
                    <span>{benefit.label}</span>
                  </span>
                ))}
              </div>

              <p className="craft-cream-disclaimer">
                Cover design and materials may vary slightly. All internal
                specifications remain identical.
              </p>
            </div>
          </div>
        </div>

        {/* 2. Redesigned Lower Navy Panel: Sleek Mattress Spec, 3-Step Snap Slider & Action Bar */}
        <div
          className="craft-navy-action-bar"
          role="region"
          aria-label="Mattress Specifications and 3D View Controls"
        >
          <div className="craft-navy-specs">
            <span className="craft-navy-model-name">
              {ecoModelConfig.name}
            </span>
            <span className="craft-navy-dot" aria-hidden="true">
              •
            </span>
            <span className="craft-navy-spec-item tabular-nums">
              {ecoModelConfig.profileHeightInches}&quot; Total Profile
            </span>
            <span className="craft-navy-dot" aria-hidden="true">
              •
            </span>
            <span className="craft-navy-spec-item tabular-nums">
              {ecoModelConfig.layersCount} Targeted Layers
            </span>
          </div>

          <div
            className="craft-navy-firmness"
            role="group"
            aria-label={`Model & Firmness Scale: ${ecoModelConfig.shortLabel}, ${ecoModelConfig.firmnessLabel} (${ecoModelConfig.firmnessScore.toFixed(1)} out of 10)`}
          >
            <div
              className="craft-model-stops-row"
              role="group"
              aria-label="Select Puffy Mattress Model"
            >
              {PUFFY_MODEL_ORDER.map((modelKey, idx) => {
                const cfg = getModelConfig(modelKey);
                const isSelected = modelKey === activeEcoModelKey;
                return (
                  <Fragment key={modelKey}>
                    {idx > 0 && (
                      <span
                        className="craft-model-stop-connector"
                        aria-hidden="true"
                      />
                    )}
                    <button
                      type="button"
                      className="craft-model-stop-btn"
                      data-selected={isSelected ? "true" : "false"}
                      aria-pressed={isSelected}
                      onClick={() => handleSelectEcoModel(modelKey)}
                    >
                      {cfg.shortLabel}
                    </button>
                  </Fragment>
                );
              })}
            </div>

            <div className="craft-firmness-slider-row">
              <span className="craft-firmness-end">Plush Soft</span>
              <div className="craft-firmness-track-wrap">
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={1}
                  value={ecoModelConfig.sliderStep}
                  onChange={handleFirmnessSliderChange}
                  className="craft-firmness-range-input"
                  aria-label="Select Mattress Model and Firmness"
                  aria-valuetext={`${ecoModelConfig.shortLabel} — ${ecoModelConfig.firmnessLabel} (${ecoModelConfig.firmnessScore.toFixed(1)}/10)`}
                />
                <div className="craft-firmness-track" aria-hidden="true">
                  <div
                    className="craft-firmness-fill"
                    style={{ width: `${ecoModelConfig.sliderValue}%` }}
                  />
                  <span
                    className="craft-firmness-notch"
                    style={{ left: "0%" }}
                  />
                  <span
                    className="craft-firmness-notch"
                    style={{ left: "50%" }}
                  />
                  <span
                    className="craft-firmness-notch"
                    style={{ left: "100%" }}
                  />
                  <span
                    className="craft-firmness-knob"
                    style={{ left: `${ecoModelConfig.sliderValue}%` }}
                  />
                </div>
              </div>
              <span className="craft-firmness-end">Firm</span>
              <span className="craft-firmness-readout tabular-nums">
                {ecoModelConfig.firmnessLabel} (
                {ecoModelConfig.firmnessScore.toFixed(1)}/10)
              </span>
            </div>
          </div>

          <div className="craft-navy-actions">
            <button
              type="button"
              role="switch"
              aria-checked={isExploded}
              className="craft-navy-toggle-btn"
              data-active={isExploded ? "true" : "false"}
              onClick={handleToggleExplodeInLab}
            >
              <span className="craft-toggle-track" aria-hidden="true">
                <span className="craft-toggle-thumb" />
              </span>
              <span>Exploded View</span>
            </button>

            <button
              type="button"
              className="craft-navy-reset-btn"
              onClick={handleResetLabView}
            >
              Reset View
            </button>
          </div>
        </div>

        <div className="craft-metrics-strip">
          {craftMetrics.map((m) => (
            <div key={m.val} className="craft-metric-box">
              <span className="craft-metric-val">{m.val}</span>
              <span className="craft-metric-lbl">{m.lbl}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Isolated WebGL Mount Container */}
      <div
        ref={mountContainerRef}
        className="webgl-mount-container w-full h-full"
        style={{ touchAction: "pan-y" }}
        aria-label="Interactive 3D Puffy Floating Mattress Meadow Sanctuary"
      />

      {/* 5. Active-Layer Cutaway HUD Pill Strip */}
      <div
        className="canvas-cutaway-10layer-hud"
        data-visible={isExploded ? "true" : "false"}
        aria-hidden={!isExploded}
      >
        <span className="canvas-cutaway-hud-label">3D Slide-Out Layer:</span>
        {activeModelLayers.map((layer, idx) => {
          const masterIdx = layer.id - 1;
          const sequentialNum = idx + 1;
          const isActive = masterIdx === activeLayer.id - 1;
          return (
            <button
              key={layer.id}
              type="button"
              className="canvas-cutaway-hud-pill tabular-nums"
              data-active={isActive ? "true" : "false"}
              title={`Layer ${sequentialNum}: ${layer.name} (${layer.badgeLabel})`}
              onClick={() => handleSelectLayerIn3D(masterIdx, true)}
            >
              L{sequentialNum}
            </button>
          );
        })}
      </div>

      {/* 5b. Bedroom Staging Configurator Dock (only in Bedroom XR mode) */}
      {currentEnvironment === "bedroom" && (
        <BedroomConfiguratorDock bottomOffset={isDockCollapsed ? 68 : 104} />
      )}

      {/* 6. Collapsible Bottom Control Dock */}
      <div
        className="canvas-bottom-dock-wrapper"
        data-collapsed={isDockCollapsed ? "true" : "false"}
      >
        <button
          type="button"
          className="dock-collapse-toggle"
          onClick={() => setIsDockCollapsed((prev) => !prev)}
        >
          {isDockCollapsed ? "▴ Show 3D Controls" : "▾ Hide 3D Controls"}
        </button>

        <div className="canvas-bottom-dock">
          <button
            type="button"
            className="dock-btn"
            data-active={isExploded ? "true" : "false"}
            onClick={handleToggleExplode}
          >
            {isExploded
              ? "📦 Assemble Mattress"
              : `💥 Explode ${ecoModelConfig.layersCount} Layers`}
          </button>

          <button
            type="button"
            className="dock-btn"
            onClick={handleResetCamera}
          >
            Reset Camera
          </button>

          <button
            type="button"
            className="dock-btn"
            data-active={isCraftLabVisible ? "true" : "false"}
            onClick={() => handleToggleCraftLab(!isCraftLabVisible)}
          >
            Layer Spec Tooltips
          </button>

          <div className="dock-divider" aria-hidden="true" />

          {CAMERA_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="dock-btn"
              data-active={activePreset === preset.id ? "true" : "false"}
              onClick={() => handleSetCameraPreset(preset.id)}
            >
              {preset.label}
            </button>
          ))}

          <div className="dock-divider" aria-hidden="true" />

          <button
            type="button"
            className="dock-btn dock-btn-accent"
            onClick={handlePressWoolPad}
          >
            Press Wool Pad
          </button>

          <button
            type="button"
            className="dock-btn"
            data-active={currentEnvironment === "bedroom" ? "true" : "false"}
            onClick={handleToggleBedroomMode}
          >
            {currentEnvironment === "bedroom"
              ? "Return to Meadow"
              : "View in Bedroom (XR)"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PuffyFloatingHero3D;
