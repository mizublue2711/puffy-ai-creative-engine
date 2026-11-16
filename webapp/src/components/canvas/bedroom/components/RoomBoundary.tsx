import { useEffect } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import {
  registerBedroomComponent,
  disposeComponent,
  type BedroomStylePreset,
} from '../BedroomRegistry.ts';
import type { StyleableBedroomAsset } from './BedThrowBlanket.tsx';

export interface RoomBoundaryOptions {
  width?: number;
  wallHeight?: number;
  wallZ?: number;
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

/**
 * LEGO Component: Room Boundary (Limewash Plaster Back Wall, Skirting Baseboard & Architectural Slats)
 * Seals the floor-to-wall seam and supports 0.5s GSAP style transitions.
 */
export function createRoomBoundary(options: RoomBoundaryOptions = {}): StyleableBedroomAsset {
  const width = options.width ?? 6.4;
  const wallHeight = options.wallHeight ?? 3.2;
  const wallZ = options.wallZ ?? -1.395;

  const group = new THREE.Group();
  group.name = 'RoomBoundaryAndBaseboard';

  const plasterNormalMap = createLimewashPlasterNormalMap();

  const limewashPlasterMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#E6E3DC'),
    roughness: 0.92,
    metalness: 0.0,
    normalMap: plasterNormalMap,
    normalScale: new THREE.Vector2(0.32, 0.32),
  });

  const baseboardMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#F5F5F3'),
    roughness: 0.35,
    metalness: 0.0,
  });

  const accentSlatMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#C8A882'),
    roughness: 0.45,
    metalness: 0.02,
  });

  const meshes: THREE.Mesh[] = [];

  // 1. Limewash / Fine Mineral Plaster Back Wall (front face at wallZ)
  const wallDepth = 0.12;
  const wallGeo = new THREE.BoxGeometry(width, wallHeight, wallDepth);
  const wallMesh = new THREE.Mesh(wallGeo, limewashPlasterMat);
  wallMesh.name = 'SanctuaryBackWall';
  wallMesh.position.set(0, wallHeight / 2, wallZ - wallDepth / 2);
  wallMesh.receiveShadow = true;
  group.add(wallMesh);
  meshes.push(wallMesh);

  // 2. Architectural Skirting Baseboard Trim (sealing floor seam y = 0..0.12m)
  const baseboardHeight = 0.12;
  const baseboardDepth = 0.018;
  const baseboardGeo = new THREE.BoxGeometry(width, baseboardHeight, baseboardDepth);
  const baseboardMesh = new THREE.Mesh(baseboardGeo, baseboardMat);
  baseboardMesh.name = 'SkirtingBaseboardTrim';
  baseboardMesh.position.set(0, baseboardHeight / 2, wallZ + baseboardDepth / 2);
  baseboardMesh.castShadow = true;
  baseboardMesh.receiveShadow = true;
  group.add(baseboardMesh);
  meshes.push(baseboardMesh);

  // 3. Asymmetric Architectural Slats (Japandi Oak Slats / Mid-Century Brass Inlay)
  const slatGroup = new THREE.Group();
  slatGroup.name = 'ArchitecturalWallSlats';
  slatGroup.visible = false;
  const slatGeo = new THREE.BoxGeometry(0.028, wallHeight - 0.12, 0.022);
  for (let i = 0; i < 10; i++) {
    const slat = new THREE.Mesh(slatGeo, accentSlatMat);
    slat.position.set(1.55 + i * 0.09, (wallHeight + 0.12) / 2, wallZ + 0.011);
    slat.castShadow = true;
    slat.receiveShadow = true;
    slatGroup.add(slat);
    meshes.push(slat);
  }
  group.add(slatGroup);

  const applyStyle = (preset: BedroomStylePreset, duration = 0.5) => {
    const wc = new THREE.Color(preset.wall.color);
    const bc = new THREE.Color(preset.wall.baseboardColor);
    const sc = new THREE.Color(preset.wall.accentSlatColor);

    gsap.to(limewashPlasterMat.color, { r: wc.r, g: wc.g, b: wc.b, duration, ease: 'power2.out' });
    gsap.to(limewashPlasterMat, { roughness: preset.wall.roughness, duration, ease: 'power2.out' });
    gsap.to(baseboardMat.color, { r: bc.r, g: bc.g, b: bc.b, duration, ease: 'power2.out' });
    gsap.to(accentSlatMat.color, { r: sc.r, g: sc.g, b: sc.b, duration, ease: 'power2.out' });
    gsap.to(accentSlatMat, {
      metalness: preset.wall.accentSlatMetalness,
      duration,
      ease: 'power2.out',
    });
    slatGroup.visible = preset.wall.accentSlatVisible;
  };

  registerBedroomComponent({
    id: 'room-boundary',
    name: 'Limewash Plaster Wall & Skirting Baseboard',
    category: 'decor',
    dimensions: { width, height: wallHeight, depth: wallDepth + baseboardDepth },
    defaultTransform: {
      position: [0, 0, wallZ],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    materialSlots: ['limewash-mineral-plaster', 'semi-gloss-baseboard', 'architectural-slats'],
    disposableMeshes: meshes,
  });

  return {
    group,
    meshes,
    applyStyle,
    dispose: () => disposeComponent('room-boundary'),
  };
}

export function RoomBoundary({
  scene,
  ...options
}: RoomBoundaryOptions & { scene?: THREE.Scene }) {
  useEffect(() => {
    if (!scene) return;
    const asset = createRoomBoundary(options);
    scene.add(asset.group);
    return () => {
      scene.remove(asset.group);
      asset.dispose();
    };
  }, [scene, options.width, options.wallHeight, options.wallZ]);

  return null;
}
