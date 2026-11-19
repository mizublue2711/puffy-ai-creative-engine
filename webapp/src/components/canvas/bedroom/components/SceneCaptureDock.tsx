import React from 'react';
import * as THREE from 'three';
import { useBannerStore } from '../../../../store/useBannerStore.ts';
import { useBedroomConfigStore } from '../../../../store/useBedroomConfigStore.ts';
import { useShowroomViewStore } from '../../../../store/useShowroomViewStore.ts';

export interface SceneCaptureDockProps {
  // Classic snapshot & video recording props
  isRecording?: boolean;
  recordingProgress?: number;
  onSnapshot?: () => void;
  onRecord?: () => void;
  pendingSnapshot?: string | null;
  onDownloadSnapshot?: () => void;
  onOpenInStudio?: () => void;
  onDismissSnapshot?: () => void;
  renderer?: THREE.WebGLRenderer | null;
  scene?: THREE.Scene | null;
  camera?: THREE.Camera | null;
  logoBadgeGroup?: THREE.Object3D | null;
  resolution?: { width: number; height: number };
  onStudioCapture?: (result: { passA: string; passB: string; timestamp: number }) => void | Promise<void>;
  onStudioCaptureStart?: () => void;
  onStudioCaptureComplete?: (result: { passA: string; passB: string; timestamp: number }) => void;
  isStudioCapturing?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const PuffyCameraIcon = ({ className = 'w-5 h-5', active = false }: { className?: string; active?: boolean }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="puffy-camera-grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
        <stop stopColor="#38BDF8" />
        <stop offset="1" stopColor="#818CF8" />
      </linearGradient>
    </defs>
    <path
      d="M7.5 7L8.8 4.6C9.2 4.2 9.8 4 10.4 4H13.6C14.2 4 14.8 4.2 15.2 4.6L16.5 7"
      stroke={active ? 'url(#puffy-camera-grad)' : 'currentColor'}
      strokeWidth="1.75"
      strokeLinecap="round"
    />
    <rect
      x="3"
      y="7"
      width="18"
      height="13"
      rx="4.5"
      stroke={active ? 'url(#puffy-camera-grad)' : 'currentColor'}
      strokeWidth="1.75"
    />
    <circle
      cx="12"
      cy="13.5"
      r="3.5"
      stroke={active ? 'url(#puffy-camera-grad)' : 'currentColor'}
      strokeWidth="1.75"
    />
    <circle cx="17" cy="10" r="0.75" fill={active ? '#38BDF8' : 'currentColor'} />
  </svg>
);

export const PuffyResolutionIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <rect x="3.5" y="5" width="17" height="14" rx="3.5" stroke="currentColor" strokeWidth="1.75" strokeDasharray="3 2" />
    <path d="M8 10L10 8M10 8H8.5M10 8V9.5" stroke="#38BDF8" strokeWidth="1.75" strokeLinecap="round" />
    <path d="M16 14L14 16M14 16H15.5M14 16V14.5" stroke="#818CF8" strokeWidth="1.75" strokeLinecap="round" />
  </svg>
);

export const PuffyGalleryIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="4" width="14" height="14" rx="3.5" stroke="currentColor" strokeWidth="1.75" />
    <path d="M7 14L10 11L14 15" stroke="#38BDF8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M7 8H7.01" stroke="#818CF8" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M7 20H17.5C19.4 20 21 18.4 21 16.5V7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" opacity="0.4" />
  </svg>
);

export const PuffyVideoRecordIcon = ({ className = 'w-5 h-5', active = false }: { className?: string; active?: boolean }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="puffy-video-grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
        <stop stopColor="#38BDF8" />
        <stop offset="1" stopColor="#818CF8" />
      </linearGradient>
    </defs>
    <rect
      x="3"
      y="6"
      width="12"
      height="12"
      rx="3"
      stroke={active ? 'url(#puffy-video-grad)' : 'currentColor'}
      strokeWidth="1.75"
    />
    <path
      d="M15 10L19.2 7.6C19.8 7.2 20.5 7.7 20.5 8.4V15.6C20.5 16.3 19.8 16.8 19.2 16.4L15 14"
      stroke={active ? 'url(#puffy-video-grad)' : 'currentColor'}
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M8 9.5L11 12L8 14.5V9.5Z"
      fill={active ? 'url(#puffy-video-grad)' : 'currentColor'}
      opacity="0.85"
    />
  </svg>
);

/**
 * Execute Two-Pass Synchronous Studio Capture via Three.js Layers:
 * Pass A: Complete bedroom/mattress 3D render with the brand badge intact (`camera.layers.enableAll()`),
 *         preserving standard background and lighting.
 * Pass B: Isolated 3D perspective brand badge rendered on Layer 1 (`camera.layers.set(1)`)
 *         with scene lights enabled on Layer 1 and pure transparent alpha (`scene.background = null`,
 *         `renderer.setClearColor(0x000000, 0)`).
 * Zero-drift guarantee: Both passes rendered synchronously in the same animation frame
 * before restoring camera layers, background, and clear state to ensure 0-pixel projection drift.
 */
export const executeTwoPassCapture = async (
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  logoBadgeGroup: THREE.Object3D | null,
  resolution = { width: 2048, height: 2048 }
): Promise<{ passA: string; passB: string }> => {
  if (
    !Number.isSafeInteger(resolution.width) ||
    !Number.isSafeInteger(resolution.height) ||
    resolution.width < 1 ||
    resolution.height < 1
  ) {
    throw new Error('Capture dimensions must be positive whole numbers.');
  }

  const originalSize = new THREE.Vector2();
  renderer.getSize(originalSize);
  const originalPixelRatio = renderer.getPixelRatio();
  const originalClearColor = new THREE.Color();
  const originalClearAlpha = renderer.getClearAlpha();
  renderer.getClearColor(originalClearColor);
  const originalBackground = scene.background;
  const perspectiveCamera = camera instanceof THREE.PerspectiveCamera ? camera : null;
  const originalAspect = perspectiveCamera?.aspect;

  // Ensure main directional & ambient lights participate in Layer 1
  scene.traverse((obj) => {
    if ((obj as THREE.Light).isLight) {
      obj.layers.enable(1);
    }
  });

  // Safety net: ensure at least one visible mesh participates in Layer 1
  const layer1 = new THREE.Layers();
  layer1.set(1);
  let hasVisibleLayer1Mesh = false;
  scene.traverse((obj) => {
    if (hasVisibleLayer1Mesh) return;
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.layers.test(layer1)) return;
    let ancestor: THREE.Object3D | null = mesh;
    let visibleInHierarchy = true;
    while (ancestor) {
      if (!ancestor.visible) {
        visibleInHierarchy = false;
        break;
      }
      ancestor = ancestor.parent;
    }
    if (visibleInHierarchy) {
      hasVisibleLayer1Mesh = true;
    }
  });

  if (!hasVisibleLayer1Mesh && logoBadgeGroup) {
    logoBadgeGroup.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        obj.layers.enable(0);
        obj.layers.enable(1);
      }
    });
  }

  let passADataUrl = '';
  let passBDataUrl = '';

  try {
    renderer.setPixelRatio(1);
    renderer.setSize(resolution.width, resolution.height, false);

    if (perspectiveCamera) {
      perspectiveCamera.aspect = resolution.width / resolution.height;
      perspectiveCamera.updateProjectionMatrix();
    }

    camera.updateMatrixWorld(true);

    // --- PASS A: COMPLETE BEDROOM SCENE ---
    camera.layers.enableAll(); // Render room + mattress + badge
    scene.background = originalBackground;
    renderer.setClearColor(0x000000, 1);
    renderer.render(scene, camera);
    passADataUrl = renderer.domElement.toDataURL('image/png');

    // --- PASS B: ISOLATED 3D PERSPECTIVE BADGE ---
    camera.layers.set(1); // ONLY render objects on Layer 1 (Badge + Lights)
    scene.background = null; // Critical: prevent scene.background color from overwriting alpha=0
    renderer.setClearColor(0x000000, 0); // Pure transparent alpha
    renderer.clear();
    renderer.render(scene, camera);
    passBDataUrl = renderer.domElement.toDataURL('image/png');
  } finally {
    camera.layers.enableAll();
    scene.background = originalBackground;
    renderer.setClearColor(originalClearColor, originalClearAlpha);

    if (perspectiveCamera && originalAspect !== undefined) {
      perspectiveCamera.aspect = originalAspect;
      perspectiveCamera.updateProjectionMatrix();
    }

    camera.updateMatrixWorld(true);
    renderer.setPixelRatio(originalPixelRatio);
    renderer.setSize(originalSize.x, originalSize.y, false);
    renderer.render(scene, camera);
  }

  return { passA: passADataUrl, passB: passBDataUrl };
};

/**
 * Download a data URL string as a named file in the client browser.
 */
export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Traverse a Three.js scene to locate the active Puffy brand badge mesh or group.
 */
export function findLogoBadgeObject(
  scene: THREE.Scene,
  activeVariant?: string,
): THREE.Object3D | null {
  const candidates: Array<{
    mesh: THREE.Mesh;
    material: THREE.Material | null;
    mapSrc: string;
    score: number;
    isVisible: boolean;
  }> = [];

  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;

    const meshName = mesh.name.toLowerCase();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    let bestMaterialMatch: {
      material: THREE.Material | null;
      mapSrc: string;
      score: number;
    } | null = null;

    for (const material of materials) {
      const materialName = material.name.toLowerCase();
      const mappedMaterial = material as THREE.Material & { map?: THREE.Texture | null };
      const texture = mappedMaterial.map;
      const image = texture?.image as { currentSrc?: string; src?: string } | undefined;
      const mapSrc = [
        image?.currentSrc,
        image?.src,
        texture?.name,
      ]
        .filter((source): source is string => Boolean(source))
        .join(' ')
        .toLowerCase();
      const materialHasBadgeSignal =
        materialName.includes('badge') ||
        materialName.includes('logo') ||
        mapSrc.includes('badge') ||
        mapSrc.includes('logo');

      if (!materialHasBadgeSignal) continue;

      const score =
        (materialName.includes('mat_brand_badge') ? 12 : 0) +
        (materialName.includes('badge') ? 8 : 0) +
        (materialName.includes('logo') ? 6 : 0) +
        (mapSrc.includes('badge') ? 8 : 0) +
        (mapSrc.includes('logo') ? 6 : 0) +
        (mapSrc.includes('01_basecolor') ? 2 : 0) +
        (materialName.includes('lux') || mapSrc.includes('lux') ? 1 : 0);

      if (!bestMaterialMatch || score > bestMaterialMatch.score) {
        bestMaterialMatch = { material, mapSrc, score };
      }
    }

    const meshHasBadgeSignal =
      meshName === 'puffybrandbadgemesh' ||
      meshName.includes('puffy-embroidered-badge') ||
      meshName.includes('mat_brand_badge') ||
      meshName.includes('badge') ||
      meshName.includes('logo');
    if (!meshHasBadgeSignal && !bestMaterialMatch) return;

    let isVisible = true;
    let ancestor: THREE.Object3D | null = mesh;
    while (ancestor && ancestor !== scene) {
      isVisible &&= ancestor.visible;
      ancestor = ancestor.parent;
    }

    const variantSignal = activeVariant
      ? [meshName, bestMaterialMatch?.material?.name.toLowerCase(), bestMaterialMatch?.mapSrc]
          .filter(Boolean)
          .join(' ')
          .includes(activeVariant.toLowerCase())
      : false;
    const score =
      (meshName === 'puffybrandbadgemesh' ? 32 : 0) +
      (meshName.includes('puffy-embroidered-badge') ? 16 : 0) +
      (meshName.includes('mat_brand_badge') ? 12 : 0) +
      (meshName.includes('badge') ? 8 : 0) +
      (meshName.includes('logo') ? 6 : 0) +
      (bestMaterialMatch?.score ?? 0) +
      (variantSignal ? 24 : 0);
    candidates.push({
      mesh,
      material: bestMaterialMatch?.material ?? null,
      mapSrc: bestMaterialMatch?.mapSrc ?? '',
      score,
      isVisible,
    });
  });

  const bestCandidate = candidates.sort(
    (candidate, selected) =>
      Number(selected.isVisible) - Number(candidate.isVisible) ||
      selected.score - candidate.score,
  )[0];

  if (bestCandidate) {
    console.log(
      '🎯 [Found Badge Mesh via Material]:',
      bestCandidate.mesh.name,
      'Material:',
      bestCandidate.material?.name,
      'Map:',
      bestCandidate.mapSrc,
    );
    return bestCandidate.mesh;
  }

  return null;
}

// UI STYLES (Apple VisionOS / Cybernetic Minimalist Glassmorphism per ui-rules.md)
const dockContainerStyle: React.CSSProperties = {
  position: 'absolute',
  right: 16,
  bottom: 16,
  zIndex: 30,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: 8,
  pointerEvents: 'none',
  fontFamily: 'Inter, "SF Pro Display", system-ui, sans-serif',
};

const capsuleRowStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 8px',
  borderRadius: 9999,
  backgroundColor: 'rgba(18, 20, 26, 0.82)',
  backdropFilter: 'blur(20px) saturate(160%)',
  WebkitBackdropFilter: 'blur(20px) saturate(160%)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.28)',
  pointerEvents: 'auto',
};

const circleBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 36,
  height: 36,
  borderRadius: 9999,
  border: '1px solid rgba(255, 255, 255, 0.14)',
  fontSize: 18,
  cursor: 'pointer',
  background: 'rgba(255, 255, 255, 0.10)',
  color: '#fff',
  transition: 'all 0.2s ease',
};

const studioBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  height: 36,
  padding: '0 14px',
  borderRadius: 9999,
  border: '1px solid rgba(255, 255, 255, 0.18)',
  background: 'rgba(255, 255, 255, 0.14)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  color: '#ffffff',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.02em',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  transition: 'all 0.2s ease',
};

const modalRowStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 12,
  borderRadius: 16,
  backgroundColor: 'rgba(18, 20, 26, 0.90)',
  backdropFilter: 'blur(20px) saturate(160%)',
  WebkitBackdropFilter: 'blur(20px) saturate(160%)',
  border: '1px solid rgba(255, 255, 255, 0.15)',
  boxShadow: '0 12px 32px rgba(0, 0, 0, 0.40)',
  color: '#fff',
  fontSize: 12,
  pointerEvents: 'auto',
};


export function SceneCaptureDock({
  isRecording = false,
  recordingProgress = 0,
  onSnapshot,
  onRecord,
  pendingSnapshot,
  onDownloadSnapshot,
  onOpenInStudio,
  onDismissSnapshot,
  renderer,
  scene,
  camera,
  logoBadgeGroup,
  resolution,
  onStudioCapture,
  onStudioCaptureStart,
  onStudioCaptureComplete,
  isStudioCapturing = false,
  className,
  style,
}: SceneCaptureDockProps) {
  const [isCapturingStudioPasses, setIsCapturingStudioPasses] = React.useState(false);
  const hasTwoPassCaptureInputs = Boolean(renderer && scene && camera);
  const isCaptureDisabled = isStudioCapturing || isCapturingStudioPasses;

  const handleCameraClick = async () => {
    if (isCaptureDisabled) return;
    if (!renderer || !scene || !camera) {
      onSnapshot?.();
      return;
    }

    setIsCapturingStudioPasses(true);
    try {
      onStudioCaptureStart?.();
      const activeVariant = useBedroomConfigStore.getState().activeMattress;
      const activeBadge =
        scene.getObjectByName('PuffyBrandBadgeMesh') ??
        findLogoBadgeObject(scene, activeVariant) ??
        logoBadgeGroup ??
        null;
      const captureResolution = resolution ?? { width: 2048, height: 2048 };
      const { passA, passB } = await executeTwoPassCapture(
        renderer,
        scene,
        camera,
        activeBadge,
        captureResolution,
      );
      const timestamp = Date.now();
      useShowroomViewStore.getState().setStudioPasses(passA, passB);
      useBannerStore.getState().setBackgroundImage(passA);
      useShowroomViewStore.getState().setActiveView('studio');
      const captureResult = { passA, passB, timestamp };
      await onStudioCapture?.(captureResult);
      onStudioCaptureComplete?.(captureResult);
    } catch (error) {
      console.error('Failed to capture the two-pass studio scene.', error);
    } finally {
      setIsCapturingStudioPasses(false);
    }
  };

  return (
    <div
      style={{ ...dockContainerStyle, ...style }}
      className={className}
      data-testid="scene-capture-dock"
    >

      {/* 1. Pending Snapshot Modal (WebP snapshot preview) */}
      {pendingSnapshot && (
        <div
          role="dialog"
          aria-label="Snapshot ready"
          style={modalRowStyle}
        >
          <img
            src={pendingSnapshot}
            alt="Snapshot preview"
            style={{ width: 180, borderRadius: 8 }}
          />
          <button
            type="button"
            style={{ ...studioBtnStyle, height: 32, padding: '0 12px' }}
            onClick={(e) => {
              e.stopPropagation();
              onDownloadSnapshot?.();
            }}
          >
            Download WebP
          </button>
          <button
            type="button"
            style={{
              ...studioBtnStyle,
              height: 32,
              padding: '0 12px',
              backgroundColor: '#067A57',
            }}
            onClick={(e) => {
              e.stopPropagation();
              onOpenInStudio?.();
            }}
          >
            <PuffyGalleryIcon />
            <span>Open in Banner Studio</span>
          </button>
          <button
            type="button"
            style={{
              ...studioBtnStyle,
              height: 'auto',
              fontSize: 11,
              background: 'none',
              border: 'none',
              opacity: 0.7,
            }}
            onClick={(e) => {
              e.stopPropagation();
              onDismissSnapshot?.();
            }}
          >
            Close
          </button>
        </div>
      )}

      {/* 2. Recording Status Progress Pill */}
      {isRecording && (
        <div
          role="status"
          style={{
            ...modalRowStyle,
            gap: 4,
            padding: '8px 12px',
          }}
        >
          <span>Recording Cinematic... {Math.round(recordingProgress * 100)}%</span>
          <div
            style={{
              height: 4,
              borderRadius: 2,
              backgroundColor: 'rgba(255,255,255,0.25)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.round(recordingProgress * 100)}%`,
                borderRadius: 2,
                backgroundColor: '#ff6b6b',
                transition: 'width 0.1s linear',
              }}
            />
          </div>
        </div>
      )}

      {/* 3. Horizontal Capsule Dock Controls */}
      <div style={capsuleRowStyle}>
        {(onSnapshot || hasTwoPassCaptureInputs) && (
          <button
            type="button"
            style={{
              ...circleBtnStyle,
              filter: 'drop-shadow(0 0 8px rgba(56, 189, 248, 0.40))',
              color: '#38BDF8',
              opacity: isCaptureDisabled ? 0.5 : 1,
            }}
            title={onSnapshot ? 'Capture Snapshot (.webp)' : 'Capture two-pass studio scene'}
            aria-label={onSnapshot ? 'Capture Snapshot (.webp)' : 'Capture two-pass studio scene'}
            disabled={isCaptureDisabled}
            onClick={(e) => {
              e.stopPropagation();
              void handleCameraClick();
            }}
          >
            <PuffyCameraIcon className="w-5 h-5" active />
          </button>
        )}

        {onRecord && (
          <button
            type="button"
            style={{
              ...circleBtnStyle,
              opacity: isRecording ? 0.5 : 1,
              filter: isRecording ? 'drop-shadow(0 0 8px rgba(56, 189, 248, 0.4))' : 'none',
              color: isRecording ? '#38BDF8' : 'rgba(255, 255, 255, 0.65)',
            }}
            title="Record Cinematic 360° (.webm)"
            aria-label="Record Cinematic 360° (.webm)"
            disabled={isRecording}
            onClick={(e) => {
              e.stopPropagation();
              onRecord();
            }}
          >
            <PuffyVideoRecordIcon className="w-5 h-5" active={isRecording} />
          </button>
        )}
      </div>
    </div>
  );
}

export default SceneCaptureDock;

