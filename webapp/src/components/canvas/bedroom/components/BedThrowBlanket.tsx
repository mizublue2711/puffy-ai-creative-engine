import { useEffect } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import {
  registerBedroomComponent,
  disposeComponent,
  type BedroomStylePreset,
} from '../BedroomRegistry.ts';
import type { BedroomAssetInstance } from './PuffyBedFrame.tsx';

export interface BedThrowBlanketOptions {
  mattressWidth?: number;
  surfaceY?: number;
  footZ?: number;
  drapeDrop?: number;
  runnerDepth?: number;
}

export interface StyleableBedroomAsset extends BedroomAssetInstance {
  applyStyle: (preset: BedroomStylePreset, duration?: number) => void;
}

function createThrowWeaveNormalMap(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const img = ctx.createImageData(size, size);
    const data = img.data;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        // Chunky knit / waffle / linen weave texture
        const wx = Math.sin(x * 0.55) * 0.45;
        const wy = Math.cos(y * 0.55) * 0.45;
        const idx = (y * size + x) * 4;
        data[idx] = Math.round(THREE.MathUtils.clamp(0.5 + wx * 0.35, 0, 1) * 255);
        data[idx + 1] = Math.round(THREE.MathUtils.clamp(0.5 + wy * 0.35, 0, 1) * 255);
        data[idx + 2] = 230;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(14, 8);
  return tex;
}

/**
 * LEGO Decor Prop: Bed Throw Blanket / Runner
 * Draped naturally across the foot of the Puffy mattress at y = 0.58m (configurable),
 * curving smoothly over the mattress crown and draping 0.18m down both left and right sides
 * with soft rounded corners and subtle fabric fold ripples.
 */
export function createBedThrowBlanket(
  options: BedThrowBlanketOptions = {},
): StyleableBedroomAsset {
  const mattressW = options.mattressWidth ?? 2.15;
  const surfaceY = options.surfaceY ?? 0.58;
  const footZ = options.footZ ?? 0.68;
  const drapeDrop = options.drapeDrop ?? 0.18;
  const runnerDepth = options.runnerDepth ?? 0.68;

  const group = new THREE.Group();
  group.name = 'BedThrowBlanket';

  const weaveNormal = createThrowWeaveNormalMap();

  const throwMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#202436'),
    roughness: 0.92,
    metalness: 0.0,
    sheen: 1.0,
    sheenColor: new THREE.Color('#4E5B85'),
    sheenRoughness: 0.55,
    normalMap: weaveNormal,
    normalScale: new THREE.Vector2(0.85, 0.85),
    side: THREE.DoubleSide,
  });

  // Build draped U-profile curve hugging the mattress crown and dropping 0.18m on both sides
  const halfW = mattressW / 2 + 0.015;
  const halfZ = runnerDepth / 2;
  const totalHalfSpan = halfW + drapeDrop;
  const thickness = 0.014;
  const segsX = 72;
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

  const shoulderRadius = 0.045;
  const shoulderArcLen = (Math.PI / 2) * shoulderRadius;
  const crownHeight = 0.014;
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
    const localThicknessOffset = rawY * hemTaper;

    const absX = Math.abs(x);
    let cx: number;
    let cy: number;
    let nx: number;
    let ny: number;

    if (absX <= halfW) {
      // Gentle cosine crown across the mattress top + subtle fabric fold ripples along Z
      const u = absX / halfW;
      const crown = crownHeight * Math.cos(u * (Math.PI / 2));
      const topRipple =
        Math.sin(z * 11.0 + x * 2.2) * 0.0032 +
        Math.cos(z * 19.0 - x * 3.4) * 0.0016;

      cx = x;
      cy = crown + topRipple;
      nx = 0;
      ny = 1;
    } else {
      const over = absX - halfW;
      const hangFactor = THREE.MathUtils.clamp(over / drapeDrop, 0, 1);

      if (over <= shoulderArcLen) {
        // Smooth quarter-circle roll over the mattress shoulder
        const angle = (over / shoulderArcLen) * (Math.PI / 2);
        cx = signX * (halfW + Math.sin(angle) * shoulderRadius);
        cy = -(1 - Math.cos(angle)) * shoulderRadius;
        nx = signX * Math.sin(angle);
        ny = Math.cos(angle);
      } else {
        // Natural gravity drape down the side with subtle outward flare
        const rem = over - shoulderArcLen;
        cx = signX * (halfW + shoulderRadius + rem * 0.06);
        cy = -shoulderRadius - rem * 0.998;
        nx = signX * 0.998;
        ny = 0.06;
      }

      // Subtle fabric pleat ripples along Z that deepen as the fabric hangs down
      const pleat =
        (Math.sin(z * 14.0 + signX * 1.1) * 0.0075 +
          Math.cos(z * 23.0 - signX * 0.7) * 0.0035) *
        hangFactor;
      const hemWave = Math.sin(z * 9.5 + signX * 0.5) * 0.004 * hangFactor;

      cx += nx * pleat;
      cy += ny * pleat * 0.25 - hemWave;
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
  throwMesh.position.set(0, surfaceY + thickness / 2, footZ);
  throwMesh.castShadow = true;
  throwMesh.receiveShadow = true;
  group.add(throwMesh);

  const applyStyle = (preset: BedroomStylePreset, duration = 0.5) => {
    const targetCol = new THREE.Color(preset.throwBlanket.color);
    const targetSheen = new THREE.Color(preset.throwBlanket.sheenColor);
    gsap.to(throwMat.color, {
      r: targetCol.r,
      g: targetCol.g,
      b: targetCol.b,
      duration,
      ease: 'power2.out',
    });
    gsap.to(throwMat.sheenColor, {
      r: targetSheen.r,
      g: targetSheen.g,
      b: targetSheen.b,
      duration,
      ease: 'power2.out',
    });
    gsap.to(throwMat, {
      roughness: preset.throwBlanket.roughness,
      duration,
      ease: 'power2.out',
    });
  };

  registerBedroomComponent({
    id: 'bed-throw-blanket',
    name: 'Draped Bed Throw Blanket',
    category: 'decor',
    dimensions: { width: mattressW + 0.06, height: drapeDrop + 0.03, depth: runnerDepth },
    defaultTransform: {
      position: [0, surfaceY, footZ],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    materialSlots: ['throw-fabric-sheen'],
    disposableMeshes: [throwMesh],
  });

  return {
    group,
    meshes: [throwMesh],
    applyStyle,
    dispose: () => disposeComponent('bed-throw-blanket'),
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
