import { useEffect } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import gsap from 'gsap';
import {
  registerBedroomComponent,
  disposeComponent,
  type BedroomStylePreset,
} from '../BedroomRegistry.ts';
import type { BedroomAssetInstance } from './PuffyBedFrame.tsx';

export interface BedRunnerTextureSlots {
  map?: THREE.Texture | null;
  normalMap?: THREE.Texture | null;
  roughnessMap?: THREE.Texture | null;
  aoMap?: THREE.Texture | null;
}

export interface BedThrowBlanketOptions {
  mattressWidth?: number;
  surfaceY?: number;
  footZ?: number;
  drapeDrop?: number;
  runnerDepth?: number;
  textures?: BedRunnerTextureSlots;
}

export interface StyleableBedroomAsset extends BedroomAssetInstance {
  applyStyle: (preset: BedroomStylePreset, duration?: number) => void;
}

function loadChenilleRunnerTextures(overrides?: BedRunnerTextureSlots): {
  map: THREE.Texture | null;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture | null;
  aoMap: THREE.Texture | null;
} {
  const loader = new THREE.TextureLoader();
  const configureTile = (tex: THREE.Texture, isColor = false) => {
    tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 1.2);
    tex.anisotropy = 4;
    return tex;
  };

  const basePath = '/shared_assets/lego/components/bed_runner/bed_runner_chenille_woven_v1';
  const normalMap = overrides?.normalMap ?? configureTile(loader.load(`${basePath}/02_normal.png`));
  const roughnessMap =
    overrides?.roughnessMap !== undefined
      ? overrides.roughnessMap
      : configureTile(loader.load(`${basePath}/03_roughness.webp`));
  const aoMap =
    overrides?.aoMap !== undefined
      ? overrides.aoMap
      : configureTile(loader.load(`${basePath}/05_ambientOcclusion.webp`));
  const map = overrides?.map ?? null;

  return { map, normalMap, roughnessMap, aoMap };
}

/**
 * Evaluates the exact draped side-overhang (cx, cy) for a given overhang distance and Z coordinate,
 * shared between the runner mesh deformation and the knotted tassel fringe placement.
 */
function evaluateDrapeOverhang(
  signX: number,
  over: number,
  z: number,
  halfW: number,
  drapeDrop: number,
  edgeCrownY: number,
  shoulderRadius: number,
  shoulderArcLen: number,
): { cx: number; cy: number; nx: number; ny: number } {
  const hangFactor = THREE.MathUtils.clamp(over / drapeDrop, 0, 1);
  let cx: number;
  let cy: number;
  let nx: number;
  let ny: number;

  if (over <= shoulderArcLen) {
    const angle = (over / shoulderArcLen) * (Math.PI / 2);
    cx = signX * (halfW + Math.sin(angle) * shoulderRadius);
    cy = edgeCrownY - (1 - Math.cos(angle)) * shoulderRadius;
    nx = signX * Math.sin(angle);
    ny = Math.cos(angle);
  } else {
    const rem = over - shoulderArcLen;
    cy = edgeCrownY - shoulderRadius - rem;
    const gravityRipple = Math.sin(cy * 20.0) * 0.005 * hangFactor;
    cx = signX * (halfW + shoulderRadius + rem * 0.02) + signX * gravityRipple;
    nx = signX * 0.998;
    ny = 0.02;
  }

  const pleat =
    (Math.sin(z * 14.0 + signX * 1.1) * 0.0065 +
      Math.cos(z * 23.0 - signX * 0.7) * 0.003) *
    hangFactor;
  const hemWave = Math.sin(z * 9.5 + signX * 0.5) * 0.0035 * hangFactor;

  cx += nx * pleat;
  cy += ny * pleat * 0.25 - hemWave;

  return { cx, cy, nx, ny };
}

/**
 * Builds a single knotted twisted-yarn tassel cluster (total length 0.08m) hanging along -Y.
 */
function createKnottedTasselGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  // Hand-tied top knot ("đầu thắt nút")
  const knot = new THREE.SphereGeometry(0.0068, 8, 6);
  knot.scale(1.0, 0.85, 1.0);
  knot.translate(0, -0.005, 0);
  parts.push(knot);

  // Three twisted/flared yarn strands hanging to y = -0.08m
  const strandLen = 0.072;
  for (let s = 0; s < 3; s++) {
    const angle = (s / 3) * Math.PI * 2;
    const strand = new THREE.CylinderGeometry(0.0024, 0.0016, strandLen, 6, 1);
    strand.translate(0, -0.008 - strandLen / 2, 0);
    strand.rotateZ(Math.cos(angle) * 0.055);
    strand.rotateX(Math.sin(angle) * 0.055);
    strand.translate(Math.cos(angle) * 0.0022, 0, Math.sin(angle) * 0.0022);
    parts.push(strand);
  }

  const merged = mergeGeometries(parts, false);
  for (const part of parts) {
    part.dispose();
  }
  return merged ?? new THREE.CylinderGeometry(0.004, 0.002, 0.08, 6);
}

/**
 * LEGO Decor Prop: Draped Chenille Bed Runner with Knotted Tassel Fringes
 * Contoured onto the mattress pillow-top (y = 0.582m at center crown, zero air gap),
 * draping 0.22m down both left and right sides with 0.08m knotted yarn tassels.
 */
export function createBedThrowBlanket(
  options: BedThrowBlanketOptions = {},
): StyleableBedroomAsset {
  const mattressW = options.mattressWidth ?? 2.10;
  const surfaceY = options.surfaceY ?? 0.58;
  const footZ = options.footZ ?? 0.68;
  const drapeDrop = options.drapeDrop ?? 0.22;
  const runnerDepth = options.runnerDepth ?? 0.60;

  const group = new THREE.Group();
  group.name = 'BedThrowBlanket';

  const runnerTextures = loadChenilleRunnerTextures(options.textures);

  const throwMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#1A2844'),
    roughness: 0.92,
    metalness: 0.0,
    sheen: 0.85,
    sheenColor: new THREE.Color('#4A6B9C'),
    sheenRoughness: 0.6,
    map: runnerTextures.map,
    normalMap: runnerTextures.normalMap,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughnessMap: runnerTextures.roughnessMap,
    aoMap: runnerTextures.aoMap,
    aoMapIntensity: 0.55,
    side: THREE.DoubleSide,
  });

  // Build draped U-profile curve hugging the mattress crown (no hover gap) and dropping 0.22m on both sides
  const halfW = mattressW / 2;
  const halfZ = runnerDepth / 2;
  const totalHalfSpan = halfW + drapeDrop;
  const thickness = 0.012;
  const segsX = 80;
  const segsY = 2;
  const segsZ = 28;

  const geo = new THREE.BoxGeometry(
    totalHalfSpan * 2,
    thickness,
    runnerDepth,
    segsX,
    segsY,
    segsZ,
  );
  const pos = geo.attributes.position;

  const shoulderRadius = 0.04;
  const shoulderArcLen = (Math.PI / 2) * shoulderRadius;
  const crownCenterOffset = 0.002; // 2mm offset above mattress crown to prevent z-fighting
  const crownDrop = 0.015; // Tapers 15mm from center crown (0.582m) to edges (0.567m)
  const edgeCrownY = crownCenterOffset - crownDrop;
  const cornerRadius = 0.07;

  for (let i = 0; i < pos.count; i++) {
    const rawX = pos.getX(i);
    const rawY = pos.getY(i);
    const rawZ = pos.getZ(i);

    const signX = rawX >= 0 ? 1 : -1;
    const signZ = rawZ >= 0 ? 1 : -1;

    // Soften X-Z perimeter corners into rounded fabric corners
    const innerX = totalHalfSpan - cornerRadius;
    const innerZ = halfZ - cornerRadius;
    const dxCorner = Math.max(0, Math.abs(rawX) - innerX);
    const dzCorner = Math.max(0, Math.abs(rawZ) - innerZ);

    let x = rawX;
    let z = rawZ;
    if (dxCorner > 0 && dzCorner > 0) {
      const dist = Math.hypot(dxCorner, dzCorner);
      if (dist > cornerRadius) {
        const scale = cornerRadius / dist;
        x = signX * (innerX + dxCorner * scale);
        z = signZ * (innerZ + dzCorner * scale);
      }
    }

    // Soft hem taper near the perimeter edges so it reads as folded textile, not a rigid board
    const edgeFactorX = THREE.MathUtils.clamp((Math.abs(x) - (totalHalfSpan - 0.025)) / 0.025, 0, 1);
    const edgeFactorZ = THREE.MathUtils.clamp((Math.abs(z) - (halfZ - 0.025)) / 0.025, 0, 1);
    const hemTaper = 1.0 - 0.65 * Math.max(edgeFactorX, edgeFactorZ);
    // Offset upward from the bottom face (rawY = -thickness/2 -> 0) so underside sits flush on mattressCrownY
    const localThicknessOffset = (rawY + thickness / 2) * hemTaper;

    const absX = Math.abs(x);
    let cx: number;
    let cy: number;
    let nx: number;
    let ny: number;

    if (absX <= halfW) {
      // Exact parabolic mattress crown profile: Y = surfaceY + 0.002 - (x / halfW)^2 * 0.015
      const mattressCrownY = crownCenterOffset - Math.pow(x / halfW, 2) * crownDrop;
      const topRipple =
        (Math.sin(z * 11.0 + x * 2.2) * 0.0012 +
          Math.cos(z * 19.0 - x * 3.4) * 0.0006 +
          0.0018) *
        THREE.MathUtils.clamp(1 - Math.abs(x) / halfW, 0.15, 1);

      cx = x;
      cy = mattressCrownY + topRipple;
      const slope = -(2 * crownDrop * x) / (halfW * halfW);
      const len = Math.hypot(-slope, 1);
      nx = -slope / len;
      ny = 1 / len;
    } else {
      const over = absX - halfW;
      ({ cx, cy, nx, ny } = evaluateDrapeOverhang(
        signX,
        over,
        z,
        halfW,
        drapeDrop,
        edgeCrownY,
        shoulderRadius,
        shoulderArcLen,
      ));
    }

    pos.setXYZ(
      i,
      cx + nx * localThicknessOffset,
      cy + ny * localThicknessOffset,
      z,
    );
  }
  geo.computeVertexNormals();

  const throwMesh = new THREE.Mesh(geo, throwMat);
  throwMesh.position.set(0, surfaceY, footZ);
  throwMesh.castShadow = true;
  throwMesh.receiveShadow = true;
  group.add(throwMesh);

  // Handcrafted knotted yarn tassel fringes (0.60m width, 0.08m length) on both draped ends
  const tasselsPerSide = 28;
  const totalTassels = tasselsPerSide * 2;
  const tasselLength = 0.08;
  const tasselGeo = createKnottedTasselGeometry();
  const tasselMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#E8E1D5'),
    roughness: 0.94,
    metalness: 0.0,
    sheen: 0.65,
    sheenColor: new THREE.Color('#FFF8EE'),
    sheenRoughness: 0.7,
  });

  const tasselMesh = new THREE.InstancedMesh(tasselGeo, tasselMat, totalTassels);
  tasselMesh.name = 'BedRunnerTasselFringes';
  tasselMesh.position.set(0, surfaceY, footZ);
  tasselMesh.castShadow = true;
  tasselMesh.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const zInset = 0.025;
  const zSpan = Math.max(0.1, runnerDepth - zInset * 2);
  let instanceIdx = 0;

  for (const signX of [-1, 1]) {
    for (let t = 0; t < tasselsPerSide; t++) {
      const ratio = tasselsPerSide > 1 ? t / (tasselsPerSide - 1) : 0.5;
      const z = -zSpan / 2 + ratio * zSpan;
      const hem = evaluateDrapeOverhang(
        signX,
        drapeDrop,
        z,
        halfW,
        drapeDrop,
        edgeCrownY,
        shoulderRadius,
        shoulderArcLen,
      );

      dummy.position.set(hem.cx, hem.cy, z);
      dummy.rotation.set(
        Math.sin(t * 2.3 + signX) * 0.04,
        t * 0.7 + signX,
        Math.cos(t * 1.9 - signX) * 0.04,
      );
      const s = 0.94 + ((t * 7) % 5) * 0.03;
      dummy.scale.set(s, 1.0, s);
      dummy.updateMatrix();
      tasselMesh.setMatrixAt(instanceIdx++, dummy.matrix);
    }
  }
  tasselMesh.instanceMatrix.needsUpdate = true;
  group.add(tasselMesh);

  const setRunnerPalette = (
    palette: { color: string; sheenColor: string; roughness: number; tasselColor?: string },
    duration = 0.5,
  ) => {
    const targetCol = new THREE.Color(palette.color);
    const targetSheen = new THREE.Color(palette.sheenColor);
    const targetTassel = palette.tasselColor ? new THREE.Color(palette.tasselColor) : null;

    if (duration <= 0) {
      throwMat.color.copy(targetCol);
      throwMat.sheenColor.copy(targetSheen);
      throwMat.roughness = palette.roughness;
      throwMat.needsUpdate = true;
      if (targetTassel) {
        tasselMat.color.copy(targetTassel);
        tasselMat.needsUpdate = true;
      }
      return;
    }

    gsap.to(throwMat.color, {
      r: targetCol.r,
      g: targetCol.g,
      b: targetCol.b,
      duration,
      ease: 'power2.out',
      onUpdate: () => {
        throwMat.needsUpdate = true;
      },
    });
    gsap.to(throwMat.sheenColor, {
      r: targetSheen.r,
      g: targetSheen.g,
      b: targetSheen.b,
      duration,
      ease: 'power2.out',
    });
    gsap.to(throwMat, {
      roughness: palette.roughness,
      duration,
      ease: 'power2.out',
    });
    if (targetTassel) {
      gsap.to(tasselMat.color, {
        r: targetTassel.r,
        g: targetTassel.g,
        b: targetTassel.b,
        duration,
        ease: 'power2.out',
        onUpdate: () => {
          tasselMat.needsUpdate = true;
        },
      });
    }
  };

  const applyStyle = (preset: BedroomStylePreset, duration = 0.5) => {
    setRunnerPalette(preset.throwBlanket, duration);
  };

  registerBedroomComponent({
    id: 'bed-throw-blanket',
    name: 'Draped Chenille Bed Runner with Tassels',
    category: 'decor',
    dockCategory: 'bedding',
    shortLabel: 'Runner',
    isToggleable: true,
    defaultState: true,
    dimensions: {
      width: mattressW + shoulderRadius * 2,
      height: drapeDrop + crownDrop + thickness + tasselLength,
      depth: runnerDepth,
    },
    defaultTransform: {
      position: [0, surfaceY + crownCenterOffset, footZ],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    materialSlots: ['chenille-runner-pbr', 'knotted-yarn-tassels'],
    disposableMeshes: [throwMesh, tasselMesh],
  });

  return {
    group,
    meshes: [throwMesh, tasselMesh],
    applyStyle,
    setRunnerPalette,
    dispose: () => disposeComponent('bed-throw-blanket'),
  } as StyleableBedroomAsset & {
    setRunnerPalette: typeof setRunnerPalette;
  };
}

export function BedThrowBlanket({
  scene,
  ...options
}: BedThrowBlanketOptions & { scene?: THREE.Scene }) {
  useEffect(() => {
    if (!scene) return;
    const asset = createBedThrowBlanket(options);
    scene.add(asset.group);
    return () => {
      scene.remove(asset.group);
      asset.dispose();
    };
  }, [scene, options.mattressWidth, options.surfaceY, options.footZ]);

  return null;
}
