import { BRAND_COLORS } from '../tokens/colors';
import { BRAND_TYPOGRAPHY } from '../tokens/typography';
import { LOGO_RULES } from '../tokens/rules';

export const ACTIVE_BRAND_CONFIG = {
  brandId: 'puffy-official',
  displayName: 'Puffy® Official',
  colors: BRAND_COLORS,
  typography: BRAND_TYPOGRAPHY,
  logoRules: LOGO_RULES,
  approvedModels: ['Cloud', 'Lux', 'Royal'] as const,
} as const;
