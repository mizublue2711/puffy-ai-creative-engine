import { useEffect } from 'react';
import * as THREE from 'three';
import { registerBedroomComponent, disposeComponent } from '../../BedroomRegistry.ts';
import type { BedroomAssetInstance } from '../PuffyBedFrame.tsx';

export interface TropicalPlanterRigOptions {
  offset?: [number, number, number];
  scale?: number;
}

/**
 * Shared placeholder leaf material ready for external PBR texture binding
 * (baseColor, alpha cutout, and normal maps).
 */
export const tropicalLeafPlaceholderMaterial = new THREE.MeshPhysicalMaterial({
  color: new THREE.Color('#3A5A40'),
  roughness: 0.35,
  metalness: 0.0,
  transmission: 0.45,
  thickness: 0.01,
  side: THREE.DoubleSide,
  transparent: true,
  opacity: 0.95,
  // Texture maps to be bound by An:
  // map: leafBaseColorMap,
  // alphaMap: leafAlphaCutoutMap,
  // normalMap: leafNormalMap,
});

interface StemSpec {
  azimuth: number;
  baseRadius: number;
  reach: number;
  height: number;
  droop: number;
  leafScale: [number, number, number];
  leafPitch: number;
  leafRoll: number;
}

interface PotSpec {
  name: string;
  radiusTop: number;
  radiusBottom: number;
  height: number;
  radialSegments: number;
  position: [number, number, number];
  material: THREE.MeshStandardMaterial;
  stems: StemSpec[];
}

function createCurvedLeafGeometry(): THREE.PlaneGeometry {
  const width = 0.38;
  const length = 0.60;
  const geo = new THREE.PlaneGeometry(width, length, 8, 8);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const origX = pos.getX(i);
    // Shift Y so the petiole base sits at y = 0 and tip extends to y = length
    const y = pos.getY(i) + length * 0.5;
    const v = Math.min(1, Math.max(0, y / length)); // 0 at base, 1 at tip
    const u = origX / (width * 0.5); // -1..1 across width

    // Botanical lanceolate/teardrop taper: narrow base and soft pointed tip
    const widthProfile = Math.pow(Math.max(0, Math.sin(v * Math.PI)), 0.7);
    const taperedX = origX * widthProfile;

    // Central midrib trough dip (V-fold along X) + graceful outward/downward gravity arch
    const midribTrough = -0.028 * Math.abs(u) * widthProfile;
    const spineArch = 0.14 * Math.pow(v, 1.75);

    pos.setX(i, taperedX);
    pos.setY(i, y);
    pos.setZ(i, spineArch + midribTrough);
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * Module 03: Courtyard Tropical Planter Rig (Geometry & Stem Hierarchy)
 * - 3 staggered ceramic vessels outside the curtain wall (x < -3.25m)
 * - Graceful CatmullRomCurve3 + TubeGeometry stems
 * - Shared pre-curved, tapered organic leaf meshes
 */
export function createTropicalPlanterRig(
  options: TropicalPlanterRigOptions = {},
): BedroomAssetInstance {
  const group = new THREE.Group();
  group.name = 'TropicalPlanterRig';

  if (options.offset) {
    group.position.set(options.offset[0], options.offset[1], options.offset[2]);
  }
  if (options.scale !== undefined) {
    group.scale.setScalar(options.scale);
  }

  const meshes: THREE.Mesh[] = [];

  // Planter Vessel Materials
  const oatmealTerracottaMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#E2DDD5'),
    roughness: 0.85,
    metalness: 0.0,
  });

  const charcoalBasaltMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#242426'),
    roughness: 0.65,
    metalness: 0.0,
  });

  const soilMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#2A211B'),
    roughness: 0.95,
    metalness: 0.0,
  });

  const stemMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#3D5236'),
    roughness: 0.75,
    metalness: 0.0,
  });

  // Shared pre-curved organic leaf geometry
  const sharedLeafGeo = createCurvedLeafGeometry();

  const pots: PotSpec[] = [
    // Pot A: Large Bird of Paradise / Palm tucked into outer rear corner (6 stems)
    {
      name: 'PotA_BirdOfParadise',
      radiusTop: 0.23,
      radiusBottom: 0.19,
      height: 0.50,
      radialSegments: 16,
      position: [-5.10, 0.25, -1.30],
      material: oatmealTerracottaMat,
      stems: [
        { azimuth: 0.25, baseRadius: 0.04, reach: 0.34, height: 1.38, droop: 0.12, leafScale: [1.15, 1.32, 1.0], leafPitch: 0.58, leafRoll: 0.14 },
        { azimuth: 1.25, baseRadius: 0.05, reach: 0.42, height: 1.22, droop: 0.15, leafScale: [1.08, 1.24, 1.0], leafPitch: 0.70, leafRoll: -0.18 },
        { azimuth: 2.30, baseRadius: 0.04, reach: 0.38, height: 1.48, droop: 0.10, leafScale: [1.18, 1.38, 1.0], leafPitch: 0.52, leafRoll: 0.09 },
        { azimuth: 3.35, baseRadius: 0.06, reach: 0.45, height: 1.10, droop: 0.16, leafScale: [1.05, 1.18, 1.0], leafPitch: 0.78, leafRoll: -0.15 },
        { azimuth: 4.45, baseRadius: 0.05, reach: 0.35, height: 1.30, droop: 0.12, leafScale: [1.10, 1.26, 1.0], leafPitch: 0.65, leafRoll: 0.16 },
        { azimuth: 5.45, baseRadius: 0.03, reach: 0.24, height: 1.56, droop: 0.08, leafScale: [1.00, 1.16, 1.0], leafPitch: 0.46, leafRoll: -0.08 },
      ],
    },
    // Pot B: Low Wide Monstera Bush brought forward without crowding the glass wall at x = -3.80m (5 stems)
    {
      name: 'PotB_MonsteraDeliciosa',
      radiusTop: 0.26,
      radiusBottom: 0.21,
      height: 0.30,
      radialSegments: 16,
      position: [-4.35, 0.15, 1.00],
      material: charcoalBasaltMat,
      stems: [
        { azimuth: 1.35, baseRadius: 0.05, reach: 0.30, height: 0.84, droop: 0.12, leafScale: [1.12, 0.96, 1.0], leafPitch: 0.68, leafRoll: 0.12 },
        { azimuth: 2.15, baseRadius: 0.06, reach: 0.44, height: 0.74, droop: 0.15, leafScale: [1.18, 1.02, 1.0], leafPitch: 0.86, leafRoll: -0.16 },
        { azimuth: 3.10, baseRadius: 0.05, reach: 0.48, height: 0.92, droop: 0.12, leafScale: [1.24, 1.06, 1.0], leafPitch: 0.78, leafRoll: 0.14 },
        { azimuth: 4.10, baseRadius: 0.06, reach: 0.42, height: 0.68, droop: 0.16, leafScale: [1.10, 0.94, 1.0], leafPitch: 0.92, leafRoll: -0.12 },
        { azimuth: 4.95, baseRadius: 0.05, reach: 0.28, height: 0.98, droop: 0.10, leafScale: [1.06, 0.92, 1.0], leafPitch: 0.64, leafRoll: 0.08 },
      ],
    },
    // Pot C: Medium Slender Dwarf Palm staggered outward (5 stems)
    {
      name: 'PotC_DwarfFanPalm',
      radiusTop: 0.17,
      radiusBottom: 0.13,
      height: 0.36,
      radialSegments: 16,
      position: [-5.55, 0.18, 3.30],
      material: oatmealTerracottaMat,
      stems: [
        { azimuth: 0.35, baseRadius: 0.03, reach: 0.34, height: 0.76, droop: 0.11, leafScale: [0.92, 0.90, 1.0], leafPitch: 0.74, leafRoll: 0.13 },
        { azimuth: 1.60, baseRadius: 0.04, reach: 0.38, height: 0.66, droop: 0.13, leafScale: [0.88, 0.86, 1.0], leafPitch: 0.86, leafRoll: -0.15 },
        { azimuth: 2.85, baseRadius: 0.03, reach: 0.31, height: 0.86, droop: 0.10, leafScale: [0.94, 0.92, 1.0], leafPitch: 0.66, leafRoll: 0.09 },
        { azimuth: 4.10, baseRadius: 0.04, reach: 0.36, height: 0.68, droop: 0.13, leafScale: [0.88, 0.88, 1.0], leafPitch: 0.84, leafRoll: -0.11 },
        { azimuth: 5.35, baseRadius: 0.03, reach: 0.25, height: 0.92, droop: 0.08, leafScale: [0.84, 0.84, 1.0], leafPitch: 0.58, leafRoll: 0.06 },
      ],
    },
  ];

  const upAxis = new THREE.Vector3(0, 1, 0);

  for (const pot of pots) {
    const [px, py, pz] = pot.position;
    const potTopY = py + pot.height / 2;

    // 1. Ceramic Planter Vessel
    const potGeo = new THREE.CylinderGeometry(
      pot.radiusTop,
      pot.radiusBottom,
      pot.height,
      pot.radialSegments,
    );
    const potMesh = new THREE.Mesh(potGeo, pot.material);
    potMesh.name = pot.name;
    potMesh.position.set(px, py, pz);
    potMesh.castShadow = true;
    potMesh.receiveShadow = true;
    group.add(potMesh);
    meshes.push(potMesh);

    // 2. Dark Soil Disc recessed slightly inside rim
    const soilGeo = new THREE.CircleGeometry(pot.radiusTop * 0.94, 12);
    soilGeo.rotateX(-Math.PI / 2);
    const soilMesh = new THREE.Mesh(soilGeo, soilMat);
    soilMesh.name = `${pot.name}_Soil`;
    soilMesh.position.set(px, potTopY - 0.015, pz);
    soilMesh.receiveShadow = true;
    group.add(soilMesh);
    meshes.push(soilMesh);

    // 3. Stems & Curved Organic Leaves
    pot.stems.forEach((stem, idx) => {
      const cosA = Math.cos(stem.azimuth);
      const sinA = Math.sin(stem.azimuth);

      const p0 = new THREE.Vector3(
        px + cosA * stem.baseRadius,
        potTopY - 0.04,
        pz + sinA * stem.baseRadius,
      );
      const p1 = new THREE.Vector3(
        px + cosA * (stem.baseRadius + stem.reach * 0.25),
        potTopY + stem.height * 0.42,
        pz + sinA * (stem.baseRadius + stem.reach * 0.25),
      );
      const p2 = new THREE.Vector3(
        px + cosA * (stem.baseRadius + stem.reach * 0.68),
        potTopY + stem.height * 0.84,
        pz + sinA * (stem.baseRadius + stem.reach * 0.68),
      );
      const p3 = new THREE.Vector3(
        px + cosA * (stem.baseRadius + stem.reach),
        potTopY + stem.height - stem.droop,
        pz + sinA * (stem.baseRadius + stem.reach),
      );

      const curve = new THREE.CatmullRomCurve3([p0, p1, p2, p3]);
      const stemGeo = new THREE.TubeGeometry(curve, 7, 0.008, 4, false);
      const stemMesh = new THREE.Mesh(stemGeo, stemMat);
      stemMesh.name = `${pot.name}_Stem_${idx + 1}`;
      stemMesh.castShadow = true;
      stemMesh.receiveShadow = true;
      group.add(stemMesh);
      meshes.push(stemMesh);

      // Attach curved organic leaf at stem tip oriented outward along azimuth
      const leafMesh = new THREE.Mesh(sharedLeafGeo, tropicalLeafPlaceholderMaterial);
      leafMesh.name = `${pot.name}_Leaf_${idx + 1}`;
      leafMesh.position.copy(p3);

      // Orient leaf to face outward along stem azimuth, then pitch & roll naturally
      const outwardDir = new THREE.Vector3(cosA, 0, sinA).normalize();
      const yawQuat = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        outwardDir,
      );
      const localTilt = new THREE.Euler(stem.leafPitch, 0, stem.leafRoll, 'YXZ');
      const tiltQuat = new THREE.Quaternion().setFromEuler(localTilt);
      leafMesh.quaternion.copy(yawQuat).multiply(tiltQuat);
      // Slight twist around world up for organic variation
      leafMesh.rotateOnWorldAxis(upAxis, (idx % 2 === 0 ? 1 : -1) * 0.14);

      leafMesh.scale.set(stem.leafScale[0], stem.leafScale[1], stem.leafScale[2]);
      leafMesh.castShadow = true;
      leafMesh.receiveShadow = true;
      group.add(leafMesh);
      meshes.push(leafMesh);
    });
  }

  registerBedroomComponent({
    id: 'tropical-planter-rig',
    name: 'Courtyard Tropical Planter Rig',
    category: 'decor',
    dimensions: { width: 1.6, height: 2.2, depth: 3.3 },
    defaultTransform: {
      position: [-4.05, 0, 0.45],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    materialSlots: [
      'oatmeal-terracotta',
      'charcoal-basalt-ceramic',
      'planter-soil',
      'tropical-stem',
      'tropical-leaf-placeholder',
    ],
    disposableMeshes: meshes,
  });

  return {
    group,
    meshes,
    dispose: () => disposeComponent('tropical-planter-rig'),
  };
}

export function TropicalPlanterRig({
  scene,
  ...options
}: TropicalPlanterRigOptions & { scene?: THREE.Scene }) {
  useEffect(() => {
    if (!scene) return;
    const asset = createTropicalPlanterRig(options);
    scene.add(asset.group);
    return () => {
      scene.remove(asset.group);
      asset.dispose();
    };
  }, [scene, options.offset, options.scale]);

  return null;
}
