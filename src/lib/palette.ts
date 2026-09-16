export interface DataAccentColors {
  readonly light: string;
  readonly dark: string;
}

export const DATA_PALETTE = {
  orange: { light: '#F0562B', dark: '#FF8A5C' },
  teal: { light: '#14A79D', dark: '#3FD9D0' },
  navy: { light: '#17324F', dark: '#7FB2E3' },
  amber: { light: '#F5B21A', dark: '#FFC53D' },
} as const satisfies Record<string, DataAccentColors>;

export type DataAccent = keyof typeof DATA_PALETTE;

export const DATA_ACCENT_BADGE_ALPHA = { light: 0.12, dark: 0.18 } as const;

export const resolveDataAccent = (accent: DataAccent, mode: 'light' | 'dark') =>
  DATA_PALETTE[accent][mode];

/**
 * Converts a hex color string (#RRGGBB or #RGB) to rgba(r, g, b, alpha).
 * If the input is invalid, returns a predictable fallback rgba(0, 0, 0, alpha).
 */
export function hexToRgba(hex: string, alpha: number): string {
  const safeAlpha =
    typeof alpha === 'number' && !Number.isNaN(alpha) ? Math.max(0, Math.min(1, alpha)) : 1;

  if (typeof hex !== 'string') {
    return `rgba(0, 0, 0, ${safeAlpha})`;
  }

  let cleaned = hex.trim().replace(/^#/, '');
  if (cleaned.length === 3) {
    cleaned = cleaned
      .split('')
      .map((char) => char + char)
      .join('');
  }

  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return `rgba(0, 0, 0, ${safeAlpha})`;
  }

  const num = parseInt(cleaned, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;

  return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
}
