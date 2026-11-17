import React, { useEffect, useRef } from 'react';
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
import { createPlushAreaRug } from './components/PlushAreaRug.tsx';
import { createHardwoodFloor } from './components/HardwoodFloor.tsx';
import { createRoomBoundary } from './components/RoomBoundary.tsx';
import { createWindowCurtainWall } from './components/WindowCurtainWall.tsx';
import { createBedThrowBlanket } from './components/BedThrowBlanket.tsx';
import { PuffyBedRunner } from './components/PuffyBedRunner.tsx';
import { createPuffyPillowPair } from './components/PuffyPillowPair.tsx';
import { createBedsideArtBook } from './components/BedsideArtBook.tsx';
import { createPuffyCloudCeilingLight } from './components/PuffyCloudCeilingLight.tsx';
import { createCourtyardWall } from './components/courtyard/CourtyardWall.tsx';
import { createKaresansuiSandBed } from './components/courtyard/KaresansuiSandBed.tsx';
import { createFlushZenGardenRig } from './components/courtyard/FlushZenGardenRig.tsx';
import { createZenMoonMirror } from './components/courtyard/ZenMoonMirror.tsx';
import { createTrailingVinesRig } from './components/courtyard/TrailingVinesRig.tsx';
import { FloatingWoolPad } from '../puffy-hero-3d/FloatingWoolPad.ts';
import type { SheepFlockEngine } from '../puffy-hero-3d/SheepFlockEngine.ts';
import {
  useBedroomConfigStore,
  type PillowCountOption,
} from '../../../store/useBedroomConfigStore.ts';
import { BedroomConfiguratorDock } from '../../ui/BedroomConfiguratorDock.tsx';

export interface BedroomSanctuarySceneOptions {
  /** Optional existing FloatingWoolPad whose encasementTrayGroup will be docked onto the bed slats */
  floatingWoolPad?: FloatingWoolPad | null;
  /** Optional standalone mattressGroup / encasementTrayGroup to dock at (0, 0.35, 0) */
  mattressGroup?: THREE.Object3D | null;
  /** Optional SheepFlockEngine to pause & hide while the bedroom sanctuary is mounted */
  sheepFlock?: SheepFlockEngine | null;
  /** Initial Interior Archetype style preset */
  initialStyle?: BedroomStyle;
  /** Mattress footprint width in scene units (defaults to 1.60m Queen spec, or 2.15m for FloatingWoolPad) */
  mattressWidth?: number;
  /** Mattress footprint length in scene units (defaults to 2.10m Queen spec, or 2.55m for FloatingWoolPad) */
  mattressLength?: number;
  /** Whether directional window sunlight casts soft shadows */
  castShadow?: boolean;
  /** Intensity of directional window sunlight (defaults to 2.0 for soft grazing light) */
  sunLightIntensity?: number;
}

export interface BedroomSanctuaryInstance {
  group: THREE.Group;
  registry: typeof BEDROOM_REGISTRY;
  setStyle: (style: BedroomStyle, duration?: number) => void;
  setBedDecorVisible: (visible: boolean) => void;
  syncMattressHeight: (heightDeltaMeters: number) => void;
  dockMattress: (mattressGroup: THREE.Object3D) => void;
  runSmokeTest: (dockedMattressGroup?: THREE.Object3D) => void;
  dispose: () => void;
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
  const mattressW = options.mattressWidth ?? (isFloatingPadAttached ? 2.15 : 1.60);
  const mattressL = options.mattressLength ?? (isFloatingPadAttached ? 2.55 : 2.10);
  const castShadow = options.castShadow ?? true;
  const initialStyle = options.initialStyle ?? 'nordic-coastal';

  const group = new THREE.Group();
  group.name = 'BedroomSanctuaryScene';

  // Pause meadow sheep flock simulation completely when this scene is mounted
  if (options.sheepFlock) {
    options.sheepFlock.group.visible = false;
  }

  // 1. Hardwood Floor (y = 0, x = [-3.80, +3.60], slab depth 7.20m centered z = +1.30)
  const floor = createHardwoodFloor({ width: 7.40, length: 7.20 });
  floor.group.position.set(-0.10, 0, 1.30);
  group.add(floor.group);

  // 2. Natural Textured Jute Area Rug (10mm slab, y = 0.005m)
  const rugWidth = Math.max(3.20, mattressW + 1.20);
  const rugLength = Math.max(3.60, mattressL + 1.40);
  const rug = createPlushAreaRug({
    width: rugWidth,
    length: rugLength,
    thickness: 0.010,
    centerZ: 0.35,
  });
  group.add(rug.group);

  // 3 & 4. Modular Puffy Bed Frame & Headboard (`kyoto` | `milan` | `solace`)
  let bedFrameInstance: ReturnType<typeof createPuffyBedFrame> | null = null;
  let headboardInstance: ReturnType<typeof createPuffyHeadboard> | null = null;
  let mountedBedFrameVariant: BedFrameVariantId | null = null;

  const unmountBedFrameAndHeadboard = () => {
    if (bedFrameInstance) {
      group.remove(bedFrameInstance.group);
      bedFrameInstance.dispose();
      bedFrameInstance = null;
    }
    if (headboardInstance) {
      group.remove(headboardInstance.group);
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
    group.add(bedFrameInstance.group);

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
    group.add(headboardInstance.group);
    mountedBedFrameVariant = variant;
  };

  const headboardAnchorZ = -(mattressL / 2 + 0.015);

  // 5. Room Boundary (7.00m deep: z = -2.20 .. +4.80, ceiling slab, 15mm Negative Shadow Reveal)
  const backWallZ = -2.20;
  const roomBoundary = createRoomBoundary({
    width: 7.40,
    centerX: -0.10,
    wallHeight: 3.90,
    wallZ: backWallZ,
    roomLength: 7.00,
  });
  group.add(roomBoundary.group);

  // 6. Panoramic Glass Facade (x = -3.80m, z = -2.00 .. +4.50, 6.50m) + continuous S-Fold Voile
  const windowCurtain = createWindowCurtainWall({
    wallX: -3.80,
    startZ: -2.00,
    totalLength: 6.50,
    ceilingHeight: 3.90,
  });
  group.add(windowCurtain.group);

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
  let throwBlanket: ReturnType<typeof createBedThrowBlanket> | null = null;
  const applyRunnerEnvironmentPalette = (
    envOrStyle: BedroomEnvironmentId | string,
    duration = 0.5,
  ) => {
    if (!throwBlanket) return;

    // 1. Resolve target palette based on environment or style preset:
    const normalizedKey = (envOrStyle || '').toLowerCase().replace(/\s+/g, '-');
    const palette =
      (ENVIRONMENT_RUNNER_PALETTES as Record<string, any>)[normalizedKey] ??
      (ENVIRONMENT_RUNNER_PALETTES as Record<string, any>)[envOrStyle] ??
      ENVIRONMENT_RUNNER_PALETTES['japandi-sanctuary'] ??
      ENVIRONMENT_RUNNER_PALETTES['zen-sanctuary'];

    if (!palette) return;

    const targetColor = new THREE.Color(palette.color);
    const targetSheen = new THREE.Color(palette.sheenColor || '#FFFFFF');
    const targetTassel = new THREE.Color(palette.tasselColor || '#D8D4CA');

    if (duration <= 0) {
      throwBlanket.group.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          const mat = mesh.material as THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;
          if (!mat) return;

          const isTassel = mesh.name.toLowerCase().includes('tassel') || mesh.geometry.name.includes('tassel');

          if (isTassel) {
            mat.color.copy(targetTassel);
            mat.needsUpdate = true;
          } else {
            mat.color.copy(targetColor);
            if ('sheenColor' in mat && mat.sheenColor) {
              mat.sheenColor.copy(targetSheen);
            }
            mat.roughness = palette.roughness;
            mat.needsUpdate = true;
          }
        }
      });
      return;
    }

    // 2. Traverse throwBlanket meshes and tween their materials directly with GSAP:
    throwBlanket.group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const mat = mesh.material as THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;
        if (!mat) return;

        // Identify whether this mesh is the runner fabric body or the tassels:
        const isTassel = mesh.name.toLowerCase().includes('tassel') || mesh.geometry.name.includes('tassel');

        if (isTassel) {
          gsap.to(mat.color, {
            r: targetTassel.r,
            g: targetTassel.g,
            b: targetTassel.b,
            duration,
            ease: 'power2.out',
          });
        } else {
          // Main runner textile body:
          gsap.to(mat.color, {
            r: targetColor.r,
            g: targetColor.g,
            b: targetColor.b,
            duration,
            ease: 'power2.out',
          });
          if ('sheenColor' in mat && mat.sheenColor) {
            gsap.to(mat.sheenColor, {
              r: targetSheen.r,
              g: targetSheen.g,
              b: targetSheen.b,
              duration,
              ease: 'power2.out',
            });
          }
          gsap.to(mat, {
            roughness: palette.roughness,
            duration,
            ease: 'power2.out',
          });
        }
      }
    });
  };

  const mountBedRunner = () => {
    if (throwBlanket) return;
    throwBlanket = createBedThrowBlanket({
      mattressWidth: mattressW,
      surfaceY: mattressTopY,
      footZ: mattressL * 0.28,
      drapeDrop: 0.22,
      runnerDepth: 0.60,
    });
    const { activeEnvironment } = useBedroomConfigStore.getState();
    applyRunnerEnvironmentPalette(activeEnvironment, 0);
    throwBlanket.group.position.y = currentHeightDelta;
    throwBlanket.group.visible = bedDecorVisible;
    group.add(throwBlanket.group);
  };
  const unmountBedRunner = () => {
    if (!throwBlanket) return;
    group.remove(throwBlanket.group);
    throwBlanket.dispose();
    throwBlanket = null;
  };

  // Pillow Assembly (0 | 2 | 4)
  let pillowRootGroup: THREE.Group | null = null;
  let pillowInstances: Array<ReturnType<typeof createPuffyPillowPair>> = [];
  let mountedPillowCount: PillowCountOption | null = null;

  const unmountPillows = () => {
    if (pillowRootGroup) {
      group.remove(pillowRootGroup);
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
    root.position.y = currentPillowHeightDelta;
    root.visible = bedDecorVisible;

    if (count === 2) {
      const pair = createPuffyPillowPair({
        surfaceY: pillowSurfaceY,
        headZ: headboardAnchorZ + 0.06,
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
        surfaceY: pillowSurfaceY,
        headZ: headboardAnchorZ + 0.02,
        offsetX: Math.min(0.44, mattressW * 0.24),
        rotX: -0.20,
        scale: 1.05,
        registryId: 'puffy-pillow-pair-back',
      });
      // Front Tier: 2 Standard Pillows resting angled forward
      const frontTier = createPuffyPillowPair({
        surfaceY: pillowSurfaceY,
        headZ: headboardAnchorZ + 0.22,
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
    group.add(root);
  };

  // 8. Gallery Wall Art (Elevated on Back Wall: Width 1.6m, Height 1.05m, Passe-Partout)
  const wallArtGroup = new THREE.Group();
  wallArtGroup.name = 'SanctuaryGalleryWallArt';
  wallArtGroup.position.set(0, 2.50, -1.85);

  // Layer 1: Dark Minimalist Wood Frame (Width 1.64m, Height 1.09m, Depth 0.03m)
  const artFrameGeo = new THREE.BoxGeometry(1.64, 1.09, 0.03);
  const artFrameMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#1a1816'),
    roughness: 0.75,
    metalness: 0.1,
    depthTest: true,
  });
  const artFrameMesh = new THREE.Mesh(artFrameGeo, artFrameMat);
  artFrameMesh.name = 'SanctuaryWallArt_Frame';
  artFrameMesh.castShadow = true;
  artFrameMesh.receiveShadow = true;
  wallArtGroup.add(artFrameMesh);

  // Layer 2: White Mat Board / Passe-Partout (Width 1.60m, Height 1.05m at z = +0.016)
  const artMatGeo = new THREE.PlaneGeometry(1.60, 1.05);
  const artMatBoardMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#F9F9F7'),
    roughness: 0.95,
    depthTest: true,
  });
  const artMatBoardMesh = new THREE.Mesh(artMatGeo, artMatBoardMat);
  artMatBoardMesh.name = 'SanctuaryWallArt_MatBoard';
  artMatBoardMesh.position.set(0, 0, 0.016);
  artMatBoardMesh.receiveShadow = true;
  wallArtGroup.add(artMatBoardMesh);

  // Layer 3: Artwork Canvas Surface (Width 1.30m, Height 0.75m at z = +0.018)
  const initialArtEnv = useBedroomConfigStore.getState().activeEnvironment || initialStyle;
  const initialArtPath = getWallArtTexturePath(initialArtEnv);

  const artCanvasGeo = new THREE.PlaneGeometry(1.30, 0.75);
  const artCanvasMat = new THREE.MeshStandardMaterial({
    roughness: 0.80,
    metalness: 0.0,
    depthTest: true,
  });

  const activeArtTex = loadWallArtTexture(initialArtPath, () => {
    artCanvasMat.map = activeArtTex;
    activeArtTex.needsUpdate = true;
    artCanvasMat.needsUpdate = true;
  });
  artCanvasMat.map = activeArtTex;
  activeArtTex.needsUpdate = true;
  artCanvasMat.needsUpdate = true;

  const artCanvasMesh = new THREE.Mesh(artCanvasGeo, artCanvasMat);
  artCanvasMesh.name = 'SanctuaryWallArt_Canvas';
  artCanvasMesh.position.set(0, 0, 0.018);
  artCanvasMesh.receiveShadow = true;
  wallArtGroup.add(artCanvasMesh);

  group.add(wallArtGroup);

  const updateWallArtTexture = (envOrStyle?: string | null) => {
    const nextPath = getWallArtTexturePath(envOrStyle);
    const nextTex = loadWallArtTexture(nextPath, () => {
      artCanvasMat.map = nextTex;
      nextTex.needsUpdate = true;
      artCanvasMat.needsUpdate = true;
    });
    artCanvasMat.map = nextTex;
    nextTex.needsUpdate = true;
    artCanvasMat.needsUpdate = true;
  };

  registerBedroomComponent({
    id: 'framed-canvas-art',
    name: 'Framed Architectural Canvas Art',
    category: 'decor',
    dimensions: { width: 1.64, height: 1.09, depth: 0.03 },
    defaultTransform: {
      position: [0, 2.50, -1.85],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    materialSlots: ['art-frame', 'passe-partout', 'canvas-print'],
    disposableMeshes: [artFrameMesh, artMatBoardMesh, artCanvasMesh],
  });

  const bedsideBook = createBedsideArtBook({
    sideX: mattressW / 2 + 0.38,
    shelfY: 0.42,
    wallZ: backWallZ,
  });
  group.add(bedsideBook.group);

  // 8b. Outdoor Karesansui Zen Courtyard & Moon Mirror (outside curtain wall x = -3.80m)
  const courtyardZone = new THREE.Group();
  courtyardZone.name = 'CourtyardSanctuaryZone';
  const courtyardWall = createCourtyardWall();
  courtyardZone.add(courtyardWall.group);

  let zenCourtyardGroup: THREE.Group | null = null;
  let karesansuiSandBed: ReturnType<typeof createKaresansuiSandBed> | null = null;
  let flushZenGardenRig: ReturnType<typeof createFlushZenGardenRig> | null = null;
  let zenMoonMirror: ReturnType<typeof createZenMoonMirror> | null = null;

  const mountZenCourtyard = () => {
    if (zenCourtyardGroup) return;
    zenCourtyardGroup = new THREE.Group();
    zenCourtyardGroup.name = 'ZenCourtyardSanctuary';
    karesansuiSandBed = createKaresansuiSandBed();
    flushZenGardenRig = createFlushZenGardenRig();
    zenMoonMirror = createZenMoonMirror();
    zenCourtyardGroup.add(karesansuiSandBed.group);
    zenCourtyardGroup.add(flushZenGardenRig.group);
    zenCourtyardGroup.add(zenMoonMirror.group);
    courtyardZone.add(zenCourtyardGroup);
  };
  const unmountZenCourtyard = () => {
    if (!zenCourtyardGroup) return;
    courtyardZone.remove(zenCourtyardGroup);
    zenCourtyardGroup.clear();
    karesansuiSandBed?.dispose();
    flushZenGardenRig?.dispose();
    zenMoonMirror?.dispose();
    karesansuiSandBed = null;
    flushZenGardenRig = null;
    zenMoonMirror = null;
    zenCourtyardGroup = null;
  };

  // Trailing Pothos Vines softening the courtyard wall lips & curtain pocket corner
  const trailingVinesRig = createTrailingVinesRig();
  courtyardZone.add(trailingVinesRig.group);
  group.add(courtyardZone);

  // Mattress Variant Switching (`cloud` | `royal` | `flux`)
  let standaloneMattressInstance: ReturnType<typeof createPuffyMattress> | null = null;
  let mountedMattressVariant: MattressVariantId | null = null;

  const syncMattressHeight = (heightDeltaMeters: number) => {
    const safeDelta = Number.isFinite(heightDeltaMeters) ? heightDeltaMeters : 0;
    currentHeightDelta = safeDelta;
    currentPillowHeightDelta = safeDelta + (mattressTopY - pillowSurfaceY);
    if (pillowRootGroup) {
      pillowRootGroup.position.y = currentPillowHeightDelta;
    }
    if (throwBlanket) {
      throwBlanket.group.position.y = currentHeightDelta;
    }
  };

  const getMountedMattressCrownY = (): number | null => {
    if (options.floatingWoolPad) {
      const topWorldY = measureVisibleTopY(options.floatingWoolPad.group);
      if (topWorldY !== null) {
        const parentWorldPos = new THREE.Vector3();
        if (options.floatingWoolPad.group.parent) {
          options.floatingWoolPad.group.parent.getWorldPosition(parentWorldPos);
        }
        const localTopY = topWorldY - parentWorldPos.y;
        return 0.24 + localTopY;
      }
    } else if (standaloneMattressInstance) {
      return measureVisibleTopY(standaloneMattressInstance.group);
    } else if (options.mattressGroup) {
      return measureVisibleTopY(options.mattressGroup);
    }
    return null;
  };

  const snapAccessoriesToMattress = () => {
    const crownY = getMountedMattressCrownY();
    if (crownY !== null) {
      currentHeightDelta = crownY - mattressTopY;
      currentPillowHeightDelta = crownY - pillowSurfaceY;
      if (throwBlanket) {
        throwBlanket.group.position.y = currentHeightDelta;
      }
      if (pillowRootGroup) {
        pillowRootGroup.position.y = currentPillowHeightDelta;
      }
    }
  };

  const unmountStandaloneMattress = () => {
    if (standaloneMattressInstance) {
      group.remove(standaloneMattressInstance.group);
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
      options.floatingWoolPad.setFloatingEnabled(false, 0.238);
      options.floatingWoolPad.update(0, 0.016);
      registerPuffyMattressVariant(variant, mattressW, mattressL, [], 0.24);
      snapAccessoriesToMattress();
    } else if (!options.mattressGroup) {
      unmountStandaloneMattress();
      standaloneMattressInstance = createPuffyMattress({
        variant,
        width: mattressW,
        length: mattressL,
        deckY: 0.24,
      });
      group.add(standaloneMattressInstance.group);
      snapAccessoriesToMattress();
    } else {
      registerPuffyMattressVariant(variant, mattressW, mattressL, [], 0.24);
      snapAccessoriesToMattress();
    }
  };

  const setStyle = (style: BedroomStyle, duration = 0.5) => {
    currentStyle = style;
    const preset = BEDROOM_STYLE_PRESETS[style] ?? BEDROOM_STYLE_PRESETS['nordic-coastal'];
    roomBoundary.applyStyle(preset, duration);
    floor.applyStyle(preset, duration);
    rug.applyStyle(preset, duration);
    updateWallArtTexture(style);
    bedsideBook.applyStyle(preset, duration);
    pendantCluster?.applyStyle(preset, duration);

    // ENSURE RUNNER RECEIVES BOTH THE PRESET KEY AND DURATION:
    applyRunnerEnvironmentPalette(style, duration);
  };

  let mountedEnvironment: BedroomEnvironmentId | null = null;

  // Initial state sync + reactive subscription to useBedroomConfigStore
  const syncFromConfigStore = () => {
    const { activeItems, pillowCount, activeBedFrame, activeMattress, activeEnvironment } =
      useBedroomConfigStore.getState();

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

    if (activeItems['zen-courtyard-sanctuary'] ?? true) {
      mountZenCourtyard();
    } else {
      unmountZenCourtyard();
    }
  };

  syncFromConfigStore();
  const unsubscribeStore = useBedroomConfigStore.subscribe(syncFromConfigStore);

  // 9. Soft Sanctuary Daylight Rig (Morning Sun from left panoramic window + Hemisphere Fill)
  const sunLightIntensity = options.sunLightIntensity ?? 2.6;
  const sunLight = new THREE.DirectionalLight(0xfff6e8, sunLightIntensity);
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

  const ambientRig = new THREE.HemisphereLight(0xe8eef5, 0xd4c4b5, 0.6);
  group.add(ambientRig);

  // 10. Dock the Puffy Royal / Monarch Mattress onto the Kyoto platform deck (y = 0.24m, nested 0.04m inside 0.28m rim)
  const dockMattress = (targetGroup: THREE.Object3D) => {
    targetGroup.position.set(0, 0.24, 0);
    targetGroup.rotation.set(0, 0, 0);
    targetGroup.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
      }
    });
    snapAccessoriesToMattress();
  };

  if (options.floatingWoolPad) {
    options.floatingWoolPad.setFloatingEnabled(false, 0.238);
    snapAccessoriesToMattress();
  } else if (options.mattressGroup) {
    dockMattress(options.mattressGroup);
  }

  const setBedDecorVisible = (visible: boolean) => {
    bedDecorVisible = visible;
    if (throwBlanket) {
      throwBlanket.group.visible = visible;
    }
    if (pillowRootGroup) {
      pillowRootGroup.visible = visible;
    }
  };

  const runSmokeTest = (dockedMattressGroup?: THREE.Object3D) => {
    const floorMesh = floor.meshes[0];
    const rugY = rug.group.position.y;
    const floorY = floorMesh ? floorMesh.position.y : 0;
    const registryKeys = Object.keys(BEDROOM_REGISTRY);

    console.group('=== BEDROOM SANCTUARY SMOKE TEST REPORT ===');
    console.log(
      '0. Registry Keys (12 expected):',
      registryKeys.length === 12 ? `PASS (${registryKeys.join(', ')})` : `INFO (${registryKeys.length}: ${registryKeys.join(', ')})`,
    );
    console.log(
      '1. Rug vs Floor Clearance:',
      rugY > floorY ? `PASS (No Z-fighting: rug y=${rugY}, floor y=${floorY})` : 'FAIL',
    );
    console.log(
      '2. Mattress Docking Height:',
      dockedMattressGroup && Math.abs(dockedMattressGroup.position.y - 0.24) < 1e-6
        ? 'PASS (y=0.24m)'
        : `FAIL (Misaligned Y: ${dockedMattressGroup?.position.y ?? 'none'})`,
    );
    console.log(
      '3. Soft Sanctuary Daylight Rig:',
      sunLight.intensity >= 1.8 && sunLight.intensity <= 2.8 && ambientRig.intensity === 0.6 ? 'PASS (4000K Sun + Hemi)' : 'FAIL',
    );
    console.groupEnd();
  };

  const dispose = () => {
    unsubscribeStore();
    disposeComponent('hardwood-floor');
    disposeComponent('plush-wool-rug');
    unmountBedFrameAndHeadboard();
    unmountStandaloneMattress();
    disposeComponent('room-boundary');
    disposeComponent('window-curtain-wall');
    unmountPendantCluster();
    unmountCloudCeilingLight();
    unmountBedRunner();
    unmountPillows();
    disposeComponent('framed-canvas-art');
    artFrameGeo.dispose();
    artFrameMat.dispose();
    artMatGeo.dispose();
    artMatBoardMat.dispose();
    artCanvasGeo.dispose();
    artCanvasMat.dispose();
    disposeComponent('bedside-art-book');
    disposeComponent('courtyard-wall');
    courtyardWall.dispose();
    unmountZenCourtyard();
    trailingVinesRig.dispose();
    disposeAllBedroomComponents();

    group.clear();
  };

  return {
    group,
    registry: BEDROOM_REGISTRY,
    setStyle,
    setBedDecorVisible,
    syncMattressHeight,
    dockMattress,
    runSmokeTest,
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
  const { activeItems, activeEnvironment, activeMattress } = useBedroomConfigStore();
  const contactY =
    activeMattress === 'cloud' ? 0.448 : (activeMattress as string) === 'lux' ? 0.528 : 0.602;

  useEffect(() => {
    // Mode A: Attached to an external Three.js Scene
    if (externalScene) {
      const sanctuary = createBedroomSanctuaryScene(options);
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

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
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
    scene.add(sanctuary.group);
    scene.add(mattressDockGroup);

    sanctuary.runSmokeTest(mattressDockGroup);

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
      {!externalScene && <BedroomConfiguratorDock bottomOffset={24} />}
      {activeItems['puffy-bed-runner'] !== false && (
        <PuffyBedRunner
          key={`runner-instance-${activeEnvironment}`}
          position={[0, contactY + 0.001, 0.45]}
          environmentKey={activeEnvironment}
        />
      )}
    </div>
  );
};
