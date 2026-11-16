/** PUFFY BRAND LOGO & SPACING RULES */
export const LOGO_RULES = {
  clearSpacePx: 30,
  minWidthPx: 80,
  aspectRatio: 149 / 36,
  assets: {
    // Black logo for light backgrounds, white logo for dark backgrounds
    dark: '/assets/brand/puffy_logo_black.svg',
    light: '/assets/brand/puffy_logo_white.svg',
  },
} as const;
