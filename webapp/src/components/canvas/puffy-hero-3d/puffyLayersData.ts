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

export interface MattressLayerData {
  id: number;
  name: string;
  shortTabLabel: string;
  badgeLabel: string;
  exclusiveTag?: string;
  tagline: string;
  description: string;
  whatItIs: string;
  howItWorks: string;
  colorHex: string;
  thickness: number; // Y-scale
  textureType: LayerTextureType;
  screenshotUrl: string;
}

export const PUFFY_10_LAYERS: MattressLayerData[] = [
  {
    id: 1,
    name: 'Quilted Cloud Cover',
    shortTabLabel: 'Cool Quilted Cover',
    badgeLabel: 'Cover',
    tagline: 'Cool to the Touch, All-Night Comfort',
    description:
      'Breathable, cooling yarns knitted into a quilted cover with a patented cloud design pulls heat away up to 10x faster.',
    whatItIs:
      'A breathable, quilted cover knit with cooling yarns and finished with our patented cloud pattern.',
    howItWorks:
      'Cooling fibers draw heat away from the surface up to 10x faster while promoting steady airflow for a fresher feel.',
    colorHex: '#FFFFFF',
    thickness: 0.12,
    textureType: 'cloud-quilt',
    screenshotUrl: '/assets/3d/aistudio/Screenshot_2026-11-15_at_3.26.35_AM_94c66147.png',
  },
  {
    id: 2,
    name: 'Premium Blended Wool',
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
    colorHex: '#F2EDE4',
    thickness: 0.08,
    textureType: 'wool-cream',
    screenshotUrl: '/assets/3d/aistudio/Screenshot_2026-11-15_at_3.26.59_AM_f63fa125.png',
  },
  {
    id: 3,
    name: 'Fire-Resistant Fiber Layer',
    shortTabLabel: 'Comfort Quilt',
    badgeLabel: '0.25"',
    tagline: 'Natural Protection',
    description:
      'A whisper-quiet, chemical-free fire barrier woven directly beneath the wool layer for safe, breathable peace of mind.',
    whatItIs:
      'A lightweight, breathable comfort fiber layer that adds a soft, cushioned surface feel.',
    howItWorks:
      'Enhances initial plushness while acting as a safe, breathable protective barrier that promotes airflow.',
    colorHex: '#D9D6D0',
    thickness: 0.06,
    textureType: 'fire-felt',
    screenshotUrl: '/assets/3d/aistudio/Screenshot_2026-11-15_at_3.27.07_AM_f4c2f847.png',
  },
  {
    id: 4,
    name: 'Comfort Quilt Foam Layer',
    shortTabLabel: 'Plush Contouring',
    badgeLabel: '1"',
    tagline: 'Adaptive Support',
    description:
      'Ultra-responsive quilting foam adapts instantly to micro-movements, relieving surface pressure from the very first moment.',
    whatItIs:
      'A soft, responsive foam layer designed to contour gently to the body for immediate pressure relief.',
    howItWorks:
      'Adapts to your shape to help ease surface pressure at the shoulders and hips and improve overall comfort.',
    colorHex: '#E5E1D8',
    thickness: 0.1,
    textureType: 'foam-babyblue',
    screenshotUrl: '/assets/3d/aistudio/Screenshot_2026-11-15_at_3.27.15_AM_c278943a.png',
  },
  {
    id: 5,
    name: 'Plush Contouring Foam',
    shortTabLabel: 'Reflexive Foam',
    badgeLabel: '2"',
    tagline: 'Body-Hugging Comfort',
    description:
      'Deep-cushioning pastel blue memory foam cradles joints and curves to eliminate pressure points along shoulders and hips.',
    whatItIs:
      'A responsive memory foam layer that combines deep contouring comfort with a buoyant feel.',
    howItWorks:
      'Molds to the body to help relieve pressure points while bouncing back smoothly when you change positions.',
    colorHex: '#C2D9EE',
    thickness: 0.12,
    textureType: 'foam-cyan',
    screenshotUrl: '/assets/3d/aistudio/Screenshot_2026-11-15_at_3.27.22_AM_1f7d4aac.png',
  },
  {
    id: 6,
    name: 'Reflexive Memory Foam',
    shortTabLabel: 'Cloud Comfort',
    badgeLabel: '1"',
    tagline: 'Support for Every Position',
    description:
      'High-elasticity recovery foam responds dynamically whether you sleep on your side, back, or stomach.',
    whatItIs:
      'A supportive transition foam layer that balances plushness with healthy spinal alignment.',
    howItWorks:
      'Distributes body weight evenly to reduce pressure buildup and smooth the transition to deeper support layers.',
    colorHex: '#8FB6DE',
    thickness: 0.14,
    textureType: 'foam-mint',
    screenshotUrl: '/assets/3d/aistudio/Screenshot_2026-11-15_at_3.27.28_AM_376ad968.png',
  },
  {
    id: 7,
    name: 'Cloud Breeze™ Cooling Technology',
    shortTabLabel: 'Cloud Breeze™',
    badgeLabel: '2.5"',
    tagline: 'Targeted 5-Zone Support',
    description:
      'Precision-sculpted 5-zone contour channels provide targeted ergonomic alignment for head, shoulders, lumbar, hips, and knees.',
    whatItIs:
      'A cooling, sculpted foam layer featuring five targeted support zones and airflow channels.',
    howItWorks:
      'Provides firmer support under the lower back and softer cushioning at the shoulders while promoting heat dissipation.',
    colorHex: '#617FA3',
    thickness: 0.16,
    textureType: 'foam-lavender',
    screenshotUrl: '/assets/3d/aistudio/Screenshot_2026-11-15_at_3.27.34_AM_d4e54ec8.png',
  },
  {
    id: 8,
    name: 'Contour-Adapt Pocket Coils',
    shortTabLabel: 'Contour Coils',
    badgeLabel: '6"',
    tagline: 'Undisturbed Sleep With Edge Support',
    description:
      'Individually fabric-encased coils isolate partner motion and feature a high-density foam perimeter for edge-to-edge stability.',
    whatItIs:
      'Individually wrapped pocket coils surrounded by a reinforced high-density foam perimeter.',
    howItWorks:
      'Coils flex independently to limit motion transfer, while reinforced edges improve stability and usable sleep surface.',
    colorHex: '#F8F9FA',
    thickness: 0.42,
    textureType: 'pocket-springs',
    screenshotUrl: '/assets/3d/aistudio/Screenshot_2026-11-15_at_3.27.39_AM_2f52f46e.png',
  },
  {
    id: 9,
    name: 'Firm Core Support Foam',
    shortTabLabel: 'Firm Support',
    badgeLabel: '1"',
    tagline: 'Durability, Night After Night',
    description:
      'High-density foundation foam absorbs deep compression and reinforces the pocket coil matrix for long-lasting structural integrity.',
    whatItIs:
      'A dense base foam layer that forms a stable foundation beneath the pocket coil system.',
    howItWorks:
      'Supports the upper layers, absorbs movement, and helps maintain mattress structure over time.',
    colorHex: '#3E434D',
    thickness: 0.18,
    textureType: 'base-foam',
    screenshotUrl: '/assets/3d/aistudio/Screenshot_2026-11-15_at_3.27.45_AM_b35c0fe3.png',
  },
  {
    id: 10,
    name: 'Grip Base Cover',
    shortTabLabel: 'Grip Base',
    badgeLabel: 'Base',
    tagline: 'Stability, Added Protection',
    description:
      'Textured non-slip lower casing keeps your Puffy Royal anchored securely onto any bed frame, foundation, or adjustable base.',
    whatItIs:
      'A durable, textured bottom cover designed to help keep the mattress securely in place.',
    howItWorks:
      'Reduces shifting on foundations and bed frames while protecting the underside of the mattress.',
    colorHex: '#22242A',
    thickness: 0.05,
    textureType: 'grip-base',
    screenshotUrl: '/assets/3d/aistudio/Screenshot_2026-11-15_at_3.27.50_AM_22633f06.png',
  },
];
