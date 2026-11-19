import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { FloatingWoolPad } from "./FloatingWoolPad.ts";
import type { MattressModelId } from "./mattressPresets.ts";
import {
  getModelConfig,
  resolvePuffyModelKey,
  type PuffyModelKey,
} from "./puffyLayersData.ts";
import { getOptimalPixelRatio } from "../../../utils/webglPerf.ts";

export interface LayerCutawayPreview3DProps {
  activeLayerIndex: number;
  isExploded: boolean;
  activeModelKey: PuffyModelKey | MattressModelId;
  isVisible: boolean;
  resetSignal: number;
  onSelectLayer?: (layerIndex: number) => void;
}

function resolveSafeLayerIndex(
  layerIndex: number,
  modelKey: PuffyModelKey | MattressModelId,
): number {
  const safeInput = Number.isFinite(layerIndex) ? Math.trunc(layerIndex) : 0;
  if (modelKey === "puffy-monarch") {
    return Math.max(0, Math.min(safeInput, 9));
  }
  const cfg = getModelConfig(resolvePuffyModelKey(modelKey));
  if (cfg.layerIds.includes(safeInput + 1)) {
    return safeInput;
  }
  const firstLayerId = cfg.layerIds[0] ?? 1;
  return Math.max(0, Math.min(firstLayerId - 1, 9));
}

/**
 * Synchronized Three.js studio viewport for the upper Cream Card's left column.
 * Renders the actual 10-layer FloatingWoolPad cutaway and isolates/highlights
 * whichever layer is selected in the Cream Card or 3D scene.
 */
export function LayerCutawayPreview3D({
  activeLayerIndex,
  isExploded,
  activeModelKey,
  isVisible,
  resetSignal,
  onSelectLayer,
}: LayerCutawayPreview3DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const padRef = useRef<FloatingWoolPad | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const syncedModelRef = useRef<PuffyModelKey | MattressModelId | null>(null);
  const onSelectLayerRef = useRef(onSelectLayer);
  onSelectLayerRef.current = onSelectLayer;

  const latestPropsRef = useRef({
    activeLayerIndex,
    isExploded,
    activeModelKey,
  });
  latestPropsRef.current = { activeLayerIndex, isExploded, activeModelKey };

  useEffect(() => {
    if (!isVisible) return;
    const container = containerRef.current;
    if (!container) return;

    let isDisposed = false;
    let frameId = 0;

    let lastW = Math.min(1200, Math.max(200, Math.round(container.clientWidth || 340)));
    let lastH = Math.min(600, Math.max(200, Math.round(container.clientHeight || 260)));

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(getOptimalPixelRatio(false));
    renderer.setSize(lastW, lastH, false);
    renderer.domElement.className = "w-full h-full block cursor-pointer";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(36, lastW / lastH, 0.1, 30);
    camera.position.set(2.25, 1.45, 3.15);
    camera.lookAt(0, 0.22, 0.02);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 2.6;
    controls.maxDistance = 5.8;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.target.set(0, 0.22, 0.02);
    controls.update();
    controlsRef.current = controls;

    // Clean warm studio 3-point lighting matching the cream card backdrop
    const hemiLight = new THREE.HemisphereLight("#FFFDF9", "#D7D0C5", 1.15);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight("#FFF9EE", 1.85);
    keyLight.position.set(2.4, 3.6, 3.2);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight("#DCE8F5", 0.75);
    fillLight.position.set(-2.6, 1.8, 2.0);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight("#FFFFFF", 0.55);
    rimLight.position.set(0, 2.2, -3.0);
    scene.add(rimLight);

    // Wrapper group so FloatingWoolPad.update() scale mutations never override preview framing
    const mattressGroup = new THREE.Group();
    mattressGroup.visible = true;
    mattressGroup.scale.set(0.68, 0.68, 0.68);
    scene.add(mattressGroup);

    const maxAnisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    const pad = new FloatingWoolPad(maxAnisotropy);
    pad.group.visible = true;
    pad.group.rotation.set(0.04, 0.0, 0.0);
    pad.setFloatingEnabled(false, 0.12);
    mattressGroup.add(pad.group);
    padRef.current = pad;

    const { activeLayerIndex: initIdx, isExploded: initExp, activeModelKey: initModel } =
      latestPropsRef.current;
    if (initModel === "puffy-monarch") {
      pad.updateModel("royal", true);
      pad.switchMattressModel("puffy-monarch");
    } else {
      pad.updateModel(initModel, true);
    }
    syncedModelRef.current = initModel;
    pad.setExplodedFactor(initExp ? 1.0 : 0.65);
    pad.setActiveLayerIndex(resolveSafeLayerIndex(initIdx, initModel));

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const handlePointerDown = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      const visibleLayers = pad.layerMeshes.filter((layerObj) => layerObj.visible);
      const hits = raycaster.intersectObjects(visibleLayers, true);
      for (const hit of hits) {
        let isVisibleHit = true;
        let visCheck: THREE.Object3D | null = hit.object;
        while (visCheck) {
          if (!visCheck.visible) {
            isVisibleHit = false;
            break;
          }
          visCheck = visCheck.parent;
        }
        if (!isVisibleHit) continue;

        let obj: THREE.Object3D | null = hit.object;
        while (obj && obj.userData.layerIndex === undefined) {
          obj = obj.parent;
        }
        if (obj && obj.visible && typeof obj.userData.layerIndex === "number") {
          onSelectLayerRef.current?.(obj.userData.layerIndex);
          break;
        }
      }
    };

    renderer.domElement.addEventListener("pointerdown", handlePointerDown);

    const resizeObserver = new ResizeObserver((entries) => {
      if (isDisposed) return;
      for (const entry of entries) {
        const cw = Math.min(1200, Math.max(200, Math.round(entry.contentRect.width)));
        const ch = Math.min(600, Math.max(200, Math.round(entry.contentRect.height)));
        if (Math.abs(cw - lastW) > 1 || Math.abs(ch - lastH) > 1) {
          lastW = cw;
          lastH = ch;
          camera.aspect = cw / ch;
          camera.updateProjectionMatrix();
          renderer.setPixelRatio(getOptimalPixelRatio(false));
          renderer.setSize(cw, ch, false);
        }
      }
    });
    resizeObserver.observe(container);

    const timer = new THREE.Timer();
    timer.connect(document);

    const tick = (timestamp?: number) => {
      if (isDisposed) return;
      timer.update(timestamp ?? performance.now());
      const rawDt = timer.getDelta();
      const rawElapsed = timer.getElapsed();
      const dt = Number.isFinite(rawDt) ? Math.min(Math.max(rawDt, 0), 0.05) : 0.016;
      const elapsed = Number.isFinite(rawElapsed) ? rawElapsed : 0;

      mattressGroup.visible = true;
      pad.group.visible = true;
      pad.update(elapsed, dt);
      // Gentle subtle breathing yaw for 3D depth perception
      pad.group.rotation.y = Math.sin(elapsed * 0.45) * 0.04;

      if (
        !Number.isFinite(controls.target.x) ||
        !Number.isFinite(controls.target.y) ||
        !Number.isFinite(controls.target.z)
      ) {
        controls.target.set(0, 0.22, 0.02);
      }
      if (
        !Number.isFinite(camera.position.x) ||
        !Number.isFinite(camera.position.y) ||
        !Number.isFinite(camera.position.z)
      ) {
        camera.position.set(2.25, 1.45, 3.15);
      }
      controls.update();

      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(tick);
    };

    tick(performance.now());

    return () => {
      isDisposed = true;
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      timer.dispose();

      controls.dispose();
      controlsRef.current = null;
      pad.dispose();
      padRef.current = null;
      cameraRef.current = null;
      syncedModelRef.current = null;

      scene.clear();
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [isVisible]);

  // Sync model preset BEFORE activeLayerIndex so layer visibility is up-to-date
  useEffect(() => {
    const pad = padRef.current;
    if (!pad || syncedModelRef.current === activeModelKey) return;
    syncedModelRef.current = activeModelKey;
    if (activeModelKey === "puffy-monarch") {
      pad.updateModel("royal");
      pad.switchMattressModel("puffy-monarch");
    } else {
      pad.updateModel(activeModelKey);
    }
  }, [activeModelKey]);

  // Sync active layer index
  useEffect(() => {
    const pad = padRef.current;
    if (!pad) return;
    pad.setActiveLayerIndex(resolveSafeLayerIndex(activeLayerIndex, activeModelKey));
  }, [activeLayerIndex, activeModelKey]);

  // Sync exploded state
  useEffect(() => {
    const pad = padRef.current;
    if (!pad) return;
    pad.setExplodedFactor(isExploded ? 1.0 : 0.65);
  }, [isExploded]);

  // Reset camera pose on reset signal
  useEffect(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const pad = padRef.current;
    if (!camera || !pad) return;
    camera.position.set(2.25, 1.45, 3.15);
    if (controls) {
      controls.target.set(0, 0.22, 0.02);
      controls.update();
    } else {
      camera.lookAt(0, 0.22, 0.02);
    }
    pad.group.rotation.set(0.04, 0.0, 0.0);
  }, [resetSignal]);

  return (
    <div
      ref={containerRef}
      className="craft-cream-3d-viewport"
      aria-label="Interactive 3D Mattress Layer Cutaway"
    />
  );
}
