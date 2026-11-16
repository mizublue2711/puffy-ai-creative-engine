import { useEffect } from 'react';
import * as THREE from 'three';
import { registerBedroomComponent, disposeComponent } from '../../BedroomRegistry.ts';
import type { BedroomAssetInstance } from '../PuffyBedFrame.tsx';

export interface RippleClusterSpec {
  x: number;
  z: number;
  /** Outer radius of concentric ripple influence in meters */
  radius: number;
}

export interface KaresansuiSandBedOptions {
  sandColor?: string;
  roughness?: number;
  rippleAmplitude?: number;
  rippleFrequency?: number;
  clusters?: RippleClusterSpec[];
}

export const DEFAULT_ZEN_BOULDER_CLUSTERS: RippleClusterSpec[] = [
  { x: -5.55, z: -0.90, radius: 1.45 },
  { x: -4.60, z: 1.35, radius: 1.35 },
];

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Generates a subtle tileable fine-grain quartz sand texture for mineral realism.
 */
function createQuartzSandGrainTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.fillStyle = '#E8E4DC';
    ctx.fillRect(0, 0, size, size);

    // Deterministic PRNG for repeatable fine quartz speckle
    let seed = 0x9e3779b9;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    for (let i = 0; i < 6500; i++) {
      const px = Math.floor(rand() * size);
      const py = Math.floor(rand() * size);
      const v = rand();
      if (v > 0.65) {
        ctx.fillStyle = 'rgba(255, 252, 245, 0.28)';
      } else if (v < 0.30) {
        ctx.fillStyle = 'rgba(180, 172, 158, 0.22)';
      } else {
        ctx.fillStyle = 'rgba(218, 212, 200, 0.20)';
      }
      ctx.fillRect(px, py, 1, 1);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 20);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Courtyard Module: Karesansui Raked Zen Sand Bed
 * - Footprint: x = [-3.85m, -6.60m] (width 2.75m), z = [-2.20m, +4.80m] (depth 7.00m)
 * - Elevation: y = -0.05m
 * - Procedural raked ripples: linear Z-parallel waves sin(x * 24.0) blended smoothly
 *   into concentric circular ripples radiating around the 2 primary boulder clusters.
 */
export function createKaresansuiSandBed(
  options: KaresansuiSandBedOptions = {},
): BedroomAssetInstance {
  const sandColor = options.sandColor ?? '#E8E4DC';
  const roughness = options.roughness ?? 0.92;
  const amplitude = options.rippleAmplitude ?? 0.017;
  const frequency = options.rippleFrequency ?? 24.0;
  const clusters = options.clusters ?? DEFAULT_ZEN_BOULDER_CLUSTERS;

  const minX = -6.60;
  const maxX = -3.85;
  const minZ = -2.20;
  const maxZ = 4.80;
  const width = maxX - minX; // 2.75m
  const depth = maxZ - minZ; // 7.00m
  const centerX = (minX + maxX) / 2; // -5.225m
  const centerZ = (minZ + maxZ) / 2; // +1.30m
  const elevationY = -0.05;

  const group = new THREE.Group();
  group.name = 'KaresansuiSandBed';

  const meshes: THREE.Mesh[] = [];

  const grainTex = createQuartzSandGrainTexture();
  const sandMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(sandColor),
    map: grainTex,
    vertexColors: true,
    roughness,
    metalness: 0.0,
  });

  // High-resolution subdivided plane for crisp real-geometry raked troughs & grazing shadows
  const segX = 180;
  const segZ = 360;
  const sandGeo = new THREE.PlaneGeometry(width, depth, segX, segZ);
  sandGeo.rotateX(-Math.PI / 2);

  const pos = sandGeo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const troughColor = new THREE.Color('#D5CFC3');
  const crestColor = new THREE.Color('#F5F2EB');
  const tmpColor = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const localX = pos.getX(i);
    const localZ = pos.getZ(i);
    const worldX = centerX + localX;
    const worldZ = centerZ + localZ;

    // 1. Base linear raked wave running parallel along Z
    const linearWave = Math.sin(worldX * frequency);

    // 2. Concentric circular ripples around the 2 primary boulder clusters
    let concentricWeight = 0;
    let concentricWave = 0;

    for (const cluster of clusters) {
      const dx = worldX - cluster.x;
      const dz = worldZ - cluster.z;
      const dist = Math.hypot(dx, dz);

      if (dist < cluster.radius) {
        // Smoothly fade from 1.0 near boulder base to 0.0 at outer ring boundary
        const falloff = 1.0 - smoothstep(cluster.radius * 0.52, cluster.radius, dist);
        const ringWave = Math.sin(dist * frequency);
        if (falloff > concentricWeight) {
          concentricWeight = falloff;
          concentricWave = ringWave;
        }
      }
    }

    // Blend linear raked pattern with concentric boulder ripples
    const combinedWave =
      linearWave * (1.0 - concentricWeight) + concentricWave * concentricWeight;

    const rakedHeight = combinedWave * amplitude;
    pos.setY(i, rakedHeight);

    // Subtle mineral AO in troughs vs sunlit crests
    const t = Math.max(0, Math.min(1, (combinedWave + 1.0) * 0.5));
    tmpColor.copy(troughColor).lerp(crestColor, t);
    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }

  sandGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  sandGeo.computeVertexNormals();

  const sandMesh = new THREE.Mesh(sandGeo, sandMat);
  sandMesh.name = 'KaresansuiRakedSandSurface';
  sandMesh.position.set(centerX, elevationY, centerZ);
  sandMesh.castShadow = true;
  sandMesh.receiveShadow = true;
  group.add(sandMesh);
  meshes.push(sandMesh);

  // Solid dark mineral sub-base directly beneath the sand troughs so no gaps show from any angle
  const subBaseGeo = new THREE.BoxGeometry(width, 0.08, depth);
  const subBaseMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#2B2926'),
    roughness: 0.95,
    metalness: 0.0,
  });
  const subBaseMesh = new THREE.Mesh(subBaseGeo, subBaseMat);
  subBaseMesh.name = 'KaresansuiSandSubBase';
  subBaseMesh.position.set(centerX, elevationY - 0.075, centerZ);
  subBaseMesh.receiveShadow = true;
  group.add(subBaseMesh);
  meshes.push(subBaseMesh);

  registerBedroomComponent({
    id: 'karesansui-sand-bed',
    name: 'Karesansui Raked Zen Sand Bed',
    category: 'flooring',
    dimensions: { width, height: 0.10, depth },
    defaultTransform: {
      position: [centerX, elevationY, centerZ],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    materialSlots: ['karesansui-quartz-sand', 'karesansui-sub-base'],
    disposableMeshes: meshes,
  });

  return {
    group,
    meshes,
    dispose: () => disposeComponent('karesansui-sand-bed'),
  };
}

export function KaresansuiSandBed({
  scene,
  ...options
}: KaresansuiSandBedOptions & { scene?: THREE.Scene }) {
  useEffect(() => {
    if (!scene) return;
    const asset = createKaresansuiSandBed(options);
    scene.add(asset.group);
    return () => {
      scene.remove(asset.group);
      asset.dispose();
    };
  }, [
    scene,
    options.sandColor,
    options.roughness,
    options.rippleAmplitude,
    options.rippleFrequency,
  ]);

  return null;
}
