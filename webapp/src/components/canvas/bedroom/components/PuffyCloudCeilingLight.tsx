import { useEffect } from 'react';
import * as THREE from 'three';
import {
  registerBedroomComponent,
  disposeComponent,
} from '../BedroomRegistry.ts';
import type { BedroomAssetInstance } from './PuffyBedFrame.tsx';

// ============================================================================
// II. PBR MATERIAL DEFINITIONS (NON-PLASTIC TRANSLUCENCY)
// ============================================================================

// 1. Slim Aluminum Outer Trim (Matte Architectural White / Warm Brass Accent)
export const cloudBezelMaterial = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#F2EFE9'),
  roughness: 0.35,
  metalness: 0.2,
});

// 2. Opal Diffuser Face (Illuminated Surface)
export const cloudDiffuserMaterial = new THREE.MeshPhysicalMaterial({
  color: new THREE.Color('#FFFDF8'),
  roughness: 0.12,
  metalness: 0.0,
  transmission: 0.65,              // Translucent milky depth
  thickness: 0.02,
  emissive: new THREE.Color('#FFF5E5'), // Warm 3200K daylight tone
  emissiveIntensity: 0.65,         // Soft glowing surface without blowing out exposure
  transparent: true,
  opacity: 0.98,
});

// ============================================================================
// I. GEOMETRY & SHAPE EXTRUSION SPECIFICATION
// ============================================================================

const TARGET_WIDTH = 1.20;
const TARGET_LENGTH = 0.85;
const HOUSING_DEPTH = 0.05;
const BEVEL_THICKNESS = 0.008;
const BEVEL_SIZE = 0.008;
const BEVEL_SEGMENTS = 5;
const BEZEL_BAND_WIDTH = 0.01; // 10mm perimeter aluminum rim
const HALO_STANDOFF_GAP = 0.015; // 15mm negative recess against ceiling (y = 3.20m)

/**
 * Constructs a closed 2D cloud contour inspired by the organic Puffy cloud
 * silhouette (4 billowy lobes + gentle undulating base, zero typography),
 * normalized and centered at (0, 0) to exact metric span (width x length).
 */
function buildCloudContourPoints(width: number, length: number): THREE.Vector2[] {
  const rawShape = new THREE.Shape();

  // Construct upright in standard 2D (+Y = top of cloud), then flip Y for world +Z orientation
  // Start at lower-left junction
  rawShape.moveTo(-0.42, -0.20);

  // Lobe 1: Left billowy puff
  rawShape.bezierCurveTo(-0.64, -0.18, -0.64, 0.14, -0.34, 0.14);

  // Lobe 2: Signature tall central-left crown lobe
  rawShape.bezierCurveTo(-0.30, 0.48, 0.14, 0.50, 0.20, 0.18);

  // Lobe 3: Right-upper billowy puff
  rawShape.bezierCurveTo(0.42, 0.24, 0.60, 0.06, 0.52, -0.10);

  // Lobe 4: Right-lower rounded puff into soft base
  rawShape.bezierCurveTo(0.56, -0.28, 0.34, -0.32, 0.18, -0.24);

  // Soft undulating Puffy cloud base returning to start
  rawShape.bezierCurveTo(0.02, -0.18, -0.20, -0.28, -0.42, -0.20);

  const sampled = rawShape.getPoints(160);
  // Remove duplicate closing point if present
  if (sampled.length > 1 && sampled[0].distanceTo(sampled[sampled.length - 1]) < 1e-5) {
    sampled.pop();
  }

  // Flip Y so that with rotation [-PI/2, 0, 0], the billowy crown faces +Z (top of upward-angled view)
  for (const pt of sampled) {
    pt.y = -pt.y;
  }

  // Compute raw bounds to normalize to exact metric footprint
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const pt of sampled) {
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
  }

  const rawW = maxX - minX || 1;
  const rawH = maxY - minY || 1;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  const scaleX = width / rawW;
  const scaleY = length / rawH;

  const normalized = sampled.map(
    (pt) => new THREE.Vector2((pt.x - centerX) * scaleX, (pt.y - centerY) * scaleY),
  );

  // Ensure counter-clockwise winding for outer Three.js Shape
  if (THREE.ShapeUtils.isClockWise(normalized)) {
    normalized.reverse();
  }

  return normalized;
}

function createShapeFromPoints(points: THREE.Vector2[]): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    shape.lineTo(points[i].x, points[i].y);
  }
  shape.closePath();
  return shape;
}

function createPathFromPoints(points: THREE.Vector2[]): THREE.Path {
  const path = new THREE.Path();
  path.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    path.lineTo(points[i].x, points[i].y);
  }
  path.closePath();
  return path;
}

export const CLOUD_CEILING_POSITION: [number, number, number] = [0.0, 3.185, 0.70];

export interface PuffyCloudCeilingLightOptions {
  /** Ceiling plane Y coordinate in meters (default: 3.20m) */
  ceilingY?: number;
  /** World X position (default: 0.0) */
  positionX?: number;
  /** World Z position (default: 0.70, geometric room center) */
  positionZ?: number;
  /** Whether to enable the integrated downward ambient PointLight (default: true) */
  enableAmbientLight?: boolean;
  /** Intensity of the integrated ambient PointLight (default: 1.4) */
  ambientLightIntensity?: number;
}

export interface PuffyCloudCeilingLightInstance extends BedroomAssetInstance {
  ceilingAmbientLight: THREE.PointLight;
}

/**
 * LEGO Component: Puffy Cloud Architectural Ceiling Light
 * Flush-mounted organic cloud fixture with 10mm aluminum trim bezel,
 * translucent opal acrylic diffuser, 15mm halo standoff recess, and
 * integrated 3200K ambient fill PointLight at room center.
 */
export function createPuffyCloudCeilingLight(
  options: PuffyCloudCeilingLightOptions = {},
): PuffyCloudCeilingLightInstance {
  const ceilingY = options.ceilingY ?? 3.20;
  const positionX = options.positionX ?? CLOUD_CEILING_POSITION[0];
  const positionZ = options.positionZ ?? CLOUD_CEILING_POSITION[2];
  const enableAmbientLight = options.enableAmbientLight ?? true;
  const ambientLightIntensity = options.ambientLightIntensity ?? 1.4;

  const group = new THREE.Group();
  group.name = 'PuffyCloudCeilingLight';

  // Flush-mounted at room center: [0.0, 3.185, 0.70], rotation: [-PI/2, 0, 0]
  // With rx = -PI/2, local +Z maps to World +Y (upward toward ceiling).
  const anchorY = ceilingY - HALO_STANDOFF_GAP; // 3.185m when ceilingY = 3.20m
  group.position.set(positionX, anchorY, positionZ);
  group.rotation.set(-Math.PI / 2, 0, 0);
  group.scale.set(1, 1, 1);

  const localBezelMat = cloudBezelMaterial.clone();
  const localDiffuserMat = cloudDiffuserMaterial.clone();
  const localStandoffMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#E8E4DC'),
    roughness: 0.45,
    metalness: 0.15,
  });
  const localHaloGlowMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#FFF8EE'),
    emissive: new THREE.Color('#FFF3E0'),
    emissiveIntensity: 0.55,
    roughness: 0.3,
    metalness: 0.0,
  });

  const meshes: THREE.Mesh[] = [];

  // Account for bevelSize so total outer footprint stays ~1.20m x 0.85m
  const outerCoreW = TARGET_WIDTH - BEVEL_SIZE * 2;
  const outerCoreL = TARGET_LENGTH - BEVEL_SIZE * 2;
  const innerW = outerCoreW - BEZEL_BAND_WIDTH * 2;
  const innerL = outerCoreL - BEZEL_BAND_WIDTH * 2;

  const outerPoints = buildCloudContourPoints(outerCoreW, outerCoreL);
  const innerScaleX = innerW / outerCoreW;
  const innerScaleY = innerL / outerCoreL;
  const innerPoints = outerPoints.map(
    (pt) => new THREE.Vector2(pt.x * innerScaleX, pt.y * innerScaleY),
  );

  // Reverse inner points to CW for clean hole triangulation
  const innerHolePoints = [...innerPoints].reverse();

  // 1. Perimeter Trim Bezel (Slim 10mm aluminum rim framing the cloud shape)
  const bezelShape = createShapeFromPoints(outerPoints);
  bezelShape.holes.push(createPathFromPoints(innerHolePoints));

  const bezelCoreDepth = HOUSING_DEPTH - BEVEL_THICKNESS * 2; // 0.034m core + 2*0.008m bevel = 0.05m total
  const bezelGeo = new THREE.ExtrudeGeometry(bezelShape, {
    depth: bezelCoreDepth,
    bevelEnabled: true,
    bevelThickness: BEVEL_THICKNESS,
    bevelSize: BEVEL_SIZE,
    bevelSegments: BEVEL_SEGMENTS,
    curveSegments: 32,
  });
  // Top of bezel sits at local z = 0 (World y = 3.185m, leaving 15mm halo standoff below ceiling 3.20m)
  const bezelTopLocalZ = 0;
  bezelGeo.translate(0, 0, bezelTopLocalZ - (bezelCoreDepth + BEVEL_THICKNESS));

  const bezelMesh = new THREE.Mesh(bezelGeo, localBezelMat);
  bezelMesh.name = 'CloudPerimeterTrimBezel';
  bezelMesh.castShadow = true;
  bezelMesh.receiveShadow = true;
  group.add(bezelMesh);
  meshes.push(bezelMesh);

  // 2. Bottom Diffuser Face (Opal acrylic face emitting soft, uniform light downwards)
  const diffuserShape = createShapeFromPoints(innerPoints);
  const diffuserDepth = 0.032;
  const diffuserBevel = 0.005;
  const diffuserGeo = new THREE.ExtrudeGeometry(diffuserShape, {
    depth: diffuserDepth,
    bevelEnabled: true,
    bevelThickness: diffuserBevel,
    bevelSize: 0.004,
    bevelSegments: 4,
    curveSegments: 32,
  });
  // Recessed 2mm inside the bottom bezel lip (bezel bottom is at -0.050m -> diffuser bottom at -0.048m)
  const bezelBottomLocalZ = bezelTopLocalZ - HOUSING_DEPTH; // -0.050m (World y = 3.135m)
  diffuserGeo.translate(0, 0, bezelBottomLocalZ + 0.002 + diffuserBevel);

  const diffuserMesh = new THREE.Mesh(diffuserGeo, localDiffuserMat);
  diffuserMesh.name = 'CloudOpalDiffuserFace';
  diffuserMesh.receiveShadow = false;
  group.add(diffuserMesh);
  meshes.push(diffuserMesh);

  // 3. Halo Standoff Mounting Hub (15mm negative recess against ceiling y = 3.20m)
  const standoffPoints = outerPoints.map((pt) => new THREE.Vector2(pt.x * 0.72, pt.y * 0.72));
  const standoffShape = createShapeFromPoints(standoffPoints);
  const standoffGeo = new THREE.ExtrudeGeometry(standoffShape, {
    depth: HALO_STANDOFF_GAP,
    bevelEnabled: false,
    curveSegments: 24,
  });
  // Spans from local z = 0 (World y=3.185m) up to +0.015m (World y=3.200m flush with ceiling)
  standoffGeo.translate(0, 0, bezelTopLocalZ);

  const standoffMesh = new THREE.Mesh(standoffGeo, localStandoffMat);
  standoffMesh.name = 'CloudCeilingStandoffHub';
  standoffMesh.castShadow = false;
  standoffMesh.receiveShadow = true;
  group.add(standoffMesh);
  meshes.push(standoffMesh);

  // Subtle upward halo glow ring inside the 15mm standoff recess
  const haloPoints = outerPoints.map((pt) => new THREE.Vector2(pt.x * 0.88, pt.y * 0.88));
  const haloHolePoints = outerPoints.map((pt) => new THREE.Vector2(pt.x * 0.74, pt.y * 0.74)).reverse();
  const haloShape = createShapeFromPoints(haloPoints);
  haloShape.holes.push(createPathFromPoints(haloHolePoints));
  const haloGeo = new THREE.ExtrudeGeometry(haloShape, {
    depth: 0.003,
    bevelEnabled: false,
    curveSegments: 24,
  });
  haloGeo.translate(0, 0, bezelTopLocalZ);

  const haloMesh = new THREE.Mesh(haloGeo, localHaloGlowMat);
  haloMesh.name = 'CloudCeilingHaloGlow';
  group.add(haloMesh);
  meshes.push(haloMesh);

  // III. Integrated Ambient Lighting Rig (Centered under the cloud)
  const ceilingAmbientLight = new THREE.PointLight(
    0xfff4e5,
    enableAmbientLight ? ambientLightIntensity : 0,
    6.0,
    2.0,
  );
  ceilingAmbientLight.name = 'CloudCeilingAmbientLight';
  // Local -Z points downward into the room (-0.065m => World y = 3.12m, just below diffuser)
  ceilingAmbientLight.position.set(0, 0, -0.065);
  ceilingAmbientLight.castShadow = false; // Soft fill light only to avoid shadow clutter
  group.add(ceilingAmbientLight);

  // IV. Registration
  registerBedroomComponent({
    id: 'puffy-cloud-ceiling-light',
    name: 'Puffy Cloud Ceiling Fixture',
    category: 'lighting',
    dimensions: { width: TARGET_WIDTH, height: HOUSING_DEPTH, depth: TARGET_LENGTH },
    defaultTransform: {
      position: [positionX, anchorY, positionZ],
      rotation: [-Math.PI / 2, 0, 0],
      scale: [1, 1, 1],
    },
    materialSlots: [
      'cloud-perimeter-trim-bezel',
      'cloud-opal-diffuser',
      'cloud-ceiling-standoff',
    ],
    disposableMeshes: meshes,
  });

  const dispose = () => {
    disposeComponent('puffy-cloud-ceiling-light');
    localBezelMat.dispose();
    localDiffuserMat.dispose();
    localStandoffMat.dispose();
    localHaloGlowMat.dispose();
    ceilingAmbientLight.dispose();
  };

  return {
    group,
    meshes,
    ceilingAmbientLight,
    dispose,
  };
}

// ============================================================================
// REACT COMPONENT MOUNT WRAPPER
// ============================================================================

export interface PuffyCloudCeilingLightProps extends PuffyCloudCeilingLightOptions {
  scene?: THREE.Scene;
}

export function PuffyCloudCeilingLight({
  scene,
  ...options
}: PuffyCloudCeilingLightProps) {
  useEffect(() => {
    if (!scene) return;
    const asset = createPuffyCloudCeilingLight(options);
    scene.add(asset.group);
    return () => {
      scene.remove(asset.group);
      asset.dispose();
    };
  }, [
    scene,
    options.ceilingY,
    options.positionX,
    options.positionZ,
    options.enableAmbientLight,
    options.ambientLightIntensity,
  ]);

  return null;
}
