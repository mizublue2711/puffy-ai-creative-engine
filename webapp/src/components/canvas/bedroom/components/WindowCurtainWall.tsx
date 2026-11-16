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
 * - Occupies left wall at x = -3.80m, y = 0..3.90m, 6.50m continuous length along Z (z = -2.00..+4.50m).
 * - Slim 0.04m black anodized aluminum mullions every 1.625m (5 mullions, 4 bays).
 * - Recessed ceiling curtain pocket (pelmet cove, 0.30m wide × 0.18m deep, y = 3.90..4.08m)
 *   with integrated track, warm grazing cove light strip, and SpotLight.
 * - Full-height undulating S-fold translucent voile curtain (y = 0.015m up to pocket track).
 */
export function createWindowCurtainWall(
  options: WindowCurtainWallOptions = {},
): BedroomAssetInstance {
  const wallX = options.wallX ?? -3.80;
  const startZ = options.startZ ?? -2.0;
  const totalLength = options.totalLength ?? 6.50;
  const ceilingHeight = options.ceilingHeight ?? 3.90;
  const centerZ = startZ + totalLength / 2;

  const group = new THREE.Group();
  group.name = 'CurtainWallAndGrandVoile';

  const meshes: THREE.Mesh[] = [];

  // Slim Black Anodized Aluminum Mullions
  const blackAluminumMat = new THREE.MeshStandardMaterial({
    color: '#151515',
    roughness: 0.4,
    metalness: 0.8,
  });

  // Recessed Ceiling Pocket / Pelmet Cove Plaster Bulkhead
  const ceilingPocketMat = new THREE.MeshStandardMaterial({
    color: '#EAE6DF',
    roughness: 0.9,
    metalness: 0.0,
  });

  // Curtain Track Rail
  const trackRailMat = new THREE.MeshStandardMaterial({
    color: '#D8D4CC',
    roughness: 0.45,
    metalness: 0.35,
  });

  // Warm Grazing Cove Light Strip
  const coveLightStripMat = new THREE.MeshStandardMaterial({
    color: '#FFF2DF',
    emissive: '#FFF2DF',
    emissiveIntensity: 1.4,
    roughness: 0.25,
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
    color: '#F8F6F0',
    transmission: 0.55,
    roughness: 0.88,
    metalness: 0.0,
    opacity: 0.70,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    sheen: 1.0,
    sheenColor: new THREE.Color('#FFF4E0'),
    sheenRoughness: 0.45,
  });

  // 1. Slim 0.04m Black Anodized Mullions (4 bays of 1.625m each, 5 shared-geometry mullions)
  const mullionThick = 0.04;
  const mullionDepth = 0.04;
  const bayCount = 4;
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

  // 3. Recessed Ceiling Curtain Pocket (Pelmet Cove: 0.30m wide × 0.18m deep into ceiling)
  const pocketWidth = 0.30;
  const pocketDepth = 0.18;
  const pocketWallThick = 0.025;
  const pocketCenterX = wallX + pocketWidth / 2;
  const pocketSpanZ = totalLength + mullionThick * 2;

  // Pocket top soffit (y = ceilingHeight + pocketDepth = 4.08m)
  const pocketTopGeo = new THREE.BoxGeometry(pocketWidth + pocketWallThick, pocketWallThick, pocketSpanZ);
  const pocketTop = new THREE.Mesh(pocketTopGeo, ceilingPocketMat);
  pocketTop.position.set(pocketCenterX, ceilingHeight + pocketDepth + pocketWallThick / 2, centerZ);
  pocketTop.receiveShadow = true;

  // Pocket outer wall above glass top rail (prevents raw glass-to-ceiling clipping)
  const pocketOuterGeo = new THREE.BoxGeometry(pocketWallThick, pocketDepth, pocketSpanZ);
  const pocketOuter = new THREE.Mesh(pocketOuterGeo, ceilingPocketMat);
  pocketOuter.position.set(wallX - pocketWallThick / 2, ceilingHeight + pocketDepth / 2, centerZ);
  pocketOuter.receiveShadow = true;

  // Pocket inner pelmet valance (room-side vertical return)
  const pocketValanceGeo = new THREE.BoxGeometry(pocketWallThick, pocketDepth, pocketSpanZ);
  const pocketValance = new THREE.Mesh(pocketValanceGeo, ceilingPocketMat);
  pocketValance.position.set(
    wallX + pocketWidth + pocketWallThick / 2,
    ceilingHeight + pocketDepth / 2,
    centerZ,
  );
  pocketValance.castShadow = true;
  pocketValance.receiveShadow = true;

  // Pocket Z-end caps
  const pocketCapGeo = new THREE.BoxGeometry(pocketWidth + pocketWallThick, pocketDepth, pocketWallThick);
  const pocketCapStart = new THREE.Mesh(pocketCapGeo, ceilingPocketMat);
  pocketCapStart.position.set(
    pocketCenterX,
    ceilingHeight + pocketDepth / 2,
    startZ - mullionThick - pocketWallThick / 2,
  );
  const pocketCapEnd = new THREE.Mesh(pocketCapGeo, ceilingPocketMat);
  pocketCapEnd.position.set(
    pocketCenterX,
    ceilingHeight + pocketDepth / 2,
    startZ + totalLength + mullionThick + pocketWallThick / 2,
  );

  group.add(pocketTop, pocketOuter, pocketValance, pocketCapStart, pocketCapEnd);
  meshes.push(pocketTop, pocketOuter, pocketValance, pocketCapStart, pocketCapEnd);

  // Recessed Curtain Track anchored inside the pocket (y ≈ 3.99m - 4.02m)
  const curtainX = wallX + 0.16;
  const trackY = ceilingHeight + 0.10;
  const trackGeo = new THREE.BoxGeometry(0.045, 0.03, totalLength);
  const trackMesh = new THREE.Mesh(trackGeo, trackRailMat);
  trackMesh.position.set(curtainX, trackY, centerZ);
  trackMesh.receiveShadow = true;
  group.add(trackMesh);
  meshes.push(trackMesh);

  // Soft Grazing Cove Light Strip inside the pocket
  const coveStripX = wallX + pocketWidth - 0.035;
  const coveStripY = ceilingHeight + pocketDepth - 0.03;
  const coveStripGeo = new THREE.BoxGeometry(0.02, 0.018, totalLength - 0.04);
  const coveStripMesh = new THREE.Mesh(coveStripGeo, coveLightStripMat);
  coveStripMesh.position.set(coveStripX, coveStripY, centerZ);
  group.add(coveStripMesh);
  meshes.push(coveStripMesh);

  // Soft grazing SpotLight washing down the S-fold curtain
  const coveSpotLight = new THREE.SpotLight('#FFF2DF', 1.2, 6.5, Math.PI / 2.4, 0.9, 1.4);
  coveSpotLight.position.set(coveStripX - 0.02, coveStripY - 0.02, centerZ);
  coveSpotLight.target.position.set(curtainX, 0.0, centerZ);
  coveSpotLight.castShadow = false;
  group.add(coveSpotLight, coveSpotLight.target);

  // 4. Full-Height S-Fold Voile Curtain (pocket track down to y = 0.015m)
  const curtainBottomY = 0.015;
  const curtainTopY = trackY - 0.01;
  const curtainHeight = curtainTopY - curtainBottomY;
  const curtainCenterY = curtainBottomY + curtainHeight / 2;

  // Procedural undulating S-fold sheer curtain mesh
  const curtainGeo = new THREE.PlaneGeometry(totalLength, curtainHeight, Math.max(120, Math.round(totalLength * 24.6)), 4);
  curtainGeo.rotateY(Math.PI / 2);
  const pos = curtainGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    pos.setX(i, pos.getX(i) + Math.sin(z * 14.0) * 0.06);
  }
  curtainGeo.computeVertexNormals();

  const curtainMesh = new THREE.Mesh(curtainGeo, sheerCurtainMaterial);
  curtainMesh.position.set(curtainX, curtainCenterY, centerZ);
  curtainMesh.castShadow = true; // Soft diffused S-fold shadow bands onto oak floor & mattress
  curtainMesh.receiveShadow = true;
  group.add(curtainMesh);
  meshes.push(curtainMesh);

  registerBedroomComponent({
    id: 'window-curtain-wall',
    name: 'Floor-to-Ceiling Curtain Wall & Grand S-Fold Voile',
    category: 'decor',
    dimensions: { width: pocketWidth, height: ceilingHeight + pocketDepth, depth: totalLength },
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
