import { describe, it, expect } from 'vitest';
import { themeConfig, SIDE_MENU_TOKENS, DATA_PALETTE, type DataAccent } from '@/theme';

describe('P1 主题层与 Token 规范验证', () => {
  it('1. 全局 primaryColor 为近黑 #1A1A1A', () => {
    expect(themeConfig.token?.colorPrimary).toBe('#1A1A1A');
  });

  it('2. 全局 borderRadiusLG 为 14', () => {
    expect(themeConfig.token?.borderRadiusLG).toBe(14);
  });

  it('3. Layout 组件 headerHeight 为 64', () => {
    expect(themeConfig.components?.Layout?.headerHeight).toBe(64);
  });

  it('4. Menu 全局仅配置保守透明底色，选中态在 SIDE_MENU_TOKENS 中隔离生效', () => {
    // 全局 Menu 保守值：不设 itemSelectedBg，避免污染全局 Dropdown
    expect(themeConfig.components?.Menu?.itemSelectedBg).toBeUndefined();
    expect(themeConfig.components?.Menu?.itemBg).toBe('transparent');
    expect(themeConfig.components?.Menu?.subMenuItemBg).toBe('transparent');
    expect(themeConfig.components?.Menu?.itemActiveBg).toBe('transparent');

    // 侧栏专用激进配置：定义 itemSelectedBg 为 #F2F2F3
    expect(SIDE_MENU_TOKENS.itemSelectedBg).toBe('#F2F2F3');
  });

  it('5. DATA_PALETTE 导出预期的四种强调色键名与色值', () => {
    expect(DATA_PALETTE).toEqual({
      orange: '#F0562B',
      teal: '#14A79D',
      navy: '#17324F',
      amber: '#F5B21A',
    });
  });

  it('6. DataAccent 类型覆盖四种数据强调色', () => {
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
});
