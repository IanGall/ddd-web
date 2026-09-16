import { describe, it, expect } from 'vitest';
import {
  DATA_PALETTE,
  DATA_ACCENT_BADGE_ALPHA,
  hexToRgba,
  resolveDataAccent,
  type DataAccent,
  type DataAccentColors,
} from '@/lib/palette';

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace(/^#/, ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hexToRgb(hex1));
  const l2 = relativeLuminance(hexToRgb(hex2));
  const max = Math.max(l1, l2);
  const min = Math.min(l1, l2);
  return (max + 0.05) / (min + 0.05);
}

function rgbToHue([r, g, b]: [number, number, number]): number {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return h * 60;
}

function hueDiff(h1: number, h2: number): number {
  const diff = Math.abs(h1 - h2) % 360;
  return diff > 180 ? 360 - diff : diff;
}

const ORIGINAL_LIGHT_VALUES: Record<DataAccent, string> = {
  orange: '#F0562B',
  teal: '#14A79D',
  navy: '#17324F',
  amber: '#F5B21A',
};

describe('palette 工具函数与调色板验证', () => {
  it('1. DATA_PALETTE 导出预期的四种强调色键名与 light/dark 双值色值，且导出 DATA_ACCENT_BADGE_ALPHA', () => {
    expect(DATA_PALETTE).toEqual({
      orange: { light: '#F0562B', dark: '#FF8A5C' },
      teal: { light: '#14A79D', dark: '#3FD9D0' },
      navy: { light: '#17324F', dark: '#7FB2E3' },
      amber: { light: '#F5B21A', dark: '#FFC53D' },
    });
    expect(DATA_ACCENT_BADGE_ALPHA).toEqual({ light: 0.12, dark: 0.18 });
  });

  it('2. DataAccent 类型覆盖四种数据强调色', () => {
    const keys = Object.keys(DATA_PALETTE) as DataAccent[];
    expect(keys).toEqual(['orange', 'teal', 'navy', 'amber']);
    expect(keys).toHaveLength(4);

    // 类型系统静态覆盖断言
    const accentCheck: Record<DataAccent, DataAccentColors> = {
      orange: DATA_PALETTE.orange,
      teal: DATA_PALETTE.teal,
      navy: DATA_PALETTE.navy,
      amber: DATA_PALETTE.amber,
    };
    expect(Object.keys(accentCheck)).toHaveLength(4);
  });

  it('3. resolveDataAccent 针对 light 与 dark 模式均能准确解析强调色', () => {
    expect(resolveDataAccent('orange', 'light')).toBe('#F0562B');
    expect(resolveDataAccent('orange', 'dark')).toBe('#FF8A5C');
    expect(resolveDataAccent('teal', 'light')).toBe('#14A79D');
    expect(resolveDataAccent('teal', 'dark')).toBe('#3FD9D0');
    expect(resolveDataAccent('navy', 'light')).toBe('#17324F');
    expect(resolveDataAccent('navy', 'dark')).toBe('#7FB2E3');
    expect(resolveDataAccent('amber', 'light')).toBe('#F5B21A');
    expect(resolveDataAccent('amber', 'dark')).toBe('#FFC53D');
  });

  it('4. 对比度守卫：四个 dark 强调色对暗底 #171717 对比度均 ≥ 4.5 (WCAG AA)', () => {
    const darkBackground = '#171717';
    for (const key of Object.keys(DATA_PALETTE) as DataAccent[]) {
      const cr = contrastRatio(DATA_PALETTE[key].dark, darkBackground);
      expect(cr).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('5. 色相守卫：四个 dark 强调色与其 light 强调色的色相差均 ≤ 20°（防误改色系）', () => {
    for (const key of Object.keys(DATA_PALETTE) as DataAccent[]) {
      const { light, dark } = DATA_PALETTE[key];
      const hLight = rgbToHue(hexToRgb(light));
      const hDark = rgbToHue(hexToRgb(dark));
      const hd = hueDiff(hLight, hDark);
      expect(hd).toBeLessThanOrEqual(20);
    }
  });

  it('6. 基准守卫：四个 light 强调色严格全等于原设计基准值', () => {
    for (const [key, originalHex] of Object.entries(ORIGINAL_LIGHT_VALUES) as [
      DataAccent,
      string,
    ][]) {
      expect(DATA_PALETTE[key].light).toBe(originalHex);
    }
  });

  describe('hexToRgba', () => {
    it('7. 正确解析 #RRGGBB 格式并支持透明度边界', () => {
      expect(hexToRgba('#F0562B', 0.5)).toBe('rgba(240, 86, 43, 0.5)');
      expect(hexToRgba('#14A79D', 1)).toBe('rgba(20, 167, 157, 1)');
      expect(hexToRgba('#000000', 0)).toBe('rgba(0, 0, 0, 0)');
    });

    it('8. 正确解析 #RGB 简写格式', () => {
      expect(hexToRgba('#FFF', 0.8)).toBe('rgba(255, 255, 255, 0.8)');
      expect(hexToRgba('#123', 0.2)).toBe('rgba(17, 34, 51, 0.2)');
    });

    it('9. 非法输入与异常透明度安全走兜底逻辑', () => {
      // 非法字符串
      expect(hexToRgba('invalid', 0.5)).toBe('rgba(0, 0, 0, 0.5)');
      expect(hexToRgba('#12', 0.5)).toBe('rgba(0, 0, 0, 0.5)');
      expect(hexToRgba('#1234567', 0.5)).toBe('rgba(0, 0, 0, 0.5)');
      // 非字符串输入类型防御
      expect(hexToRgba(null as unknown as string, 0.5)).toBe('rgba(0, 0, 0, 0.5)');
      expect(hexToRgba(undefined as unknown as string, 0.5)).toBe('rgba(0, 0, 0, 0.5)');
      // 透明度范围限定 [0, 1] 及 NaN 兜底
      expect(hexToRgba('#FFF', 1.5)).toBe('rgba(255, 255, 255, 1)');
      expect(hexToRgba('#FFF', -0.5)).toBe('rgba(255, 255, 255, 0)');
      expect(hexToRgba('#FFF', NaN)).toBe('rgba(255, 255, 255, 1)');
    });
  });
});
