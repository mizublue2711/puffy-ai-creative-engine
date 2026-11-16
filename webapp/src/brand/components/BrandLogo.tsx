import React from 'react';
import { LOGO_RULES } from '../tokens/rules';

interface BrandLogoProps {
  width?: number;
  className?: string;
  /** 'light' = white logo for dark backgrounds; 'dark' = black logo for light backgrounds */
  variant?: 'light' | 'dark';
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ width = 120, className = '', variant = 'light' }) => {
  const safeWidth = Math.max(width, LOGO_RULES.minWidthPx);
  return (
    <div
      className={`inline-flex items-center justify-center relative select-none ${className}`}
      style={{ display: 'inline-flex', padding: `${LOGO_RULES.clearSpacePx}px` }}
    >
      <img
        src={LOGO_RULES.assets[variant]}
        alt="Puffy Official Logo"
        style={{
          width: `${safeWidth}px`,
          height: 'auto',
        }}
        draggable={false}
      />
    </div>
  );
};
