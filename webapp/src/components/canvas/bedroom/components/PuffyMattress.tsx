import { useEffect } from 'react';
import * as THREE from 'three';
import {
  MATTRESS_CATALOG_SPECS,
  registerBedroomComponent,
  disposeComponent,
  type MattressVariantId,
} from '../BedroomRegistry.ts';
import { FloatingWoolPad } from '../../puffy-hero-3d/FloatingWoolPad.ts';
import type { BedroomAssetInstance } from './PuffyBedFrame.tsx';

export interface PuffyMattressOptions {
  variant?: MattressVariantId;
  width?: number;
  length?: number;
  deckY?: number;
  maxAnisotropy?: number;
}

const ALL_MATTRESS_IDS: Array<
  'puffy-cloud-mattress' | 'puffy-royal-mattress' | 'puffy-flux-mattress'
> = ['puffy-cloud-mattress', 'puffy-royal-mattress', 'puffy-flux-mattress'];

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
        ? ['cloud-quilt-top', 'cloud-front-border', 'cloud-side-border', 'puffy-cloud-badge']
        : variant === 'royal'
          ? ['cloud-quilt-top', 'charcoal-tech-border', 'black-piping', 'puffy-ribbon-badge']
          : ['cloud-quilt-top', 'heather-grey-border', 'warm-neutral-piping', 'puffy-lux-badge'],
    disposableMeshes: meshes,
  });
}

/**
 * Authentic Puffy Mattress Wrapper (`cloud` | `royal` | `flux`).
 * Delegates 100% to the calibrated `FloatingWoolPad` catalog asset so authentic
 * side-wall textiles, quilting, piping cords, and brand badges are preserved
 * without any procedural recoloring or material flattening.
 */
export function createPuffyMattress(
  options: PuffyMattressOptions = {},
): BedroomAssetInstance & { woolPad: FloatingWoolPad } {
  const variant: MattressVariantId = options.variant ?? 'cloud';
  const width = options.width ?? 2.15;
  const length = options.length ?? 2.55;
  const deckY = options.deckY ?? 0.24;
  const spec = MATTRESS_CATALOG_SPECS[variant];

  const woolPad = new FloatingWoolPad(options.maxAnisotropy ?? 4);
  const ecoModel = variant === 'flux' ? 'lux' : variant;
  woolPad.updateModel(ecoModel, true);
  woolPad.setFloatingEnabled(false, 0.238);
  woolPad.update(0, 0.016);

  const badgeMesh = woolPad.getActiveBadgeMesh();
  if (badgeMesh) {
    // Explicit name and layer binding
    badgeMesh.name = 'PuffyBrandBadgeMesh';
    badgeMesh.layers.enable(0); // Visible in normal scene
    badgeMesh.layers.enable(1); // Visible in isolated Pass B
  }

  const group = new THREE.Group();
  group.name = `PuffyMattress_${variant}`;
  group.position.set(0, deckY, 0);
  group.add(woolPad.group);

  const meshes: THREE.Mesh[] = [];
  woolPad.group.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = true;
      meshes.push(child as THREE.Mesh);
    }
  });

  registerPuffyMattressVariant(variant, width, length, [], deckY);

  return {
    group,
    meshes,
    woolPad,
    dispose: () => {
      woolPad.dispose();
      disposeComponent(spec.registryId);
    },
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
  }, [scene, options.variant, options.width, options.length, options.deckY, options.maxAnisotropy]);

  return null;
}
