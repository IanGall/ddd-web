/**
 * 注意：index.html 里的内联脚本无法 import 本模块。
 * 若修改 THEME_STORAGE_KEY，必须同步修改 index.html 中的键名，两处保持一致。
 */
export const THEME_STORAGE_KEY = 'ddd-web-theme';

export const THEMES = ['light', 'dark'] as const;

export type Theme = (typeof THEMES)[number];
