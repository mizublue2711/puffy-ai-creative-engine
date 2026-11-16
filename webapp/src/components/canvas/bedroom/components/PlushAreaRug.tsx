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

export interface PlushAreaRugOptions {
  width?: number;
  length?: number;
  thickness?: number;
  trimWidth?: number;
  centerZ?: number;
}

export const naturalRugMaterial = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#D5CEBF'), // Warm Oat / Raw Jute tone
  roughness: 0.95,
  metalness: 0.0,
});

function loadJuteRugTextures(): {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
  aoMap: THREE.Texture;
} {
  const loader = new THREE.TextureLoader();
  const configureTile = (tex: THREE.Texture, isColor = false) => {
    tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 7);
    tex.anisotropy = 4;
    return tex;
  };

  const basePath = '/shared_assets/lego/components/rug/rug_natural_jute_loop_v1';
  return {
    map: configureTile(loader.load(`${basePath}/01_baseColor.webp`), true),
    normalMap: configureTile(loader.load(`${basePath}/02_normal.png`)),
    roughnessMap: configureTile(loader.load(`${basePath}/03_roughness.webp`)),
    aoMap: configureTile(loader.load(`${basePath}/05_ambientOcclusion.webp`)),
  };
}

/**
 * LEGO Component 2A: Natural Jute & Chunky Wool Area Rug
 * Physical 10mm beveled slab: width 3.20m, depth 3.60m, thickness 0.010m.
 * Positioned at [0, 0.005, 0.35] (bottom flush on floor y = 0, top at y = 0.010m).
 */
export function createPlushAreaRug(options: PlushAreaRugOptions = {}): StyleableBedroomAsset {
  const width = options.width ?? 3.20;
  const length = options.length ?? 3.60;
  const thickness = options.thickness ?? 0.010;
  const trimWidth = options.trimWidth ?? 0.08;
  const centerZ = options.centerZ ?? 0.35;

  const group = new THREE.Group();
  group.name = 'PlushBoucleAreaRug';
  group.position.set(0, thickness / 2, centerZ);

  const juteTextures = loadJuteRugTextures();

  const woolBodyMat = naturalRugMaterial.clone();
  woolBodyMat.map = juteTextures.map;
  woolBodyMat.normalMap = juteTextures.normalMap;
  woolBodyMat.normalScale = new THREE.Vector2(1.1, 1.1);
  woolBodyMat.roughnessMap = juteTextures.roughnessMap;
  woolBodyMat.aoMap = juteTextures.aoMap;
  woolBodyMat.aoMapIntensity = 0.65;

  const navyTrimMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#8E8372'),
    roughness: 0.95,
    metalness: 0.0,
    normalMap: juteTextures.normalMap,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughnessMap: juteTextures.roughnessMap,
  });

  const meshes: THREE.Mesh[] = [];

  // 1. Main Oatmeal Ivory Rug Slab (beveled 18mm thick wool pile)
  const innerW = Math.max(0.5, width - trimWidth * 2);
  const innerL = Math.max(0.5, length - trimWidth * 2);
  const bodyGeo = new RoundedBoxGeometry(innerW, thickness, innerL, 2, 0.005);
  const bodyMesh = new THREE.Mesh(bodyGeo, woolBodyMat);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  group.add(bodyMesh);
  meshes.push(bodyMesh);

  // 2. Outer Navy Border Welt (0.08m wide beveled perimeter strips)
  const sideTrimGeo = new RoundedBoxGeometry(trimWidth, thickness, length, 2, 0.005);
  const endTrimGeo = new RoundedBoxGeometry(innerW, thickness, trimWidth, 2, 0.005);

  const leftTrim = new THREE.Mesh(sideTrimGeo, navyTrimMat);
  leftTrim.position.set(-(innerW / 2 + trimWidth / 2), 0, 0);
  leftTrim.castShadow = true;
  leftTrim.receiveShadow = true;

  const rightTrim = new THREE.Mesh(sideTrimGeo, navyTrimMat);
  rightTrim.position.set(innerW / 2 + trimWidth / 2, 0, 0);
  rightTrim.castShadow = true;
  rightTrim.receiveShadow = true;

  const backTrim = new THREE.Mesh(endTrimGeo, navyTrimMat);
  backTrim.position.set(0, 0, -(innerL / 2 + trimWidth / 2));
  backTrim.castShadow = true;
  backTrim.receiveShadow = true;

  const frontTrim = new THREE.Mesh(endTrimGeo, navyTrimMat);
  frontTrim.position.set(0, 0, innerL / 2 + trimWidth / 2);
  frontTrim.castShadow = true;
  frontTrim.receiveShadow = true;

  group.add(leftTrim, rightTrim, backTrim, frontTrim);
  meshes.push(leftTrim, rightTrim, backTrim, frontTrim);

  const applyStyle = (preset: BedroomStylePreset, duration = 0.5) => {
    const bc = new THREE.Color(preset.rug.bodyColor);
    const tc = new THREE.Color(preset.rug.trimColor);

    gsap.to(woolBodyMat.color, { r: bc.r, g: bc.g, b: bc.b, duration, ease: 'power2.out' });
    gsap.to(woolBodyMat, { roughness: preset.rug.roughness, duration, ease: 'power2.out' });
    gsap.to(navyTrimMat.color, { r: tc.r, g: tc.g, b: tc.b, duration, ease: 'power2.out' });
  };

  registerBedroomComponent({
    id: 'plush-wool-rug',
    name: 'Natural Textured Jute Area Rug',
    category: 'decor',
    dimensions: { width, height: thickness, depth: length },
    defaultTransform: {
      position: [0, thickness / 2, centerZ],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    materialSlots: ['natural-jute-weave', 'jute-border-trim'],
    disposableMeshes: meshes,
  });

  return {
    group,
    meshes,
    applyStyle,
    dispose: () => disposeComponent('plush-wool-rug'),
  };
}

export function PlushAreaRug({
  scene,
  ...options
}: PlushAreaRugOptions & { scene?: THREE.Scene }) {
  useEffect(() => {
    if (!scene) return;
    const asset = createPlushAreaRug(options);
    scene.add(asset.group);
    return () => {
      scene.remove(asset.group);
      asset.dispose();
    };
  }, [scene, options.width, options.length, options.thickness, options.centerZ]);

  return null;
}
