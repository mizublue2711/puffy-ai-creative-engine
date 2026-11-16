import { useEffect } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { registerBedroomComponent, disposeComponent } from '../BedroomRegistry.ts';

export interface PuffyBedFrameOptions {
  width?: number;
  length?: number;
  rimHeight?: number;
  slatHeight?: number;
  legHeight?: number;
  legRadius?: number;
}

export interface BedroomAssetInstance {
  group: THREE.Group;
  meshes: THREE.Mesh[];
  dispose: () => void;
}

function createLinenNormalMap(): THREE.CanvasTexture {
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
        const idx = (y * size + x) * 4;
        const warp = Math.sin(x * 0.85) * 0.5;
        const weft = Math.sin(y * 0.85) * 0.5;
        const grain = (((x * 37 + y * 17) % 13) / 13 - 0.5) * 0.25;
        const nx = THREE.MathUtils.clamp(0.5 + (warp + grain) * 0.16, 0, 1);
        const ny = THREE.MathUtils.clamp(0.5 + (weft + grain) * 0.16, 0, 1);
        data[idx] = Math.round(nx * 255);
        data[idx + 1] = Math.round(ny * 255);
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
  tex.repeat.set(10, 10);
  return tex;
}

/**
 * LEGO Component 1A: Puffy Platform Bed Frame & Natural Light Oak Legs
 * Fits Queen Mattress (default width: 1.60m, length: 2.10m, rimHeight: 0.35m).
 * Recessed slat foundation at y = 0.32m ready to dock the mattress encasement tray.
 */
export function createPuffyBedFrame(options: PuffyBedFrameOptions = {}): BedroomAssetInstance {
  const width = options.width ?? 1.60;
  const length = options.length ?? 2.10;
  const rimHeight = options.rimHeight ?? 0.35;
  const slatSurfaceY = options.slatHeight ?? 0.32;
  const legHeight = options.legHeight ?? 0.18;
  const legRadius = options.legRadius ?? 0.035;

  const group = new THREE.Group();
  group.name = 'PuffyPlatformBedFrame';

  const linenNormalMap = createLinenNormalMap();

  const heatherLinenMat = new THREE.MeshPhysicalMaterial({
    color: '#4A4D55',
    roughness: 0.85,
    metalness: 0.0,
    sheen: 0.7,
    sheenColor: new THREE.Color('#7A808C'),
    sheenRoughness: 0.65,
    normalMap: linenNormalMap,
    normalScale: new THREE.Vector2(0.35, 0.35),
  });

  const oakLegMat = new THREE.MeshStandardMaterial({
    color: '#C8A882',
    roughness: 0.45,
    metalness: 0.02,
  });

  const slatWoodMat = new THREE.MeshStandardMaterial({
    color: '#B89772',
    roughness: 0.62,
    metalness: 0.0,
  });

  const meshes: THREE.Mesh[] = [];

  // 1. Upholstered Perimeter Rim (y = legHeight .. rimHeight)
  const railThickness = 0.085;
  const railVerticalHeight = Math.max(0.08, rimHeight - legHeight);
  const railCenterY = legHeight + railVerticalHeight / 2;
  const outerW = width + railThickness * 2;
  const outerL = length + railThickness * 2;

  const sideRailGeo = new RoundedBoxGeometry(railThickness, railVerticalHeight, outerL, 3, 0.018);
  const endRailGeo = new RoundedBoxGeometry(width, railVerticalHeight, railThickness, 3, 0.018);

  const leftRail = new THREE.Mesh(sideRailGeo, heatherLinenMat);
  leftRail.position.set(-(width / 2 + railThickness / 2), railCenterY, 0);
  leftRail.castShadow = true;
  leftRail.receiveShadow = true;

  const rightRail = new THREE.Mesh(sideRailGeo, heatherLinenMat);
  rightRail.position.set(width / 2 + railThickness / 2, railCenterY, 0);
  rightRail.castShadow = true;
  rightRail.receiveShadow = true;

  const headRail = new THREE.Mesh(endRailGeo, heatherLinenMat);
  headRail.position.set(0, railCenterY, -(length / 2 + railThickness / 2));
  headRail.castShadow = true;
  headRail.receiveShadow = true;

  const footRail = new THREE.Mesh(endRailGeo, heatherLinenMat);
  footRail.position.set(0, railCenterY, length / 2 + railThickness / 2);
  footRail.castShadow = true;
  footRail.receiveShadow = true;

  group.add(leftRail, rightRail, headRail, footRail);
  meshes.push(leftRail, rightRail, headRail, footRail);

  // 2. Recessed Slat Foundation at y = 0.32m
  const deckThickness = 0.024;
  const subDeckGeo = new THREE.BoxGeometry(width - 0.01, deckThickness, length - 0.01);
  const subDeckMesh = new THREE.Mesh(subDeckGeo, slatWoodMat);
  subDeckMesh.position.set(0, slatSurfaceY - deckThickness / 2 - 0.016, 0);
  subDeckMesh.receiveShadow = true;
  group.add(subDeckMesh);
  meshes.push(subDeckMesh);

  const slatCount = 10;
  const slatThick = 0.016;
  const slatDepth = 0.095;
  const slatGeo = new THREE.BoxGeometry(width - 0.02, slatThick, slatDepth);
  const slatSpan = length - 0.22;
  for (let i = 0; i < slatCount; i++) {
    const t = slatCount > 1 ? i / (slatCount - 1) : 0.5;
    const sz = -slatSpan / 2 + t * slatSpan;
    const slat = new THREE.Mesh(slatGeo, slatWoodMat);
    slat.position.set(0, slatSurfaceY - slatThick / 2, sz);
    slat.castShadow = true;
    slat.receiveShadow = true;
    group.add(slat);
    meshes.push(slat);
  }

  // 3. 4x Cylindrical Natural Light Oak Legs at perimeter corners
  const legGeo = new THREE.CylinderGeometry(legRadius, legRadius * 0.85, legHeight, 20);
  const legInsetX = outerW / 2 - legRadius - 0.04;
  const legInsetZ = outerL / 2 - legRadius - 0.04;
  const legCorners: Array<[number, number]> = [
    [-legInsetX, -legInsetZ],
    [legInsetX, -legInsetZ],
    [-legInsetX, legInsetZ],
    [legInsetX, legInsetZ],
  ];

  for (const [lx, lz] of legCorners) {
    const leg = new THREE.Mesh(legGeo, oakLegMat);
    leg.position.set(lx, legHeight / 2, lz);
    leg.castShadow = true;
    leg.receiveShadow = true;
    group.add(leg);
    meshes.push(leg);
  }

  registerBedroomComponent({
    id: 'puffy-platform-frame',
    name: 'Puffy Platform Bed Frame',
    category: 'furniture',
    dimensions: { width: outerW, height: rimHeight, depth: outerL },
    defaultTransform: {
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    materialSlots: ['heather-grey-linen', 'natural-light-oak', 'slat-wood'],
    disposableMeshes: meshes,
  });

  return {
    group,
    meshes,
    dispose: () => disposeComponent('puffy-platform-frame'),
  };
}

export function PuffyBedFrame({
  scene,
  ...options
}: PuffyBedFrameOptions & { scene?: THREE.Scene }) {
  useEffect(() => {
    if (!scene) return;
    const asset = createPuffyBedFrame(options);
    scene.add(asset.group);
    return () => {
      scene.remove(asset.group);
      asset.dispose();
    };
  }, [scene, options.width, options.length, options.rimHeight, options.slatHeight]);

  return null;
}
