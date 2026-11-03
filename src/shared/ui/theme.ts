export const colors = {
  bg: '#F4F1EA',
  surface: '#FFFFFF',
  surfaceAlt: '#ECE7DC',
  ink: '#1F2A1F',
  inkSoft: '#56604F',
  inkMuted: '#8A9182',
  line: '#D9D3C5',
  leaf: '#3F7A4A',
  leafDark: '#2C5A35',
  leafSoft: '#DCEBD9',
  soil: '#7A5A3C',
  sun: '#E9A23B',
  sunSoft: '#FBEBCF',
  warn: '#B4542D',
  warnSoft: '#F8E1D6',
  info: '#2F6690',
  infoSoft: '#DDEAF3',
  outline: '#FFF7D6',
  outlineStroke: '#F2C14E',
  danger: '#C2412D',
  scrim: 'rgba(20, 28, 20, 0.55)',
};

export const space = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 };
export const radius = { s: 8, m: 12, l: 18, pill: 999 };
/** Minimum touch target (Apple HIG 44pt, Material 48dp). */
export const TOUCH = 48;

export const type = {
  title: { fontSize: 22, fontWeight: '700' as const, color: colors.ink },
  heading: { fontSize: 17, fontWeight: '700' as const, color: colors.ink },
  body: { fontSize: 15, color: colors.ink },
  small: { fontSize: 13, color: colors.inkSoft },
  tiny: { fontSize: 11, color: colors.inkMuted },
};
