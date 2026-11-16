import { useEffect } from 'react';
import * as THREE from 'three';
import { registerBedroomComponent, disposeComponent } from '../../BedroomRegistry.ts';
import type { BedroomAssetInstance } from '../PuffyBedFrame.tsx';

export interface FlushZenGardenRigOptions {
  offset?: [number, number, number];
  scale?: number;
  seed?: number;
}

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
 * Creates a soft deformed halved-sphere moss island mound.
 */
function createMossIslandGeometry(
  radius: number,
  height: number,
  rand: () => number,
): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(radius, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.52);
  const pos = geo.attributes.position;
  const phaseA = rand() * Math.PI * 2;
  const phaseB = rand() * Math.PI * 2;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    const angle = Math.atan2(z, x);
    const radialNorm = Math.hypot(x, z) / Math.max(0.001, radius);

    // Organic perimeter undulation + soft dome height modulation
    const lobeNoise =
      1.0 +
      0.12 * Math.sin(angle * 3.0 + phaseA) * radialNorm +
      0.07 * Math.cos(angle * 5.0 + phaseB) * radialNorm;

    const scaledY = (y / radius) * height * (0.92 + 0.16 * Math.sin(x * 4.5 + z * 3.8 + phaseA));
    pos.setXYZ(i, x * lobeNoise, Math.max(-0.02, scaledY), z * lobeNoise);
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates an irregular weathered basalt boulder with deterministic vertex jitter.
 */
function createWeatheredBoulderGeometry(
  radius: number,
  scaleVec: [number, number, number],
  rand: () => number,
): THREE.BufferGeometry {
  const geo = new THREE.DodecahedronGeometry(radius, 1);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();

  // Group coincident vertices so split faces stay watertight
  const jitterMap = new Map<string, number>();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const key = `${v.x.toFixed(3)}_${v.y.toFixed(3)}_${v.z.toFixed(3)}`;
    let jitter = jitterMap.get(key);
    if (jitter === undefined) {
      jitter = 0.80 + rand() * 0.42;
      jitterMap.set(key, jitter);
    }
    v.multiplyScalar(jitter);
    v.x *= scaleVec[0];
    v.y *= scaleVec[1];
    v.z *= scaleVec[2];
    // Flatten bottom slightly for natural ground seating
    if (v.y < -radius * scaleVec[1] * 0.35) {
      v.y *= 0.65;
    }
    pos.setXYZ(i, v.x, v.y, v.z);
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * Shared curved botanical leaf geometry (lanceolate taper + midrib V-fold + gravity arch).
 */
function createCurvedLeafGeometry(width = 0.24, length = 0.42): THREE.PlaneGeometry {
  const geo = new THREE.PlaneGeometry(width, length, 6, 6);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const origX = pos.getX(i);
    const y = pos.getY(i) + length * 0.5;
    const v = Math.min(1, Math.max(0, y / length));
    const u = origX / (width * 0.5);

    const widthProfile = Math.pow(Math.max(0, Math.sin(v * Math.PI)), 0.72);
    const taperedX = origX * widthProfile;
    const midribTrough = -0.018 * Math.abs(u) * widthProfile;
    const spineArch = 0.09 * Math.pow(v, 1.7);

    pos.setXYZ(i, taperedX, y, spineArch + midribTrough);
  }

  geo.computeVertexNormals();
  return geo;
}

interface IslandSpec {
  name: string;
  center: [number, number, number];
  mossRadius: number;
  mossHeight: number;
  boulders: Array<{
    offset: [number, number, number];
    radius: number;
    scale: [number, number, number];
    rotY: number;
  }>;
  trees: Array<{
    baseOffset: [number, number, number];
    reachX: number;
    reachZ: number;
    height: number;
    trunkRadius: number;
    canopyCount: number;
  }>;
  stems: Array<{
    baseOffset: [number, number, number];
    azimuth: number;
    reach: number;
    height: number;
    droop: number;
    leafScale: number;
  }>;
}

/**
 * Courtyard Module: Flush Zen Garden Rig (Zero Pots)
 * - 3 naturalistic organic moss islands embedded flush at ground level (y = -0.05m).
 * - 5 sculptural weathered basalt boulders (#3A3835) grounding the islands.
 * - Multi-stemmed courtyard trees & slender botanical stems sprouting directly from y = -0.05m.
 * - Low ground-cover dwarf evergreens and delicate fern sprouts around boulder bases.
 */
export function createFlushZenGardenRig(
  options: FlushZenGardenRigOptions = {},
): BedroomAssetInstance {
  const rand = mulberry32(options.seed ?? 0x4b4152);
  const groundY = -0.05;

  const group = new THREE.Group();
  group.name = 'FlushZenGardenRig';

  if (options.offset) {
    group.position.set(options.offset[0], options.offset[1], options.offset[2]);
  }
  if (options.scale !== undefined) {
    group.scale.setScalar(options.scale);
  }

  const meshes: THREE.Mesh[] = [];

  // Materials
  const mossMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#2F4F2F'),
    roughness: 0.95,
    metalness: 0.0,
    sheen: 0.6,
    sheenColor: new THREE.Color('#4B6F44'),
    sheenRoughness: 0.85,
  });

  const boulderMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#3A3835'),
    roughness: 0.88,
    metalness: 0.06,
  });

  const barkMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#463A32'),
    roughness: 0.86,
    metalness: 0.0,
  });

  const stemMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#3D5236'),
    roughness: 0.76,
    metalness: 0.0,
  });

  const canopyLeafMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#3A5A40'),
    roughness: 0.38,
    metalness: 0.0,
    transmission: 0.35,
    thickness: 0.01,
    side: THREE.DoubleSide,
  });

  const dwarfEvergreenMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#27432B'),
    roughness: 0.85,
    metalness: 0.0,
  });

  const fernMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#436846'),
    roughness: 0.48,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });

  const sharedLeafGeo = createCurvedLeafGeometry(0.22, 0.38);
  const sharedTwigLeafGeo = createCurvedLeafGeometry(0.085, 0.16);
  const sharedFernBladeGeo = createCurvedLeafGeometry(0.08, 0.24);

  const canopyLeafTransforms: THREE.Matrix4[] = [];

  const islands: IslandSpec[] = [
    // Island 1: Primary Rear Moss & Boulder Cluster (frames the Moon Mirror at x = -5.10)
    {
      name: 'ZenIsland_RearPrimary',
      center: [-5.55, groundY, -0.90],
      mossRadius: 0.72,
      mossHeight: 0.18,
      boulders: [
        { offset: [0.18, 0.12, 0.08], radius: 0.24, scale: [1.15, 1.35, 0.95], rotY: 0.45 },
        { offset: [-0.20, 0.07, 0.22], radius: 0.17, scale: [1.30, 0.82, 1.10], rotY: 1.85 },
      ],
      trees: [
        { baseOffset: [-0.08, 0.0, -0.05], reachX: -0.22, reachZ: 0.18, height: 2.15, trunkRadius: 0.032, canopyCount: 7 },
        { baseOffset: [-0.02, 0.0, -0.10], reachX: 0.24, reachZ: 0.12, height: 1.72, trunkRadius: 0.024, canopyCount: 5 },
      ],
      stems: [
        { baseOffset: [0.12, 0.0, -0.18], azimuth: 0.8, reach: 0.28, height: 0.92, droop: 0.08, leafScale: 1.0 },
        { baseOffset: [-0.22, 0.0, 0.04], azimuth: 2.4, reach: 0.32, height: 0.78, droop: 0.10, leafScale: 0.92 },
      ],
    },
    // Island 2: Primary Mid-Courtyard Moss & Boulder Cluster (framed through glass wall)
    {
      name: 'ZenIsland_MidPrimary',
      center: [-4.60, groundY, 1.35],
      mossRadius: 0.64,
      mossHeight: 0.17,
      boulders: [
        { offset: [-0.16, 0.10, -0.08], radius: 0.21, scale: [1.20, 1.18, 0.95], rotY: 2.30 },
        { offset: [0.16, 0.06, 0.16], radius: 0.15, scale: [1.35, 0.78, 1.15], rotY: 0.90 },
      ],
      trees: [
        { baseOffset: [0.02, 0.0, 0.02], reachX: -0.24, reachZ: -0.14, height: 1.55, trunkRadius: 0.025, canopyCount: 6 },
      ],
      stems: [
        { baseOffset: [-0.06, 0.0, 0.14], azimuth: 1.9, reach: 0.30, height: 0.82, droop: 0.09, leafScale: 1.05 },
        { baseOffset: [0.14, 0.0, -0.12], azimuth: 4.2, reach: 0.28, height: 0.72, droop: 0.08, leafScale: 0.95 },
        { baseOffset: [-0.15, 0.0, 0.05], azimuth: 3.1, reach: 0.34, height: 0.65, droop: 0.10, leafScale: 0.90 },
      ],
    },
    // Island 3: Secondary Front Moss & Boulder Accent
    {
      name: 'ZenIsland_FrontAccent',
      center: [-5.65, groundY, 3.45],
      mossRadius: 0.48,
      mossHeight: 0.15,
      boulders: [
        { offset: [0.10, 0.08, -0.06], radius: 0.18, scale: [1.22, 1.05, 1.00], rotY: 1.15 },
      ],
      trees: [],
      stems: [
        { baseOffset: [-0.06, 0.0, 0.05], azimuth: 0.5, reach: 0.28, height: 0.95, droop: 0.08, leafScale: 1.0 },
        { baseOffset: [0.04, 0.0, 0.12], azimuth: 1.8, reach: 0.32, height: 0.80, droop: 0.09, leafScale: 0.92 },
        { baseOffset: [-0.10, 0.0, -0.06], azimuth: 3.6, reach: 0.26, height: 0.72, droop: 0.07, leafScale: 0.88 },
        { baseOffset: [0.08, 0.0, 0.02], azimuth: 5.1, reach: 0.24, height: 1.04, droop: 0.07, leafScale: 0.95 },
      ],
    },
  ];

  const upAxis = new THREE.Vector3(0, 1, 0);

  for (const island of islands) {
    const [ix, iy, iz] = island.center;

    // 1. Organic Moss Island Mound (flush at y = -0.05m)
    const mossGeo = createMossIslandGeometry(island.mossRadius, island.mossHeight, rand);
    const mossMesh = new THREE.Mesh(mossGeo, mossMat);
    mossMesh.name = `${island.name}_MossMound`;
    mossMesh.position.set(ix, iy, iz);
    mossMesh.castShadow = true;
    mossMesh.receiveShadow = true;
    group.add(mossMesh);
    meshes.push(mossMesh);

    // 2. Weathered Basalt Boulders
    island.boulders.forEach((b, bIdx) => {
      const boulderGeo = createWeatheredBoulderGeometry(b.radius, b.scale, rand);
      const boulderMesh = new THREE.Mesh(boulderGeo, boulderMat);
      boulderMesh.name = `${island.name}_Boulder_${bIdx + 1}`;
      boulderMesh.position.set(ix + b.offset[0], iy + b.offset[1], iz + b.offset[2]);
      boulderMesh.rotation.y = b.rotY;
      boulderMesh.castShadow = true;
      boulderMesh.receiveShadow = true;
      group.add(boulderMesh);
      meshes.push(boulderMesh);

      // Low Ground-Cover Dwarf Evergreens & Fern Sprouts around each boulder base
      const evergreenCount = 2;
      for (let e = 0; e < evergreenCount; e++) {
        const ang = b.rotY + e * 2.2 + 0.6;
        const dist = b.radius * 1.05;
        const tuftGeo = new THREE.DodecahedronGeometry(0.08 + rand() * 0.04, 1);
        const tuftMesh = new THREE.Mesh(tuftGeo, dwarfEvergreenMat);
        tuftMesh.name = `${island.name}_DwarfEvergreen_${bIdx + 1}_${e + 1}`;
        tuftMesh.position.set(
          ix + b.offset[0] + Math.cos(ang) * dist,
          iy + 0.08,
          iz + b.offset[2] + Math.sin(ang) * dist,
        );
        tuftMesh.scale.set(1.25, 0.72, 1.15);
        tuftMesh.castShadow = true;
        tuftMesh.receiveShadow = true;
        group.add(tuftMesh);
        meshes.push(tuftMesh);
      }

      // Delicate Fern Sprout Rosette (4 arched fronds per cluster)
      const fernOriginX = ix + b.offset[0] - Math.cos(b.rotY) * (b.radius * 0.95);
      const fernOriginZ = iz + b.offset[2] - Math.sin(b.rotY) * (b.radius * 0.95);
      for (let f = 0; f < 4; f++) {
        const fAng = b.rotY + (f / 4) * Math.PI * 2 + 0.3;
        const frond = new THREE.Mesh(sharedFernBladeGeo, fernMat);
        frond.name = `${island.name}_FernFrond_${bIdx + 1}_${f + 1}`;
        frond.position.set(fernOriginX, iy + 0.06, fernOriginZ);
        frond.rotation.set(0.85, fAng, 0, 'YXZ');
        frond.castShadow = true;
        frond.receiveShadow = true;
        group.add(frond);
        meshes.push(frond);
      }
    });

    // 3. Sculptural Courtyard Trees sprouting directly from ground level (y = -0.05m)
    island.trees.forEach((tree, tIdx) => {
      const tx = ix + tree.baseOffset[0];
      const tz = iz + tree.baseOffset[2];
      const p0 = new THREE.Vector3(tx, iy, tz);
      const p1 = new THREE.Vector3(
        tx + tree.reachX * 0.22,
        iy + tree.height * 0.38,
        tz + tree.reachZ * 0.22,
      );
      const p2 = new THREE.Vector3(
        tx + tree.reachX * 0.65,
        iy + tree.height * 0.76,
        tz + tree.reachZ * 0.65,
      );
      const p3 = new THREE.Vector3(
        tx + tree.reachX,
        iy + tree.height,
        tz + tree.reachZ,
      );

      const trunkCurve = new THREE.CatmullRomCurve3([p0, p1, p2, p3]);
      const trunkGeo = new THREE.TubeGeometry(trunkCurve, 12, tree.trunkRadius, 7, false);
      const trunkMesh = new THREE.Mesh(trunkGeo, barkMat);
      trunkMesh.name = `${island.name}_TreeTrunk_${tIdx + 1}`;
      trunkMesh.castShadow = true;
      trunkMesh.receiveShadow = true;
      group.add(trunkMesh);
      meshes.push(trunkMesh);

      // Layered airy Zen foliage sprays (delicate radiating leaves on upper branches)
      const dummy = new THREE.Object3D();
      for (let c = 0; c < tree.canopyCount; c++) {
        const frac = 0.58 + (c / Math.max(1, tree.canopyCount - 1)) * 0.42;
        const pt = trunkCurve.getPoint(Math.min(1, frac));
        const clusterAngle = c * 2.15 + tIdx;
        const clusterSpread = 0.14 + (c % 2) * 0.12;
        const cx = pt.x + Math.cos(clusterAngle) * clusterSpread;
        const cy = pt.y + (c === tree.canopyCount - 1 ? 0.05 : -0.02);
        const cz = pt.z + Math.sin(clusterAngle) * clusterSpread;

        // 18 delicate leaves per spray tier
        for (let l = 0; l < 18; l++) {
          const az = (l / 18) * Math.PI * 2 + rand() * 0.45;
          const r = 0.04 + rand() * 0.18;
          dummy.position.set(
            cx + Math.cos(az) * r,
            cy + (rand() - 0.5) * 0.07,
            cz + Math.sin(az) * r,
          );
          dummy.rotation.set(
            0.95 + (rand() - 0.5) * 0.5,
            az,
            (rand() - 0.5) * 0.4,
            'YXZ',
          );
          const sc = 0.75 + rand() * 0.65;
          dummy.scale.setScalar(sc);
          dummy.updateMatrix();
          canopyLeafTransforms.push(dummy.matrix.clone());
        }
      }
    });

    // 4. Slender Botanical Stems sprouting directly from ground level (y = -0.05m)
    island.stems.forEach((stem, sIdx) => {
      const sx = ix + stem.baseOffset[0];
      const sz = iz + stem.baseOffset[2];
      const cosA = Math.cos(stem.azimuth);
      const sinA = Math.sin(stem.azimuth);

      const p0 = new THREE.Vector3(sx, iy, sz);
      const p1 = new THREE.Vector3(sx + cosA * stem.reach * 0.25, iy + stem.height * 0.42, sz + sinA * stem.reach * 0.25);
      const p2 = new THREE.Vector3(sx + cosA * stem.reach * 0.68, iy + stem.height * 0.84, sz + sinA * stem.reach * 0.68);
      const p3 = new THREE.Vector3(sx + cosA * stem.reach, iy + stem.height - stem.droop, sz + sinA * stem.reach);

      const curve = new THREE.CatmullRomCurve3([p0, p1, p2, p3]);
      const stemGeo = new THREE.TubeGeometry(curve, 8, 0.007, 5, false);
      const stemMesh = new THREE.Mesh(stemGeo, stemMat);
      stemMesh.name = `${island.name}_Stem_${sIdx + 1}`;
      stemMesh.castShadow = true;
      stemMesh.receiveShadow = true;
      group.add(stemMesh);
      meshes.push(stemMesh);

      const leafMesh = new THREE.Mesh(sharedLeafGeo, canopyLeafMat);
      leafMesh.name = `${island.name}_Leaf_${sIdx + 1}`;
      leafMesh.position.copy(p3);
      const outwardDir = new THREE.Vector3(cosA, 0, sinA).normalize();
      const yawQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), outwardDir);
      const tiltQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.68, 0, (sIdx % 2 === 0 ? 1 : -1) * 0.12, 'YXZ'));
      leafMesh.quaternion.copy(yawQuat).multiply(tiltQuat);
      leafMesh.rotateOnWorldAxis(upAxis, (sIdx % 2 === 0 ? 1 : -1) * 0.15);
      leafMesh.scale.setScalar(stem.leafScale);
      leafMesh.castShadow = true;
      leafMesh.receiveShadow = true;
      group.add(leafMesh);
      meshes.push(leafMesh);
    });
  }

  if (canopyLeafTransforms.length > 0) {
    const canopyInstanced = new THREE.InstancedMesh(
      sharedTwigLeafGeo,
      canopyLeafMat,
      canopyLeafTransforms.length,
    );
    canopyInstanced.name = 'ZenTreeCanopyLeavesInstanced';
    canopyLeafTransforms.forEach((mat, i) => {
      canopyInstanced.setMatrixAt(i, mat);
    });
    canopyInstanced.instanceMatrix.needsUpdate = true;
    canopyInstanced.castShadow = true;
    canopyInstanced.receiveShadow = true;
    group.add(canopyInstanced);
    meshes.push(canopyInstanced);
  }

  registerBedroomComponent({
    id: 'flush-zen-garden-rig',
    name: 'Flush Zen Garden Moss Islands, Boulders & Trees',
    category: 'decor',
    dimensions: { width: 2.5, height: 2.3, depth: 5.5 },
    defaultTransform: {
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    materialSlots: [
      'forest-moss-island',
      'weathered-basalt-boulder',
      'zen-tree-bark',
      'zen-botanical-stem',
      'zen-foliage',
      'dwarf-evergreen',
      'fern-sprout',
    ],
    disposableMeshes: meshes,
  });

  return {
    group,
    meshes,
    dispose: () => disposeComponent('flush-zen-garden-rig'),
  };
}

export function FlushZenGardenRig({
  scene,
  ...options
}: FlushZenGardenRigOptions & { scene?: THREE.Scene }) {
  useEffect(() => {
    if (!scene) return;
    const asset = createFlushZenGardenRig(options);
    scene.add(asset.group);
    return () => {
      scene.remove(asset.group);
      asset.dispose();
    };
  }, [scene, options.offset, options.scale, options.seed]);

  return null;
}
