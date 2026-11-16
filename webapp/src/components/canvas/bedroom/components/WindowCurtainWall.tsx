import { useEffect } from 'react';
import * as THREE from 'three';
import { registerBedroomComponent, disposeComponent } from '../BedroomRegistry.ts';
import type { BedroomAssetInstance } from './PuffyBedFrame.tsx';

export interface WindowCurtainWallOptions {
  wallX?: number;
  startZ?: number;
  totalLength?: number;
  ceilingHeight?: number;
}

/**
 * PART I: Floor-to-Ceiling Curtain Wall & Full-Height S-Fold Voile Curtain
 * - Occupies left wall at x = -3.2m, y = 0..3.2m, 4.5m length along Z.
 * - Slim 0.04m black anodized aluminum mullions dividing 3 bays (1.5m each).
 * - Recessed ceiling track + undulating S-fold translucent voile curtain (y = 0.01..3.18m).
 */
export function createWindowCurtainWall(
  options: WindowCurtainWallOptions = {},
): BedroomAssetInstance {
  const wallX = options.wallX ?? -3.2;
  const startZ = options.startZ ?? -1.4;
  const totalLength = options.totalLength ?? 4.5;
  const ceilingHeight = options.ceilingHeight ?? 3.2;
  const centerZ = startZ + totalLength / 2;

  const group = new THREE.Group();
  group.name = 'CurtainWallAndGrandVoile';

  const meshes: THREE.Mesh[] = [];

  // Slim Black Anodized Aluminum Mullions
  const blackAluminumMat = new THREE.MeshStandardMaterial({
    color: '#1A1C1F',
    roughness: 0.38,
    metalness: 0.78,
  });

  // Recessed Ceiling Track Plaster Bulkhead
  const ceilingTrackMat = new THREE.MeshStandardMaterial({
    color: '#EAE6DF',
    roughness: 0.9,
    metalness: 0.0,
  });

  // Curtain Wall Glass
  const curtainGlassMat = new THREE.MeshPhysicalMaterial({
    color: '#FFFFFF',
    transmission: 0.96,
    roughness: 0.04,
    metalness: 0.0,
    ior: 1.52,
    thickness: 0.015,
    transparent: true,
    opacity: 0.28,
  });

  // Full-Height S-Fold Voile Curtain (Chiffon / Linen Sheer)
  const sheerCurtainMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#FAF8F5'),
    roughness: 0.92,
    metalness: 0.0,
    transparent: true,
    opacity: 0.65,
    transmission: 0.38,
    sheen: 1.0,
    sheenColor: new THREE.Color('#FFF4E0'),
    sheenRoughness: 0.45,
    side: THREE.DoubleSide,
  });

  // 1. Slim 0.04m Black Anodized Mullions (3 bays of 1.5m each)
  const mullionThick = 0.04;
  const mullionDepth = 0.06;
  const bayCount = 3;
  const bayWidth = totalLength / bayCount;

  const vMullionGeo = new THREE.BoxGeometry(mullionDepth, ceilingHeight, mullionThick);
  for (let i = 0; i <= bayCount; i++) {
    const mz = startZ + i * bayWidth;
    const vMullion = new THREE.Mesh(vMullionGeo, blackAluminumMat);
    vMullion.position.set(wallX, ceilingHeight / 2, mz);
    vMullion.castShadow = true;
    vMullion.receiveShadow = true;
    group.add(vMullion);
    meshes.push(vMullion);
  }

  // Top & Bottom slim rails
  const hMullionGeo = new THREE.BoxGeometry(mullionDepth, mullionThick, totalLength + mullionThick);
  const topRail = new THREE.Mesh(hMullionGeo, blackAluminumMat);
  topRail.position.set(wallX, ceilingHeight - mullionThick / 2, centerZ);
  topRail.castShadow = true;

  const bottomRail = new THREE.Mesh(hMullionGeo, blackAluminumMat);
  bottomRail.position.set(wallX, mullionThick / 2, centerZ);
  bottomRail.receiveShadow = true;

  group.add(topRail, bottomRail);
  meshes.push(topRail, bottomRail);

  // 2. Floor-to-Ceiling Curtain Wall Glass
  const glassGeo = new THREE.PlaneGeometry(totalLength, ceilingHeight);
  glassGeo.rotateY(Math.PI / 2);
  const glassMesh = new THREE.Mesh(glassGeo, curtainGlassMat);
  glassMesh.position.set(wallX, ceilingHeight / 2, centerZ);
  glassMesh.castShadow = false;
  group.add(glassMesh);
  meshes.push(glassMesh);

  // 3. Recessed Ceiling Track & Full-Height S-Fold Voile Curtain (y = 0.01..3.18m)
  const curtainX = wallX + 0.14;
  const trackGeo = new THREE.BoxGeometry(0.14, 0.05, totalLength + 0.1);
  const trackMesh = new THREE.Mesh(trackGeo, ceilingTrackMat);
  trackMesh.position.set(curtainX, ceilingHeight - 0.025, centerZ);
  trackMesh.receiveShadow = true;
  group.add(trackMesh);
  meshes.push(trackMesh);

  const curtainBottomY = 0.01;
  const curtainTopY = ceilingHeight - 0.02;
  const curtainHeight = curtainTopY - curtainBottomY;
  const curtainCenterY = curtainBottomY + curtainHeight / 2;

  // Two grand S-fold sheer panels gently parted or spanning across the glass
  const panelSpanZ = totalLength * 0.48;
  const buildSFoldPanel = (panelCenterZ: number, phaseOffset: number) => {
    const geo = new THREE.PlaneGeometry(panelSpanZ, curtainHeight, 64, 28);
    geo.rotateY(Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const hNorm = (y + curtainHeight / 2) / curtainHeight; // 0 at floor, 1 at ceiling
      const sFoldAmp = 0.048 + (1 - hNorm) * 0.016;
      const wave = Math.sin(z * 16.0 + phaseOffset) * sFoldAmp;
      pos.setX(i, pos.getX(i) + wave);
    }
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, sheerCurtainMaterial);
    mesh.position.set(curtainX, curtainCenterY, panelCenterZ);
    mesh.castShadow = true; // Soft diffused S-fold shadow bands onto oak floor & mattress
    mesh.receiveShadow = true;
    group.add(mesh);
    meshes.push(mesh);
  };

  buildSFoldPanel(centerZ - totalLength * 0.25, 0);
  buildSFoldPanel(centerZ + totalLength * 0.25, Math.PI * 0.45);

  registerBedroomComponent({
    id: 'window-curtain-wall',
    name: 'Floor-to-Ceiling Curtain Wall & Grand S-Fold Voile',
    category: 'decor',
    dimensions: { width: 0.22, height: ceilingHeight, depth: totalLength },
    defaultTransform: {
      position: [wallX, 0, centerZ],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    materialSlots: ['black-anodized-aluminum', 'curtain-wall-glass', 's-fold-voile-sheer'],
    disposableMeshes: meshes,
  });

  return {
    group,
    meshes,
    dispose: () => disposeComponent('window-curtain-wall'),
  };
}

export function WindowCurtainWall({
  scene,
  ...options
}: WindowCurtainWallOptions & { scene?: THREE.Scene }) {
  useEffect(() => {
    if (!scene) return;
    const asset = createWindowCurtainWall(options);
    scene.add(asset.group);
    return () => {
      scene.remove(asset.group);
      asset.dispose();
    };
  }, [scene, options.wallX, options.startZ, options.totalLength, options.ceilingHeight]);

  return null;
}
