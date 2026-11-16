import { useEffect } from 'react';
import * as THREE from 'three';
import { registerBedroomComponent, disposeComponent } from '../../BedroomRegistry.ts';
import type { BedroomAssetInstance } from '../PuffyBedFrame.tsx';

export interface CourtyardTerraceOptions {
  gravelColor?: string;
  paverColor?: string;
}

/**
 * Courtyard Module 01: Recessed Gravel Bed & Stepping Paver Stones
 * - Gravel bed base: 2.65m x 0.10m x 5.20m centered at [-5.175, -0.05, 1.20] (top flush at y = 0.00).
 * - 5x staggered basalt stepping paver slabs (0.60m x 0.04m x 0.90m) resting at y = 0.02.
 * - Minimal polycount: 72 triangles total (6 BoxGeometry meshes sharing 2 geometries & 2 materials).
 */
export function createCourtyardTerrace(
  options: CourtyardTerraceOptions = {},
): BedroomAssetInstance {
  const gravelColor = options.gravelColor ?? '#2E2B28';
  const paverColor = options.paverColor ?? '#4A4A4A';

  const group = new THREE.Group();
  group.name = 'CourtyardTerrace';

  const meshes: THREE.Mesh[] = [];

  // 1. Recessed Gravel Bed / Wood Deck Base
  const gravelGeo = new THREE.BoxGeometry(2.65, 0.10, 7.20);
  const gravelMat = new THREE.MeshStandardMaterial({
    color: gravelColor,
    roughness: 0.88,
    metalness: 0.0,
  });

  const gravelMesh = new THREE.Mesh(gravelGeo, gravelMat);
  gravelMesh.name = 'CourtyardGravelBed';
  gravelMesh.position.set(-5.175, -0.05, 1.20);
  gravelMesh.receiveShadow = true;
  group.add(gravelMesh);
  meshes.push(gravelMesh);

  // 2. Stepping Paver Stones (5x Large basalt paver slabs resting on gravel at y = 0.02)
  const paverGeo = new THREE.BoxGeometry(0.60, 0.04, 0.90);
  const paverMat = new THREE.MeshStandardMaterial({
    color: paverColor,
    roughness: 0.75,
    metalness: 0.0,
  });

  const paverPlacements: ReadonlyArray<[number, number, number]> = [
    [-5.05, 0.02, -1.60],
    [-5.25, 0.02, -0.20],
    [-5.00, 0.02, 1.20],
    [-5.30, 0.02, 2.60],
    [-5.05, 0.02, 4.00],
  ];

  paverPlacements.forEach(([x, y, z], index) => {
    const paverMesh = new THREE.Mesh(paverGeo, paverMat);
    paverMesh.name = `CourtyardSteppingPaver_${index + 1}`;
    paverMesh.position.set(x, y, z);
    paverMesh.castShadow = true;
    paverMesh.receiveShadow = true;
    group.add(paverMesh);
    meshes.push(paverMesh);
  });

  registerBedroomComponent({
    id: 'courtyard-terrace',
    name: 'Courtyard Terrace Gravel Bed & Basalt Pavers',
    category: 'flooring',
    dimensions: { width: 2.65, height: 0.14, depth: 7.20 },
    defaultTransform: {
      position: [-5.175, -0.05, 1.20],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    materialSlots: ['courtyard-gravel-bed', 'basalt-stepping-pavers'],
    disposableMeshes: meshes,
  });

  return {
    group,
    meshes,
    dispose: () => disposeComponent('courtyard-terrace'),
  };
}

export function CourtyardTerrace({
  scene,
  ...options
}: CourtyardTerraceOptions & { scene?: THREE.Scene }) {
  useEffect(() => {
    if (!scene) return;
    const asset = createCourtyardTerrace(options);
    scene.add(asset.group);
    return () => {
      scene.remove(asset.group);
      asset.dispose();
    };
  }, [scene, options.gravelColor, options.paverColor]);

  return null;
}
