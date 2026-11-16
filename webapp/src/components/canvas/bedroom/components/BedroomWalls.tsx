import { useEffect } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import {
  registerBedroomComponent,
  disposeComponent,
  type BedroomStylePreset,
} from '../BedroomRegistry.ts';
import { useBedroomConfigStore } from '../../../../store/useBedroomConfigStore.ts';

export const WALL_ENVIRONMENT_MATERIALS = {
  // 1. Mid-Century Modern: Warm Sand Walnut / Muted Honey Teak
  'mid-century': {
    color: '#8E7558',
    roughness: 0.72,
    metalness: 0.0,
    revealGapColor: '#1A1816',
  },

  // 2. Zen Courtyard: Natural Light Ash / Bleached Bamboo Slat Plaster
  'zen': {
    color: '#D2CBBF',
    roughness: 0.88,
    metalness: 0.0,
    revealGapColor: '#2B2824',
  },
  'zen-sanctuary': {
    color: '#D2CBBF',
    roughness: 0.88,
    metalness: 0.0,
    revealGapColor: '#2B2824',
  },

  // 3. Modern Minimalist: Warm Mineral Greige Limewash Slat
  'modern': {
    color: '#E4DFD6',
    roughness: 0.92,
    metalness: 0.0,
    revealGapColor: '#363430',
  },
  'modern-sanctuary': {
    color: '#E4DFD6',
    roughness: 0.92,
    metalness: 0.0,
    revealGapColor: '#363430',
  },
} as const;

export type WallEnvironmentKey = keyof typeof WALL_ENVIRONMENT_MATERIALS;

export interface BedroomWallsOptions {
  width?: number;
  wallHeight?: number;
  wallZ?: number;
  centerX?: number;
  /** Room depth along +Z from back wall front face (default 7.00m: z = -2.20..+4.80) */
  roomLength?: number;
  /** Width of ceiling gap strip at left (curtain pocket), default 0.30m */
  ceilingPocketGap?: number;
  environment?: WallEnvironmentKey | string;
}

export interface BedroomWallsAsset {
  group: THREE.Group;
  meshes: THREE.Mesh[];
  applyStyle: (presetOrEnv: BedroomStylePreset | string, duration?: number) => void;
  setEnvironment: (env: WallEnvironmentKey | string, duration?: number) => void;
  dispose: () => void;
}

function createLimewashPlasterNormalMap(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const img = ctx.createImageData(size, size);
    const data = img.data;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        // Fine mineral plaster / limewash micro-stucco troweling
        const trowel = Math.sin(x * 0.06 + y * 0.04) * Math.cos(y * 0.05 - x * 0.03) * 0.16;
        const grit = (((x * 43 + y * 89) % 19) / 19 - 0.5) * 0.22;
        const idx = (y * size + x) * 4;
        data[idx] = Math.round(THREE.MathUtils.clamp(0.5 + trowel + grit, 0, 1) * 255);
        data[idx + 1] = Math.round(THREE.MathUtils.clamp(0.5 - trowel + grit, 0, 1) * 255);
        data[idx + 2] = 240;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 4);
  return tex;
}

function createVerticalTimberNormalMap(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const img = ctx.createImageData(size, size);
    const data = img.data;
    const twoPi = Math.PI * 2;
    for (let y = 0; y < size; y++) {
      const yPhase = (y / size) * twoPi;
      for (let x = 0; x < size; x++) {
        // Seamless vertical timber micro-grain running continuously along Y
        const fineGrain = Math.sin(x * 0.42 + Math.sin(yPhase * 2) * 1.1) * 0.12;
        const cathedral = Math.sin(x * 0.14 + Math.cos(yPhase) * 0.6) * 0.07;
        const pore = (((x * 37 + y * 13) % 17) / 17 - 0.5) * 0.05;
        const idx = (y * size + x) * 4;
        data[idx] = Math.round(THREE.MathUtils.clamp(0.5 + fineGrain + cathedral + pore, 0, 1) * 255);
        data[idx + 1] = Math.round(THREE.MathUtils.clamp(0.5 + pore * 0.4, 0, 1) * 255);
        data[idx + 2] = 242;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 1);
  return tex;
}

export function resolveWallEnvironmentKey(
  input?: BedroomStylePreset | string | null,
): WallEnvironmentKey {
  if (typeof input === 'string') {
    if (input in WALL_ENVIRONMENT_MATERIALS) {
      return input as WallEnvironmentKey;
    }
    if (input === 'japandi') return 'zen-sanctuary';
    if (input === 'nordic-coastal' || input === 'urban-loft') return 'modern-sanctuary';
  } else if (input && typeof input === 'object' && 'id' in input) {
    if (input.id === 'mid-century') return 'mid-century';
    if (input.id === 'japandi') return 'zen-sanctuary';
    if (input.id === 'nordic-coastal' || input.id === 'urban-loft') return 'modern-sanctuary';
  }
  try {
    const storeEnv = useBedroomConfigStore.getState().activeEnvironment;
    if (storeEnv && storeEnv in WALL_ENVIRONMENT_MATERIALS) {
      return storeEnv as WallEnvironmentKey;
    }
  } catch {
    // fallback if store not yet initialized
  }
  return 'zen-sanctuary';
}

/**
 * LEGO Component: Unified Bedroom Walls (Floor-to-Ceiling Vertical Rhythmic Timber Slats across ALL Environments)
 *
 * Geometric specification:
 * Continuous floor-to-ceiling vertical planks (height 3.90m, plank width ~0.60m)
 * with 5mm negative shadow reveal gaps (0.005m deep recesses) between adjacent planks.
 * Eliminates all horizontal seams across all environments.
 */
export function createBedroomWalls(options: BedroomWallsOptions = {}): BedroomWallsAsset {
  const width = options.width ?? 7.40;
  const wallHeight = options.wallHeight ?? 3.90;
  const wallZ = options.wallZ ?? -2.20;
  const roomLength = options.roomLength ?? 7.00;
  const ceilingPocketGap = options.ceilingPocketGap ?? 0.30;
  const centerX = options.centerX ?? -0.10;

  const group = new THREE.Group();
  group.name = 'BedroomWallsAndBoundary';

  const plasterNormalMap = createLimewashPlasterNormalMap();
  const timberNormalMap = createVerticalTimberNormalMap();

  const initialEnvKey = resolveWallEnvironmentKey(options.environment);
  const initialMat = WALL_ENVIRONMENT_MATERIALS[initialEnvKey] ?? WALL_ENVIRONMENT_MATERIALS['zen-sanctuary'];

  // 1. Dynamic Floor-to-Ceiling Vertical Timber Slat Material
  const localSlatWoodMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(initialMat.color),
    roughness: initialMat.roughness,
    metalness: initialMat.metalness,
    normalMap: timberNormalMap,
    normalScale: new THREE.Vector2(0.3, 0.3),
  });

  // 2. Negative Shadow Reveal Gap Backing Material
  const localShadowGapMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(initialMat.revealGapColor),
  });

  // 3. Right Wall Warm Mineral Limewash Plaster Material
  const limewashPlasterMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#E6E3DC'),
    roughness: 0.92,
    metalness: 0.0,
    normalMap: plasterNormalMap,
    normalScale: new THREE.Vector2(0.32, 0.32),
  });

  const warmPlasterMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#EAE5DC'),
    roughness: 0.92,
    metalness: 0.0,
    normalMap: plasterNormalMap,
    normalScale: new THREE.Vector2(0.24, 0.24),
  });

  // Baseboard Shadow Reveal Channel along Right Wall (15mm x 15mm)
  const shadowRevealMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#1F1E1C'),
    roughness: 0.45,
    metalness: 0.75,
  });

  // Inlay Accent Slat Material (Mid-Century Brass Inlay / Architectural Accent)
  const accentSlatMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#C5A059'),
    roughness: 0.45,
    metalness: 0.88,
  });

  const meshes: THREE.Mesh[] = [];

  const wallDepth = 0.12;
  const revealSize = 0.015;
  const plasterWallHeight = wallHeight - revealSize;
  const plasterWallY = revealSize + plasterWallHeight / 2;

  // =========================================================================
  // BACK WALL: UNIFIED FLOOR-TO-CEILING VERTICAL RHYTHMIC TIMBER SLATS
  // Continuous floor-to-ceiling (y = 0.00m..3.90m, plank width: 0.60m)
  // 5mm negative shadow reveal gaps (0.005m deep recesses) between adjacent planks.
  // ACTIVE ACROSS ALL 3 ENVIRONMENTS (NO HORIZONTAL SEAMS)
  // =========================================================================
  const verticalPlankGroup = new THREE.Group();
  verticalPlankGroup.name = 'VerticalTimberSlatWall';
  verticalPlankGroup.visible = true;

  const plankDepth = 0.025;
  const revealGap = 0.005; // 5mm negative reveal gap
  const plankCount = Math.max(1, Math.round(width / (0.60 + revealGap)));
  const plankWidth = (width - (plankCount - 1) * revealGap) / plankCount;
  const backingDepth = wallDepth - plankDepth;

  // Reveal Backing Mesh
  const backingGeo = new THREE.BoxGeometry(width, wallHeight, backingDepth);
  const backingMesh = new THREE.Mesh(backingGeo, localShadowGapMat);
  backingMesh.name = 'MidCenturyShadowRevealBacking';
  backingMesh.position.set(centerX, wallHeight / 2, wallZ - plankDepth - backingDepth / 2);
  verticalPlankGroup.add(backingMesh);
  meshes.push(backingMesh);

  // Vertical Planks Array
  const plankGeo = new THREE.BoxGeometry(plankWidth, wallHeight, plankDepth);
  const startX = centerX - width / 2;
  for (let i = 0; i < plankCount; i++) {
    const plank = new THREE.Mesh(plankGeo, localSlatWoodMat);
    plank.name = `MidCenturyVerticalPlank_${i + 1}`;
    const px = startX + plankWidth / 2 + i * (plankWidth + revealGap);
    plank.position.set(px, wallHeight / 2, wallZ - plankDepth / 2);
    plank.castShadow = true;
    plank.receiveShadow = true;
    verticalPlankGroup.add(plank);
    meshes.push(plank);
  }
  group.add(verticalPlankGroup);

  // =========================================================================
  // RIGHT ACCENT WALL: Warm Mineral Limewash Plaster Wall
  // Inner face at x = centerX + width / 2, spanning z = wallZ .. wallZ + roomLength
  // =========================================================================
  const rightWallX = centerX + width / 2;
  const rightWallSpanZ = roomLength;
  const rightWallCenterZ = wallZ + rightWallSpanZ / 2;
  const rightWallGeo = new THREE.BoxGeometry(wallDepth, plasterWallHeight, rightWallSpanZ);
  const rightWallMesh = new THREE.Mesh(rightWallGeo, warmPlasterMat);
  rightWallMesh.name = 'SanctuaryRightWall';
  rightWallMesh.position.set(rightWallX + wallDepth / 2, plasterWallY, rightWallCenterZ);
  rightWallMesh.receiveShadow = true;
  group.add(rightWallMesh);
  meshes.push(rightWallMesh);

  // Baseboard Shadow Reveal along Right Accent Wall (15mm x 15mm dark bronze/black anodized channel)
  const rightRevealGeo = new THREE.BoxGeometry(revealSize, revealSize, rightWallSpanZ);
  const rightRevealMesh = new THREE.Mesh(rightRevealGeo, shadowRevealMat);
  rightRevealMesh.name = 'RightWallShadowBaseboardReveal';
  rightRevealMesh.position.set(rightWallX + revealSize / 2, revealSize / 2, rightWallCenterZ);
  rightRevealMesh.receiveShadow = true;
  group.add(rightRevealMesh);
  meshes.push(rightRevealMesh);

  // =========================================================================
  // CEILING SLAB: y = wallHeight, leaving pocket gap at left for curtain facade
  // =========================================================================
  const ceilingMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#EFEBE4'),
    roughness: 0.95,
    metalness: 0.0,
    side: THREE.FrontSide,
  });
  const ceilingThick = 0.10;
  const ceilingDepth = roomLength + 0.20;
  const ceilingCenterZ = wallZ + roomLength / 2;
  const ceilingMinX = centerX - width / 2 + ceilingPocketGap;
  const ceilingMaxX = centerX + width / 2;
  const ceilingGeo = new THREE.BoxGeometry(ceilingMaxX - ceilingMinX, ceilingThick, ceilingDepth);
  const ceilingMesh = new THREE.Mesh(ceilingGeo, ceilingMat);
  ceilingMesh.name = 'SanctuaryCeilingSlab';
  ceilingMesh.position.set((ceilingMinX + ceilingMaxX) / 2, wallHeight + ceilingThick / 2, ceilingCenterZ);
  ceilingMesh.receiveShadow = true;
  group.add(ceilingMesh);
  meshes.push(ceilingMesh);

  // =========================================================================
  // ARCHITECTURAL ACCENT INLAY SLATS (Optional mid-century brass inlay)
  // =========================================================================
  const slatGroup = new THREE.Group();
  slatGroup.name = 'ArchitecturalWallSlats';
  slatGroup.visible = false;
  const slatGeo = new THREE.BoxGeometry(0.028, plasterWallHeight, 0.022);
  for (let i = 0; i < 10; i++) {
    const slat = new THREE.Mesh(slatGeo, accentSlatMat);
    slat.position.set(centerX + 1.55 + i * 0.09, plasterWallY, wallZ + 0.011);
    slat.castShadow = true;
    slat.receiveShadow = true;
    slatGroup.add(slat);
    meshes.push(slat);
  }
  group.add(slatGroup);

  // =========================================================================
  // ENVIRONMENT DYNAMICS & STYLE APPLICATION
  // =========================================================================
  const applyEnvironmentMaterials = (envKey: string, duration = 0.5) => {
    const resolvedKey = resolveWallEnvironmentKey(envKey);
    const matConfig = WALL_ENVIRONMENT_MATERIALS[resolvedKey] ?? WALL_ENVIRONMENT_MATERIALS['zen-sanctuary'];

    const targetPlankColor = new THREE.Color(matConfig.color);
    const targetGapColor = new THREE.Color(matConfig.revealGapColor);

    if (duration > 0) {
      gsap.to(localSlatWoodMat.color, {
        r: targetPlankColor.r,
        g: targetPlankColor.g,
        b: targetPlankColor.b,
        duration,
        ease: 'power2.out',
      });
      gsap.to(localSlatWoodMat, {
        roughness: matConfig.roughness,
        metalness: matConfig.metalness,
        duration,
        ease: 'power2.out',
      });
      gsap.to(localShadowGapMat.color, {
        r: targetGapColor.r,
        g: targetGapColor.g,
        b: targetGapColor.b,
        duration,
        ease: 'power2.out',
      });
    } else {
      localSlatWoodMat.color.copy(targetPlankColor);
      localSlatWoodMat.roughness = matConfig.roughness;
      localSlatWoodMat.metalness = matConfig.metalness;
      localShadowGapMat.color.copy(targetGapColor);
    }

    const isMidCentury = resolvedKey === 'mid-century';
    rightWallMesh.material = isMidCentury ? warmPlasterMat : limewashPlasterMat;
    if (!isMidCentury) {
      const rightWallColor = resolvedKey.includes('zen') ? '#DEDAD3' : '#E6E3DC';
      if (duration > 0) {
        gsap.to(limewashPlasterMat.color, {
          r: new THREE.Color(rightWallColor).r,
          g: new THREE.Color(rightWallColor).g,
          b: new THREE.Color(rightWallColor).b,
          duration,
          ease: 'power2.out',
        });
      } else {
        limewashPlasterMat.color.set(rightWallColor);
      }
    }
  };

  const applyStyle = (presetOrEnv: BedroomStylePreset | string, duration = 0.5) => {
    const resolvedKey = resolveWallEnvironmentKey(presetOrEnv);
    applyEnvironmentMaterials(resolvedKey, duration);

    if (typeof presetOrEnv === 'object' && presetOrEnv && 'wall' in presetOrEnv) {
      const preset = presetOrEnv as BedroomStylePreset;
      const sc = new THREE.Color(preset.wall.accentSlatColor);
      if (duration > 0) {
        gsap.to(accentSlatMat.color, { r: sc.r, g: sc.g, b: sc.b, duration, ease: 'power2.out' });
        gsap.to(accentSlatMat, {
          metalness: preset.wall.accentSlatMetalness,
          duration,
          ease: 'power2.out',
        });
      } else {
        accentSlatMat.color.copy(sc);
        accentSlatMat.metalness = preset.wall.accentSlatMetalness;
      }
      slatGroup.visible = Boolean(preset.wall.accentSlatVisible);
    } else {
      slatGroup.visible = resolvedKey === 'mid-century';
    }
  };

  const setEnvironment = (env: WallEnvironmentKey | string, duration = 0.5) => {
    applyEnvironmentMaterials(env, duration);
  };

  // Keep synced with centralized Zustand store
  const unsubscribeStore = useBedroomConfigStore.subscribe((state) => {
    applyEnvironmentMaterials(state.activeEnvironment, 0.4);
  });

  // Apply initial material values immediately (no animation)
  applyEnvironmentMaterials(initialEnvKey, 0);

  // Register in centralized LEGO Bedroom Registry
  registerBedroomComponent({
    id: 'room-boundary',
    name: 'Unified Floor-to-Ceiling Vertical Timber Slat Walls',
    category: 'decor',
    dimensions: { width, height: wallHeight, depth: wallDepth },
    defaultTransform: {
      position: [centerX, 0, wallZ],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    materialSlots: [
      'vertical-timber-slats',
      'negative-shadow-reveal-gap',
      'warm-mineral-limewash-plaster',
      'anodized-shadow-reveal',
      'architectural-slats',
    ],
    disposableMeshes: meshes,
  });

  registerBedroomComponent({
    id: 'mid-century-headboard-wall',
    name: 'Mid-Century Vertical Timber Headboard Wall',
    category: 'decor',
    dimensions: { width, height: wallHeight, depth: plankDepth },
    defaultTransform: {
      position: [centerX, 0, wallZ],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    materialSlots: ['warm-sand-walnut-vertical-planks', 'negative-shadow-reveal-gap', 'architectural-slats'],
    disposableMeshes: [],
  });

  registerBedroomComponent({
    id: 'mid-century-accent-wall',
    name: 'Mid-Century Warm Mineral Limewash Plaster Right Wall',
    category: 'decor',
    dimensions: { width: wallDepth, height: wallHeight, depth: rightWallSpanZ },
    defaultTransform: {
      position: [rightWallX + wallDepth / 2, plasterWallY, rightWallCenterZ],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    materialSlots: ['warm-mineral-limewash-plaster', 'anodized-shadow-reveal'],
    disposableMeshes: [],
  });

  return {
    group,
    meshes,
    applyStyle,
    setEnvironment,
    dispose: () => {
      unsubscribeStore();
      disposeComponent('mid-century-headboard-wall');
      disposeComponent('mid-century-accent-wall');
      disposeComponent('room-boundary');
    },
  };
}

export function BedroomWalls({
  scene,
  ...options
}: BedroomWallsOptions & { scene?: THREE.Scene }) {
  useEffect(() => {
    if (!scene) return;
    const asset = createBedroomWalls(options);
    scene.add(asset.group);
    return () => {
      scene.remove(asset.group);
      asset.dispose();
    };
  }, [scene, options.width, options.wallHeight, options.wallZ, options.centerX, options.roomLength, options.ceilingPocketGap, options.environment]);

  return null;
}
