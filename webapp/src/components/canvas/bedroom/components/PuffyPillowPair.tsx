import { useEffect } from 'react';
import * as THREE from 'three';
import {
  registerBedroomComponent,
  disposeComponent,
} from '../BedroomRegistry.ts';
import type { BedroomAssetInstance } from './PuffyBedFrame.tsx';

export interface PuffyPillowPairOptions {
  /** Mattress top surface Y coordinate in scene units (default: 0.58m) */
  surfaceY?: number;
  /** Z coordinate near the headboard (default: -0.75m) */
  headZ?: number;
  /** Symmetric X offset from bed center (default: 0.42m) */
  offsetX?: number;
  /** Backward tilt angle in radians (default: -0.28) */
  rotX?: number;
  /** Uniform scale multiplier for pillow pair (default: 1.0) */
  scale?: number;
  /** Optional registry ID override for multi-tier pillow assemblies */
  registryId?: string;
}

const PILLOW_WIDTH = 0.65; // Standard pillow width (65cm)
const PILLOW_HEIGHT = 0.45; // Standard pillow height (45cm)
const PILLOW_DEPTH = 0.20; // Generous plush belly (20cm)
const PILLOW_SUBDIVISIONS = 40;
const SINK_DEPTH = 0.025; // 2.5cm weighted sink into mattress surface
const TILT_X_RAD = -0.28; // ~16° backward lean against headboard
const YAW_Y_RAD = 0.07; // ~±4° outward fan

/**
 * Organic Plush Pillow Generator:
 * Deforms a subdivided BoxGeometry with perimeter barrel bulge, corner pinch
 * (killing sharp 90° corners), and a cosine dome profile that tapers smoothly
 * toward the center seam.
 */
export function createOrganicPlushPillow(
  width = PILLOW_WIDTH,
  height = PILLOW_HEIGHT,
  depth = PILLOW_DEPTH,
  subdivisions = PILLOW_SUBDIVISIONS,
): THREE.BufferGeometry {
  const geom = new THREE.BoxGeometry(width, height, depth, subdivisions, subdivisions, 16);
  const pos = geom.attributes.position as THREE.BufferAttribute;

  const halfW = width / 2;
  const halfH = height / 2;
  const halfD = depth / 2;

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    // Normalized coordinates [-1, 1]
    const u = Math.min(Math.max(x / halfW, -1), 1);
    const v = Math.min(Math.max(y / halfH, -1), 1);

    // 1. Organic barrel bulge on perimeter (no straight 90° edges):
    const edgeBulgeX = Math.cos((v * Math.PI) / 2);
    const edgeBulgeY = Math.cos((u * Math.PI) / 2);
    x *= 0.92 + 0.08 * edgeBulgeX;
    y *= 0.92 + 0.08 * edgeBulgeY;

    // 2. Corner pinch (soften sharp rectangular corners):
    const distFromCenter = Math.sqrt(u * u + v * v) / Math.SQRT2;
    const cornerPinch = 1.0 - 0.15 * Math.pow(distFromCenter, 2.5);
    x *= cornerPinch;
    y *= cornerPinch;

    // 3. Smooth Cosine pillow dome (plump center, tapering toward seam):
    // Scale proportionally by z/halfD so front/back faces hit ±(0.15 + 0.85*domeFactor)*halfD
    // and the 16 side segments interpolate smoothly through z=0 without seam artifacts.
    const domeFactor = Math.pow(Math.max(0, edgeBulgeX * edgeBulgeY), 0.6);
    const w = z / halfD;
    z = w * (halfD * 0.15 + halfD * 0.85 * domeFactor);

    pos.setXYZ(i, x, y, z);
  }

  geom.computeVertexNormals();
  return geom;
}

export {
  createOrganicPlushPillow as createPuffyPlushPillow,
  createOrganicPlushPillow as createPlushPillowGeometry,
};

/**
 * Computes the exact local Y offset needed so that the rotated pillow's lowest
 * world vertex sinks `SINK_DEPTH` into the mattress surface.
 */
function computeRotatedBottomOffsetY(
  geom: THREE.BufferGeometry,
  rotX: number,
  rotY: number,
): number {
  const pos = geom.attributes.position as THREE.BufferAttribute;
  const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(rotX, rotY, 0));
  const v = new THREE.Vector3();
  let minY = Infinity;

  for (let i = 0; i < pos.count; i++) {
    v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyQuaternion(quat);
    if (v.y < minY) minY = v.y;
  }

  return (-minY - SINK_DEPTH) / Math.cos(rotX);
}

export const pillowFabricMaterial = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#FAF8F5'), // Pristine organic white fabric
  roughness: 0.88,                   // High roughness, zero specular metallic reflection
  metalness: 0.0,
});

/**
 * LEGO Component: Puffy Signature Pillow Pair
 * Symmetric pair of zero-seam clamshell plush pillows with cosine dome loft,
 * weighted mattress sink, and matte organic white fabric material.
 */
export function createPuffyPillowPair(
  options: PuffyPillowPairOptions = {},
): BedroomAssetInstance {
  const surfaceY = options.surfaceY ?? 0.58;
  const headZ = options.headZ ?? -0.75;
  const offsetX = options.offsetX ?? 0.42;
  const rotX = options.rotX ?? TILT_X_RAD;
  const scale = options.scale ?? 1.0;
  const registryId = options.registryId ?? 'puffy-pillow-pair';

  const group = new THREE.Group();
  group.name = registryId === 'puffy-pillow-pair' ? 'PuffyPillowPair' : `PuffyPillowPair_${registryId}`;

  const pillowMaterial = pillowFabricMaterial.clone();

  const pillowGeometry = createOrganicPlushPillow();

  const meshes: THREE.Mesh[] = [];

  const pillowPlacements: Array<{
    side: 'Left' | 'Right';
    x: number;
    y: number;
    z: number;
    rotX: number;
    rotY: number;
  }> = [
    {
      side: 'Left',
      x: -offsetX,
      y: surfaceY,
      z: headZ,
      rotX,
      rotY: YAW_Y_RAD,
    },
    {
      side: 'Right',
      x: offsetX,
      y: surfaceY,
      z: headZ,
      rotX,
      rotY: -YAW_Y_RAD,
    },
  ];

  for (const spec of pillowPlacements) {
    const pillowAnchor = new THREE.Group();
    pillowAnchor.name = `PuffyPillow_${spec.side}`;
    pillowAnchor.position.set(spec.x, spec.y, spec.z);
    pillowAnchor.rotation.set(spec.rotX, spec.rotY, 0);
    pillowAnchor.scale.setScalar(scale);

    const localOffsetY = computeRotatedBottomOffsetY(pillowGeometry, spec.rotX, spec.rotY);

    const pillowMesh = new THREE.Mesh(pillowGeometry, pillowMaterial);
    pillowMesh.name = `PuffyPillowMesh_${spec.side}`;
    pillowMesh.position.set(0, localOffsetY, 0);
    pillowMesh.castShadow = true;
    pillowMesh.receiveShadow = true;

    pillowAnchor.add(pillowMesh);
    group.add(pillowAnchor);

    meshes.push(pillowMesh);
  }

  registerBedroomComponent({
    id: registryId,
    name: 'Puffy Signature Pillow Pair',
    category: 'decor',
    dockCategory: 'bedding',
    shortLabel: 'Pillows',
    isToggleable: registryId === 'puffy-pillow-pair',
    variantKey: registryId === 'puffy-pillow-pair' ? 'pillowCount' : undefined,
    options: registryId === 'puffy-pillow-pair' ? [0, 2, 4] : undefined,
    defaultState: registryId === 'puffy-pillow-pair' ? 2 : undefined,
    dimensions: {
      width: offsetX * 2 + PILLOW_WIDTH * scale,
      height: PILLOW_HEIGHT * scale,
      depth: PILLOW_DEPTH * scale,
    },
    defaultTransform: {
      position: [0, surfaceY, headZ],
      rotation: [rotX, 0, 0],
      scale: [scale, scale, scale],
    },
    materialSlots: ['puffy-pillow-body'],
    disposableMeshes: meshes,
  });

  return {
    group,
    meshes,
    dispose: () => disposeComponent(registryId),
  };
}

export function PuffyPillowPair({
  scene,
  ...options
}: PuffyPillowPairOptions & { scene?: THREE.Scene }) {
  useEffect(() => {
    if (!scene) return;
    const asset = createPuffyPillowPair(options);
    scene.add(asset.group);
    return () => {
      scene.remove(asset.group);
      asset.dispose();
    };
  }, [scene, options.surfaceY, options.headZ, options.offsetX]);

  return null;
}
