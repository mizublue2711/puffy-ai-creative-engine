import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { ViewportMode } from "../../../types/pdp";
import {
  PUFFY_FLAGSHIP_ORDER,
  PUFFY_FLAGSHIP_PRESETS,
  type MattressModelId,
} from "./mattressPresets.ts";
import { PUFFY_10_LAYERS } from "./puffyLayersData.ts";
import {
  resolveMattressSizeSpec,
  type CameraAnglePreset,
  type TelemetryReadout,
} from "./types.ts";
import {
  WoolMeadowSceneModule,
  type SanctuaryEnvironmentMode,
} from "./WoolMeadowSceneModule.ts";
import "./PuffyFloatingHero3D.css";

export interface ActiveTrustOverlay {
  label: string;
  source: string;
  src: string;
}

export interface PuffyFloatingHero3DProps {
  viewport?: ViewportMode;
  selectedSize?: string;
  selectedModel?: MattressModelId;
  activeBadge?: ActiveTrustOverlay;
  onTelemetryUpdate?: (telemetry: TelemetryReadout) => void;
  onLayerSelect?: (layerIndex: number) => void;
}

const CAMERA_PRESETS: Array<{ id: CameraAnglePreset; label: string }> = [
  { id: "hero45", label: "Tiny Planet 60°" },
  { id: "dollyClose", label: "Dolly Close-Up" },
  { id: "topDown", label: "Top-Down Cloud" },
  { id: "exploded", label: "10-Layer Cutaway" },
];

const CRAFT_LAB_BADGES = [
  "Crafted in the USA",
  "CertiPUR-US® Certified Foams",
  "Exclusive Blended Wool (L2)",
  '6" Contour-Adapt Pocket Coils (L8)',
];

const CRAFT_METRICS = [
  { val: "Cooler Sleep", lbl: "10x Faster Heat Dissipation" },
  { val: "5-Zone Support", lbl: "Cloud Breeze™ Sculpted Relief" },
  { val: "Responsive Comfort", lbl: "99.4% Reflexive Foam Rebound" },
  { val: '10 Layers · 14"', lbl: "Crafted in USA · Forever Warranty" },
];

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
  const telemetryCallbackRef = useRef(onTelemetryUpdate);
  const layerSelectCallbackRef = useRef(onLayerSelect);

  telemetryCallbackRef.current = onTelemetryUpdate;
  layerSelectCallbackRef.current = onLayerSelect;

  const [activePreset, setActivePreset] = useState<CameraAnglePreset>("hero45");
  const [environmentMode, setEnvironmentMode] =
    useState<SanctuaryEnvironmentMode>("meadow");
  const [activeLayerIndex, setActiveLayerIndex] = useState<number>(0);
  const [isCraftLabVisible, setIsCraftLabVisible] = useState<boolean>(false);
  const [isDockCollapsed, setIsDockCollapsed] = useState<boolean>(false);
  const [internalModelKey, setInternalModelKey] =
    useState<MattressModelId>("puffy-royal");

  const activeModelKey = selectedModel ?? internalModelKey;
  const isMobile = viewport === "mobile";
  const currentSizeSpec = useMemo(
    () => resolveMattressSizeSpec(selectedSize),
    [selectedSize]
  );
  const currentModelCfg = PUFFY_FLAGSHIP_PRESETS[activeModelKey];
  const activeLayer = PUFFY_10_LAYERS[activeLayerIndex] ?? PUFFY_10_LAYERS[0];

  // Keep latest initial props available for WebGL initialization
  const initialSizeRef = useRef(currentSizeSpec);
  const initialModelRef = useRef(activeModelKey);
  const hasSyncedSizeRef = useRef(false);
  initialSizeRef.current = currentSizeSpec;
  initialModelRef.current = activeModelKey;

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
    renderer.toneMappingExposure = 1.08;
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
    sceneModule.switchMattressModel(initialModelRef.current);

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
      timer.update(timestamp);
      const deltaTime = timer.getDelta();
      const elapsedTime = timer.getElapsed();

      sceneModule.update(elapsedTime, deltaTime);
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(() => tick(performance.now()));
      } else {
        frameId = window.requestAnimationFrame(tick);
      }
    };

    tick();

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

  // Sync Flagship PBR Model changes (Puffy Royal vs Puffy Monarch)
  useEffect(() => {
    sceneModuleRef.current?.switchMattressModel(activeModelKey);
  }, [activeModelKey]);

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
    if (environmentMode === "bedroom" && preset === "hero45") {
      setEnvironmentMode("meadow");
    }
    sceneModuleRef.current?.setCameraPreset(preset);
  };

  const handleSelectLayerIn3D = (layerIdx: number, focusCamera = true) => {
    const clamped = Math.max(0, Math.min(PUFFY_10_LAYERS.length - 1, layerIdx));
    setActiveLayerIndex(clamped);
    if (focusCamera) {
      if (isCraftLabVisible) {
        handleToggleCraftLab(false);
      }
      setActivePreset("exploded");
      sceneModuleRef.current?.setActiveLayerIndex(clamped, true);
    } else {
      sceneModuleRef.current?.setActiveLayerIndex(clamped, false);
    }
    layerSelectCallbackRef.current?.(clamped);
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
      environmentMode === "bedroom" ? "meadow" : "bedroom";
    setEnvironmentMode(nextMode);
    sceneModuleRef.current?.setEnvironmentMode(nextMode);
  };

  const handleSelectModel = (modelKey: MattressModelId) => {
    setInternalModelKey(modelKey);
    sceneModuleRef.current?.switchMattressModel(modelKey);
  };

  // Top badge copy based on active mode
  let badgeKicker = "CURVED HORIZON · CLAYMATION MEADOW SANCTUARY";
  let badgeTitle = `${currentModelCfg.displayName} — 14" 10-Layer Profile`;
  let badgeSub = `${currentSizeSpec.label} (${currentSizeSpec.dimensions}) · Scroll to dolly · Hover sheep or click pad`;

  if (activePreset === "exploded") {
    badgeKicker = `10-LAYER CUTAWAY INSPECTOR · LAYER ${activeLayer.id} OF 10`;
    badgeTitle = `Layer ${activeLayer.id}: ${activeLayer.name} (${activeLayer.badgeLabel})`;
    badgeSub = `${activeLayer.tagline} · Click any 3D layer or L1–L10 pill below`;
  } else if (environmentMode === "bedroom") {
    badgeKicker = "SANCTUARY BEDROOM · STATIC WALNUT BED FRAME";
    badgeTitle = `${currentModelCfg.displayName} — Indoor Bedroom Placement`;
    badgeSub = `${currentSizeSpec.label} (${currentSizeSpec.dimensions}) · Resting on Walnut Bed Frame · Click pad to test rebound`;
  }

  return (
    <div
      className={`puffy-floating-hero-3d w-full h-full ${isMobile ? "mobile" : "desktop"}`}
      style={{ touchAction: "pan-y" }}
    >
      {/* 1. Minimal Top-Left Spec Badge + PBR Flagship Switcher */}
      <div className="canvas-top-badge">
        <span className="canvas-top-badge-kicker">{badgeKicker}</span>
        <span className="canvas-top-badge-title">{badgeTitle}</span>
        <span className="canvas-top-badge-sub tabular-nums">{badgeSub}</span>

        {!selectedModel && (
          <div
            className="puffy-model-switcher-pills"
            role="group"
            aria-label="3D Mattress Model Preset"
          >
            {PUFFY_FLAGSHIP_ORDER.map((modelKey) => {
              const cfg = PUFFY_FLAGSHIP_PRESETS[modelKey];
              const isSelected = modelKey === activeModelKey;
              return (
                <button
                  key={modelKey}
                  type="button"
                  className="puffy-model-pill"
                  data-selected={isSelected ? "true" : "false"}
                  onClick={() => handleSelectModel(modelKey)}
                >
                  <span
                    className="puffy-model-swatch"
                    style={{ backgroundColor: cfg.upperBand.color }}
                    aria-hidden="true"
                  />
                  <span>{cfg.displayName}</span>
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

      {/* 3. Craft & Specs Lab Overlay (10-Layer Interactive Cutaway) */}
      <div
        className="reference-cutout-preview"
        data-visible={isCraftLabVisible ? "true" : "false"}
        aria-hidden={!isCraftLabVisible}
      >
        <div className="craft-lab-header">
          <div>
            <div className="craft-lab-kicker">
              PUFFY MATERIAL INTEGRITY &amp; 10-LAYER QUALITY LAB
            </div>
            <h3 className="craft-lab-title">
              Experience 10 Layers of Ultra-Plush Comfort
            </h3>
            <div className="craft-lab-badges-row">
              {CRAFT_LAB_BADGES.map((badge) => (
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
              onClick={() => handleSetCameraPreset("exploded")}
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

        <div className="craft-lab-body-grid">
          <div className="craft-cutaway-stage">
            <div className="craft-cutaway-img-wrap">
              <img
                src={activeLayer.screenshotUrl}
                alt={`Layer ${activeLayer.id}: ${activeLayer.name}`}
                referrerPolicy="no-referrer"
              />
            </div>

            <div className="craft-tooltip-card">
              <div className="craft-tooltip-header">
                <strong className="craft-tooltip-title">
                  Layer {activeLayer.id}: {activeLayer.name}
                </strong>
                <span className="craft-tooltip-badge tabular-nums">
                  {activeLayer.badgeLabel}
                  {activeLayer.exclusiveTag
                    ? ` · ${activeLayer.exclusiveTag}`
                    : ""}
                </span>
              </div>
              <div className="craft-tooltip-tagline">{activeLayer.tagline}</div>
              <div className="craft-tooltip-desc">
                {activeLayer.description}
              </div>
            </div>
          </div>

          <div className="craft-layer-list">
            {PUFFY_10_LAYERS.map((layerSpec, idx) => (
              <button
                key={layerSpec.id}
                type="button"
                className="craft-layer-btn"
                data-active={idx === activeLayerIndex ? "true" : "false"}
                onClick={() => handleSelectLayerIn3D(idx, false)}
              >
                <span className="craft-layer-btn-left">
                  <span
                    className="craft-layer-swatch"
                    style={{ backgroundColor: layerSpec.colorHex }}
                  />
                  <span>
                    {layerSpec.id}. {layerSpec.name}
                  </span>
                </span>
                <span className="craft-layer-btn-right tabular-nums">
                  {layerSpec.badgeLabel}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="craft-metrics-strip">
          {CRAFT_METRICS.map((m) => (
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

      {/* 5. 10-Layer Cutaway HUD Pill Strip */}
      <div
        className="canvas-cutaway-10layer-hud"
        data-visible={activePreset === "exploded" ? "true" : "false"}
        aria-hidden={activePreset !== "exploded"}
      >
        <span className="canvas-cutaway-hud-label">3D Slide-Out Layer:</span>
        {PUFFY_10_LAYERS.map((layer, idx) => (
          <button
            key={layer.id}
            type="button"
            className="canvas-cutaway-hud-pill tabular-nums"
            data-active={idx === activeLayerIndex ? "true" : "false"}
            title={`Layer ${layer.id}: ${layer.name} (${layer.badgeLabel})`}
            onClick={() => handleSelectLayerIn3D(idx, true)}
          >
            L{layer.id}
          </button>
        ))}
      </div>

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
            data-active={isCraftLabVisible ? "true" : "false"}
            onClick={() => handleToggleCraftLab(!isCraftLabVisible)}
          >
            Craft &amp; Specs Lab
          </button>

          <button
            type="button"
            className="dock-btn"
            data-active={environmentMode === "bedroom" ? "true" : "false"}
            onClick={handleToggleBedroomMode}
          >
            {environmentMode === "bedroom"
              ? "Return to Meadow"
              : "View in Bedroom (XR)"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PuffyFloatingHero3D;
