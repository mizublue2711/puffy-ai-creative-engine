import { useEffect } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
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
}

const PILLOW_WIDTH = 0.65; // Standard pillow width (65cm)
const PILLOW_HEIGHT = 0.45; // Standard pillow height (45cm)
const PILLOW_DEPTH = 0.22; // Generous plush thickness (22cm)
const PILLOW_SUBDIVISIONS = 48;
const SINK_DEPTH = 0.025; // 2.5cm weighted sink into mattress surface
const TILT_X_RAD = -0.15; // Tilt back against the headboard (-0.15 rad)
const YAW_Y_RAD = 0.07; // ~±4° outward fan

/**
 * Zero-Seam Clamshell Plush Pillow Generator:
 * Two mirrored quilted fabric domes stitched together at a zero-thickness
 * perimeter seam line (Z = 0) using cosine falloff that converges to 0 at all edges.
 */
export function createPuffyPlushPillow(
  width = PILLOW_WIDTH,
  height = PILLOW_HEIGHT,
  depth = PILLOW_DEPTH,
  subdivisions = PILLOW_SUBDIVISIONS,
): THREE.BufferGeometry {
  const geom = new THREE.PlaneGeometry(width, height, subdivisions, subdivisions);
  const pos = geom.attributes.position as THREE.BufferAttribute;

  const frontPos = pos.clone();
  const backPos = pos.clone();

  const halfW = width / 2;
  const halfH = height / 2;
  const halfD = depth / 2;

  // Deform Front & Back using natural cosine falloff that converges to EXACT ZERO at all edges
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);

    const nx = x / halfW;
    const ny = y / halfH;

    const factorX = Math.cos((nx * Math.PI) / 2);
    const factorY = Math.cos((ny * Math.PI) / 2);
    const dome = Math.pow(Math.max(0, factorX * factorY), 0.65);

    // Front bulges +Z, Back bulges -Z
    frontPos.setZ(i, halfD * dome);
    backPos.setZ(i, -halfD * dome);
  }

  const frontGeom = geom.clone();
  frontGeom.setAttribute('position', frontPos);
  frontGeom.computeVertexNormals();

  const backGeom = geom.clone();
  backGeom.setAttribute('position', backPos);
  // Flip triangle winding for back face so normals point outward (-Z)
  const index = backGeom.getIndex();
  if (index) {
    for (let i = 0; i < index.count; i += 3) {
      const a = index.getX(i);
      const c = index.getX(i + 2);
      index.setX(i, c);
      index.setX(i + 2, a);
    }
    index.needsUpdate = true;
  }
  backGeom.computeVertexNormals();

  geom.dispose();

  const merged = mergeGeometries([frontGeom, backGeom], false);
  frontGeom.dispose();
  backGeom.dispose();

  return merged;
}

export { createPuffyPlushPillow as createPlushPillowGeometry };

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

/**
 * LEGO Component: Puffy Signature Pillow Pair
 * Symmetric pair of zero-seam clamshell plush pillows with cosine dome loft,
 * weighted mattress sink, and PBR slots.
 */
export function createPuffyPillowPair(
  options: PuffyPillowPairOptions = {},
): BedroomAssetInstance {
  const surfaceY = options.surfaceY ?? 0.58;
  const headZ = options.headZ ?? -0.75;
  const offsetX = options.offsetX ?? 0.42;

  const group = new THREE.Group();
  group.name = 'PuffyPillowPair';

  const textureLoader = new THREE.TextureLoader();
  const pillowBaseColor = textureLoader.load('/shared_assets/bedding/puffy_pillow/01_baseColor.webp');
  pillowBaseColor.colorSpace = THREE.SRGBColorSpace;
  const pillowNormal = textureLoader.load('/shared_assets/bedding/puffy_pillow/02_normal.webp');
  const pillowRoughness = textureLoader.load('/shared_assets/bedding/puffy_pillow/03_roughness.webp');
  const pillowAo = textureLoader.load('/shared_assets/bedding/puffy_pillow/04_ao.webp');

  const pillowMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#FFFFFF'),
    map: pillowBaseColor,
    normalMap: pillowNormal,
    normalScale: new THREE.Vector2(0.8, 0.8),
    roughnessMap: pillowRoughness,
    roughness: 0.88,
    aoMap: pillowAo,
    aoMapIntensity: 0.65,
    metalness: 0.0,
    sheen: 1.0,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color('#FFFFFF'),
  });

  const pillowGeometry = createPuffyPlushPillow();

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
      rotX: TILT_X_RAD,
      rotY: YAW_Y_RAD,
    },
    {
      side: 'Right',
      x: offsetX,
      y: surfaceY,
      z: headZ,
      rotX: TILT_X_RAD,
      rotY: -YAW_Y_RAD,
    },
  ];

  for (const spec of pillowPlacements) {
    const pillowAnchor = new THREE.Group();
    pillowAnchor.name = `PuffyPillow_${spec.side}`;
    pillowAnchor.position.set(spec.x, spec.y, spec.z);
    pillowAnchor.rotation.set(spec.rotX, spec.rotY, 0);

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
    id: 'puffy-pillow-pair',
    name: 'Puffy Signature Pillow Pair',
    category: 'decor',
    dimensions: {
      width: offsetX * 2 + PILLOW_WIDTH,
      height: PILLOW_HEIGHT,
      depth: PILLOW_DEPTH,
    },
    defaultTransform: {
      position: [0, surfaceY, headZ],
      rotation: [TILT_X_RAD, 0, 0],
      scale: [1, 1, 1],
    },
    materialSlots: ['puffy-pillow-body'],
    disposableMeshes: meshes,
  });

  return {
    group,
    meshes,
    dispose: () => disposeComponent('puffy-pillow-pair'),
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
