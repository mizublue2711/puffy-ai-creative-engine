import { useEffect } from 'react';
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { registerBedroomComponent, disposeComponent } from '../../BedroomRegistry.ts';
import type { BedroomAssetInstance } from '../PuffyBedFrame.tsx';

export interface ZenMoonMirrorOptions {
  /** Center X position in world space. Default: -5.10m */
  positionX?: number;
  /** Center Y position in world space. Default: 1.35m */
  positionY?: number;
  /** Mounting Z position against courtyard rear termination wall. Default: -2.15m */
  positionZ?: number;
  /** Mirror disk radius in meters. Default: 1.10m */
  radius?: number;
  /** Bezel color. Default: '#151515' (matte black anodized aluminum) */
  bezelColor?: string;
}

/**
 * Courtyard Module: Zen En-So Moon Mirror
 * - Large circular architectural mirror mounted at the courtyard rear termination wall.
 * - Center at [-5.10, 1.35, -2.15] with radius 1.10m (bottom edge grazes just above sand ripples).
 * - Slim 12mm matte black anodized aluminum bezel (#151515).
 * - Real-time planar Reflector face backed by a 20mm architectural disk, reflecting the sky,
 *   curtain wall, boulders, and sand ripples for infinite spatial depth.
 */
export function createZenMoonMirror(
  options: ZenMoonMirrorOptions = {},
): BedroomAssetInstance {
  const posX = options.positionX ?? -5.10;
  const posY = options.positionY ?? 1.35;
  const posZ = options.positionZ ?? -2.15;
  const radius = options.radius ?? 1.10;
  const bezelColor = options.bezelColor ?? '#151515';

  const group = new THREE.Group();
  group.name = 'ZenMoonMirror';
  group.position.set(posX, posY, posZ);

  const meshes: THREE.Mesh[] = [];

  // 1. Circular Mirror Backing Disk: CylinderGeometry(radius: 1.10m, height: 0.02m, radialSegments: 64)
  // Oriented flat against the wall face (rotation.x = Math.PI / 2)
  const diskGeo = new THREE.CylinderGeometry(radius, radius, 0.02, 64);
  const diskMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#FFFFFF'),
    roughness: 0.02,
    metalness: 0.98,
  });
  const diskMesh = new THREE.Mesh(diskGeo, diskMat);
  diskMesh.name = 'ZenMoonMirrorDisk';
  diskMesh.rotation.x = Math.PI / 2;
  diskMesh.castShadow = true;
  diskMesh.receiveShadow = true;
  group.add(diskMesh);
  meshes.push(diskMesh);

  // 1b. Recessed Architectural Wall Standoff Collar connecting disk to CourtyardReturnWall (z = -2.475m)
  const standoffDepth = Math.max(0.02, Math.abs(-2.475 - posZ));
  const standoffGeo = new THREE.CylinderGeometry(radius * 0.72, radius * 0.72, standoffDepth, 48);
  const standoffMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#1A1A1A'),
    roughness: 0.55,
    metalness: 0.4,
  });
  const standoffMesh = new THREE.Mesh(standoffGeo, standoffMat);
  standoffMesh.name = 'ZenMoonMirrorWallStandoff';
  standoffMesh.rotation.x = Math.PI / 2;
  standoffMesh.position.z = -(standoffDepth * 0.5 + 0.01);
  standoffMesh.castShadow = true;
  standoffMesh.receiveShadow = true;
  group.add(standoffMesh);
  meshes.push(standoffMesh);

  // 2. Real-time Planar Reflector Face (CircleGeometry facing +Z)
  const reflectorGeo = new THREE.CircleGeometry(radius - 0.004, 64);
  const reflector = new Reflector(reflectorGeo, {
    clipBias: 0.003,
    textureWidth: 1024,
    textureHeight: 1024,
    color: 0xe6eaee,
  });
  reflector.name = 'ZenMoonMirrorReflector';
  reflector.position.z = 0.012;
  group.add(reflector);
  meshes.push(reflector);

  // 3. Minimalist 12mm Matte Black Anodized Aluminum Bezel (#151515)
  const bezelTubeRadius = 0.012;
  const bezelGeo = new THREE.TorusGeometry(radius + bezelTubeRadius * 0.4, bezelTubeRadius, 16, 64);
  const bezelMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(bezelColor),
    roughness: 0.35,
    metalness: 0.85,
  });
  const bezelMesh = new THREE.Mesh(bezelGeo, bezelMat);
  bezelMesh.name = 'ZenMoonMirrorBezel';
  bezelMesh.position.z = 0.006;
  bezelMesh.castShadow = true;
  bezelMesh.receiveShadow = true;
  group.add(bezelMesh);
  meshes.push(bezelMesh);

  registerBedroomComponent({
    id: 'zen-moon-mirror',
    name: 'Zen En-So Moon Mirror',
    category: 'decor',
    dimensions: { width: radius * 2, height: radius * 2, depth: 0.036 },
    defaultTransform: {
      position: [posX, posY, posZ],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    materialSlots: ['zen-moon-mirror-reflector', 'anodized-black-bezel'],
    disposableMeshes: meshes,
  });

  return {
    group,
    meshes,
    dispose: () => {
      reflector.dispose();
      disposeComponent('zen-moon-mirror');
    },
  };
}

export function ZenMoonMirror({
  scene,
  ...options
}: ZenMoonMirrorOptions & { scene?: THREE.Scene }) {
  useEffect(() => {
    if (!scene) return;
    const asset = createZenMoonMirror(options);
    scene.add(asset.group);
    return () => {
      scene.remove(asset.group);
      asset.dispose();
    };
  }, [
    scene,
    options.positionX,
    options.positionY,
    options.positionZ,
    options.radius,
    options.bezelColor,
  ]);

  return null;
}
