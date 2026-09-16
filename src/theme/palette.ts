export const DATA_PALETTE = {
  orange: '#F0562B',
  teal: '#14A79D',
  navy: '#17324F',
  amber: '#F5B21A',
} as const;

export type DataAccent = keyof typeof DATA_PALETTE;
