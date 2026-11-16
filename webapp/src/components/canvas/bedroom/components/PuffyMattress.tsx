import { useEffect } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  MATTRESS_CATALOG_SPECS,
  registerBedroomComponent,
  disposeComponent,
  type MattressVariantId,
} from '../BedroomRegistry.ts';
import type { BedroomAssetInstance } from './PuffyBedFrame.tsx';

export interface PuffyMattressOptions {
  variant?: MattressVariantId;
  width?: number;
  length?: number;
  deckY?: number;
}

const ALL_MATTRESS_IDS: Array<'puffy-cloud-mattress' | 'puffy-royal-mattress' | 'puffy-flux-mattress'> = [
  'puffy-cloud-mattress',
  'puffy-royal-mattress',
  'puffy-flux-mattress',
];

export function unregisterAllPuffyMattresses(): void {
  for (const id of ALL_MATTRESS_IDS) {
    disposeComponent(id);
  }
}

export function registerPuffyMattressVariant(
  variant: MattressVariantId,
  width: number,
  length: number,
  meshes: THREE.Mesh[] = [],
  deckY = 0.24,
): void {
  unregisterAllPuffyMattresses();
  const spec = MATTRESS_CATALOG_SPECS[variant];
  registerBedroomComponent({
    id: spec.registryId,
    name: spec.name,
    category: 'furniture',
    dimensions: { width, height: spec.profileHeightMeters, depth: length },
    defaultTransform: {
      position: [0, deckY, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    materialSlots:
      variant === 'cloud'
        ? ['organic-ivory-quilt', 'ivory-self-piping']
        : variant === 'royal'
          ? ['cloud-quilt-top', 'charcoal-tech-border', 'black-piping', 'puffy-ribbon-badge']
          : ['cloud-quilt-top', 'heather-grey-border', 'warm-neutral-piping'],
    disposableMeshes: meshes,
  });
}

function createQuiltNormalMap(): THREE.CanvasTexture {
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
        const u = (x / size) * 8;
        const v = (y / size) * 8;
        const wave = Math.sin(u * Math.PI * 2) * Math.cos(v * Math.PI * 2);
        const dx = Math.cos(u * Math.PI * 2) * Math.cos(v * Math.PI * 2) * 0.28;
        const dy = -Math.sin(u * Math.PI * 2) * Math.sin(v * Math.PI * 2) * 0.28;
        const idx = (y * size + x) * 4;
        data[idx] = Math.round(THREE.MathUtils.clamp(0.5 + dx + wave * 0.04, 0, 1) * 255);
        data[idx + 1] = Math.round(THREE.MathUtils.clamp(0.5 + dy + wave * 0.04, 0, 1) * 255);
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
  tex.repeat.set(3, 4);
  return tex;
}

/**
 * Modular Mattress Switcher (`cloud` | `royal` | `flux`) for standalone bedroom mode.
 * When `FloatingWoolPad` is attached, `BedroomSanctuaryScene` delegates variant switching
 * to `FloatingWoolPad.updateModel` and registers metadata via `registerPuffyMattressVariant`.
 */
export function createPuffyMattress(options: PuffyMattressOptions = {}): BedroomAssetInstance {
  const variant: MattressVariantId = options.variant ?? 'cloud';
  const width = options.width ?? 1.60;
  const length = options.length ?? 2.10;
  const deckY = options.deckY ?? 0.24;
  const spec = MATTRESS_CATALOG_SPECS[variant];
  const totalHeight = spec.profileHeightMeters;

  const group = new THREE.Group();
  group.name = `PuffyMattress_${variant}`;

  const quiltNormal = createQuiltNormalMap();
  const meshes: THREE.Mesh[] = [];

  const topColor = variant === 'cloud' ? '#F5F2EB' : '#F8F7F4';
  const borderColor =
    variant === 'cloud' ? '#F5F2EB' : variant === 'royal' ? '#2B2F36' : '#6A6F78';
  const pipingColor =
    variant === 'cloud' ? '#EAE6DC' : variant === 'royal' ? '#171A1F' : '#D5CFC3';

  const topQuiltMat = new THREE.MeshPhysicalMaterial({
    color: topColor,
    roughness: 0.88,
    metalness: 0.0,
    sheen: 0.35,
    sheenColor: new THREE.Color('#FFFFFF'),
    sheenRoughness: 0.75,
    normalMap: quiltNormal,
    normalScale: new THREE.Vector2(0.45, 0.45),
  });

  const borderMat = new THREE.MeshPhysicalMaterial({
    color: borderColor,
    roughness: variant === 'royal' ? 0.82 : 0.88,
    metalness: 0.0,
    sheen: 0.25,
    sheenColor: new THREE.Color(variant === 'royal' ? '#4B5260' : '#E8E4DC'),
    sheenRoughness: 0.8,
  });

  const pipingMat = new THREE.MeshStandardMaterial({
    color: pipingColor,
    roughness: 0.72,
    metalness: 0.0,
  });

  // Main mattress core
  const coreHeight = totalHeight - 0.025;
  const coreGeo = new RoundedBoxGeometry(width, coreHeight, length, 4, 0.024);
  const coreMesh = new THREE.Mesh(coreGeo, borderMat);
  coreMesh.position.set(0, deckY + coreHeight / 2, 0);
  coreMesh.castShadow = true;
  coreMesh.receiveShadow = true;
  group.add(coreMesh);
  meshes.push(coreMesh);

  // Top quilted cloud pillow-top slab
  const topSlabH = 0.045;
  const topGeo = new RoundedBoxGeometry(width - 0.008, topSlabH, length - 0.008, 4, 0.020);
  const topMesh = new THREE.Mesh(topGeo, topQuiltMat);
  topMesh.position.set(0, deckY + totalHeight - topSlabH / 2, 0);
  topMesh.castShadow = true;
  topMesh.receiveShadow = true;
  group.add(topMesh);
  meshes.push(topMesh);

  // Perimeter piping welt
  const pipingThick = 0.009;
  const pipingY = deckY + totalHeight - topSlabH + 0.006;
  const pipingFB = new THREE.BoxGeometry(width + 0.004, pipingThick, pipingThick);
  const pipingLR = new THREE.BoxGeometry(pipingThick, pipingThick, length + 0.004);

  const frontPipe = new THREE.Mesh(pipingFB, pipingMat);
  frontPipe.position.set(0, pipingY, length / 2);
  const backPipe = new THREE.Mesh(pipingFB, pipingMat);
  backPipe.position.set(0, pipingY, -length / 2);
  const leftPipe = new THREE.Mesh(pipingLR, pipingMat);
  leftPipe.position.set(-width / 2, pipingY, 0);
  const rightPipe = new THREE.Mesh(pipingLR, pipingMat);
  rightPipe.position.set(width / 2, pipingY, 0);
  group.add(frontPipe, backPipe, leftPipe, rightPipe);
  meshes.push(frontPipe, backPipe, leftPipe, rightPipe);

  // Royal: high-contrast navy upper gusset & signature ribbon badge
  if (variant === 'royal') {
    const gussetMat = new THREE.MeshStandardMaterial({
      color: '#253B5E',
      roughness: 0.82,
      metalness: 0.0,
    });
    const gussetGeo = new RoundedBoxGeometry(width + 0.002, 0.055, length + 0.002, 3, 0.012);
    const gussetMesh = new THREE.Mesh(gussetGeo, gussetMat);
    gussetMesh.position.set(0, deckY + totalHeight - 0.072, 0);
    gussetMesh.castShadow = true;
    gussetMesh.receiveShadow = true;
    group.add(gussetMesh);
    meshes.push(gussetMesh);

    const badgeMat = new THREE.MeshStandardMaterial({
      color: '#1E2229',
      roughness: 0.55,
      metalness: 0.05,
    });
    const badgeGeo = new RoundedBoxGeometry(0.14, 0.048, 0.012, 2, 0.004);
    const badgeMesh = new THREE.Mesh(badgeGeo, badgeMat);
    badgeMesh.position.set(0, deckY + totalHeight * 0.45, length / 2 + 0.004);
    group.add(badgeMesh);
    meshes.push(badgeMesh);
  }

  registerPuffyMattressVariant(variant, width, length, meshes, deckY);

  return {
    group,
    meshes,
    dispose: () => disposeComponent(spec.registryId),
  };
}

export function PuffyMattress({
  scene,
  ...options
}: PuffyMattressOptions & { scene?: THREE.Scene }) {
  useEffect(() => {
    if (!scene) return;
    const asset = createPuffyMattress(options);
    scene.add(asset.group);
    return () => {
      scene.remove(asset.group);
      asset.dispose();
    };
  }, [scene, options.variant, options.width, options.length, options.deckY]);

  return null;
}
