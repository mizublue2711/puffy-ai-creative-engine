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
  centerX?: number;
  /** Room depth along +Z from back wall front face (default 7.00m: z = -2.20..+4.80) */
  roomLength?: number;
  /** Width of ceiling gap strip at left (curtain pocket), default 0.30m */
  ceilingPocketGap?: number;
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
 * LEGO Component: Room Boundary (Limewash Plaster Back & Right Walls, Negative Shadow Reveal & Architectural Slats)
 * Seals the floor-to-wall seam with a 15mm x 15mm dark anodized shadow reveal and supports 0.5s GSAP style transitions.
 */
export function createRoomBoundary(options: RoomBoundaryOptions = {}): StyleableBedroomAsset {
  const width = options.width ?? 7.40;
  const wallHeight = options.wallHeight ?? 3.90;
  const wallZ = options.wallZ ?? -2.20;
  const roomLength = options.roomLength ?? 7.00;
  const ceilingPocketGap = options.ceilingPocketGap ?? 0.30;
  const centerX = options.centerX ?? -0.10;

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

  const shadowRevealMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#1F1E1C'),
    roughness: 0.45,
    metalness: 0.75,
  });

  const accentSlatMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#C8A882'),
    roughness: 0.45,
    metalness: 0.02,
  });

  const meshes: THREE.Mesh[] = [];

  const wallDepth = 0.12;
  const revealSize = 0.015;
  const plasterWallHeight = wallHeight - revealSize;
  const plasterWallY = revealSize + plasterWallHeight / 2;

  // 1. Limewash / Fine Mineral Plaster Back Wall (front face at wallZ, raised by 15mm for shadow reveal)
  const wallGeo = new THREE.BoxGeometry(width, plasterWallHeight, wallDepth);
  const wallMesh = new THREE.Mesh(wallGeo, limewashPlasterMat);
  wallMesh.name = 'SanctuaryBackWall';
  wallMesh.position.set(centerX, plasterWallY, wallZ - wallDepth / 2);
  wallMesh.receiveShadow = true;
  group.add(wallMesh);
  meshes.push(wallMesh);

  // 2. Negative Shadow Baseboard Reveal along Back Wall (15mm x 15mm dark bronze/black anodized channel)
  const backRevealGeo = new THREE.BoxGeometry(width, revealSize, revealSize);
  const backRevealMesh = new THREE.Mesh(backRevealGeo, shadowRevealMat);
  backRevealMesh.name = 'NegativeShadowBaseboardReveal';
  backRevealMesh.position.set(centerX, revealSize / 2, wallZ - revealSize / 2);
  backRevealMesh.receiveShadow = true;
  group.add(backRevealMesh);
  meshes.push(backRevealMesh);

  // 3. Right Accent Plaster Wall (inner face at x = centerX + width / 2 = +3.60m, spanning z = -2.20..+4.80)
  const rightWallX = centerX + width / 2;
  const rightWallSpanZ = roomLength;
  const rightWallCenterZ = wallZ + rightWallSpanZ / 2;
  const rightWallGeo = new THREE.BoxGeometry(wallDepth, plasterWallHeight, rightWallSpanZ);
  const rightWallMesh = new THREE.Mesh(rightWallGeo, limewashPlasterMat);
  rightWallMesh.name = 'SanctuaryRightWall';
  rightWallMesh.position.set(rightWallX + wallDepth / 2, plasterWallY, rightWallCenterZ);
  rightWallMesh.receiveShadow = true;
  group.add(rightWallMesh);
  meshes.push(rightWallMesh);

  // 4. Negative Shadow Baseboard Reveal along Right Accent Wall (15mm x 15mm dark bronze/black anodized channel)
  const rightRevealGeo = new THREE.BoxGeometry(revealSize, revealSize, rightWallSpanZ);
  const rightRevealMesh = new THREE.Mesh(rightRevealGeo, shadowRevealMat);
  rightRevealMesh.name = 'RightWallShadowBaseboardReveal';
  rightRevealMesh.position.set(rightWallX + revealSize / 2, revealSize / 2, rightWallCenterZ);
  rightRevealMesh.receiveShadow = true;
  group.add(rightRevealMesh);
  meshes.push(rightRevealMesh);

  // 4b. Ceiling Slab (bottom face at y = wallHeight, 0.10m thick), leaving a curtain-pocket gap strip at left
  const ceilingMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#EFEBE4'),
    roughness: 0.95,
    metalness: 0.0,
    side: THREE.FrontSide,
  });
  const ceilingThick = 0.10;
  const ceilingDepth = roomLength + 0.20;
  const ceilingCenterZ = wallZ + roomLength / 2; // overhangs 0.10m past back & front
  const ceilingMinX = centerX - width / 2 + ceilingPocketGap;
  const ceilingMaxX = centerX + width / 2;
  const ceilingGeo = new THREE.BoxGeometry(ceilingMaxX - ceilingMinX, ceilingThick, ceilingDepth);
  const ceilingMesh = new THREE.Mesh(ceilingGeo, ceilingMat);
  ceilingMesh.name = 'SanctuaryCeilingSlab';
  ceilingMesh.position.set((ceilingMinX + ceilingMaxX) / 2, wallHeight + ceilingThick / 2, ceilingCenterZ);
  ceilingMesh.receiveShadow = true;
  group.add(ceilingMesh);
  meshes.push(ceilingMesh);

  // 5. Asymmetric Architectural Slats (Japandi Oak Slats / Mid-Century Brass Inlay)
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

  const applyStyle = (preset: BedroomStylePreset, duration = 0.5) => {
    const wc = new THREE.Color(preset.wall.color);
    const sc = new THREE.Color(preset.wall.accentSlatColor);

    gsap.to(limewashPlasterMat.color, { r: wc.r, g: wc.g, b: wc.b, duration, ease: 'power2.out' });
    gsap.to(limewashPlasterMat, { roughness: preset.wall.roughness, duration, ease: 'power2.out' });
    // Shadow reveal channel retains its dark bronze/black anodized finish (#1F1E1C) across all style presets
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
    name: 'Limewash Plaster Walls & Negative Shadow Reveal',
    category: 'decor',
    dimensions: { width, height: wallHeight, depth: wallDepth },
    defaultTransform: {
      position: [centerX, 0, wallZ],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    materialSlots: ['limewash-mineral-plaster', 'anodized-shadow-reveal', 'architectural-slats'],
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
  }, [scene, options.width, options.wallHeight, options.wallZ, options.centerX, options.roomLength, options.ceilingPocketGap]);

  return null;
}
