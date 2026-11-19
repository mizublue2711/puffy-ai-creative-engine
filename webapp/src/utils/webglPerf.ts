import type * as THREE from 'three';

export function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(max-width: 768px)').matches ||
    window.matchMedia('(pointer: coarse)').matches
  );
}

export function getOptimalPixelRatio(isSoftwareGl = false): number {
  if (isSoftwareGl || typeof window === 'undefined') return 1;
  const dpr = window.devicePixelRatio || 1;
  const maxDpr = isMobileViewport() ? 1.5 : 2;
  return Math.min(dpr, maxDpr);
}

export function getShadowMapSize(): number {
  return isMobileViewport() ? 1024 : 2048;
}

export function getOptimalAnisotropy(renderer: THREE.WebGLRenderer): number {
  const max = renderer.capabilities.getMaxAnisotropy();
  return isMobileViewport() ? Math.min(4, max) : max;
}
