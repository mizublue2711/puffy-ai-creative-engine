import React from 'react';
import { BRAND_COLORS } from '../tokens/colors';
import { BRAND_TYPOGRAPHY } from '../tokens/typography';

interface PillBadgeProps {
  label: string;
  variant?: 'cooling' | 'warranty' | 'neutral' | 'luxury';
  icon?: React.ReactNode;
}

const stylesByVariant = {
  cooling: { bg: 'rgba(6, 122, 87, 0.15)', text: BRAND_COLORS.oceanTeal, border: 'rgba(6, 122, 87, 0.3)' },
  warranty: { bg: 'rgba(43, 47, 68, 0.25)', text: BRAND_COLORS.warmLinen, border: 'rgba(229, 227, 223, 0.3)' },
  neutral: { bg: 'rgba(229, 227, 223, 0.1)', text: BRAND_COLORS.pureWhite, border: BRAND_COLORS.surface.border },
  luxury: { bg: 'rgba(212, 175, 55, 0.15)', text: '#D4AF37', border: 'rgba(212, 175, 55, 0.3)' },
} as const;

export const PillBadge: React.FC<PillBadgeProps> = ({ label, variant = 'cooling', icon }) => {
  const style = stylesByVariant[variant];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 12px',
        borderRadius: 9999,
        textTransform: 'uppercase',
        backgroundColor: style.bg,
        color: style.text,
        border: `1px solid ${style.border}`,
        fontFamily: BRAND_TYPOGRAPHY.fonts.functional,
        fontSize: BRAND_TYPOGRAPHY.scale.badge.size,
        letterSpacing: BRAND_TYPOGRAPHY.scale.badge.letterSpacing,
        fontWeight: BRAND_TYPOGRAPHY.scale.badge.weight,
      }}
    >
      {icon && <span style={{ display: 'inline-flex', width: 12, height: 12 }}>{icon}</span>}
      {label}
    </span>
  );
};
