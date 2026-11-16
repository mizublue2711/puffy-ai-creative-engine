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

export interface BedsideArtBookOptions {
  sideX?: number;
  shelfY?: number;
  wallZ?: number;
}

function createBookCoverTexture(title: string, bg: string, fg: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 320;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 256, 320);
    ctx.strokeStyle = fg;
    ctx.lineWidth = 4;
    ctx.strokeRect(20, 20, 216, 280);
    ctx.fillStyle = fg;
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    const words = title.split(' ');
    words.forEach((w, i) => {
      ctx.fillText(w, 128, 120 + i * 28);
    });
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * LEGO Decor Prop: Bedside Floating Shelf, Artbook & Sculptural Vessel
 */
export function createBedsideArtBook(
  options: BedsideArtBookOptions = {},
): StyleableBedroomAsset {
  const sideX = options.sideX ?? 1.48;
  const shelfY = options.shelfY ?? 0.42;
  const wallZ = options.wallZ ?? -1.35;

  const group = new THREE.Group();
  group.name = 'BedsideArtBookAndDecor';

  const shelfMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#C8A882'),
    roughness: 0.48,
    metalness: 0.05,
  });

  let activeBookTex = createBookCoverTexture('KINFOLK', '#202436', '#EDE8DF');
  const bookMat = new THREE.MeshStandardMaterial({
    map: activeBookTex,
    roughness: 0.72,
    metalness: 0.05,
  });

  const vesselMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#F6F4EF'),
    roughness: 0.28,
    metalness: 0.05,
  });

  // 1. Minimalist Floating Bedside Shelf
  const shelfW = 0.48;
  const shelfH = 0.032;
  const shelfD = 0.34;
  const shelfGeo = new RoundedBoxGeometry(shelfW, shelfH, shelfD, 2, 0.006);
  const shelfMesh = new THREE.Mesh(shelfGeo, shelfMat);
  shelfMesh.position.set(sideX, shelfY, wallZ + shelfD / 2);
  shelfMesh.castShadow = true;
  shelfMesh.receiveShadow = true;

  // 2. Hardcover Artbook resting on shelf
  const bookW = 0.23;
  const bookH = 0.028;
  const bookD = 0.27;
  const bookGeo = new THREE.BoxGeometry(bookW, bookH, bookD);
  const bookMesh = new THREE.Mesh(bookGeo, bookMat);
  bookMesh.position.set(sideX - 0.07, shelfY + shelfH / 2 + bookH / 2, wallZ + shelfD / 2 + 0.01);
  bookMesh.rotation.y = 0.14;
  bookMesh.castShadow = true;
  bookMesh.receiveShadow = true;

  // 3. Sculptural Ceramic / Brass Vessel
  const vesselGeo = new THREE.CylinderGeometry(0.042, 0.054, 0.14, 24);
  const vesselMesh = new THREE.Mesh(vesselGeo, vesselMat);
  vesselMesh.position.set(sideX + 0.13, shelfY + shelfH / 2 + 0.07, wallZ + shelfD / 2 - 0.02);
  vesselMesh.castShadow = true;
  vesselMesh.receiveShadow = true;

  group.add(shelfMesh, bookMesh, vesselMesh);

  const applyStyle = (preset: BedroomStylePreset, duration = 0.5) => {
    const sc = new THREE.Color(preset.floor.color);
    const vc = new THREE.Color(preset.book.vesselColor);

    gsap.to(shelfMat.color, { r: sc.r, g: sc.g, b: sc.b, duration, ease: 'power2.out' });
    gsap.to(vesselMat.color, { r: vc.r, g: vc.g, b: vc.b, duration, ease: 'power2.out' });
    gsap.to(vesselMat, {
      metalness: preset.book.vesselMetalness,
      roughness: preset.book.vesselRoughness,
      duration,
      ease: 'power2.out',
    });

    const nextTex = createBookCoverTexture(
      preset.book.title,
      preset.book.coverColor,
      preset.book.accentColor,
    );
    const oldTex = activeBookTex;
    activeBookTex = nextTex;
    bookMat.map = nextTex;
    bookMat.needsUpdate = true;
    oldTex.dispose();
  };

  registerBedroomComponent({
    id: 'bedside-art-book',
    name: 'Bedside Floating Shelf, Artbook & Vessel',
    category: 'decor',
    dimensions: { width: shelfW, height: 0.22, depth: shelfD },
    defaultTransform: {
      position: [sideX, shelfY, wallZ + shelfD / 2],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    materialSlots: ['bedside-shelf', 'artbook-cover', 'decor-vessel'],
    disposableMeshes: [shelfMesh, bookMesh, vesselMesh],
  });

  return {
    group,
    meshes: [shelfMesh, bookMesh, vesselMesh],
    applyStyle,
    dispose: () => disposeComponent('bedside-art-book'),
  };
}

export function BedsideArtBook({
  scene,
  ...options
}: BedsideArtBookOptions & { scene?: THREE.Scene }) {
  useEffect(() => {
    if (!scene) return;
    const asset = createBedsideArtBook(options);
    scene.add(asset.group);
    return () => {
      scene.remove(asset.group);
      asset.dispose();
    };
  }, [scene, options.sideX, options.shelfY, options.wallZ]);

  return null;
}
