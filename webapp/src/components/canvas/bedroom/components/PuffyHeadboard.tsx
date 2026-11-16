import { useEffect } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { registerBedroomComponent, disposeComponent } from '../BedroomRegistry.ts';
import type { BedroomAssetInstance } from './PuffyBedFrame.tsx';

export interface PuffyHeadboardOptions {
  width?: number;
  height?: number;
  depth?: number;
  anchorZ?: number;
}

function createTuftedLinenNormalMap(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const img = ctx.createImageData(size, size);
    const data = img.data;
    const cols = 4;
    const rows = 3;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = (x / size) * cols;
        const v = (y / size) * rows;
        const fx = u - Math.floor(u) - 0.5;
        const fy = v - Math.floor(v) - 0.5;
        // Diamond-tufted pillowing gradient + subtle linen weave
        const dist = Math.sqrt(fx * fx + fy * fy);
        const tuftSlope = THREE.MathUtils.clamp(1.0 - dist * 1.6, 0, 1);
        const weave = Math.sin(x * 1.1) * 0.08 + Math.sin(y * 1.1) * 0.08;
        const dx = -fx * tuftSlope * 0.55 + weave;
        const dy = -fy * tuftSlope * 0.55 + weave;

        const idx = (y * size + x) * 4;
        data[idx] = Math.round(THREE.MathUtils.clamp(0.5 + dx, 0, 1) * 255);
        data[idx + 1] = Math.round(THREE.MathUtils.clamp(0.5 + dy, 0, 1) * 255);
        data[idx + 2] = 235;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/**
 * LEGO Component 1B: Upholstered Button-Tufted Headboard
 * Dimensions: width: 1.70m, height: 1.15m, depth: 0.12m.
 * Anchored flush at head of bed (z = -1.05m, resting on floor y = 0).
 */
export function createPuffyHeadboard(options: PuffyHeadboardOptions = {}): BedroomAssetInstance {
  const width = options.width ?? 1.70;
  const height = options.height ?? 1.15;
  const depth = options.depth ?? 0.12;
  const anchorZ = options.anchorZ ?? -1.05;

  const group = new THREE.Group();
  group.name = 'PuffyUpholsteredHeadboard';

  const tuftedNormalMap = createTuftedLinenNormalMap();

  const heatherLinenMat = new THREE.MeshPhysicalMaterial({
    color: '#4A4D55',
    roughness: 0.85,
    metalness: 0.0,
    clearcoat: 0.0,
    specularIntensity: 0.12,
    envMapIntensity: 0.2,
    sheen: 0.25,
    sheenColor: new THREE.Color('#7A808C'),
    sheenRoughness: 0.85,
    normalMap: tuftedNormalMap,
    normalScale: new THREE.Vector2(0.65, 0.65),
    side: THREE.FrontSide, // Backface culling enabled to save draw calls against back wall
  });

  const buttonMat = new THREE.MeshPhysicalMaterial({
    color: '#3D4048',
    roughness: 0.85,
    metalness: 0.0,
    clearcoat: 0.0,
    specularIntensity: 0.12,
    envMapIntensity: 0.2,
    sheen: 0.25,
    sheenColor: new THREE.Color('#7A808C'),
    sheenRoughness: 0.85,
    side: THREE.FrontSide,
  });

  const meshes: THREE.Mesh[] = [];

  // 1. Padded vertical panel with subtle edge beveling
  const panelGeo = new RoundedBoxGeometry(width, height, depth, 4, 0.025);
  const panelMesh = new THREE.Mesh(panelGeo, heatherLinenMat);
  panelMesh.position.set(0, height / 2, anchorZ - depth / 2);
  panelMesh.castShadow = true;
  panelMesh.receiveShadow = true;
  group.add(panelMesh);
  meshes.push(panelMesh);

  // 2. Instanced recessed tufted buttons across the upper upholstered zone
  const cols = 5;
  const rows = 3;
  const buttonGeo = new THREE.SphereGeometry(0.014, 12, 10);
  buttonGeo.scale(1, 1, 0.45);
  const buttonCount = cols * rows;
  const buttonInstanced = new THREE.InstancedMesh(buttonGeo, buttonMat, buttonCount);
  buttonInstanced.name = 'HeadboardTuftedButtons';
  buttonInstanced.castShadow = true;
  buttonInstanced.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const spanX = width * 0.72;
  const startY = 0.52;
  const endY = height - 0.16;
  let instanceIdx = 0;

  for (let r = 0; r < rows; r++) {
    const ty = rows > 1 ? r / (rows - 1) : 0.5;
    const by = THREE.MathUtils.lerp(startY, endY, ty);
    const stagger = r % 2 === 1 ? 0.04 : 0;
    for (let c = 0; c < cols; c++) {
      const tx = cols > 1 ? c / (cols - 1) : 0.5;
      const bx = -spanX / 2 + tx * spanX + (stagger && c < cols - 1 ? stagger : 0);
      dummy.position.set(bx, by, anchorZ - 0.002);
      dummy.updateMatrix();
      buttonInstanced.setMatrixAt(instanceIdx++, dummy.matrix);
    }
  }
  buttonInstanced.instanceMatrix.needsUpdate = true;
  group.add(buttonInstanced);
  meshes.push(buttonInstanced);

  registerBedroomComponent({
    id: 'puffy-headboard',
    name: 'Puffy Deluxe Tufted Headboard',
    category: 'furniture',
    dimensions: { width, height, depth },
    defaultTransform: {
      position: [0, 0, anchorZ],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    materialSlots: ['heather-grey-linen', 'tufted-buttons'],
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
  }, [scene, options.width, options.height, options.depth, options.anchorZ]);

  return null;
}
