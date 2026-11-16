/** PUFFY BRAND CORE COLOR PALETTE */
export const BRAND_COLORS = {
  navyInk: '#2B2F44',
  oceanTeal: '#067A57',
  oceanTealHover: '#056346',
  warmLinen: '#E5E3DF',
  warmLinenLight: '#F5F4F0',
  pureWhite: '#FFFFFF',
  onyxBlack: '#333333',
  surface: {
    dark: '#1E222E',
    frosted: 'rgba(43, 47, 68, 0.85)',
    border: 'rgba(229, 227, 223, 0.15)',
  },
} as const;

export type BrandColorKey = keyof typeof BRAND_COLORS;
