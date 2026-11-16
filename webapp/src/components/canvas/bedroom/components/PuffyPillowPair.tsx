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
}

const PILLOW_WIDTH = 0.65;
const PILLOW_HEIGHT = 0.45;
const PILLOW_DEPTH = 0.18;
const PILLOW_SEGMENTS = 32;
const PIPING_DIAMETER = 0.008;
const SINK_DEPTH = 0.012; // 12mm weighted sink into mattress
const TILT_X_RAD = -0.26; // ~-15° recline against headboard (-0.2 to -0.3 rad)
const YAW_Y_RAD = 0.07; // ~±4° outward fan

/**
 * Applies the organic corner-pinch XY tug used by both the pillow body and piping seam.
 */
function applyCornerPinchXY(
  x: number,
  y: number,
  halfW: number,
  halfH: number,
): [number, number] {
  const u = Math.min(Math.max(x / halfW, -1), 1);
  const v = Math.min(Math.max(y / halfH, -1), 1);
  const cornerDistance = Math.sqrt(u * u + v * v) / Math.SQRT2;
  const cornerPinch = 1.0 - 0.12 * Math.pow(cornerDistance, 2);
  return [x * cornerPinch, y * cornerPinch];
}

/**
 * Parametric Pillow Displacement Generator:
 * - Cosine dome falloff peaking at center and tapering smoothly to a thin pinched seam
 * - Organic radial corner pinch (12% inward fabric tug at corners)
 * - Recomputed smooth vertex normals
 */
export function createPlushPillowGeometry(
  width = PILLOW_WIDTH,
  height = PILLOW_HEIGHT,
  depth = PILLOW_DEPTH,
  segments = PILLOW_SEGMENTS,
): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(width, height, depth, segments, segments, 16);
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  const halfW = width / 2;
  const halfH = height / 2;
  const halfD = depth / 2;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    // Normalized coordinates [-1, 1]
    const u = Math.min(Math.max(x / halfW, -1), 1);
    const v = Math.min(Math.max(y / halfH, -1), 1);

    // Cosine dome falloff (peaks in center, tapers smoothly toward perimeter seams)
    const factorX = Math.cos((u * Math.PI) / 2);
    const factorY = Math.cos((v * Math.PI) / 2);
    const pillowFactor = Math.pow(Math.max(0, factorX * factorY), 0.7);

    // Smooth spherical expansion across front (+1), back (-1), and side seam rings (zNorm)
    const zNorm = z / halfD;
    const displacedZ = zNorm * (halfD * 0.2 + halfD * 0.8 * pillowFactor);

    // Pinch the corners inward slightly (organic fabric tug)
    const [pinchedX, pinchedY] = applyCornerPinchXY(x, y, halfW, halfH);

    pos.setXYZ(i, pinchedX, pinchedY, displacedZ);
  }

  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Builds the contoured perimeter piping welt (0.008m diameter TubeGeometry)
 * following the exact corner-pinched seam at z = 0.
 */
function createContouredPipingGeometry(
  width = PILLOW_WIDTH,
  height = PILLOW_HEIGHT,
): THREE.BufferGeometry {
  const halfW = width / 2;
  const halfH = height / 2;
  const points: THREE.Vector3[] = [];
  const segsPerEdge = 24;

  const pushPoint = (rawX: number, rawY: number) => {
    const [px, py] = applyCornerPinchXY(rawX, rawY, halfW, halfH);
    points.push(new THREE.Vector3(px, py, 0));
  };

  for (let i = 0; i < segsPerEdge; i++) {
    const t = -1 + (2 * i) / segsPerEdge;
    pushPoint(t * halfW, halfH);
  }
  for (let i = 0; i < segsPerEdge; i++) {
    const t = 1 - (2 * i) / segsPerEdge;
    pushPoint(halfW, t * halfH);
  }
  for (let i = 0; i < segsPerEdge; i++) {
    const t = 1 - (2 * i) / segsPerEdge;
    pushPoint(t * halfW, -halfH);
  }
  for (let i = 0; i < segsPerEdge; i++) {
    const t = -1 + (2 * i) / segsPerEdge;
    pushPoint(-halfW, t * halfH);
  }

  const curve = new THREE.CatmullRomCurve3(points, true, 'centripetal', 0.2);
  return new THREE.TubeGeometry(curve, 128, PIPING_DIAMETER / 2, 12, true);
}

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
 * Symmetric pair of plush parametric pillows with cosine dome loft,
 * corner fabric pinch, contoured piping welt, weighted mattress sink, and PBR slots.
 */
export function createPuffyPillowPair(
  options: PuffyPillowPairOptions = {},
): BedroomAssetInstance {
  const surfaceY = options.surfaceY ?? 0.58;
  const headZ = options.headZ ?? -0.75;
  const offsetX = options.offsetX ?? 0.42;

  const group = new THREE.Group();
  group.name = 'PuffyPillowPair';

  // Placeholder TextureLoader ready for An Local's 5 baked PBR maps
  // const textureLoader = new THREE.TextureLoader();

  const pillowMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#E2E8F0'),
    roughness: 0.85,
    metalness: 0.0,
    sheen: 1.0,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color('#FFFFFF'),
    displacementScale: 0.015,
    // TextureLoader chờ sẵn đường dẫn mà An Local sẽ thả file vào:
    // map: textureLoader.load('/shared_assets/bedding/puffy_pillow/01_baseColor.png'),
    // normalMap: textureLoader.load('/shared_assets/bedding/puffy_pillow/02_normal.png'),
    // roughnessMap: textureLoader.load('/shared_assets/bedding/puffy_pillow/03_roughness.png'),
    // displacementMap: textureLoader.load('/shared_assets/bedding/puffy_pillow/04_height.png'),
    // aoMap: textureLoader.load('/shared_assets/bedding/puffy_pillow/05_ao.png'),
  });

  const pipingMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#F8FAFC'),
    roughness: 0.78,
    metalness: 0.0,
    sheen: 0.9,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color('#FFFFFF'),
  });

  const pillowGeometry = createPlushPillowGeometry();
  const pipingGeometry = createContouredPipingGeometry();

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

    const pipingMesh = new THREE.Mesh(pipingGeometry, pipingMaterial);
    pipingMesh.name = `PuffyPillowPiping_${spec.side}`;
    pipingMesh.castShadow = true;
    pipingMesh.receiveShadow = true;

    pillowMesh.add(pipingMesh);
    pillowAnchor.add(pillowMesh);
    group.add(pillowAnchor);

    meshes.push(pillowMesh, pipingMesh);
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
    materialSlots: ['puffy-pillow-body', 'puffy-pillow-piping'],
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
