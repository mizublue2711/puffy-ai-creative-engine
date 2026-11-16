import { useEffect } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import {
  registerBedroomComponent,
  disposeComponent,
  type BedroomStylePreset,
} from '../BedroomRegistry.ts';
import type { StyleableBedroomAsset } from './BedThrowBlanket.tsx';

export interface FramedCanvasArtOptions {
  wallZ?: number;
  centerY?: number;
}

function drawArtMotifTexture(
  motif: BedroomStylePreset['art']['motif'],
): THREE.CanvasTexture {
  const w = 512;
  const h = 384;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    if (motif === 'japandi-enso') {
      // Warm Washi paper background + Indigo Enso calligraphy circle
      ctx.fillStyle = '#F3EEE3';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#2B3245';
      ctx.lineWidth = 22;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.5, 105, 0.35, Math.PI * 1.92);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(43, 50, 69, 0.35)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.5, 118, 0.5, Math.PI * 1.6);
      ctx.stroke();
    } else if (motif === 'nordic-diptych') {
      // Coastal tide abstract: Navy, Ocean Teal & Seafoam
      ctx.fillStyle = '#F7F5F0';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#202436';
      ctx.fillRect(28, 34, w * 0.43, h - 68);
      ctx.fillStyle = '#3C6E71';
      ctx.beginPath();
      ctx.arc(w * 0.25, h * 0.58, 95, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#EAE5DC';
      ctx.fillRect(w * 0.53, 34, w * 0.42, h - 68);
      ctx.fillStyle = '#2B2F44';
      ctx.fillRect(w * 0.57, h * 0.45, w * 0.34, h * 0.32);
    } else if (motif === 'midcentury-bauhaus') {
      // Bauhaus Geometry: Navy, Terracotta, Champagne Gold Foil
      ctx.fillStyle = '#EFE9DD';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#1E2538';
      ctx.fillRect(42, 42, 180, 290);
      ctx.fillStyle = '#B85D3B';
      ctx.beginPath();
      ctx.arc(325, 165, 108, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#D4B475';
      ctx.fillRect(245, 230, 210, 96);
    } else {
      // Urban Loft: B&W Architectural Concrete Museum Curves
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#1D1F22');
      grad.addColorStop(0.55, '#6C7075');
      grad.addColorStop(1, '#D5D7DA');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#2A2D31';
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.quadraticCurveTo(w * 0.45, h * 0.18, w, h * 0.55);
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * LEGO Decor Prop: Framed Canvas Art
 * Mounted centered above the headboard at z = wallZ + 0.025, y = 1.95m.
 */
export function createFramedCanvasArt(
  options: FramedCanvasArtOptions = {},
): StyleableBedroomAsset {
  const wallZ = options.wallZ ?? -1.35;
  const centerY = options.centerY ?? 1.95;

  const group = new THREE.Group();
  group.name = 'FramedCanvasArt';

  const frameMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#E5DFD5'),
    roughness: 0.42,
    metalness: 0.04,
  });

  let activeArtTex = drawArtMotifTexture('nordic-diptych');
  const canvasMat = new THREE.MeshStandardMaterial({
    map: activeArtTex,
    roughness: 0.85,
    metalness: 0.0,
  });

  const artW = 1.18;
  const artH = 0.86;
  const frameDepth = 0.036;
  const border = 0.032;

  const backGeo = new THREE.BoxGeometry(artW + border * 2, artH + border * 2, frameDepth);
  const frameMesh = new THREE.Mesh(backGeo, frameMat);
  frameMesh.position.set(0, centerY, wallZ + frameDepth / 2);
  frameMesh.castShadow = true;
  frameMesh.receiveShadow = true;

  const artGeo = new THREE.PlaneGeometry(artW, artH);
  const artMesh = new THREE.Mesh(artGeo, canvasMat);
  artMesh.position.set(0, centerY, wallZ + frameDepth + 0.002);
  artMesh.receiveShadow = true;

  group.add(frameMesh, artMesh);

  const applyStyle = (preset: BedroomStylePreset, duration = 0.5) => {
    const fc = new THREE.Color(preset.art.frameColor);
    gsap.to(frameMat.color, { r: fc.r, g: fc.g, b: fc.b, duration, ease: 'power2.out' });
    gsap.to(frameMat, {
      metalness: preset.art.frameMetalness,
      duration,
      ease: 'power2.out',
    });

    const nextTex = drawArtMotifTexture(preset.art.motif);
    const oldTex = activeArtTex;
    activeArtTex = nextTex;
    canvasMat.map = nextTex;
    canvasMat.needsUpdate = true;
    oldTex.dispose();
  };

  registerBedroomComponent({
    id: 'framed-canvas-art',
    name: 'Framed Architectural Canvas Art',
    category: 'decor',
    dimensions: { width: artW + border * 2, height: artH + border * 2, depth: frameDepth },
    defaultTransform: {
      position: [0, centerY, wallZ + frameDepth / 2],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    materialSlots: ['art-frame', 'canvas-print'],
    disposableMeshes: [frameMesh, artMesh],
  });

  return {
    group,
    meshes: [frameMesh, artMesh],
    applyStyle,
    dispose: () => disposeComponent('framed-canvas-art'),
  };
}

export function FramedCanvasArt({
  scene,
  ...options
}: FramedCanvasArtOptions & { scene?: THREE.Scene }) {
  useEffect(() => {
    if (!scene) return;
    const asset = createFramedCanvasArt(options);
    scene.add(asset.group);
    return () => {
      scene.remove(asset.group);
      asset.dispose();
    };
  }, [scene, options.wallZ, options.centerY]);

  return null;
}
