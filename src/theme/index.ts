import type { ThemeConfig } from 'antd';
import { components } from './components';
import { tokens } from './tokens';

export const themeConfig: ThemeConfig = {
  token: tokens,
  components,
};

export { SIDE_MENU_TOKENS } from './components';
export { DATA_PALETTE, hexToRgba, type DataAccent } from './palette';
