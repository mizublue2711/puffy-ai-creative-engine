import { useEffect } from 'react';
import * as THREE from 'three';
import { registerBedroomComponent, disposeComponent } from '../BedroomRegistry.ts';
import type { BedroomAssetInstance } from './PuffyBedFrame.tsx';

export interface WallSconcesOptions {
  offsetX?: number;
  heightY?: number;
  wallZ?: number;
}

function createBrushedBrassNormalMap(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const img = ctx.createImageData(size, size);
    const data = img.data;
    for (let y = 0; y < size; y++) {
      const streak = (((y * 53) % 19) / 19 - 0.5) * 0.18;
      for (let x = 0; x < size; x++) {
        const micro = (((x * 17 + y * 31) % 11) / 11 - 0.5) * 0.08;
        const idx = (y * size + x) * 4;
        data[idx] = Math.round(THREE.MathUtils.clamp(0.5 + micro, 0, 1) * 255);
        data[idx + 1] = Math.round(THREE.MathUtils.clamp(0.5 + streak, 0, 1) * 255);
        data[idx + 2] = 248;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
}

/**
 * LEGO Component 1C: Dual Minimalist Brushed Brass Wall Sconces (Decorative Resting State)
 * Lights OFF: active PointLights removed to save draw calls; frosted milk-glass spheres
 * and brushed brass arms catch natural grazing window sunlight.
 */
export function createWallSconces(options: WallSconcesOptions = {}): BedroomAssetInstance {
  const offsetX = options.offsetX ?? 1.25;
  const heightY = options.heightY ?? 1.40;
  const wallZ = options.wallZ ?? -1.03;

  const group = new THREE.Group();
  group.name = 'MinimalistWallSconcesPair';

  const brushedNormal = createBrushedBrassNormalMap();

  const brushedBrassMat = new THREE.MeshStandardMaterial({
    color: '#C5A059',
    metalness: 0.88,
    roughness: 0.25,
    normalMap: brushedNormal,
    normalScale: new THREE.Vector2(0.25, 0.25),
  });

  // Frosted milk-glass diffuser in resting (lights-off) state
  const frostedMilkGlassMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#F0EDE6'),
    roughness: 0.2,
    metalness: 0.0,
    transmission: 0.4,
    thickness: 0.05,
    ior: 1.45,
    emissive: new THREE.Color('#000000'),
    emissiveIntensity: 0,
  });

  const plateGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.02, 32);
  plateGeo.rotateX(Math.PI / 2);

  // Right-angle brass arm: extends 0.22m outward (+Z) and 0.08m upward (+Y)
  const armCurve = new THREE.CurvePath<THREE.Vector3>();
  armCurve.add(new THREE.LineCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0.22)));
  armCurve.add(new THREE.LineCurve3(new THREE.Vector3(0, 0, 0.22), new THREE.Vector3(0, 0.08, 0.22)));
  const armGeo = new THREE.TubeGeometry(armCurve, 20, 0.012, 14, false);

  const socketGeo = new THREE.CylinderGeometry(0.028, 0.024, 0.032, 20);
  const diffuserGeo = new THREE.SphereGeometry(0.14, 32, 24);

  const meshes: THREE.Mesh[] = [];

  for (const side of [-1, 1]) {
    const sconceRoot = new THREE.Group();
    sconceRoot.name = side < 0 ? 'WallSconceLeft' : 'WallSconceRight';
    sconceRoot.position.set(side * offsetX, heightY, wallZ);

    const plate = new THREE.Mesh(plateGeo, brushedBrassMat);
    plate.position.set(0, 0, 0.01);
    plate.castShadow = true;
    plate.receiveShadow = true;
    sconceRoot.add(plate);
    meshes.push(plate);

    const arm = new THREE.Mesh(armGeo, brushedBrassMat);
    arm.castShadow = true;
    sconceRoot.add(arm);
    meshes.push(arm);

    const socket = new THREE.Mesh(socketGeo, brushedBrassMat);
    socket.position.set(0, 0.08, 0.22);
    socket.castShadow = true;
    sconceRoot.add(socket);
    meshes.push(socket);

    const diffuser = new THREE.Mesh(diffuserGeo, frostedMilkGlassMat);
    diffuser.position.set(0, 0.22, 0.22);
    diffuser.castShadow = true;
    diffuser.receiveShadow = true;
    sconceRoot.add(diffuser);
    meshes.push(diffuser);

    group.add(sconceRoot);
  }

  registerBedroomComponent({
    id: 'sconces-pair',
    name: 'Dual Minimalist Brushed Brass Wall Sconces (Resting)',
    category: 'lighting',
    dimensions: { width: offsetX * 2 + 0.28, height: 0.42, depth: 0.36 },
    defaultTransform: {
      position: [0, heightY, wallZ],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    materialSlots: ['brushed-brass', 'frosted-milk-glass'],
    disposableMeshes: meshes,
  });

  return {
    group,
    meshes,
    dispose: () => disposeComponent('sconces-pair'),
  };
}

export function WallSconces({
  scene,
  ...options
}: WallSconcesOptions & { scene?: THREE.Scene }) {
  useEffect(() => {
    if (!scene) return;
    const asset = createWallSconces(options);
    scene.add(asset.group);
    return () => {
      scene.remove(asset.group);
      asset.dispose();
    };
  }, [scene, options.offsetX, options.heightY, options.wallZ]);

  return null;
}
