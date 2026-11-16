import { useEffect } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import gsap from 'gsap';
import {
  registerBedroomComponent,
  disposeComponent,
  type BedroomStylePreset,
} from '../BedroomRegistry.ts';
import type { StyleableBedroomAsset } from './BedThrowBlanket.tsx';

export interface AccentPillowsOptions {
  mattressWidth?: number;
  surfaceY?: number;
  headZ?: number;
}

/**
 * LEGO Decor Prop: Dual Accent Pillows
 * Two sculpted cushions tilted at 15° against the headboard with contrasting piping welt.
 */
export function createAccentPillows(
  options: AccentPillowsOptions = {},
): StyleableBedroomAsset {
  const mattressW = options.mattressWidth ?? 2.15;
  const surfaceY = options.surfaceY ?? 0.58;
  const headZ = options.headZ ?? -0.88;

  const group = new THREE.Group();
  group.name = 'AccentDecorPillows';

  const primaryMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#202436'),
    roughness: 0.85,
    metalness: 0.0,
    sheen: 1.0,
    sheenColor: new THREE.Color('#586796'),
    sheenRoughness: 0.55,
  });

  const secondaryMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#262C42'),
    roughness: 0.85,
    metalness: 0.0,
    sheen: 1.0,
    sheenColor: new THREE.Color('#586796'),
    sheenRoughness: 0.55,
  });

  const pipingMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#F4F0E8'),
    roughness: 0.72,
    metalness: 0.1,
    sheen: 0.9,
    sheenColor: new THREE.Color('#FFFFFF'),
  });

  const pillowW = 0.56;
  const pillowH = 0.42;
  const pillowD = 0.14;
  const pillowGeo = new RoundedBoxGeometry(pillowW, pillowH, pillowD, 5, 0.055);
  const pipingGeo = new RoundedBoxGeometry(pillowW + 0.012, pillowH + 0.012, 0.018, 3, 0.008);

  const meshes: THREE.Mesh[] = [];
  const offsetX = Math.min(0.46, mattressW * 0.23);

  const specs: Array<{ x: number; mat: THREE.MeshPhysicalMaterial; tiltZ: number }> = [
    { x: -offsetX, mat: primaryMat, tiltZ: 0.03 },
    { x: offsetX, mat: secondaryMat, tiltZ: -0.03 },
  ];

  for (const spec of specs) {
    const pGroup = new THREE.Group();
    pGroup.position.set(spec.x, surfaceY + pillowH * 0.45, headZ);
    // Tilt 15° back against headboard
    pGroup.rotation.set(-THREE.MathUtils.degToRad(15), 0, spec.tiltZ);

    const cushion = new THREE.Mesh(pillowGeo, spec.mat);
    cushion.castShadow = true;
    cushion.receiveShadow = true;
    pGroup.add(cushion);
    meshes.push(cushion);

    const piping = new THREE.Mesh(pipingGeo, pipingMat);
    piping.castShadow = true;
    pGroup.add(piping);
    meshes.push(piping);

    group.add(pGroup);
  }

  const applyStyle = (preset: BedroomStylePreset, duration = 0.5) => {
    const c1 = new THREE.Color(preset.pillows.primaryColor);
    const c2 = new THREE.Color(preset.pillows.secondaryColor);
    const cp = new THREE.Color(preset.pillows.pipingColor);
    const cs = new THREE.Color(preset.pillows.sheenColor);

    gsap.to(primaryMat.color, { r: c1.r, g: c1.g, b: c1.b, duration, ease: 'power2.out' });
    gsap.to(secondaryMat.color, { r: c2.r, g: c2.g, b: c2.b, duration, ease: 'power2.out' });
    gsap.to(pipingMat.color, { r: cp.r, g: cp.g, b: cp.b, duration, ease: 'power2.out' });
    gsap.to(primaryMat.sheenColor, { r: cs.r, g: cs.g, b: cs.b, duration, ease: 'power2.out' });
    gsap.to(secondaryMat.sheenColor, { r: cs.r, g: cs.g, b: cs.b, duration, ease: 'power2.out' });
    gsap.to([primaryMat, secondaryMat], {
      roughness: preset.pillows.roughness,
      duration,
      ease: 'power2.out',
    });
  };

  registerBedroomComponent({
    id: 'accent-pillows',
    name: 'Dual Tilted Accent Pillows',
    category: 'decor',
    dimensions: { width: offsetX * 2 + pillowW, height: pillowH, depth: pillowD },
    defaultTransform: {
      position: [0, surfaceY + pillowH * 0.45, headZ],
      rotation: [-THREE.MathUtils.degToRad(15), 0, 0],
      scale: [1, 1, 1],
    },
    materialSlots: ['pillow-primary', 'pillow-secondary', 'pillow-piping'],
    disposableMeshes: meshes,
  });

  return {
    group,
    meshes,
    applyStyle,
    dispose: () => disposeComponent('accent-pillows'),
  };
}

export function AccentPillows({
  scene,
  ...options
}: AccentPillowsOptions & { scene?: THREE.Scene }) {
  useEffect(() => {
    if (!scene) return;
    const asset = createAccentPillows(options);
    scene.add(asset.group);
    return () => {
      scene.remove(asset.group);
      asset.dispose();
    };
  }, [scene, options.mattressWidth, options.surfaceY, options.headZ]);

  return null;
}
