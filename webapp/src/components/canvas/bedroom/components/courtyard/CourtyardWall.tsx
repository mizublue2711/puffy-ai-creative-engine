import { useEffect } from 'react';
import * as THREE from 'three';
import { registerBedroomComponent, disposeComponent } from '../../BedroomRegistry.ts';

export interface CourtyardWallOptions {
  color?: string;
  roughness?: number;
  metalness?: number;
}

export interface CourtyardWallAsset {
  group: THREE.Group;
  meshes: THREE.Mesh[];
  dispose: () => void;
}

/**
 * LEGO Component: Exterior Enclosure U-Wall (Module 02)
 * Mineral architectural micro-cement courtyard boundary (36 triangles total).
 */
export function createCourtyardWall(options: CourtyardWallOptions = {}): CourtyardWallAsset {
  const color = options.color ?? '#C2BEB6';
  const roughness = options.roughness ?? 0.92;
  const metalness = options.metalness ?? 0.0;

  const group = new THREE.Group();
  group.name = 'CourtyardWall';

  const microCementMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness,
    metalness,
  });

  const meshes: THREE.Mesh[] = [];

  // 1. Long Wall (Left): 0.15m x 4.10m x 7.50m (12 triangles)
  const longWallGeo = new THREE.BoxGeometry(0.15, 4.10, 7.50);
  const longWallMesh = new THREE.Mesh(longWallGeo, microCementMat);
  longWallMesh.name = 'CourtyardLongWall';
  longWallMesh.position.set(-6.60, 2.00, 1.20);
  longWallMesh.castShadow = true;
  longWallMesh.receiveShadow = true;
  group.add(longWallMesh);
  meshes.push(longWallMesh);

  // 2. Return Wall (Back wrap): 2.95m x 4.10m x 0.15m (12 triangles)
  const returnWallGeo = new THREE.BoxGeometry(2.95, 4.10, 0.15);
  const returnWallMesh = new THREE.Mesh(returnWallGeo, microCementMat);
  returnWallMesh.name = 'CourtyardReturnWall';
  returnWallMesh.position.set(-5.20, 2.00, -2.55);
  returnWallMesh.castShadow = true;
  returnWallMesh.receiveShadow = true;
  group.add(returnWallMesh);
  meshes.push(returnWallMesh);

  // 3. Front Return Wall (Front wrap): 2.95m x 4.10m x 0.15m (12 triangles)
  const frontReturnMesh = new THREE.Mesh(returnWallGeo, microCementMat);
  frontReturnMesh.name = 'CourtyardFrontReturnWall';
  frontReturnMesh.position.set(-5.20, 2.00, 4.95);
  frontReturnMesh.castShadow = true;
  frontReturnMesh.receiveShadow = true;
  group.add(frontReturnMesh);
  meshes.push(frontReturnMesh);

  registerBedroomComponent({
    id: 'courtyard-wall',
    name: 'Exterior Enclosure U-Wall',
    category: 'decor',
    dimensions: { width: 2.95, height: 4.10, depth: 7.50 },
    defaultTransform: {
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    materialSlots: ['mineral-micro-cement'],
    disposableMeshes: meshes,
  });

  return {
    group,
    meshes,
    dispose: () => disposeComponent('courtyard-wall'),
  };
}

export function CourtyardWall({
  scene,
  ...options
}: CourtyardWallOptions & { scene?: THREE.Scene }) {
  useEffect(() => {
    if (!scene) return;
    const asset = createCourtyardWall(options);
    scene.add(asset.group);
    return () => {
      scene.remove(asset.group);
      asset.dispose();
    };
  }, [scene, options.color, options.roughness, options.metalness]);

  return null;
}
