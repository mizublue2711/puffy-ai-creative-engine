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
 * with smooth rounded edges draping 0.15m down both left and right sides.
 */
export function createBedThrowBlanket(
  options: BedThrowBlanketOptions = {},
): StyleableBedroomAsset {
  const mattressW = options.mattressWidth ?? 2.15;
  const surfaceY = options.surfaceY ?? 0.58;
  const footZ = options.footZ ?? 0.68;
  const drapeDrop = options.drapeDrop ?? 0.15;
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

  // Build draped U-profile curve hugging the mattress top and dropping 0.15m on both sides
  const halfW = mattressW / 2 + 0.015;
  const thickness = 0.016;
  const segsX = 48;
  const segsZ = 16;

  const geo = new THREE.BoxGeometry(halfW * 2 + drapeDrop * 2, thickness, runnerDepth, segsX, 1, segsZ);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    const absX = Math.abs(x);
    let newX = x;
    let newY = y;

    if (absX > halfW) {
      const over = absX - halfW;
      const t = THREE.MathUtils.clamp(over / drapeDrop, 0, 1);
      // Smooth 90-degree rounded fold over the mattress shoulder
      const angle = t * (Math.PI / 2);
      const radius = 0.03;
      const sign = Math.sign(x);
      newX = sign * (halfW + Math.sin(angle) * radius);
      newY = y - over * 0.92 - (1 - Math.cos(angle)) * 0.015;
    } else {
      // Subtle organic fabric ripple across the quilted top
      newY = y + Math.sin(x * 7.5 + z * 4.0) * 0.003;
    }

    pos.setXYZ(i, newX, newY, z);
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
