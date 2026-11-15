import type * as THREE from 'three';

export type CameraAnglePreset = 'hero45' | 'dollyClose' | 'topDown' | 'exploded';

export type ViewportMode = 'desktop' | 'mobile';

export interface SceneModuleContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  container: HTMLElement;
  isSoftwareGl: boolean;
}

/**
 * Strict LEGO Modular 3D Contract (`ISceneModule`).
 * Guarantees deterministic lifecycle management and 0% VRAM leak on teardown.
 */
export interface ISceneModule {
  readonly id: string;
  init(context: SceneModuleContext): void;
  update(elapsedTime: number, deltaTime: number): void;
  onResize(width: number, height: number): void;
  dispose(): void;
}

export type MattressSizeId =
  | 'twin'
  | 'twin_xl'
  | 'full'
  | 'queen'
  | 'king'
  | 'cal_king';

export interface MattressSizeSpec {
  id: MattressSizeId;
  label: string;
  dimensions: string;
  widthMeters: number;
  lengthMeters: number;
  salePrice: number;
  originalPrice: number;
  savings: number;
  bundleValue: number;
  weightLbs: number;
}

export interface TelemetryReadout {
  springCompressionMm: number;
  activeSheepCount: number;
  airflowCfm: number;
  surfaceTempC: number;
}

export const MATTRESS_SIZES: Record<MattressSizeId, MattressSizeSpec> = {
  twin: {
    id: 'twin',
    label: 'Twin',
    dimensions: '38" × 75" × 12"',
    widthMeters: 1.55,
    lengthMeters: 2.35,
    salePrice: 749,
    originalPrice: 2099,
    savings: 1350,
    bundleValue: 600,
    weightLbs: 68,
  },
  twin_xl: {
    id: 'twin_xl',
    label: 'Twin XL',
    dimensions: '38" × 80" × 12"',
    widthMeters: 1.58,
    lengthMeters: 2.5,
    salePrice: 799,
    originalPrice: 2149,
    savings: 1350,
    bundleValue: 600,
    weightLbs: 72,
  },
  full: {
    id: 'full',
    label: 'Full',
    dimensions: '54" × 75" × 12"',
    widthMeters: 1.9,
    lengthMeters: 2.35,
    salePrice: 949,
    originalPrice: 2299,
    savings: 1350,
    bundleValue: 600,
    weightLbs: 88,
  },
  queen: {
    id: 'queen',
    label: 'Queen',
    dimensions: '60" × 80" × 12"',
    widthMeters: 2.15,
    lengthMeters: 2.55,
    salePrice: 1049,
    originalPrice: 2399,
    savings: 1350,
    bundleValue: 600,
    weightLbs: 102,
  },
  king: {
    id: 'king',
    label: 'King',
    dimensions: '76" × 80" × 12"',
    widthMeters: 2.55,
    lengthMeters: 2.55,
    salePrice: 1249,
    originalPrice: 2599,
    savings: 1350,
    bundleValue: 600,
    weightLbs: 124,
  },
  cal_king: {
    id: 'cal_king',
    label: 'Cal King',
    dimensions: '72" × 84" × 12"',
    widthMeters: 2.45,
    lengthMeters: 2.68,
    salePrice: 1249,
    originalPrice: 2599,
    savings: 1350,
    bundleValue: 600,
    weightLbs: 126,
  },
};

export const MATTRESS_SIZE_ORDER: MattressSizeId[] = [
  'twin',
  'twin_xl',
  'full',
  'queen',
  'king',
  'cal_king',
];

const SIZE_ALIAS_MAP: Record<string, MattressSizeId> = {
  twin: 'twin',
  'twin xl': 'twin_xl',
  twin_xl: 'twin_xl',
  'twin-xl': 'twin_xl',
  full: 'full',
  queen: 'queen',
  king: 'king',
  'cal king': 'cal_king',
  cal_king: 'cal_king',
  'cal-king': 'cal_king',
  'california king': 'cal_king',
};

/**
 * Normalizes PDP variant size strings (e.g., "Twin", "Twin XL", "Full", "Queen", "King", "Cal King")
 * into the canonical `MattressSizeSpec`, defaulting to `MATTRESS_SIZES.queen`.
 */
export function resolveMattressSizeSpec(sizeOrId?: string): MattressSizeSpec {
  if (!sizeOrId) return MATTRESS_SIZES.queen;
  const normalized = sizeOrId.trim().toLowerCase();
  const mappedId = SIZE_ALIAS_MAP[normalized];
  if (mappedId) {
    return MATTRESS_SIZES[mappedId];
  }
  return MATTRESS_SIZES.queen;
}
