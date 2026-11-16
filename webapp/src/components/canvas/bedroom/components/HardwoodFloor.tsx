import { useEffect } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import {
  registerBedroomComponent,
  disposeComponent,
  type BedroomStylePreset,
} from '../BedroomRegistry.ts';
import type { StyleableBedroomAsset } from './BedThrowBlanket.tsx';

export interface HardwoodFloorOptions {
  width?: number;
  length?: number;
}

function createScandinavianOakMaps(): {
  albedoMap: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  const size = 512;
  const aCanvas = document.createElement('canvas');
  aCanvas.width = size;
  aCanvas.height = size;
  const aCtx = aCanvas.getContext('2d');

  const nCanvas = document.createElement('canvas');
  nCanvas.width = size;
  nCanvas.height = size;
  const nCtx = nCanvas.getContext('2d');

  const rCanvas = document.createElement('canvas');
  rCanvas.width = size;
  rCanvas.height = size;
  const rCtx = rCanvas.getContext('2d');

  if (aCtx && nCtx && rCtx) {
    const aImg = aCtx.createImageData(size, size);
    const nImg = nCtx.createImageData(size, size);
    const rImg = rCtx.createImageData(size, size);
    const aData = aImg.data;
    const nData = nImg.data;
    const rData = rImg.data;

    const plankWidth = 64; // 8 longitudinal planks across tile
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const plankIdx = Math.floor(x / plankWidth);
        const localX = x % plankWidth;
        const seamDist = Math.min(localX, plankWidth - 1 - localX);
        const isSeam = seamDist <= 1;

        // Staggered cross-plank end joint
        const jointY = (y + plankIdx * 173) % 256;
        const isEndJoint = jointY <= 1;

        // Multi-frequency longitudinal wood grain & cathedral rings
        const wave = Math.sin(y * 0.045 + plankIdx * 1.9) * 3.2;
        const grainPrimary = Math.sin((x + wave) * 0.55 + plankIdx * 0.7);
        const grainFine = Math.sin((x + wave * 0.6) * 1.65) * 0.35;
        const poreNoise = (((x * 37 + y * 13 + plankIdx * 97) % 23) / 23 - 0.5) * 0.25;
        const grain = grainPrimary * 0.6 + grainFine + poreNoise;

        // Subtle plank-to-plank warm honey oak tone variation
        const plankTone = ((plankIdx * 47 + Math.floor((y + plankIdx * 173) / 256) * 29) % 7) - 3;
        const toneShift = plankTone * 0.032 + grain * 0.06;
        const seamDarken = isSeam || isEndJoint ? 0.52 : 1.0;

        // Neutral warm multiplier around 0.92..1.05 so material.color (#B58A57) stays true
        const baseLum = THREE.MathUtils.clamp((0.95 + toneShift) * seamDarken, 0.35, 1.0);
        const lumR = Math.round(baseLum * 255);
        const lumG = Math.round(THREE.MathUtils.clamp(baseLum * 0.96, 0.32, 1.0) * 255);
        const lumB = Math.round(THREE.MathUtils.clamp(baseLum * 0.90, 0.28, 1.0) * 255);

        // Normal perturbation for beveled board grooves + wood grain
        let nx = 0.5 + grain * 0.12;
        let ny = 0.5;
        if (seamDist <= 2) {
          nx = localX <= 2 ? 0.18 : 0.82;
        }
        if (jointY <= 2) {
          ny = jointY === 0 ? 0.2 : 0.8;
        }

        // Roughness variation: matte in grain pores & bevel seams, satin reflection on flat grain
        const poreFactor = grain < -0.25 ? 0.18 : -0.06;
        const roughVal = isSeam || isEndJoint
          ? 0.82
          : THREE.MathUtils.clamp(0.42 + poreFactor + (plankIdx % 2) * 0.03, 0.28, 0.78);
        const roughByte = Math.round(roughVal * 255);

        const idx = (y * size + x) * 4;
        aData[idx] = lumR;
        aData[idx + 1] = lumG;
        aData[idx + 2] = lumB;
        aData[idx + 3] = 255;

        nData[idx] = Math.round(THREE.MathUtils.clamp(nx, 0, 1) * 255);
        nData[idx + 1] = Math.round(THREE.MathUtils.clamp(ny, 0, 1) * 255);
        nData[idx + 2] = 242;
        nData[idx + 3] = 255;

        rData[idx] = roughByte;
        rData[idx + 1] = roughByte;
        rData[idx + 2] = roughByte;
        rData[idx + 3] = 255;
      }
    }

    aCtx.putImageData(aImg, 0, 0);
    nCtx.putImageData(nImg, 0, 0);
    rCtx.putImageData(rImg, 0, 0);
  }

  const configureTex = (c: HTMLCanvasElement, isColor: boolean) => {
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 6);
    tex.anisotropy = 8;
    return tex;
  };

  return {
    albedoMap: configureTex(aCanvas, true),
    normalMap: configureTex(nCanvas, false),
    roughnessMap: configureTex(rCanvas, false),
  };
}

/**
 * LEGO Component 2B: Scandinavian Warm Honey Oak Hardwood Floor
 * Seamless room floor plane (width: 6.0m, length: 6.0m) at y = 0.
 * Satin wax finish (roughness: 0.42) with longitudinal plank grooves and roughness variation.
 */
export function createHardwoodFloor(options: HardwoodFloorOptions = {}): StyleableBedroomAsset {
  const width = options.width ?? 6.4;
  const length = options.length ?? 6.4;

  const group = new THREE.Group();
  group.name = 'ScandinavianHardwoodFloor';

  const { albedoMap, normalMap, roughnessMap } = createScandinavianOakMaps();

  const oakFloorMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#B58A57'),
    map: albedoMap,
    roughness: 0.42,
    metalness: 0.0,
    normalMap,
    normalScale: new THREE.Vector2(0.6, 0.6),
    roughnessMap,
  });

  const floorGeo = new THREE.PlaneGeometry(width, length);
  floorGeo.rotateX(-Math.PI / 2);
  const floorMesh = new THREE.Mesh(floorGeo, oakFloorMat);
  floorMesh.position.set(0, 0, 0);
  floorMesh.receiveShadow = true;

  group.add(floorMesh);

  const applyStyle = (preset: BedroomStylePreset, duration = 0.5) => {
    const fc = new THREE.Color(preset.floor.color);
    gsap.to(oakFloorMat.color, { r: fc.r, g: fc.g, b: fc.b, duration, ease: 'power2.out' });
    gsap.to(oakFloorMat, { roughness: preset.floor.roughness, duration, ease: 'power2.out' });
  };

  registerBedroomComponent({
    id: 'hardwood-floor',
    name: 'Scandinavian Warm Honey Oak Hardwood Floor',
    category: 'flooring',
    dimensions: { width, height: 0, depth: length },
    defaultTransform: {
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    materialSlots: ['honey-scandinavian-oak'],
    disposableMeshes: [floorMesh],
  });

  return {
    group,
    meshes: [floorMesh],
    applyStyle,
    dispose: () => disposeComponent('hardwood-floor'),
  };
}

export function HardwoodFloor({
  scene,
  ...options
}: HardwoodFloorOptions & { scene?: THREE.Scene }) {
  useEffect(() => {
    if (!scene) return;
    const asset = createHardwoodFloor(options);
    scene.add(asset.group);
    return () => {
      scene.remove(asset.group);
      asset.dispose();
    };
  }, [scene, options.width, options.length]);

  return null;
}
