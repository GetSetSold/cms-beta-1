/**
 * Shared design tokens for the GetSetSold.ca public site.
 *
 * These mirror the CSS custom properties in admin/styles.css so the
 * public site and the admin UI stay visually consistent.
 * Brand: black + white with a single cobalt blue accent (#2456e6).
 */

export const TOKENS = {
  colors: {
    black: '#111111',
    ink: '#1a1a1a',       // body text on white
    white: '#ffffff',
    accent: '#2456e6',    // cobalt blue — the ONLY brand accent
    accentDark: '#1a41b8',// accent hover / pressed
    accentSoft: '#eef3fe',// light blue tint for subtle backgrounds
    grey50: '#f8f9fb',
    grey100: '#f1f3f6',
    grey200: '#e5e8ee',
    grey300: '#d3d8e1',
    grey500: '#6b7280',
    grey700: '#374151',
    success: '#15803d',
    error: '#dc2626',
  },
  fonts: {
    sans: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`,
    display: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`,
    mono: `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`,
  },
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    h3: '1.5rem',
    h2: '2rem',
    h1: '2.75rem',
    hero: '3.5rem',
  },
  radii: {
    sm: '6px',
    md: '10px',
    lg: '16px',
    pill: '999px',
  },
  shadows: {
    sm: '0 1px 2px rgba(17,17,17,0.06)',
    md: '0 4px 14px rgba(17,17,17,0.10)',
    lg: '0 12px 32px rgba(17,17,17,0.14)',
  },
  spacing: {
    sectionY: '4.5rem',
    containerMax: '1200px',
    gutter: '1.25rem',
  },
  breakpoints: {
    sm: '640px',
    md: '900px',
    lg: '1200px',
  },
};

/**
 * Emit the :root CSS custom properties block.
 * The Worker inlines this in every page <head>.
 */
export function cssVariables() {
  const c = TOKENS.colors;
  const f = TOKENS.fonts;
  const r = TOKENS.radii;
  const s = TOKENS.shadows;
  return `:root{
  --black:${c.black};--ink:${c.ink};--white:${c.white};
  --accent:${c.accent};--accent-dark:${c.accentDark};--accent-soft:${c.accentSoft};
  --grey-50:${c.grey50};--grey-100:${c.grey100};--grey-200:${c.grey200};
  --grey-300:${c.grey300};--grey-500:${c.grey500};--grey-700:${c.grey700};
  --success:${c.success};--error:${c.error};
  --font-sans:${f.sans};--font-display:${f.display};--font-mono:${f.mono};
  --radius-sm:${r.sm};--radius-md:${r.md};--radius-lg:${r.lg};--radius-pill:${r.pill};
  --shadow-sm:${s.sm};--shadow-md:${s.md};--shadow-lg:${s.lg};
  --section-y:${TOKENS.spacing.sectionY};--container-max:${TOKENS.spacing.containerMax};--gutter:${TOKENS.spacing.gutter};
}`;
}
