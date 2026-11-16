import { useEffect } from 'react';
import * as THREE from 'three';
import type { StyleableBedroomAsset } from './BedThrowBlanket.tsx';
import {
  createBedroomWalls,
  BedroomWalls,
  WALL_ENVIRONMENT_MATERIALS,
  type BedroomWallsOptions,
  type BedroomWallsAsset,
} from './BedroomWalls.tsx';

export {
  WALL_ENVIRONMENT_MATERIALS,
  BedroomWalls,
  createBedroomWalls,
  type BedroomWallsOptions,
  type BedroomWallsAsset,
};

export type RoomBoundaryOptions = BedroomWallsOptions;

// Muted Warm Sand Walnut / Honey Teak
export const midCenturyMutedWoodMaterial = new THREE.MeshStandardMaterial({
  color: new THREE.Color(WALL_ENVIRONMENT_MATERIALS['mid-century'].color),
  roughness: WALL_ENVIRONMENT_MATERIALS['mid-century'].roughness,
  metalness: WALL_ENVIRONMENT_MATERIALS['mid-century'].metalness,
  normalScale: new THREE.Vector2(0.3, 0.3),
});

// Negative Reveal Shadow Gap Material
export const shadowGapMaterial = new THREE.MeshBasicMaterial({
  color: new THREE.Color(WALL_ENVIRONMENT_MATERIALS['mid-century'].revealGapColor),
});

// Warm Mineral Limewash Plaster (Right Wall)
export const warmPlasterMaterial = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#EAE5DC'),
  roughness: 0.92,
  metalness: 0.0,
});

/**
 * LEGO Component: Room Boundary / Bedroom Walls
 * Delegates directly to unified floor-to-ceiling vertical rhythmic slats wall architecture.
 */
export function createRoomBoundary(options: RoomBoundaryOptions = {}): StyleableBedroomAsset {
  return createBedroomWalls(options);
}

export function RoomBoundary({
  scene,
  ...options
}: RoomBoundaryOptions & { scene?: THREE.Scene }) {
  useEffect(() => {
    if (!scene) return;
    const asset = createRoomBoundary(options);
    scene.add(asset.group);
    return () => {
      scene.remove(asset.group);
      asset.dispose();
    };
  }, [scene, options.width, options.wallHeight, options.wallZ, options.centerX, options.roomLength, options.ceilingPocketGap, options.environment]);

  return null;
}
