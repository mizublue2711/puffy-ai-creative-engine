/**
 * BRANDING ASSET REGISTRY (PLUG-AND-PLAY SLOTS)
 * To switch brand logos in the future, simply drop new images into
 * /webapp/public/assets/branding/ with matching slot names.
 */
export const BRAND_BADGE_SLOTS = {
  lux: '/assets/branding/badge_lux.png',
  cloud: '/assets/branding/badge_cloud.png',
  royal: '/assets/branding/badge_royal.png',
} as const;

export type MattressBrandVariant = keyof typeof BRAND_BADGE_SLOTS;

export const getBrandBadgeUrl = (variant: string = 'lux'): string => {
  const key = variant.toLowerCase() as MattressBrandVariant;
  return BRAND_BADGE_SLOTS[key] || BRAND_BADGE_SLOTS.lux;
};
