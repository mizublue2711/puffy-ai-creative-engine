import { useEffect } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { registerBedroomComponent, disposeComponent } from '../../BedroomRegistry.ts';
import type { BedroomAssetInstance } from '../PuffyBedFrame.tsx';

export interface TrailingVinesRigOptions {
  /**
   * Inner corner pivot [X, Y, Z] flush against the outdoor privacy U-wall
   * (LongWall inner face x = -6.525m, ReturnWall inner face z = -2.475m).
   * Default: [-6.40, 3.70, -2.35].
   */
  cornerPivot?: [number, number, number];
  /** Planter length along +Z on the long privacy wall. Default: 3.50m (z = -2.35m .. +1.15m). */
  planterLengthZ?: number;
  /** Planter return length along +X on the rear privacy wall. Default: 2.20m (x = -6.40m .. -4.20m, strictly <= -4.10m). */
  planterReturnX?: number;
  /** Number of vine strands along the long wall (Wing A). Default: 20. */
  strandsWingA?: number;
  /** Number of vine strands along the rear wall (Wing B). Default: 14. */
  strandsWingB?: number;
  /** Seed for deterministic PRNG. Default: 0x5eed. */
  seed?: number;
}

/**
 * PBR Material for trailing golden pothos leaves.
 * Reserved slots for An's local PBR maps (map, alphaMap, normalMap).
 */
export const trailingVineLeafMaterial = new THREE.MeshPhysicalMaterial({
  color: new THREE.Color('#41644A'), // Vibrant Golden Pothos Green
  roughness: 0.30,
  metalness: 0.0,
  transmission: 0.50,                // Catches backlight through window glass
  thickness: 0.008,
  side: THREE.DoubleSide,
  transparent: true,
  opacity: 0.96,
  // Texture maps to be bound by An:
  // map: leafBaseColorMap,
  // alphaMap: leafAlphaCutoutMap,
  // normalMap: leafNormalMap,
});

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Curved leaf prototype with central spine V-trough fold
 * and heart-shaped silhouette (notch at petiole, soft tip at apex).
 */
function createCurvedLeafPrototype(): THREE.PlaneGeometry {
  const w = 0.12;
  const h = 0.18;
  const geo = new THREE.PlaneGeometry(w, h, 2, 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    const isTop = y > h * 0.25;
    const isBottom = y < -h * 0.25;
    const isCenter = Math.abs(x) < 1e-5;

    if (isTop && isCenter) y -= h * 0.20;
    if (isBottom) {
      if (isCenter) y -= h * 0.04;
      else x *= 0.18;
    }
    if (isTop && !isCenter) x *= 0.92;

    const z = -Math.abs(x) * 0.3;
    pos.setXYZ(i, x, y, z);
  }
  geo.translate(0, -(h * 0.5 - h * 0.20), 0);
  geo.computeVertexNormals();
  return geo;
}

interface StrandDefinition {
  curve: THREE.CatmullRomCurve3;
  strandLength: number;
  dist: number;
}

/**
 * LEGO Component: Trailing Pothos Vines Rig (Module 05)
 * Wall-mounted architectural planter coping flush against the outdoor concrete U-wall,
 * with organic cascading vine curtain and InstancedMesh leaves.
 * STRICT RULE: All geometry strictly outdoors at x <= -4.10m (>= 30cm air gap to glass at x = -3.80m).
 */
export function createTrailingVinesRig(options: TrailingVinesRigOptions = {}): BedroomAssetInstance {
  const [cornerX, planterY, cornerZ] = options.cornerPivot ?? [-6.40, 3.70, -2.35];
  const lengthZ = options.planterLengthZ ?? 3.50;
  // Clamp returnX so the rear planter ledge never extends past x = -4.20m
  const returnX = Math.min(options.planterReturnX ?? 2.20, -4.20 - cornerX);
  const countA = options.strandsWingA ?? 20;
  const countB = options.strandsWingB ?? 14;
  const rand = mulberry32(options.seed ?? 0x5eed);

  const group = new THREE.Group();
  group.name = 'TrailingVinesRig';
  const meshes: THREE.Mesh[] = [];

  // --------------------------------------------------------------------------
  // 1. Wall-Mounted Architectural Planter Ledge & Coping (Flush with U-Wall)
  // --------------------------------------------------------------------------
  const planterMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#2A2826'), // Dark bronze / basalt architectural coping
    roughness: 0.70,
    metalness: 0.25,
  });

  const soilMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#1A1614'), // Organic potting soil
    roughness: 0.95,
    metalness: 0.0,
  });

  const stemMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#384D2B'),
    roughness: 0.68,
    metalness: 0.05,
  });

  const planterGeos: THREE.BufferGeometry[] = [];
  const soilGeos: THREE.BufferGeometry[] = [];

  // Long-wall planter ledge (0.25m wide, 0.08m tall, 3.50m long) flush against CourtyardLongWall (x = -6.525m)
  const centerZ = cornerZ + lengthZ / 2 - 0.125;
  const mainLedgeGeo = new THREE.BoxGeometry(0.25, 0.08, lengthZ);
  mainLedgeGeo.translate(cornerX, planterY, centerZ);
  planterGeos.push(mainLedgeGeo);

  const mainSoilGeo = new THREE.BoxGeometry(0.20, 0.015, lengthZ - 0.04);
  mainSoilGeo.translate(cornerX, planterY + 0.036, centerZ);
  soilGeos.push(mainSoilGeo);

  // Rear-wall planter ledge along X, flush against CourtyardReturnWall (z = -2.475m), stopping at x = -4.20m
  const returnCenterX = cornerX + returnX / 2 - 0.125;
  const returnLedgeGeo = new THREE.BoxGeometry(returnX, 0.08, 0.25);
  returnLedgeGeo.translate(returnCenterX, planterY, cornerZ);
  planterGeos.push(returnLedgeGeo);

  const returnSoilGeo = new THREE.BoxGeometry(returnX - 0.04, 0.015, 0.20);
  returnSoilGeo.translate(returnCenterX, planterY + 0.036, cornerZ);
  soilGeos.push(returnSoilGeo);

  const mergedPlanterGeo = mergeGeometries(planterGeos, false);
  planterGeos.forEach((g) => g.dispose());
  const planterMesh = new THREE.Mesh(mergedPlanterGeo, planterMat);
  planterMesh.name = 'CourtyardPlanterLedge';
  planterMesh.castShadow = true;
  planterMesh.receiveShadow = true;
  group.add(planterMesh);
  meshes.push(planterMesh);

  const mergedSoilGeo = mergeGeometries(soilGeos, false);
  soilGeos.forEach((g) => g.dispose());
  const soilMesh = new THREE.Mesh(mergedSoilGeo, soilMat);
  soilMesh.name = 'CourtyardPlanterSoil';
  soilMesh.receiveShadow = true;
  group.add(soilMesh);
  meshes.push(soilMesh);

  // --------------------------------------------------------------------------
  // 2. Procedural Vine Strands (Asymmetric Gradient Clumping)
  // --------------------------------------------------------------------------
  const soilSurfaceY = planterY + 0.043; // y = 3.743m
  const stemGeometries: THREE.BufferGeometry[] = [];
  const strands: StrandDefinition[] = [];

  // Wing A: Along +Z on the long privacy wall (x ~ -6.32m, cascading down the inner wall face)
  for (let i = 0; i < countA; i++) {
    const dist = countA === 1 ? 0 : i / (countA - 1);
    const spacingOffset = Math.pow(dist, 1.3) * (lengthZ - 0.25);
    const anchorX = cornerX + 0.05 + (rand() - 0.5) * 0.04;
    const anchorZ = cornerZ + spacingOffset;

    // Deep corner drops 3.44m (down to y = 0.30m near gravel floor), tapering to 0.55m at outer end
    const strandLength = THREE.MathUtils.lerp(3.44, 0.55, Math.pow(dist, 0.65)) + (rand() * 0.22 - 0.11);

    const pts: THREE.Vector3[] = [];
    const numPts = 7;
    const swayPhase = rand() * Math.PI * 2;
    const swayFreq = 2.2 + rand() * 1.4;

    for (let p = 0; p < numPts; p++) {
      const t = p / (numPts - 1);
      const curY = soilSurfaceY - t * strandLength;
      // Crest over the front lip (+X) and drape down just in front of the wall/planter
      const lipArcX = Math.min(0.11, t * 0.65) * 0.12 + Math.sin(t * Math.PI) * 0.03;
      const swayX = Math.sin(t * swayFreq + swayPhase) * 0.02 * Math.sqrt(t);
      const swayZ = Math.cos(t * swayFreq * 0.8 + swayPhase) * 0.03 * Math.sqrt(t);

      const curX = Math.min(-4.22, anchorX + lipArcX + swayX);
      const curZ = anchorZ + swayZ;
      pts.push(new THREE.Vector3(curX, curY, curZ));
    }

    const curve = new THREE.CatmullRomCurve3(pts);
    strands.push({ curve, strandLength, dist });
    stemGeometries.push(new THREE.TubeGeometry(curve, 18, 0.0035, 4, false));
  }

  // Wing B: Along +X on the rear return wall (from x = -6.40m to x = -4.25m, strictly <= -4.10m)
  for (let i = 1; i <= countB; i++) {
    const dist = i / countB;
    const maxSpanX = Math.max(0.2, returnX - 0.20);
    const spacingOffset = Math.pow(dist, 1.25) * maxSpanX;
    const anchorX = Math.min(-4.24, cornerX + spacingOffset);
    const anchorZ = cornerZ + 0.05 + (rand() - 0.5) * 0.04;

    const strandLength = THREE.MathUtils.lerp(3.44, 0.60, Math.pow(dist, 0.65)) + (rand() * 0.22 - 0.11);

    const pts: THREE.Vector3[] = [];
    const numPts = 7;
    const swayPhase = rand() * Math.PI * 2;
    const swayFreq = 2.2 + rand() * 1.4;

    for (let p = 0; p < numPts; p++) {
      const t = p / (numPts - 1);
      const curY = soilSurfaceY - t * strandLength;
      // Crest over the front lip (+Z) and drape down against the rear concrete wall
      const lipArcZ = Math.min(0.11, t * 0.65) * 0.12 + Math.sin(t * Math.PI) * 0.03;
      const swayX = Math.sin(t * swayFreq * 0.8 + swayPhase) * 0.025 * Math.sqrt(t);
      const swayZ = Math.cos(t * swayFreq + swayPhase) * 0.02 * Math.sqrt(t);

      // STRICT RULE: Keep stem X <= -4.22m so leaves (radius ~0.10m) never exceed x = -4.10m
      const curX = Math.min(-4.22, anchorX + swayX);
      const curZ = anchorZ + lipArcZ + swayZ;
      pts.push(new THREE.Vector3(curX, curY, curZ));
    }

    const curve = new THREE.CatmullRomCurve3(pts);
    strands.push({ curve, strandLength, dist });
    stemGeometries.push(new THREE.TubeGeometry(curve, 18, 0.0035, 4, false));
  }

  // --------------------------------------------------------------------------
  // 3. Merged Stems Mesh (1 Draw Call)
  // --------------------------------------------------------------------------
  const mergedStemGeo = mergeGeometries(stemGeometries, false);
  stemGeometries.forEach((g) => g.dispose());

  const mergedStemsMesh = new THREE.Mesh(mergedStemGeo, stemMaterial);
  mergedStemsMesh.name = 'TrailingVines_MergedStems';
  mergedStemsMesh.castShadow = true;
  mergedStemsMesh.receiveShadow = true;
  group.add(mergedStemsMesh);
  meshes.push(mergedStemsMesh);

  // --------------------------------------------------------------------------
  // 4. Instanced Leaves Rendering (1 Draw Call)
  // --------------------------------------------------------------------------
  const leafGeometry = createCurvedLeafPrototype();
  const maxLeaves = 1600;
  const leafInstancedMesh = new THREE.InstancedMesh(leafGeometry, trailingVineLeafMaterial, maxLeaves);
  leafInstancedMesh.name = 'TrailingVines_InstancedLeaves';
  leafInstancedMesh.castShadow = true;
  leafInstancedMesh.receiveShadow = true;

  const dummy = new THREE.Object3D();
  let leafCount = 0;

  strands.forEach((strand) => {
    const leafSpacing = THREE.MathUtils.lerp(0.075, 0.095, strand.dist);
    const numLeaves = Math.max(5, Math.floor(strand.strandLength / leafSpacing));

    for (let l = 1; l <= numLeaves; l++) {
      if (leafCount >= maxLeaves) break;

      const u = l / (numLeaves + 0.6);
      const pt = strand.curve.getPointAt(u);
      const tangent = strand.curve.getTangentAt(u).normalize();

      const side = l % 2 === 0 ? 1 : -1;
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      if (normal.lengthSq() < 1e-4) normal.set(1, 0, 0);

      // STRICT RULE: Enforce leaf attachment X <= -4.21m so blade stays <= -4.10m
      const leafPosX = Math.min(-4.21, pt.x + normal.x * side * 0.012);
      const leafPosZ = pt.z + normal.z * side * 0.012;
      dummy.position.set(leafPosX, pt.y, leafPosZ);

      dummy.rotation.set(
        0.42 + rand() * 0.28,
        rand() * Math.PI * 2,
        Math.sin(l * 0.5) * 0.25,
      );

      const scaleFactor = THREE.MathUtils.lerp(1.12, 0.62, u) * (0.85 + rand() * 0.28);
      dummy.scale.set(scaleFactor, scaleFactor, scaleFactor);

      dummy.updateMatrix();
      leafInstancedMesh.setMatrixAt(leafCount++, dummy.matrix);
    }
  });

  leafInstancedMesh.count = leafCount;
  leafInstancedMesh.instanceMatrix.needsUpdate = true;
  group.add(leafInstancedMesh);
  meshes.push(leafInstancedMesh);

  registerBedroomComponent({
    id: 'trailing-vines-rig',
    name: 'Courtyard Trailing Vines Rig',
    category: 'decor',
    dimensions: { width: returnX + 0.25, height: 3.50, depth: lengthZ + 0.25 },
    defaultTransform: {
      position: [cornerX, planterY, cornerZ],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    materialSlots: ['architectural-coping', 'potting-soil', 'trailing-vine-stem', 'trailing-vine-leaf'],
    disposableMeshes: meshes,
  });

  return {
    group,
    meshes,
    dispose: () => disposeComponent('trailing-vines-rig'),
  };
}

export function TrailingVinesRig({ scene, ...options }: TrailingVinesRigOptions & { scene?: THREE.Scene }) {
  useEffect(() => {
    if (!scene) return;
    const asset = createTrailingVinesRig(options);
    scene.add(asset.group);
    return () => {
      scene.remove(asset.group);
      asset.dispose();
    };
  }, [
    scene,
    options.cornerPivot,
    options.planterLengthZ,
    options.planterReturnX,
    options.strandsWingA,
    options.strandsWingB,
    options.seed,
  ]);

  return null;
}
