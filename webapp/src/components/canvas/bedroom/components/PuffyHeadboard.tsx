import { useEffect } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  registerBedroomComponent,
  disposeComponent,
  type BedFrameVariantId,
} from '../BedroomRegistry.ts';
import {
  createNaturalAshMaterial,
  createWovenFabricNormalMap,
  type BedroomAssetInstance,
} from './PuffyBedFrame.tsx';

export interface PuffyHeadboardOptions {
  variant?: BedFrameVariantId;
  width?: number;
  height?: number;
  depth?: number;
  anchorZ?: number;
  reclineDegrees?: number;
}

/**
 * LEGO Component 1B: Modular Puffy Headboard (`kyoto` | `milan` | `solace`)
 * - kyoto: Low-profile natural ash timber slab with filleted top corners & 5° backward recline
 * - milan: Oversized wide dark charcoal upholstered headboard with 22 vertical fluted channels
 * - solace: Warm oatmeal bouclé dual-cushion headboard with vertical center seam & rounded silhouette
 */
export function createPuffyHeadboard(options: PuffyHeadboardOptions = {}): BedroomAssetInstance {
  const variant: BedFrameVariantId = options.variant ?? 'kyoto';
  const baseWidth = options.width ?? 1.91;
  const width = variant === 'milan' ? baseWidth + 0.52 : baseWidth;
  const height = options.height ?? (variant === 'milan' ? 1.24 : variant === 'solace' ? 1.09 : 1.00);
  const depth = options.depth ?? (variant === 'kyoto' ? 0.065 : 0.105);
  const anchorZ = options.anchorZ ?? -1.065;
  const reclineDegrees = options.reclineDegrees ?? (variant === 'kyoto' ? 5 : 0);
  const baseFloorY = 0.005;

  const group = new THREE.Group();
  group.name = `PuffyHeadboard_${variant}`;

  const meshes: THREE.Mesh[] = [];

  if (variant === 'kyoto') {
    const ashWoodMat = createNaturalAshMaterial();

    const cornerR = 0.085;
    const bevelSize = 0.010;
    const innerW = width - bevelSize * 2;
    const innerH = height - baseFloorY - bevelSize * 2;
    const coreDepth = Math.max(0.02, depth - bevelSize * 2);

    const shape = new THREE.Shape();
    shape.moveTo(-innerW / 2, 0);
    shape.lineTo(innerW / 2, 0);
    shape.lineTo(innerW / 2, innerH - cornerR);
    shape.quadraticCurveTo(innerW / 2, innerH, innerW / 2 - cornerR, innerH);
    shape.lineTo(-innerW / 2 + cornerR, innerH);
    shape.quadraticCurveTo(-innerW / 2, innerH, -innerW / 2, innerH - cornerR);
    shape.closePath();

    const panelGeo = new THREE.ExtrudeGeometry(shape, {
      depth: coreDepth,
      bevelEnabled: true,
      bevelSegments: 4,
      steps: 1,
      bevelSize,
      bevelThickness: bevelSize,
      curveSegments: 16,
    });
    panelGeo.translate(0, bevelSize, -(coreDepth + bevelSize));

    const panelMesh = new THREE.Mesh(panelGeo, ashWoodMat);
    panelMesh.castShadow = true;
    panelMesh.receiveShadow = true;

    const pivotGroup = new THREE.Group();
    pivotGroup.name = 'HeadboardReclinePivot';
    pivotGroup.position.set(0, baseFloorY, anchorZ);
    pivotGroup.rotation.x = -THREE.MathUtils.degToRad(reclineDegrees);
    pivotGroup.add(panelMesh);

    group.add(pivotGroup);
    meshes.push(panelMesh);
  } else if (variant === 'milan') {
    // Milan: Oversized wide dark charcoal upholstered headboard with 22 vertical fluted channels
    const fabricNormal = createWovenFabricNormalMap(14, 10);
    const charcoalVelvetMat = new THREE.MeshPhysicalMaterial({
      color: '#25282F',
      roughness: 0.88,
      metalness: 0.0,
      sheen: 0.40,
      sheenColor: new THREE.Color('#4B5160'),
      sheenRoughness: 0.72,
      normalMap: fabricNormal,
      normalScale: new THREE.Vector2(0.22, 0.22),
    });

    const backingH = height - baseFloorY;
    const backingDepth = depth * 0.55;
    const backingGeo = new RoundedBoxGeometry(width, backingH, backingDepth, 2, 0.012);
    const backingMesh = new THREE.Mesh(backingGeo, charcoalVelvetMat);
    backingMesh.position.set(0, baseFloorY + backingH / 2, anchorZ - depth + backingDepth / 2);
    backingMesh.castShadow = true;
    backingMesh.receiveShadow = true;
    group.add(backingMesh);
    meshes.push(backingMesh);

    const channelCount = 22;
    const seamGap = 0.004;
    const channelW = (width - seamGap * (channelCount - 1)) / channelCount;
    const channelDepth = depth * 0.58;
    const channelGeo = new RoundedBoxGeometry(channelW, backingH - 0.004, channelDepth, 3, 0.016);

    for (let i = 0; i < channelCount; i++) {
      const cx = -width / 2 + channelW / 2 + i * (channelW + seamGap);
      const channelMesh = new THREE.Mesh(channelGeo, charcoalVelvetMat);
      channelMesh.position.set(cx, baseFloorY + backingH / 2, anchorZ - channelDepth / 2);
      channelMesh.castShadow = true;
      channelMesh.receiveShadow = true;
      group.add(channelMesh);
      meshes.push(channelMesh);
    }
  } else {
    // Solace: Warm oatmeal bouclé dual-cushion headboard with vertical center seam
    const fabricNormal = createWovenFabricNormalMap(12, 10);
    const boucleMat = new THREE.MeshPhysicalMaterial({
      color: '#DFD5C5',
      roughness: 0.90,
      metalness: 0.0,
      sheen: 0.45,
      sheenColor: new THREE.Color('#F5EFE4'),
      sheenRoughness: 0.78,
      normalMap: fabricNormal,
      normalScale: new THREE.Vector2(0.45, 0.45),
    });

    const panelH = height - baseFloorY;
    const seamGap = 0.006;
    const halfW = (width - seamGap) / 2;
    const panelGeo = new RoundedBoxGeometry(halfW, panelH, depth, 4, 0.036);

    const leftPanel = new THREE.Mesh(panelGeo, boucleMat);
    leftPanel.position.set(-(halfW / 2 + seamGap / 2), baseFloorY + panelH / 2, anchorZ - depth / 2);
    leftPanel.castShadow = true;
    leftPanel.receiveShadow = true;

    const rightPanel = new THREE.Mesh(panelGeo, boucleMat);
    rightPanel.position.set(halfW / 2 + seamGap / 2, baseFloorY + panelH / 2, anchorZ - depth / 2);
    rightPanel.castShadow = true;
    rightPanel.receiveShadow = true;

    // Subtle recessed center spine behind seam so zero light leaks through
    const spineGeo = new THREE.BoxGeometry(0.06, panelH - 0.04, depth * 0.65);
    const spineMesh = new THREE.Mesh(spineGeo, boucleMat);
    spineMesh.position.set(0, baseFloorY + panelH / 2, anchorZ - depth * 0.65);
    spineMesh.castShadow = true;
    spineMesh.receiveShadow = true;

    group.add(leftPanel, rightPanel, spineMesh);
    meshes.push(leftPanel, rightPanel, spineMesh);
  }

  registerBedroomComponent({
    id: 'puffy-headboard',
    name:
      variant === 'milan'
        ? 'Puffy Milan Channel Headboard'
        : variant === 'solace'
          ? 'Puffy Solace Dual-Cushion Headboard'
          : 'Puffy Kyoto Timber Headboard',
    category: 'furniture',
    dimensions: { width, height: height - baseFloorY, depth },
    defaultTransform: {
      position: [0, baseFloorY, anchorZ],
      rotation: [-THREE.MathUtils.degToRad(reclineDegrees), 0, 0],
      scale: [1, 1, 1],
    },
    materialSlots:
      variant === 'kyoto'
        ? ['natural-ash-timber']
        : variant === 'milan'
          ? ['charcoal-channel-velvet']
          : ['oatmeal-boucle-cushion'],
    disposableMeshes: meshes,
  });

  return {
    group,
    meshes,
    dispose: () => disposeComponent('puffy-headboard'),
  };
}

export function PuffyHeadboard({
  scene,
  ...options
}: PuffyHeadboardOptions & { scene?: THREE.Scene }) {
  useEffect(() => {
    if (!scene) return;
    const asset = createPuffyHeadboard(options);
    scene.add(asset.group);
    return () => {
      scene.remove(asset.group);
      asset.dispose();
    };
  }, [
    scene,
    options.variant,
    options.width,
    options.height,
    options.depth,
    options.anchorZ,
    options.reclineDegrees,
  ]);

  return null;
}

