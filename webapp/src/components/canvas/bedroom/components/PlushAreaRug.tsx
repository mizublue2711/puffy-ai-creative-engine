import { useEffect } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import gsap from 'gsap';
import {
  registerBedroomComponent,
  disposeComponent,
  type BedroomStylePreset,
} from '../BedroomRegistry.ts';
import type { StyleableBedroomAsset } from './BedThrowBlanket.tsx';

export interface PlushAreaRugOptions {
  width?: number;
  length?: number;
  thickness?: number;
  trimWidth?: number;
  centerZ?: number;
}

function createBoucleNormalMap(): THREE.CanvasTexture {
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
        // Dense looped curly wool / bouclé clusters
        const curlX = Math.sin(x * 0.55 + Math.cos(y * 0.42) * 1.8);
        const curlY = Math.cos(y * 0.55 + Math.sin(x * 0.42) * 1.8);
        const tuft = (((x * 73 + y * 139) % 29) / 29 - 0.5) * 0.55;

        const nx = THREE.MathUtils.clamp(0.5 + (curlX * 0.32 + tuft * 0.25), 0, 1);
        const ny = THREE.MathUtils.clamp(0.5 + (curlY * 0.32 + tuft * 0.25), 0, 1);
        const idx = (y * size + x) * 4;
        data[idx] = Math.round(nx * 255);
        data[idx + 1] = Math.round(ny * 255);
        data[idx + 2] = 215;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(18, 20);
  tex.anisotropy = 4;
  return tex;
}

/**
 * LEGO Component 2A: High-Pile Bouclé Wool Area Rug (with Royal Navy Welt Trim)
 * Physical 18mm beveled slab: width 2.80m, length 3.20m, thickness 0.018m.
 * Positioned at y = 0.009m (bottom flush on floor y = 0, top at y = 0.018m), z = 0.35m.
 */
export function createPlushAreaRug(options: PlushAreaRugOptions = {}): StyleableBedroomAsset {
  const width = options.width ?? 2.80;
  const length = options.length ?? 3.20;
  const thickness = options.thickness ?? 0.018;
  const trimWidth = options.trimWidth ?? 0.08;
  const centerZ = options.centerZ ?? 0.35;

  const group = new THREE.Group();
  group.name = 'PlushBoucleAreaRug';
  group.position.set(0, thickness / 2, centerZ);

  const boucleNormalMap = createBoucleNormalMap();

  const woolBodyMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#EDE8DF'),
    roughness: 0.94,
    metalness: 0.0,
    sheen: 1.0,
    sheenRoughness: 0.65,
    sheenColor: new THREE.Color('#FFF9F0'),
    normalMap: boucleNormalMap,
    normalScale: new THREE.Vector2(1.2, 1.2),
  });

  const navyTrimMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#2B2F44'),
    roughness: 0.90,
    metalness: 0.0,
    sheen: 0.8,
    sheenRoughness: 0.65,
    sheenColor: new THREE.Color('#3D4A6E'),
    normalMap: boucleNormalMap,
    normalScale: new THREE.Vector2(0.85, 0.85),
  });

  const meshes: THREE.Mesh[] = [];

  // 1. Main Oatmeal Ivory Rug Slab (beveled 18mm thick wool pile)
  const innerW = Math.max(0.5, width - trimWidth * 2);
  const innerL = Math.max(0.5, length - trimWidth * 2);
  const bodyGeo = new RoundedBoxGeometry(innerW, thickness, innerL, 2, 0.005);
  const bodyMesh = new THREE.Mesh(bodyGeo, woolBodyMat);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  group.add(bodyMesh);
  meshes.push(bodyMesh);

  // 2. Outer Navy Border Welt (0.08m wide beveled perimeter strips)
  const sideTrimGeo = new RoundedBoxGeometry(trimWidth, thickness, length, 2, 0.005);
  const endTrimGeo = new RoundedBoxGeometry(innerW, thickness, trimWidth, 2, 0.005);

  const leftTrim = new THREE.Mesh(sideTrimGeo, navyTrimMat);
  leftTrim.position.set(-(innerW / 2 + trimWidth / 2), 0, 0);
  leftTrim.castShadow = true;
  leftTrim.receiveShadow = true;

  const rightTrim = new THREE.Mesh(sideTrimGeo, navyTrimMat);
  rightTrim.position.set(innerW / 2 + trimWidth / 2, 0, 0);
  rightTrim.castShadow = true;
  rightTrim.receiveShadow = true;

  const backTrim = new THREE.Mesh(endTrimGeo, navyTrimMat);
  backTrim.position.set(0, 0, -(innerL / 2 + trimWidth / 2));
  backTrim.castShadow = true;
  backTrim.receiveShadow = true;

  const frontTrim = new THREE.Mesh(endTrimGeo, navyTrimMat);
  frontTrim.position.set(0, 0, innerL / 2 + trimWidth / 2);
  frontTrim.castShadow = true;
  frontTrim.receiveShadow = true;

  group.add(leftTrim, rightTrim, backTrim, frontTrim);
  meshes.push(leftTrim, rightTrim, backTrim, frontTrim);

  const applyStyle = (preset: BedroomStylePreset, duration = 0.5) => {
    const bc = new THREE.Color(preset.rug.bodyColor);
    const tc = new THREE.Color(preset.rug.trimColor);
    const sc = new THREE.Color(preset.rug.sheenColor);

    gsap.to(woolBodyMat.color, { r: bc.r, g: bc.g, b: bc.b, duration, ease: 'power2.out' });
    gsap.to(woolBodyMat.sheenColor, { r: sc.r, g: sc.g, b: sc.b, duration, ease: 'power2.out' });
    gsap.to(woolBodyMat, { roughness: preset.rug.roughness, duration, ease: 'power2.out' });
    gsap.to(navyTrimMat.color, { r: tc.r, g: tc.g, b: tc.b, duration, ease: 'power2.out' });
  };

  registerBedroomComponent({
    id: 'plush-wool-rug',
    name: 'High-Pile Bouclé Wool Area Rug',
    category: 'decor',
    dimensions: { width, height: thickness, depth: length },
    defaultTransform: {
      position: [0, thickness / 2, centerZ],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    materialSlots: ['boucle-oatmeal-wool', 'puffy-navy-trim'],
    disposableMeshes: meshes,
  });

  return {
    group,
    meshes,
    applyStyle,
    dispose: () => disposeComponent('plush-wool-rug'),
  };
}

export function PlushAreaRug({
  scene,
  ...options
}: PlushAreaRugOptions & { scene?: THREE.Scene }) {
  useEffect(() => {
    if (!scene) return;
    const asset = createPlushAreaRug(options);
    scene.add(asset.group);
    return () => {
      scene.remove(asset.group);
      asset.dispose();
    };
  }, [scene, options.width, options.length, options.thickness, options.centerZ]);

  return null;
}
