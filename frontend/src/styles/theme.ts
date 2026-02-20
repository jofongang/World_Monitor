export const PALETTE = {
  background: "#060911",
  backgroundElevated: "#0A1020",
  panel: "#0B1324",
  panelAlt: "#0D1730",
  panelHover: "#111E39",
  border: "#1A2B4E",
  borderStrong: "#26406F",
  accent: "#2D7BFF",
  accentSoft: "#83B5FF",
  accentGlow: "rgba(45, 123, 255, 0.28)",
  foreground: "#E8EEFA",
  muted: "#7F93B7",
  positive: "#00E676",
  warning: "#FFC247",
  danger: "#FF4D5F",
} as const;

export const TYPOGRAPHY = {
  sans: "'Geist', 'Segoe UI', system-ui, sans-serif",
  mono: "'Geist Mono', 'JetBrains Mono', 'Fira Code', monospace",
} as const;

export const PANEL_STYLE = {
  frame:
    "rounded-lg border border-border/90 bg-panel/90 shadow-[0_0_0_1px_rgba(45,123,255,0.06),0_8px_24px_rgba(1,4,10,0.65)] backdrop-blur-sm",
  header: "flex items-start justify-between gap-3 border-b border-border/65 px-4 py-3",
  title:
    "text-accent font-mono text-xs font-bold uppercase tracking-[0.18em]",
  subtitle: "text-muted text-[11px] font-mono mt-1",
} as const;

export const COLORS = {
  background: PALETTE.background,
  panel: PALETTE.panel,
  panelHover: PALETTE.panelHover,
  border: PALETTE.border,
  borderGlow: PALETTE.accentGlow,
  accent: PALETTE.accent,
  accentDim: PALETTE.accentSoft,
  text: PALETTE.foreground,
  textMuted: PALETTE.muted,
  positive: PALETTE.positive,
  negative: PALETTE.danger,
  warning: PALETTE.warning,
} as const;

export type ThemeColor = keyof typeof COLORS;
