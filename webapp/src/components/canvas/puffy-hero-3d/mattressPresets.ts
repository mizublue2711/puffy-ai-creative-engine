export type MattressModelId = 'puffy-royal' | 'puffy-monarch';

export interface MattressModelConfig {
  id: MattressModelId;
  displayName: string;
  badgeLabel: 'ROYAL' | 'MONARCH';
  upperBand: {
    color: string;
    sheenColor: string;
    normalMapType: 'vertical-flutes' | 'micro-diamonds';
    roughness: number;
  };
  lowerBorder: {
    color: string; // Shared Charcoal Slate (#3B3E46)
    normalMapType: 'large-diamonds';
  };
}

export const PUFFY_FLAGSHIP_PRESETS: Record<MattressModelId, MattressModelConfig> = {
  'puffy-royal': {
    id: 'puffy-royal',
    displayName: 'Puffy Royal Hybrid',
    badgeLabel: 'ROYAL',
    upperBand: {
      color: '#18243B', // Rich Midnight Navy Velvet
      sheenColor: '#3D5A80', // Soft Navy Velvet micro-fiber sheen
      normalMapType: 'vertical-flutes', // Elegant vertical pleated/fluted ribs
      roughness: 0.75,
    },
    lowerBorder: {
      color: '#3B3E46', // Charcoal Grey diamond tufted
      normalMapType: 'large-diamonds',
    },
  },
  'puffy-monarch': {
    id: 'puffy-monarch',
    displayName: 'Puffy Monarch Hybrid',
    badgeLabel: 'MONARCH',
    upperBand: {
      color: '#45382E', // Warm Espresso / Mocha Bronze
      sheenColor: '#705A4A', // Warm Mocha micro-fiber sheen
      normalMapType: 'micro-diamonds', // Intricate small quilted diamond mesh
      roughness: 0.75,
    },
    lowerBorder: {
      color: '#3B3E46', // Identical Charcoal Grey diamond tufted
      normalMapType: 'large-diamonds',
    },
  },
};

export const PUFFY_FLAGSHIP_ORDER: MattressModelId[] = ['puffy-royal', 'puffy-monarch'];
