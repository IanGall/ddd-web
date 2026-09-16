export const DATA_PALETTE = {
  orange: '#F0562B',
  teal: '#14A79D',
  navy: '#17324F',
  amber: '#F5B21A',
} as const;

export type DataAccent = keyof typeof DATA_PALETTE;

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
