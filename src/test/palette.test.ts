import { describe, it, expect } from 'vitest';
import { DATA_PALETTE, hexToRgba, type DataAccent } from '@/lib/palette';

describe('palette 工具函数与调色板验证', () => {
  it('1. DATA_PALETTE 导出预期的四种强调色键名与色值', () => {
    expect(DATA_PALETTE).toEqual({
      orange: '#F0562B',
      teal: '#14A79D',
      navy: '#17324F',
      amber: '#F5B21A',
    });
  });

  it('2. DataAccent 类型覆盖四种数据强调色', () => {
    const keys = Object.keys(DATA_PALETTE) as DataAccent[];
    expect(keys).toEqual(['orange', 'teal', 'navy', 'amber']);
    expect(keys).toHaveLength(4);

    // 类型系统静态覆盖断言
    const accentCheck: Record<DataAccent, string> = {
      orange: DATA_PALETTE.orange,
      teal: DATA_PALETTE.teal,
      navy: DATA_PALETTE.navy,
      amber: DATA_PALETTE.amber,
    };
    expect(Object.keys(accentCheck)).toHaveLength(4);
  });

  describe('hexToRgba', () => {
    it('3. 正确解析 #RRGGBB 格式并支持透明度边界', () => {
      expect(hexToRgba('#F0562B', 0.5)).toBe('rgba(240, 86, 43, 0.5)');
      expect(hexToRgba('#14A79D', 1)).toBe('rgba(20, 167, 157, 1)');
      expect(hexToRgba('#000000', 0)).toBe('rgba(0, 0, 0, 0)');
    });

    it('4. 正确解析 #RGB 简写格式', () => {
      expect(hexToRgba('#FFF', 0.8)).toBe('rgba(255, 255, 255, 0.8)');
      expect(hexToRgba('#123', 0.2)).toBe('rgba(17, 34, 51, 0.2)');
    });

    it('5. 非法输入与异常透明度安全走兜底逻辑', () => {
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
