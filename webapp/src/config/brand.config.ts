export interface BrandTheme {
  brandId: string;
  brandName: string;
  logoUrl: string;
  typography: {
    headline: string; // PT Serif
    body: string; // Mukta
  };
  palette: {
    navyInk: string;
    oceanTeal: string;
    warmLinen: string;
    pureWhite: string;
    onyxBlack: string;
  };
  badgePresets: Array<{ id: string; label: string; bg: string; text: string }>;
  headlinePresets: string[];
}

export const ACTIVE_BRAND: BrandTheme = {
  brandId: 'puffy',
  brandName: 'Puffy',
  // White wordmark: banners use a dark bottom gradient behind the logo/text.
  logoUrl: '/assets/brand/puffy_logo_white.svg',
  typography: {
    headline: "'PT Serif', Georgia, serif",
    body: "'Mukta', sans-serif",
  },
  palette: {
    navyInk: '#2B2F44',
    oceanTeal: '#067A57',
    warmLinen: '#E5E3DF',
    pureWhite: '#FFFFFF',
    onyxBlack: '#333333',
  },
  badgePresets: [
    { id: 'cooling', label: 'COOLING CLOUD TECHNOLOGY', bg: '#067A57', text: '#FFFFFF' },
    { id: 'warranty', label: 'LIFETIME WARRANTY', bg: '#2B2F44', text: '#FFFFFF' },
    { id: 'made_in_usa', label: 'MADE IN USA', bg: '#2B2F44', text: '#FFFFFF' },
    { id: 'restful', label: 'RESTFUL SANCTUARY', bg: '#E5E3DF', text: '#2B2F44' },
  ],
  headlinePresets: [
    "Sleep Like You're Floating on a Cloud",
    'Restorative Luxury, Cloud-Soft Support',
    "America's Most Comfortable Mattress",
  ],
};
