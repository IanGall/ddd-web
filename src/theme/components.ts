import type { ThemeConfig } from 'antd';

export const SIDE_MENU_TOKENS = {
  itemColor: '#4B5563',
  itemHoverBg: '#F7F7F8',
  itemSelectedBg: '#F2F2F3',
  itemSelectedColor: '#111827',
  itemBorderRadius: 10,
  subMenuItemBorderRadius: 10,
  itemHeight: 44,
  itemMarginInline: 10,
  itemMarginBlock: 2,
  activeBarWidth: 0,
  activeBarBorderWidth: 0,
  groupTitleColor: '#9CA3AF',
  groupTitleFontSize: 11,
  groupTitleLineHeight: 1.6,
} satisfies NonNullable<ThemeConfig['components']>['Menu'];

export const components: ThemeConfig['components'] = {
  Layout: {
    siderBg: '#FFFFFF',
    lightSiderBg: '#FFFFFF',
    headerBg: '#FFFFFF',
    headerHeight: 64,
    headerPadding: '0 24px',
    headerColor: '#111827',
    bodyBg: '#FAFAFA',
    triggerBg: '#1A1A1A',
  },
  Card: {
    bodyPadding: 24,
    headerBg: 'transparent',
    headerPadding: 24,
    headerFontSize: 16,
    actionsBg: 'transparent',
  },
  Button: {
    fontWeight: 500,
    primaryColor: '#FFFFFF',
    primaryShadow: 'none',
    defaultShadow: 'none',
    dangerShadow: 'none',
    textTextColor: '#4B5563',
  },
  Typography: {
    titleMarginTop: 0,
    titleMarginBottom: 4,
  },
  Menu: {
    itemBg: 'transparent',
    subMenuItemBg: 'transparent',
    itemActiveBg: 'transparent',
  },
};
