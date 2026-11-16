/** PUFFY TYPOGRAPHY TOKENS: PT Serif (Editorial) & Mukta (Functional) */
export const BRAND_TYPOGRAPHY = {
  fonts: {
    editorial: '"PT Serif", Georgia, serif',
    functional: '"Mukta", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  scale: {
    h1: { font: 'editorial', size: '2.5rem', lineHeight: '1.2', weight: 700 },
    h2: { font: 'editorial', size: '2.0rem', lineHeight: '1.25', weight: 700 },
    h3: { font: 'editorial', size: '1.5rem', lineHeight: '1.3', weight: 600 },
    body: { font: 'functional', size: '1.0rem', lineHeight: '1.5', weight: 400 },
    badge: { font: 'functional', size: '0.75rem', lineHeight: '1.2', weight: 600, letterSpacing: '0.08em' },
    navLink: { font: 'functional', size: '0.875rem', lineHeight: '1.25', weight: 500, letterSpacing: '0.04em' },
  },
} as const;
