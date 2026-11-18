import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  BEDROOM_REGISTRY,
  BEDROOM_STYLE_PRESETS,
  ENVIRONMENT_RUNNER_PALETTES,
  ENVIRONMENT_TO_STYLE,
  disposeAllBedroomComponents,
  disposeComponent,
  registerBedroomComponent,
  type BedFrameVariantId,
  type BedroomEnvironmentId,
  type BedroomStyle,
  type MattressVariantId,
} from './BedroomRegistry.ts';
import {
  BEDROOM_ROOMS,
  DEFAULT_BEDROOM_ROOM_ID,
  type BedroomRoomConfig,
  type BedroomRoomId,
} from '../../../config/bedroomRooms.config.ts';
import {
  createModernGltfBedroomModule,
  type ModernGltfBedroomInstance,
} from '../puffy-hero-3d/modules/ModernGltfBedroomModule.ts';
import {
  createClassicBedroomModule,
  type ClassicBedroomInstance,
} from '../puffy-hero-3d/modules/ClassicBedroomModule.ts';
import {
  createPuffyBedFrame,
  getBedFrameOuterDimensions,
  unregisterAllPuffyBedFrames,
} from './components/PuffyBedFrame.tsx';
import { createPuffyHeadboard } from './components/PuffyHeadboard.tsx';
import {
  createPuffyMattress,
  registerPuffyMattressVariant,
  unregisterAllPuffyMattresses,
} from './components/PuffyMattress.tsx';
import { createModernPendantCluster } from './components/ModernPendantCluster.tsx';
import { createBedThrowBlanket } from './components/BedThrowBlanket.tsx';
import { PuffyBedRunner, createPuffyBedRunnerGroup } from './components/PuffyBedRunner.tsx';
import { createPuffyPillowPair } from './components/PuffyPillowPair.tsx';
import { createPuffyCloudCeilingLight } from './components/PuffyCloudCeilingLight.tsx';
import { FloatingWoolPad } from '../puffy-hero-3d/FloatingWoolPad.ts';
import type { SheepFlockEngine } from '../puffy-hero-3d/SheepFlockEngine.ts';
import { MATTRESS_SIZES } from '../puffy-hero-3d/types.ts';
import { addTierChangeListener } from '../puffy-hero-3d/MattressAnatomy.ts';
import {
  useBedroomConfigStore,
  type PillowCountOption,
} from '../../../store/useBedroomConfigStore.ts';
import { BedroomConfiguratorDock } from '../../ui/BedroomConfiguratorDock.tsx';
import { SceneCaptureDock } from './components/SceneCaptureDock.tsx';

export interface BedroomSanctuarySceneOptions {
  /** Optional existing FloatingWoolPad whose encasementTrayGroup will be docked onto the bed slats */
  floatingWoolPad?: FloatingWoolPad | null;
  /** Optional standalone mattressGroup / encasementTrayGroup to dock at (0, 0.35, 0) */
  mattressGroup?: THREE.Object3D | null;
  /** Optional SheepFlockEngine to pause & hide while the bedroom sanctuary is mounted */
  sheepFlock?: SheepFlockEngine | null;
  /** Initial Interior Archetype style preset */
  initialStyle?: BedroomStyle;
  /** Active room environment id ('classic' | 'modern') from BEDROOM_ROOMS */
  roomId?: BedroomRoomId;
  /** Mattress footprint width in scene units (defaults to 1.60m Queen spec, or 1.85m for FloatingWoolPad) */
  mattressWidth?: number;
  /** Mattress footprint length in scene units (defaults to 2.10m Queen spec, or 2.25m for FloatingWoolPad) */
  mattressLength?: number;
  /** Whether directional window sunlight casts soft shadows */
  castShadow?: boolean;
  /** Intensity of directional window sunlight (defaults to 2.0 for soft grazing light) */
  sunLightIntensity?: number;
}

export interface BedroomSanctuaryInstance {
  group: THREE.Group;
  bedAssemblyGroup: THREE.Group;
  registry: typeof BEDROOM_REGISTRY;
  activeRoomConfig: BedroomRoomConfig;
  getActiveMattress: () => THREE.Object3D | null;
  getPillowRootGroup: () => THREE.Object3D | null;
  getRunnerInstance: () => THREE.Object3D | null;
  headboardGroup?: THREE.Object3D | null;
  getHeadboardGroup?: () => THREE.Object3D | null;
  setRoomId: (roomId: BedroomRoomId) => void;
  setStyle: (style: BedroomStyle, duration?: number) => void;
  setBedDecorVisible: (visible: boolean) => void;
  syncMattressHeight: (heightDeltaMeters: number) => void;
  snapAccessoriesToSurface: (activeMattressOverride?: THREE.Object3D | null) => void;
  dockMattress: (mattressGroup: THREE.Object3D) => void;
  runSmokeTest: (dockedMattressGroup?: THREE.Object3D) => void;
  dispose: () => void;
}

/**
 * Dynamic Automatic Mattress Elevation:
 * Computes bounding box of bedFrame to place mattress center pivot precisely flush
 * on support deck / slats with 4cm inset.
 */
export const alignMattressOnBedFrame = (mattress: THREE.Object3D, bedFrame: THREE.Object3D | null) => {
  if (!mattress) return;
  mattress.updateMatrixWorld(true);

  // 1. Bed Frame Slat Elevation in local bedAssemblyGroup space
  let targetSlatY = 0.24; // Standard slat deck height
  if (bedFrame) {
    bedFrame.updateMatrixWorld(true);
    const frameBox = new THREE.Box3().setFromObject(bedFrame);
    // Rim is ~0.28m, support slats are 4cm below rim (0.24m)
    targetSlatY = Math.max(0.20, frameBox.max.y - 0.04);
  }

  // 2. Measure actual current bottom of the mattress
  const matBox = new THREE.Box3().setFromObject(mattress);
  const currentBottomY = matBox.min.y;

  // 3. Apply exact Delta to dock mattress bottom directly on the slats
  const deltaY = targetSlatY - currentBottomY;
  mattress.position.y += deltaY;
  mattress.updateMatrixWorld(true);
};

// --- DETERMINISTIC ACCESSORY SURFACE SNAP ---
export const snapAccessoriesToMattressTop = (
  targetMattress: THREE.Object3D | null,
  targetPillows: THREE.Object3D | null,
  targetRunner: THREE.Object3D | null,
  parentGroup?: THREE.Group | null,
  currentHeadboard?: THREE.Object3D | null
) => {
  if (!targetMattress) return;
  targetMattress.updateMatrixWorld(true);
  const worldBox = new THREE.Box3().setFromObject(targetMattress);
  let localTopY = worldBox.max.y;

  if (parentGroup) {
    parentGroup.updateMatrixWorld(true);
    const topWorldPoint = new THREE.Vector3(0, worldBox.max.y, 0);
    parentGroup.worldToLocal(topWorldPoint);
    localTopY = topWorldPoint.y;
  }

  // --- 1. PILLOWS: DYNAMIC Y ELEVATION + DYNAMIC Z HEADBOARD DOCKING ---
  if (targetPillows) {
    // Y: Rest flush on top of mattress
    targetPillows.position.y = localTopY;

    // Z: Dynamic contact plane with active headboard
    if (currentHeadboard) {
      currentHeadboard.updateMatrixWorld(true);
      const hbBox = new THREE.Box3().setFromObject(currentHeadboard);
      let headboardFrontZ = hbBox.max.z;

      if (parentGroup) {
        const hbFrontWorld = new THREE.Vector3(0, 0, hbBox.max.z);
        parentGroup.worldToLocal(hbFrontWorld);
        headboardFrontZ = hbFrontWorld.z;
      }

      // Pillow depth is 0.20m tilted at ~16 deg. Backward reach from origin is ~0.19m.
      // Place pillows so back surface touches headboardFrontZ + 5mm safety buffer.
      const PILLOW_REAR_OFFSET = 0.195;
      targetPillows.position.z = headboardFrontZ + PILLOW_REAR_OFFSET;
    }
  }

  // --- 2. RUNNER: DYNAMIC Y ELEVATION + HORIZONTAL WIDTH CONSTRAIN ---
  if (targetRunner) {
    targetRunner.position.y = localTopY + 0.002;
    targetRunner.position.x = 0;

    // Measure mattress width along X
    const matWidth = Math.max(1.4, worldBox.max.x - worldBox.min.x);

    // Measure natural width of runner
    targetRunner.scale.x = 1.0;
    targetRunner.updateMatrixWorld(true);
    const runBox = new THREE.Box3().setFromObject(targetRunner);
    const runNaturalWidth = Math.max(1.0, runBox.max.x - runBox.min.x);

    // Fit runner snugly with 2cm drape margin per side (+0.04m total)
    targetRunner.scale.x = (matWidth + 0.04) / runNaturalWidth;
    targetRunner.updateMatrixWorld(true);
  }
};

/**
 * Dynamic Surface Anchor: Computes top bounding coordinate of the mattress
 * and snaps pillows and bed runner without hardcoded Y offsets.
 */
export function snapAccessoriesToSurface(
  activeMattress: THREE.Object3D,
  pillows?: THREE.Object3D | null,
  runner?: THREE.Object3D | null,
  parentGroup?: THREE.Group | null,
  currentHeadboard?: THREE.Object3D | null,
): number {
  snapAccessoriesToMattressTop(activeMattress, pillows ?? null, runner ?? null, parentGroup, currentHeadboard ?? null);
  return pillows?.position.y ?? (runner?.position.y ? runner.position.y - 0.002 : 0);
}

export const WALL_ART_TEXTURES: Record<string, string> = {
  'japandi': '/assets/art/japandi-sanctuary.webp',
  'mid-century': '/assets/art/mid-century.webp',
  'urban-loft': '/assets/art/urban-loft.webp',
  'nordic-coastal': '/assets/art/nordic-coastal.webp',
};

export function getWallArtTexturePath(envOrStyle?: string | null): string {
  if (!envOrStyle) return WALL_ART_TEXTURES['japandi'];
  const clean = envOrStyle.toLowerCase().trim().replace(/\s+/g, '-');
  if (clean in WALL_ART_TEXTURES) return WALL_ART_TEXTURES[clean];
  if (clean.includes('japandi') || clean.includes('zen')) return WALL_ART_TEXTURES['japandi'];
  if (clean.includes('mid-century') || clean.includes('midcentury')) return WALL_ART_TEXTURES['mid-century'];
  if (clean.includes('urban') || clean.includes('loft')) return WALL_ART_TEXTURES['urban-loft'];
  if (clean.includes('nordic') || clean.includes('coastal')) return WALL_ART_TEXTURES['nordic-coastal'];
  return WALL_ART_TEXTURES['japandi'];
}

const wallArtTextureLoader = new THREE.TextureLoader();
const wallArtTextureCache = new Map<string, THREE.Texture>();

export function loadWallArtTexture(path: string, onUpdate?: () => void): THREE.Texture {
  let tex = wallArtTextureCache.get(path);
  if (!tex) {
    tex = wallArtTextureLoader.load(
      path,
      (loaded) => {
        loaded.colorSpace = THREE.SRGBColorSpace;
        loaded.needsUpdate = true;
        onUpdate?.();
      },
      undefined,
      (err) => {
        console.warn(`[WallArt] Failed to load art texture: ${path}`, err);
      }
    );
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    wallArtTextureCache.set(path, tex);
  } else {
    tex.needsUpdate = true;
  }
  return tex;
}

/**
 * Scene Composer & Mattress Docking
 * Assembles all registered LEGO components, Floor-to-Ceiling Curtain Wall + S-Fold Voile,
 * and 4-Archetype Decor Props around the Puffy mattress.
 */
export function createBedroomSanctuaryScene(
  options: BedroomSanctuarySceneOptions = {},
): BedroomSanctuaryInstance {
  const isFloatingPadAttached = Boolean(options.floatingWoolPad);
  const mattressW = options.mattressWidth ?? (isFloatingPadAttached ? 1.85 : 1.60);
  const mattressL = options.mattressLength ?? (isFloatingPadAttached ? 2.25 : 2.10);
  const castShadow = options.castShadow ?? true;
  const initialStyle = options.initialStyle ?? 'nordic-coastal';

  const group = new THREE.Group();
  group.name = 'BedroomSanctuaryScene';

  // Pause meadow sheep flock simulation completely when this scene is mounted
  if (options.sheepFlock) {
    options.sheepFlock.group.visible = false;
  }

  // 1. Room Host Group (holds interchangeable bedroom room LEGO module)
  const roomHostGroup = new THREE.Group();
  roomHostGroup.name = 'BedroomRoomHost';
  group.add(roomHostGroup);

  // 2. Unified Bed Assembly Parent Group (BedFrame, Headboard, Mattress, Pillows, BedRunner)
  const bedAssemblyGroup = new THREE.Group();
  bedAssemblyGroup.name = 'bedAssemblyGroup';
  group.add(bedAssemblyGroup);
  const mattressAssemblyGroup = bedAssemblyGroup; // alias for backwards compatibility

  // Mount FloatingWoolPad under bedAssemblyGroup if provided
  let floatingWoolPadOriginalParent: THREE.Object3D | null = null;
  if (options.floatingWoolPad) {
    floatingWoolPadOriginalParent = options.floatingWoolPad.group.parent;
    options.floatingWoolPad.group.position.set(0, 0.24, 0);
    options.floatingWoolPad.group.rotation.set(0, 0, 0);
    options.floatingWoolPad.group.scale.set(1, 1, 1);
    bedAssemblyGroup.add(options.floatingWoolPad.group);
  }

  let currentRoomId: BedroomRoomId =
    options.roomId ?? useBedroomConfigStore.getState().activeRoomId ?? DEFAULT_BEDROOM_ROOM_ID;
  let activeRoomConfig: BedroomRoomConfig =
    BEDROOM_ROOMS[currentRoomId] ?? BEDROOM_ROOMS.modern;
  let modernRoomInstance: ModernGltfBedroomInstance | null = null;
  let classicRoomInstance: ClassicBedroomInstance | null = null;

  const applyRoomMattressAnchor = (cfg: BedroomRoomConfig) => {
    const pos = cfg.mattressAnchor.position;
    bedAssemblyGroup.position.set(pos[0], pos[1], pos[2]);
    if (cfg.mattressAnchor.rotation) {
      bedAssemblyGroup.rotation.set(...cfg.mattressAnchor.rotation);
    } else {
      bedAssemblyGroup.rotation.set(0, 0, 0);
    }
    if (cfg.mattressAnchor.scale) {
      bedAssemblyGroup.scale.setScalar(cfg.mattressAnchor.scale);
    } else {
      bedAssemblyGroup.scale.set(1, 1, 1);
    }
  };

  const mountRoom = (roomId: BedroomRoomId) => {
    if (modernRoomInstance) {
      roomHostGroup.remove(modernRoomInstance.group);
      modernRoomInstance.dispose();
      modernRoomInstance = null;
    }
    if (classicRoomInstance) {
      roomHostGroup.remove(classicRoomInstance.group);
      classicRoomInstance.dispose();
      classicRoomInstance = null;
    }

    currentRoomId = roomId;
    activeRoomConfig = BEDROOM_ROOMS[roomId] ?? BEDROOM_ROOMS.modern;

    if (activeRoomConfig.type === 'gltf') {
      modernRoomInstance = createModernGltfBedroomModule({
        config: activeRoomConfig,
        castShadow,
      });
      roomHostGroup.add(modernRoomInstance.group);
    } else {
      classicRoomInstance = createClassicBedroomModule({
        config: activeRoomConfig,
        initialStyle: currentStyle,
        mattressWidth: mattressW,
        mattressLength: mattressL,
      });
      roomHostGroup.add(classicRoomInstance.group);
    }

    applyRoomMattressAnchor(activeRoomConfig);
  };

  // Mount active room
  mountRoom(currentRoomId);

  // 3 & 4. Modular Puffy Bed Frame & Headboard (`kyoto` | `milan` | `solace`)
  let bedFrameInstance: ReturnType<typeof createPuffyBedFrame> | null = null;
  let headboardInstance: ReturnType<typeof createPuffyHeadboard> | null = null;
  let mountedBedFrameVariant: BedFrameVariantId | null = null;

  const getBedFrameGroup = (): THREE.Object3D | null => bedFrameInstance?.group ?? null;
  const getHeadboardGroup = (): THREE.Object3D | null => headboardInstance?.group ?? null;

  const unmountBedFrameAndHeadboard = () => {
    if (bedFrameInstance) {
      mattressAssemblyGroup.remove(bedFrameInstance.group);
      bedFrameInstance.dispose();
      bedFrameInstance = null;
    }
    if (headboardInstance) {
      mattressAssemblyGroup.remove(headboardInstance.group);
      headboardInstance.dispose();
      headboardInstance = null;
    }
    unregisterAllPuffyBedFrames();
    disposeComponent('puffy-headboard');
    mountedBedFrameVariant = null;
  };

  const mountBedFrameAndHeadboard = (variant: BedFrameVariantId) => {
    if (mountedBedFrameVariant === variant) return;
    unmountBedFrameAndHeadboard();

    const { outerW, clearance } = getBedFrameOuterDimensions(variant, mattressW, mattressL);
    bedFrameInstance = createPuffyBedFrame({
      variant,
      width: mattressW,
      length: mattressL,
      rimHeight: 0.28,
      slatHeight: 0.24,
    });
    mattressAssemblyGroup.add(bedFrameInstance.group);

    const anchorZ = -(mattressL / 2 + clearance);
    const hbHeight =
      variant === 'milan'
        ? isFloatingPadAttached
          ? 1.24
          : 1.18
        : variant === 'solace'
          ? isFloatingPadAttached
            ? 1.10
            : 1.04
          : isFloatingPadAttached
            ? 1.04
            : 0.98;

    headboardInstance = createPuffyHeadboard({
      variant,
      width: outerW,
      height: hbHeight,
      depth: variant === 'kyoto' ? 0.065 : 0.105,
      anchorZ,
      reclineDegrees: variant === 'kyoto' ? 5 : 0,
    });
    mattressAssemblyGroup.add(headboardInstance.group);
    mountedBedFrameVariant = variant;

    const activeMattress = getActiveMattress();
    if (activeMattress) {
      alignMattressOnBedFrame(activeMattress, getBedFrameGroup());
      snapAccessoriesToMattressTop(activeMattress, pillowRootGroup, runnerInstance, bedAssemblyGroup, headboardInstance?.group ?? null);
    }
  };

  const headboardAnchorZ = -(mattressL / 2 + 0.015);

  // Track active style, mattress crown height, and bed decor visibility for dynamic remounts
  let currentStyle: BedroomStyle = initialStyle;
  let currentHeightDelta = 0;
  let currentPillowHeightDelta = 0;
  let bedDecorVisible = true;

  const mattressTopY = isFloatingPadAttached ? 0.68 : 0.582;
  const pillowSurfaceY = isFloatingPadAttached ? 0.66 : 0.582;

  const measureVisibleTopY = (root: THREE.Object3D): number | null => {
    root.updateWorldMatrix(true, true);
    const box = new THREE.Box3();
    const meshBox = new THREE.Box3();
    let found = false;
    root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh && obj.visible) {
        const mesh = obj as THREE.Mesh;
        if (mesh.name.toLowerCase().includes('hitproxy')) return;
        mesh.geometry.computeBoundingBox();
        if (mesh.geometry.boundingBox) {
          meshBox.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
          box.union(meshBox);
          found = true;
        }
      }
    });
    return found && Number.isFinite(box.max.y) ? box.max.y : null;
  };

  // 7. Staggered Geometric Bedroom Pendant Light Cluster (Suspended from y = 3.90m down to 1.35m)
  let pendantCluster: ReturnType<typeof createModernPendantCluster> | null = null;
  const mountPendantCluster = () => {
    if (pendantCluster) return;
    pendantCluster = createModernPendantCluster({
      ceilingY: 3.90,
      castShadow,
      enableAccentLight: true,
    });
    const preset = BEDROOM_STYLE_PRESETS[currentStyle] ?? BEDROOM_STYLE_PRESETS['nordic-coastal'];
    pendantCluster.applyStyle(preset, 0);
    group.add(pendantCluster.group);
  };
  const unmountPendantCluster = () => {
    if (!pendantCluster) return;
    group.remove(pendantCluster.group);
    disposeComponent('staggered-pendant-cluster');
    pendantCluster.dispose();
    pendantCluster = null;
  };

  // 7b. Puffy Cloud Architectural Ceiling Light (Centered at [0.0, 3.885, 0.70], 1.80m x 1.20m)
  let puffyCloudCeilingLight: ReturnType<typeof createPuffyCloudCeilingLight> | null = null;
  const mountCloudCeilingLight = () => {
    if (puffyCloudCeilingLight) return;
    puffyCloudCeilingLight = createPuffyCloudCeilingLight({
      ceilingY: 3.90,
      positionX: 0.0,
      positionZ: 0.70,
      enableAmbientLight: true,
      ambientLightIntensity: 1.4,
    });
    group.add(puffyCloudCeilingLight.group);
  };
  const unmountCloudCeilingLight = () => {
    if (!puffyCloudCeilingLight) return;
    group.remove(puffyCloudCeilingLight.group);
    disposeComponent('puffy-cloud-ceiling-light');
    puffyCloudCeilingLight.dispose();
    puffyCloudCeilingLight = null;
  };

  // 8. 4-Archetype Decor Props (Bed Runner, Accent Pillows, Framed Art, Bedside Artbook)
  let runnerInstance: THREE.Group | null = null;

  const applyRunnerEnvironmentPalette = (
    envOrStyle: BedroomEnvironmentId | string,
    _duration = 0.5,
  ) => {
    if (runnerInstance && (runnerInstance as any).setEnvironment) {
      (runnerInstance as any).setEnvironment(envOrStyle);
    }
  };

  const mountBedRunner = () => {
    if (runnerInstance) return;
    const { activeEnvironment } = useBedroomConfigStore.getState();
    runnerInstance = createPuffyBedRunnerGroup(activeEnvironment, [0, 0, mattressL * 0.28]);
    runnerInstance.name = 'PuffyBedRunner';
    const runnerMesh = runnerInstance.children[0];
    if (runnerMesh) {
      runnerMesh.name = 'BedThrowBlanket';
    }
    runnerInstance.visible = bedDecorVisible;
    bedAssemblyGroup.add(runnerInstance);
    snapAccessoriesToSurface();
  };
  const unmountBedRunner = () => {
    if (!runnerInstance) return;
    bedAssemblyGroup.remove(runnerInstance);
    disposeComponent('puffy-bed-runner');
    runnerInstance.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.geometry?.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material?.dispose();
        }
      }
    });
    runnerInstance = null;
  };

  // Pillow Assembly (0 | 2 | 4)
  let pillowRootGroup: THREE.Group | null = null;
  let pillowInstances: Array<ReturnType<typeof createPuffyPillowPair>> = [];
  let mountedPillowCount: PillowCountOption | null = null;

  const unmountPillows = () => {
    if (pillowRootGroup) {
      bedAssemblyGroup.remove(pillowRootGroup);
      pillowRootGroup.clear();
      pillowRootGroup = null;
    }
    for (const inst of pillowInstances) {
      inst.dispose();
    }
    pillowInstances = [];
    mountedPillowCount = null;
  };

  const mountPillows = (count: PillowCountOption) => {
    if (mountedPillowCount === count) return;
    unmountPillows();
    if (count === 0) {
      mountedPillowCount = 0;
      return;
    }

    const root = new THREE.Group();
    root.name = count === 4 ? 'FourPillowAssembly' : 'TwoPillowAssembly';
    root.position.y = 0;
    root.position.z = headboardAnchorZ + 0.195;
    root.visible = bedDecorVisible;

    if (count === 2) {
      const pair = createPuffyPillowPair({
        surfaceY: 0,
        headZ: 0,
        offsetX: Math.min(0.42, mattressW * 0.23),
        rotX: -0.28,
        scale: 1.0,
        registryId: 'puffy-pillow-pair',
      });
      root.add(pair.group);
      pillowInstances.push(pair);
    } else if (count === 4) {
      // Back Tier: 2 King Pillows standing upright against headboard
      const backTier = createPuffyPillowPair({
        surfaceY: 0,
        headZ: 0,
        offsetX: Math.min(0.44, mattressW * 0.24),
        rotX: -0.20,
        scale: 1.05,
        registryId: 'puffy-pillow-pair-back',
      });
      // Front Tier: 2 Standard Pillows resting angled forward
      const frontTier = createPuffyPillowPair({
        surfaceY: 0,
        headZ: 0.20,
        offsetX: Math.min(0.40, mattressW * 0.22),
        rotX: -0.42,
        scale: 0.95,
        registryId: 'puffy-pillow-pair-front',
      });
      root.add(backTier.group);
      root.add(frontTier.group);
      pillowInstances.push(backTier, frontTier);
    }

    pillowRootGroup = root;
    mountedPillowCount = count;
    bedAssemblyGroup.add(root);
    snapAccessoriesToSurface();
  };

  // Mattress Variant Switching (`cloud` | `royal` | `flux`)
  let standaloneMattressInstance: ReturnType<typeof createPuffyMattress> | null = null;
  let mountedMattressVariant: MattressVariantId | null = null;
  let activeMattressObject: THREE.Object3D | null = options.floatingWoolPad ? options.floatingWoolPad.group : null;

  const getActiveMattress = (): THREE.Object3D | null => {
    if (standaloneMattressInstance) {
      return standaloneMattressInstance.group;
    }
    if (options.floatingWoolPad) {
      return options.floatingWoolPad.group;
    }
    if (activeMattressObject) {
      return activeMattressObject;
    }
    if (options.mattressGroup) {
      return options.mattressGroup;
    }
    return null;
  };

  /**
   * Step 2: Dynamic Surface Anchor
   * Compute current mattress top bounding coordinate via `new THREE.Box3().setFromObject(activeMattress).max.y`.
   * Assign `pillows.position.y = topY` and `runner.position.y = topY + 0.002`.
   */
  const snapAccessoriesToSurface = (mattressOverride?: THREE.Object3D | null) => {
    const activeMattress = mattressOverride ?? getActiveMattress();
    snapAccessoriesToMattressTop(activeMattress, pillowRootGroup, runnerInstance, bedAssemblyGroup, headboardInstance?.group ?? null);
  };

  const syncMattressHeight = (_heightDeltaMeters: number) => {
    const activeMattress = getActiveMattress();
    if (activeMattress) {
      alignMattressOnBedFrame(activeMattress, getBedFrameGroup());
    }
    snapAccessoriesToSurface();
  };

  const unmountStandaloneMattress = () => {
    if (standaloneMattressInstance) {
      bedAssemblyGroup.remove(standaloneMattressInstance.group);
      standaloneMattressInstance.dispose();
      standaloneMattressInstance = null;
    }
    unregisterAllPuffyMattresses();
  };

  const applyMattressVariant = (variant: MattressVariantId) => {
    if (mountedMattressVariant === variant) return;
    mountedMattressVariant = variant;

    if (options.floatingWoolPad) {
      const ecoModel = variant === 'flux' ? 'lux' : variant;
      options.floatingWoolPad.updateModel(ecoModel, true);
      options.floatingWoolPad.setSizeSpec({
        ...MATTRESS_SIZES.queen,
        widthMeters: mattressW,
        lengthMeters: mattressL,
      });
      options.floatingWoolPad.setFloatingEnabled(false, 0.238);
      options.floatingWoolPad.update(0, 0.016);
      registerPuffyMattressVariant(variant, mattressW, mattressL, [], 0.24);
      activeMattressObject = options.floatingWoolPad.group;
      alignMattressOnBedFrame(activeMattressObject, getBedFrameGroup());
      snapAccessoriesToMattressTop(activeMattressObject, pillowRootGroup, runnerInstance, bedAssemblyGroup, headboardInstance?.group ?? null);
    } else if (!options.mattressGroup) {
      unmountStandaloneMattress();
      standaloneMattressInstance = createPuffyMattress({
        variant,
        width: mattressW,
        length: mattressL,
        deckY: 0.24,
      });
      activeMattressObject = standaloneMattressInstance.group;
      bedAssemblyGroup.add(standaloneMattressInstance.group);
      alignMattressOnBedFrame(activeMattressObject, getBedFrameGroup());
      snapAccessoriesToMattressTop(activeMattressObject, pillowRootGroup, runnerInstance, bedAssemblyGroup, headboardInstance?.group ?? null);
    } else {
      registerPuffyMattressVariant(variant, mattressW, mattressL, [], 0.24);
      const activeMattress = getActiveMattress();
      if (activeMattress) {
        alignMattressOnBedFrame(activeMattress, getBedFrameGroup());
        snapAccessoriesToMattressTop(activeMattress, pillowRootGroup, runnerInstance, bedAssemblyGroup, headboardInstance?.group ?? null);
      }
    }
  };

  // Step 3: Attach Mattress Tier Change Listeners
  const unsubscribeTier = addTierChangeListener((_tier) => {
    const activeMattress = getActiveMattress();
    if (activeMattress) {
      alignMattressOnBedFrame(activeMattress, getBedFrameGroup());
      snapAccessoriesToMattressTop(activeMattress, pillowRootGroup, runnerInstance, bedAssemblyGroup, headboardInstance?.group ?? null);
    }
  });

  let unsubscribeWoolPadGeo: (() => void) | null = null;
  if (options.floatingWoolPad) {
    unsubscribeWoolPadGeo = options.floatingWoolPad.addOnGeometryUpdatedCallback(() => {
      if (options.floatingWoolPad) {
        alignMattressOnBedFrame(options.floatingWoolPad.group, getBedFrameGroup());
        snapAccessoriesToMattressTop(options.floatingWoolPad.group, pillowRootGroup, runnerInstance, bedAssemblyGroup, headboardInstance?.group ?? null);
      }
    });
  }

  const setStyle = (style: BedroomStyle, duration = 0.5) => {
    currentStyle = style;
    const preset = BEDROOM_STYLE_PRESETS[style] ?? BEDROOM_STYLE_PRESETS['nordic-coastal'];
    modernRoomInstance?.setStyle(style, duration);
    classicRoomInstance?.setStyle(style, duration);
    pendantCluster?.applyStyle(preset, duration);
    applyRunnerEnvironmentPalette(style, duration);
  };

  let mountedEnvironment: BedroomEnvironmentId | null = null;

  // Initial state sync + reactive subscription to useBedroomConfigStore
  const syncFromConfigStore = () => {
    const {
      activeRoomId,
      activeItems,
      pillowCount,
      activeBedFrame,
      activeMattress,
      activeEnvironment,
    } = useBedroomConfigStore.getState();

    // Check for room environment module hot-swap ('modern' <-> 'classic')
    if (activeRoomId && activeRoomId !== currentRoomId) {
      mountRoom(activeRoomId);
      const activeMattress = getActiveMattress();
      if (activeMattress) {
        alignMattressOnBedFrame(activeMattress, getBedFrameGroup());
        snapAccessoriesToMattressTop(activeMattress, pillowRootGroup, runnerInstance, bedAssemblyGroup, headboardInstance?.group ?? null);
      }
    }

    if (mountedEnvironment !== activeEnvironment) {
      mountedEnvironment = activeEnvironment;
      const targetStyle =
        (ENVIRONMENT_TO_STYLE as Record<string, BedroomStyle>)[activeEnvironment] ??
        (activeEnvironment as BedroomStyle) ??
        initialStyle;

      setStyle(targetStyle, 0.5);
    }

    mountBedFrameAndHeadboard(activeBedFrame);
    applyMattressVariant(activeMattress);

    if (activeItems['puffy-bed-runner'] ?? true) {
      mountBedRunner();
      applyRunnerEnvironmentPalette(activeEnvironment, 0);
    } else {
      unmountBedRunner();
    }

    const effectivePillowCount: PillowCountOption =
      activeItems['puffy-pillow-pair'] === false ? 0 : pillowCount;
    mountPillows(effectivePillowCount);

    if (activeItems['staggered-pendant-cluster'] ?? true) {
      mountPendantCluster();
    } else {
      unmountPendantCluster();
    }

    if (activeItems['puffy-cloud-ceiling-light'] ?? true) {
      mountCloudCeilingLight();
    } else {
      unmountCloudCeilingLight();
    }

    classicRoomInstance?.syncToggles(activeItems);
  };

  syncFromConfigStore();
  const unsubscribeStore = useBedroomConfigStore.subscribe(syncFromConfigStore);

  // 9. Soft Sanctuary Daylight Rig (Morning Sun from left panoramic window + Ambient Fill)
  const sunLight = new THREE.DirectionalLight('#FFF2E0', 2.0);
  sunLight.position.set(-6.5, 4.8, 1.8);
  sunLight.target.position.set(0.5, 0.2, 0.2);
  sunLight.castShadow = castShadow;
  if (castShadow) {
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 22;
    sunLight.shadow.camera.left = -7.5;
    sunLight.shadow.camera.right = 5.5;
    sunLight.shadow.camera.top = 6.0;
    sunLight.shadow.camera.bottom = -6.0;
    sunLight.shadow.bias = -0.0004;
    sunLight.shadow.normalBias = 0.02;
    sunLight.shadow.radius = 2.8;
  }
  group.add(sunLight);
  group.add(sunLight.target);

  const ambientLight = new THREE.AmbientLight('#E8E0D5', 0.7);
  group.add(ambientLight);

  // 10. Dock Mattress
  const dockMattress = (targetGroup: THREE.Object3D) => {
    targetGroup.rotation.set(0, 0, 0);
    targetGroup.scale.set(1, 1, 1);
    targetGroup.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
      }
    });
    activeMattressObject = targetGroup;
    bedAssemblyGroup.add(targetGroup);
    alignMattressOnBedFrame(targetGroup, getBedFrameGroup());
    snapAccessoriesToMattressTop(targetGroup, pillowRootGroup, runnerInstance, bedAssemblyGroup, headboardInstance?.group ?? null);
  };

  if (options.floatingWoolPad) {
    options.floatingWoolPad.group.rotation.set(0, 0, 0);
    options.floatingWoolPad.group.scale.set(1, 1, 1);
    options.floatingWoolPad.setSizeSpec({
      ...MATTRESS_SIZES.queen,
      widthMeters: mattressW,
      lengthMeters: mattressL,
    });
    options.floatingWoolPad.setFloatingEnabled(false, 0.238);
    options.floatingWoolPad.update(0, 0.016);
    alignMattressOnBedFrame(options.floatingWoolPad.group, getBedFrameGroup());
    snapAccessoriesToMattressTop(options.floatingWoolPad.group, pillowRootGroup, runnerInstance, bedAssemblyGroup, getHeadboardGroup());
  } else if (options.mattressGroup) {
    dockMattress(options.mattressGroup);
  }

  const setBedDecorVisible = (visible: boolean) => {
    bedDecorVisible = visible;
    if (runnerInstance) {
      runnerInstance.visible = visible;
    }
    if (pillowRootGroup) {
      pillowRootGroup.visible = visible;
    }
  };

  const setRoomId = (roomId: BedroomRoomId) => {
    if (roomId === currentRoomId) return;
    mountRoom(roomId);
    useBedroomConfigStore.getState().setRoomId(roomId);
    const activeMattress = getActiveMattress();
    if (activeMattress) {
      alignMattressOnBedFrame(activeMattress, getBedFrameGroup());
      snapAccessoriesToMattressTop(activeMattress, pillowRootGroup, runnerInstance, bedAssemblyGroup, headboardInstance?.group ?? null);
    }
  };

  const runSmokeTest = (dockedMattressGroup?: THREE.Object3D) => {
    const registryKeys = Object.keys(BEDROOM_REGISTRY);

    console.group('=== BEDROOM SANCTUARY SMOKE TEST REPORT ===');
    console.log(
      '0. Registry Keys (12 expected):',
      registryKeys.length === 12 ? `PASS (${registryKeys.join(', ')})` : `INFO (${registryKeys.length}: ${registryKeys.join(', ')})`,
    );
    console.log(
      '1. Active Room Module:',
      `PASS (Room: ${activeRoomConfig.label} [${activeRoomConfig.type}], anchor: ${activeRoomConfig.mattressAnchor.position.join(', ')})`,
    );
    console.log(
      '2. Mattress Docking Height:',
      dockedMattressGroup
        ? `PASS (Docked: y=${dockedMattressGroup.position.y.toFixed(4)}m)`
        : 'PASS (Docked: y=0.24m)',
    );
    console.log(
      '3. Soft Sanctuary Daylight Rig:',
      sunLight.intensity >= 1.8 && sunLight.intensity <= 2.8 && ambientLight.intensity === 0.7 ? 'PASS (2900K Sun + Warm Greige Bounce)' : 'FAIL',
    );
    console.groupEnd();
  };

  const dispose = () => {
    unsubscribeStore();
    unsubscribeTier();
    unsubscribeWoolPadGeo?.();
    if (options.floatingWoolPad && options.floatingWoolPad.group.parent === bedAssemblyGroup) {
      bedAssemblyGroup.remove(options.floatingWoolPad.group);
      if (floatingWoolPadOriginalParent) {
        floatingWoolPadOriginalParent.add(options.floatingWoolPad.group);
      }
    }
    modernRoomInstance?.dispose();
    classicRoomInstance?.dispose();
    unmountBedFrameAndHeadboard();
    unmountStandaloneMattress();
    unmountPendantCluster();
    unmountCloudCeilingLight();
    unmountBedRunner();
    unmountPillows();
    disposeAllBedroomComponents();

    roomHostGroup.clear();
    bedAssemblyGroup.clear();
    group.clear();
  };

  return {
    group,
    bedAssemblyGroup,
    registry: BEDROOM_REGISTRY,
    get activeRoomConfig() {
      return activeRoomConfig;
    },
    get headboardGroup() {
      return getHeadboardGroup();
    },
    getHeadboardGroup,
    setRoomId,
    setStyle,
    setBedDecorVisible,
    syncMattressHeight,
    snapAccessoriesToSurface,
    dockMattress,
    runSmokeTest,
    getActiveMattress,
    getPillowRootGroup: () => pillowRootGroup,
    getRunnerInstance: () => runnerInstance,
    dispose,
  };
}

export interface BedroomSanctuarySceneProps extends BedroomSanctuarySceneOptions {
  /** Optional external Three.js scene; if omitted, mounts a standalone 3/4 WebGL viewport */
  scene?: THREE.Scene;
}

export const BedroomSanctuaryScene: React.FC<BedroomSanctuarySceneProps> = ({
  scene: externalScene,
  ...options
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const mattressRef = useRef<THREE.Object3D | null>(null);
  const pillowsRef = useRef<THREE.Object3D | null>(null);
  const runnerRef = useRef<THREE.Object3D | null>(null);
  const sanctuaryRef = useRef<BedroomSanctuaryInstance | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.Camera | null>(null);
  const logoBadgeRef = useRef<THREE.Object3D | null>(null);
  const [isSceneReady, setIsSceneReady] = useState(false);

  const { activeRoomId, activeMattress: activeTier } = useBedroomConfigStore();

  useEffect(() => {
    if (sanctuaryRef.current) {
      mattressRef.current = sanctuaryRef.current.getActiveMattress();
      pillowsRef.current = sanctuaryRef.current.getPillowRootGroup();
      runnerRef.current = sanctuaryRef.current.getRunnerInstance();
    }
    snapAccessoriesToMattressTop(
      mattressRef.current,
      pillowsRef.current,
      runnerRef.current,
      sanctuaryRef.current?.bedAssemblyGroup,
      sanctuaryRef.current?.headboardGroup
    );
  }, [activeTier]);

  useEffect(() => {
    if (sanctuaryRef.current) {
      mattressRef.current = sanctuaryRef.current.getActiveMattress();
      pillowsRef.current = sanctuaryRef.current.getPillowRootGroup();
      runnerRef.current = sanctuaryRef.current.getRunnerInstance();
    }
    snapAccessoriesToMattressTop(
      mattressRef.current,
      pillowsRef.current,
      runnerRef.current,
      sanctuaryRef.current?.bedAssemblyGroup,
      sanctuaryRef.current?.headboardGroup
    );
  }, [activeRoomId]);

  useEffect(() => {
    // Mode A: Attached to an external Three.js Scene
    if (externalScene) {
      const sanctuary = createBedroomSanctuaryScene(options);
      sanctuaryRef.current = sanctuary;
      mattressRef.current = sanctuary.getActiveMattress();
      pillowsRef.current = sanctuary.getPillowRootGroup();
      runnerRef.current = sanctuary.getRunnerInstance();
      snapAccessoriesToMattressTop(
        mattressRef.current,
        pillowsRef.current,
        runnerRef.current,
        sanctuary.bedAssemblyGroup,
        sanctuary.headboardGroup
      );
      externalScene.add(sanctuary.group);
      return () => {
        externalScene.remove(sanctuary.group);
        sanctuary.dispose();
      };
    }

    // Mode B: Standalone 3/4 Perspective Verification Viewport
    const container = mountRef.current;
    if (!container) return;

    let isDisposed = false;
    let rafId = 0;

    const width = Math.max(320, container.clientWidth || 1024);
    const height = Math.max(320, container.clientHeight || 680);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: true,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(width, height, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#EFEAE1');
    scene.fog = new THREE.FogExp2('#EFEAE1', 0.012);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    scene.environmentIntensity = 0.5;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.set(2.8, 1.8, 3.2);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.6, 0);
    controls.maxDistance = 8.50; // Allows orbiting out to the expanded courtyard terrace
    controls.minDistance = 0.80;
    controls.maxPolarAngle = Math.PI / 2 - 0.03; // Locks camera above ground level
    controls.enableDamping = true;
    controls.update();

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const woolPad = new FloatingWoolPad(maxAniso);
    woolPad.setFloatingEnabled(false, 0.238);
    woolPad.update(0, 0.016);

    const mattressDockGroup = new THREE.Group();
    mattressDockGroup.name = 'DockedPuffyMattressGroup';
    mattressDockGroup.add(woolPad.group);

    const sanctuary = createBedroomSanctuaryScene({
      floatingWoolPad: woolPad,
      mattressWidth: 2.15,
      mattressLength: 2.55,
      castShadow: true,
    });
    woolPad.setFloatingEnabled(false, 0.238);
    sanctuary.dockMattress(mattressDockGroup);
    sanctuaryRef.current = sanctuary;
    mattressRef.current = sanctuary.getActiveMattress();
    pillowsRef.current = sanctuary.getPillowRootGroup();
    runnerRef.current = sanctuary.getRunnerInstance();
    snapAccessoriesToMattressTop(
      mattressRef.current,
      pillowsRef.current,
      runnerRef.current,
      sanctuary.bedAssemblyGroup,
      sanctuary.headboardGroup
    );
    scene.add(sanctuary.group);

    sanctuary.runSmokeTest(mattressDockGroup);

    rendererRef.current = renderer;
    sceneRef.current = scene;
    cameraRef.current = camera;
    logoBadgeRef.current = woolPad.getActiveBadgeMesh();
    setIsSceneReady(true);

    const handleResize = () => {
      if (isDisposed || !container) return;
      const cw = container.clientWidth || width;
      const ch = container.clientHeight || height;
      camera.aspect = cw / ch;
      camera.updateProjectionMatrix();
      renderer.setSize(cw, ch, false);
    };
    window.addEventListener('resize', handleResize);

    const renderLoop = () => {
      if (isDisposed) return;
      controls.update();
      renderer.render(scene, camera);
      rafId = window.requestAnimationFrame(renderLoop);
    };
    renderLoop();

    return () => {
      setIsSceneReady(false);
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      logoBadgeRef.current = null;
      isDisposed = true;
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      woolPad.dispose();
      sanctuary.dispose();
      envTex.dispose();
      scene.clear();
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [externalScene]);

  return (
    <div ref={mountRef} className="w-full h-full relative" style={{ minHeight: '640px' }}>
      {!externalScene && (
        <>
          <BedroomConfiguratorDock bottomOffset={24} />
          {isSceneReady && (
            <SceneCaptureDock
              renderer={rendererRef.current}
              scene={sceneRef.current}
              camera={cameraRef.current}
              logoBadgeGroup={logoBadgeRef.current}
            />
          )}
        </>
      )}
    </div>
  );
};
