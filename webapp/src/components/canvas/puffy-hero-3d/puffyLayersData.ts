export type LayerTextureType =
  | 'cloud-quilt'
  | 'wool-cream'
  | 'fire-felt'
  | 'foam-babyblue'
  | 'foam-cyan'
  | 'foam-mint'
  | 'foam-lavender'
  | 'pocket-springs'
  | 'base-foam'
  | 'grip-base';

export type LayerBenefitIcon =
  | 'snowflake'
  | 'zones'
  | 'shield'
  | 'feather'
  | 'airflow'
  | 'spark'
  | 'spine'
  | 'coil'
  | 'anchor';

export interface LayerBenefit {
  icon: LayerBenefitIcon;
  label: string;
}

export interface MattressLayerData {
  id: number;
  name: string;
  subtitle: string;
  shortTabLabel: string;
  badgeLabel: string;
  exclusiveTag?: string;
  tagline: string;
  description: string;
  whatItIs: string;
  howItWorks: string;
  benefits: [LayerBenefit, LayerBenefit, LayerBenefit];
  colorHex: string;
  thickness: number; // Y-scale
  textureType: LayerTextureType;
  screenshotUrl: string;
}

export const PUFFY_10_LAYERS: MattressLayerData[] = [
  {
    id: 1,
    name: 'Quilted Cloud Cover',
    subtitle: 'Cool Quilted Cloud Cover',
    shortTabLabel: 'Cool Quilted Cover',
    badgeLabel: 'Cover',
    tagline: 'Cool to the Touch, All-Night Comfort',
    description:
      'Breathable, cooling yarns knitted into a quilted cover with a patented cloud design pulls heat away up to 10x faster.',
    whatItIs:
      'A breathable, quilted cover knit with cooling yarns and finished with our patented cloud pattern.',
    howItWorks:
      'Cooling fibers draw heat away from the surface up to 10x faster while promoting steady airflow for a fresher feel.',
    benefits: [
      { icon: 'snowflake', label: 'Cooler, drier sleep' },
      { icon: 'zones', label: '5-zone support' },
      { icon: 'shield', label: 'Responsive comfort' },
    ],
    colorHex: '#FFFFFF',
    thickness: 0.12,
    textureType: 'cloud-quilt',
    screenshotUrl: '/assets/3d/aistudio/Screenshot_2026-11-15_at_3.26.35_AM_94c66147.png',
  },
  {
    id: 2,
    name: 'Premium Blended Wool',
    subtitle: 'Natural Temperature-Regulating Wool',
    shortTabLabel: 'Blended Wool',
    badgeLabel: '0.25"',
    exclusiveTag: 'Exclusive to Royal',
    tagline: 'Warm in Winter, Cool in Summer',
    description:
      'Natural wool fibers regulate sleep temperature across all seasons while providing breathable, plush cushioning.',
    whatItIs:
      'A breathable comfort layer made with naturally resilient wool fibers for year-round comfort.',
    howItWorks:
      'Helps regulate temperature and moisture while adding soft, cushioned support directly beneath the cover.',
    benefits: [
      { icon: 'airflow', label: 'Moisture-wicking' },
      { icon: 'feather', label: 'Plush natural loft' },
      { icon: 'snowflake', label: 'All-season balance' },
    ],
    colorHex: '#F2EDE4',
    thickness: 0.08,
    textureType: 'wool-cream',
    screenshotUrl: '/assets/3d/aistudio/Screenshot_2026-11-15_at_3.26.59_AM_f63fa125.png',
  },
  {
    id: 3,
    name: 'Fire-Resistant Fiber Layer',
    subtitle: 'Chemical-Free Protective Fiber',
    shortTabLabel: 'Comfort Quilt',
    badgeLabel: '0.25"',
    tagline: 'Natural Protection',
    description:
      'A whisper-quiet, chemical-free fire barrier woven directly beneath the wool layer for safe, breathable peace of mind.',
    whatItIs:
      'A lightweight, breathable comfort fiber layer that adds a soft, cushioned surface feel.',
    howItWorks:
      'Enhances initial plushness while acting as a safe, breathable protective barrier that promotes airflow.',
    benefits: [
      { icon: 'shield', label: 'Chemical-free barrier' },
      { icon: 'airflow', label: 'Breathable weave' },
      { icon: 'feather', label: 'Whisper-quiet feel' },
    ],
    colorHex: '#D9D6D0',
    thickness: 0.06,
    textureType: 'fire-felt',
    screenshotUrl: '/assets/3d/aistudio/Screenshot_2026-11-15_at_3.27.07_AM_f4c2f847.png',
  },
  {
    id: 4,
    name: 'Comfort Quilt Foam Layer',
    subtitle: 'Adaptive Surface Quilting Foam',
    shortTabLabel: 'Plush Contouring',
    badgeLabel: '1"',
    tagline: 'Adaptive Support',
    description:
      'Ultra-responsive quilting foam adapts instantly to micro-movements, relieving surface pressure from the very first moment.',
    whatItIs:
      'A soft, responsive foam layer designed to contour gently to the body for immediate pressure relief.',
    howItWorks:
      'Adapts to your shape to help ease surface pressure at the shoulders and hips and improve overall comfort.',
    benefits: [
      { icon: 'feather', label: 'Instant pressure relief' },
      { icon: 'spark', label: 'Micro-movement adapt' },
      { icon: 'shield', label: 'CertiPUR-US® certified' },
    ],
    colorHex: '#E5E1D8',
    thickness: 0.1,
    textureType: 'foam-babyblue',
    screenshotUrl: '/assets/3d/aistudio/Screenshot_2026-11-15_at_3.27.15_AM_c278943a.png',
  },
  {
    id: 5,
    name: 'Plush Contouring Foam',
    subtitle: 'Deep-Cushioning Memory Foam',
    shortTabLabel: 'Reflexive Foam',
    badgeLabel: '2"',
    tagline: 'Body-Hugging Comfort',
    description:
      'Deep-cushioning pastel blue memory foam cradles joints and curves to eliminate pressure points along shoulders and hips.',
    whatItIs:
      'A responsive memory foam layer that combines deep contouring comfort with a buoyant feel.',
    howItWorks:
      'Molds to the body to help relieve pressure points while bouncing back smoothly when you change positions.',
    benefits: [
      { icon: 'feather', label: 'Joint & hip cradling' },
      { icon: 'spark', label: 'Buoyant recovery' },
      { icon: 'snowflake', label: 'Open-cell cooling' },
    ],
    colorHex: '#C2D9EE',
    thickness: 0.12,
    textureType: 'foam-cyan',
    screenshotUrl: '/assets/3d/aistudio/Screenshot_2026-11-15_at_3.27.22_AM_1f7d4aac.png',
  },
  {
    id: 6,
    name: 'Reflexive Memory Foam',
    subtitle: 'High-Elasticity Transition Foam',
    shortTabLabel: 'Cloud Comfort',
    badgeLabel: '1"',
    tagline: 'Support for Every Position',
    description:
      'High-elasticity recovery foam responds dynamically whether you sleep on your side, back, or stomach.',
    whatItIs:
      'A supportive transition foam layer that balances plushness with healthy spinal alignment.',
    howItWorks:
      'Distributes body weight evenly to reduce pressure buildup and smooth the transition to deeper support layers.',
    benefits: [
      { icon: 'spine', label: 'Even weight balance' },
      { icon: 'spark', label: '99.4% rapid rebound' },
      { icon: 'zones', label: 'All-position support' },
    ],
    colorHex: '#8FB6DE',
    thickness: 0.14,
    textureType: 'foam-mint',
    screenshotUrl: '/assets/3d/aistudio/Screenshot_2026-11-15_at_3.27.28_AM_376ad968.png',
  },
  {
    id: 7,
    name: 'Cloud Breeze™ Cooling Technology',
    subtitle: '5-Zone Sculpted Ergonomic Core',
    shortTabLabel: 'Cloud Breeze™',
    badgeLabel: '2.5"',
    tagline: 'Targeted 5-Zone Support',
    description:
      'Precision-sculpted 5-zone contour channels provide targeted ergonomic alignment for head, shoulders, lumbar, hips, and knees.',
    whatItIs:
      'A cooling, sculpted foam layer featuring five targeted support zones and airflow channels.',
    howItWorks:
      'Provides firmer support under the lower back and softer cushioning at the shoulders while promoting heat dissipation.',
    benefits: [
      { icon: 'zones', label: '5-zone alignment' },
      { icon: 'airflow', label: 'Airflow channels' },
      { icon: 'spine', label: 'Lumbar reinforcement' },
    ],
    colorHex: '#617FA3',
    thickness: 0.16,
    textureType: 'foam-lavender',
    screenshotUrl: '/assets/3d/aistudio/Screenshot_2026-11-15_at_3.27.34_AM_d4e54ec8.png',
  },
  {
    id: 8,
    name: 'Contour-Adapt Pocket Coils',
    subtitle: 'Individually Encased Coil System',
    shortTabLabel: 'Contour Coils',
    badgeLabel: '6"',
    tagline: 'Undisturbed Sleep With Edge Support',
    description:
      'Individually fabric-encased coils isolate partner motion and feature a high-density foam perimeter for edge-to-edge stability.',
    whatItIs:
      'Individually wrapped pocket coils surrounded by a reinforced high-density foam perimeter.',
    howItWorks:
      'Coils flex independently to limit motion transfer, while reinforced edges improve stability and usable sleep surface.',
    benefits: [
      { icon: 'coil', label: 'Zero motion transfer' },
      { icon: 'shield', label: 'Reinforced edge wall' },
      { icon: 'airflow', label: '360° coil airflow' },
    ],
    colorHex: '#F8F9FA',
    thickness: 0.42,
    textureType: 'pocket-springs',
    screenshotUrl: '/assets/3d/aistudio/Screenshot_2026-11-15_at_3.27.39_AM_2f52f46e.png',
  },
  {
    id: 9,
    name: 'Firm Core Support Foam',
    subtitle: 'High-Density Foundation Foam',
    shortTabLabel: 'Firm Support',
    badgeLabel: '1"',
    tagline: 'Durability, Night After Night',
    description:
      'High-density foundation foam absorbs deep compression and reinforces the pocket coil matrix for long-lasting structural integrity.',
    whatItIs:
      'A dense base foam layer that forms a stable foundation beneath the pocket coil system.',
    howItWorks:
      'Supports the upper layers, absorbs movement, and helps maintain mattress structure over time.',
    benefits: [
      { icon: 'spine', label: 'Anti-sag foundation' },
      { icon: 'shield', label: 'Coil shock absorption' },
      { icon: 'anchor', label: 'Long-term durability' },
    ],
    colorHex: '#3E434D',
    thickness: 0.18,
    textureType: 'base-foam',
    screenshotUrl: '/assets/3d/aistudio/Screenshot_2026-11-15_at_3.27.45_AM_b35c0fe3.png',
  },
  {
    id: 10,
    name: 'Grip Base Cover',
    subtitle: 'Non-Slip Encasement Base',
    shortTabLabel: 'Grip Base',
    badgeLabel: 'Base',
    tagline: 'Stability, Added Protection',
    description:
      'Textured non-slip lower casing keeps your Puffy Royal anchored securely onto any bed frame, foundation, or adjustable base.',
    whatItIs:
      'A durable, textured bottom cover designed to help keep the mattress securely in place.',
    howItWorks:
      'Reduces shifting on foundations and bed frames while protecting the underside of the mattress.',
    benefits: [
      { icon: 'anchor', label: 'Non-slip grip weave' },
      { icon: 'shield', label: 'Adjustable-base ready' },
      { icon: 'coil', label: 'Underside protection' },
    ],
    colorHex: '#22242A',
    thickness: 0.05,
    textureType: 'grip-base',
    screenshotUrl: '/assets/3d/aistudio/Screenshot_2026-11-15_at_3.27.50_AM_22633f06.png',
  },
];

export type PuffyModelKey = 'cloud' | 'lux' | 'royal';

export interface MattressModelConfig {
  key: PuffyModelKey;
  name: string;
  shortLabel: string;
  profileHeightInches: number;
  heightMeters: number;
  layersCount: number;
  firmnessScore: number;
  firmnessLabel: string;
  sliderValue: number;
  sliderStep: 0 | 1 | 2;
  layerIds: number[];
}

export type PuffyEcoModelConfig = MattressModelConfig;

export const PUFFY_MODEL_ORDER: PuffyModelKey[] = ['cloud', 'lux', 'royal'];

export const PUFFY_MODEL_CONFIGS: Record<PuffyModelKey, MattressModelConfig> = {
  cloud: {
    key: 'cloud',
    name: 'Puffy Cloud',
    shortLabel: 'Puffy Cloud (10")',
    profileHeightInches: 10,
    heightMeters: 0.254,
    layersCount: 6,
    firmnessScore: 6.0,
    firmnessLabel: 'Medium-Firm',
    sliderValue: 0,
    sliderStep: 0,
    layerIds: [1, 3, 4, 5, 9, 10],
  },
  lux: {
    key: 'lux',
    name: 'Puffy Lux Hybrid',
    shortLabel: 'Puffy Lux (12")',
    profileHeightInches: 12,
    heightMeters: 0.305,
    layersCount: 8,
    firmnessScore: 5.5,
    firmnessLabel: 'Plush Soft',
    sliderValue: 50,
    sliderStep: 1,
    layerIds: [1, 3, 4, 5, 6, 8, 9, 10],
  },
  royal: {
    key: 'royal',
    name: 'Puffy Royal Hybrid',
    shortLabel: 'Puffy Royal (14")',
    profileHeightInches: 14,
    heightMeters: 0.355,
    layersCount: 10,
    firmnessScore: 7.0,
    firmnessLabel: 'Targeted Support',
    sliderValue: 100,
    sliderStep: 2,
    layerIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  },
};

/**
 * Resolves any model identifier (ecosystem key or flagship preset id) to a canonical `PuffyModelKey`.
 */
export function resolvePuffyModelKey(key?: string | null): PuffyModelKey {
  if (!key) return 'royal';
  const normalized = key.trim().toLowerCase();
  if (normalized === 'cloud' || normalized === 'puffy-cloud') {
    return 'cloud';
  }
  if (normalized === 'lux' || normalized === 'puffy-lux') {
    return 'lux';
  }
  if (
    normalized === 'royal' ||
    normalized === 'puffy-royal' ||
    normalized === 'puffy-monarch'
  ) {
    return 'royal';
  }
  return 'royal';
}

/**
 * Returns the full mattress configuration for a given model key (defaults to `'royal'`).
 */
export function getModelConfig(
  modelKey: PuffyModelKey | string
): MattressModelConfig {
  return PUFFY_MODEL_CONFIGS[resolvePuffyModelKey(modelKey)];
}

/**
 * Checks whether a layer ID (1..10 from `PUFFY_10_LAYERS`) is active in the resolved mattress model.
 */
export function isLayerActiveInModel(
  layerId: number,
  modelKey: PuffyModelKey | string
): boolean {
  return getModelConfig(modelKey).layerIds.includes(layerId);
}

/**
 * Returns the ordered subset of `PUFFY_10_LAYERS` active in the resolved mattress model.
 */
export function getActiveLayersForModel(
  modelKey: PuffyModelKey | string
): MattressLayerData[] {
  const activeLayerIds = new Set(getModelConfig(modelKey).layerIds);
  return PUFFY_10_LAYERS.filter((layer) => activeLayerIds.has(layer.id));
}
