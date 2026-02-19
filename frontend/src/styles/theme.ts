/**
 * World Monitor — Batman Command-Center Theme Constants
 *
 * TypeScript-side mirror of the CSS custom properties defined in globals.css.
 * Use Tailwind utility classes (bg-background, text-accent, etc.) for styling.
 * Use these constants only for programmatic / JS-side color needs
 * (e.g., conditional inline styles, chart libraries, canvas rendering).
 */

export const COLORS = {
  background: "#070A12",
  panel: "#0B1020",
  panelHover: "#101830",
  border: "#1A2744",
  borderGlow: "rgba(45, 123, 255, 0.13)",
  accent: "#2D7BFF",
  accentDim: "#1A4F99",
  text: "#E6E9F2",
  textMuted: "#7A8BA8",
  positive: "#00E676",
  negative: "#FF1744",
  warning: "#FFD600",
} as const;

export const FONTS = {
  mono: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Geist Mono', monospace",
  sans: "'Inter', 'Geist', 'Segoe UI', system-ui, sans-serif",
} as const;

export type ThemeColor = keyof typeof COLORS;
