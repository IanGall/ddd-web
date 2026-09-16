/// <reference types="node" />
/**
 * 主题变量防回归与完整性测试
 *
 * 1. 快照来源与取数日期：
 *    - 来源：shadcn 官方注册表 neutral 主题清单（https://ui.shadcn.com/r/colors/neutral.json）
 *    - 字段：inlineColors.light 与 inlineColors.dark
 *    - 取数日期：2026-09-16
 *
 * 2. 如何更新快照：
 *    若后续因主题定制或 shadcn 升级修改了 src/index.css 的变量块：
 *    a. 访问或拉取官方注册表：curl -s https://ui.shadcn.com/r/colors/neutral.json
 *    b. 提取 inlineColors.light 与 inlineColors.dark 的 key 列表
 *    c. 确认 light 有 32 个变量（含 radius）、dark 有 31 个变量（不含 radius），按字典序排序后写回 src/test/fixtures/neutral-inline-colors.light.json
 *    d. 运行 pnpm test src/test/theme-vars.test.ts 确认通过
 *
 * 3. 本测试防范的事故：
 *    src/index.css 的 :root 曾是 31 个变量、漏掉了 --radius，而 @theme inline 里写的是 --radius-lg: var(--radius)，
 *    导致运行时解析为空、全站圆角全部归零（全站样式事故）。该 bug 只有真机肉眼可见，原有业务用例均无法拦截。
 *    本测试通过严格比对 CSS 变量与官方注册表快照，确保在自动化门禁中直接拦截此类缺失。
 */

import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import neutralInlineColors from './fixtures/neutral-inline-colors.light.json';

describe('主题变量防回归守卫 (theme-vars)', () => {
  const css = readFileSync('src/index.css', 'utf-8');

  function extractVarNames(cssBlock: string): string[] {
    const matches = [...cssBlock.matchAll(/^\s*--([a-zA-Z0-9-]+)\s*:/gm)];
    return matches.map((m) => m[1]).sort();
  }

  const rootBlockMatch = css.match(/:root\s*\{([^}]+)\}/);
  const darkBlockMatch = css.match(/\.dark\s*\{([^}]+)\}/);
  const themeInlineBlockMatch = css.match(/@theme\s+inline\s*\{([^}]+)\}/);

  const rootBlock = rootBlockMatch?.[1] ?? '';
  const darkBlock = darkBlockMatch?.[1] ?? '';
  const themeInlineBlock = themeInlineBlockMatch?.[1] ?? '';

  it(':root 的变量名集合（去掉 --、排序）全等于 fixture 的 light 快照', () => {
    expect(rootBlockMatch).not.toBeNull();
    const rootVars = extractVarNames(rootBlock);
    expect(rootVars).toEqual(neutralInlineColors.light);
    expect(rootVars).toContain('radius');
    expect(rootVars).toHaveLength(32);
  });

  it('.dark 的变量名集合全等于 fixture 的 dark 快照', () => {
    expect(darkBlockMatch).not.toBeNull();
    const darkVars = extractVarNames(darkBlock);
    expect(darkVars).toEqual(neutralInlineColors.dark);
    expect(darkVars).toHaveLength(31);
  });

  it('@theme inline 里 --color-* 的名字集合全等于「:root 的颜色变量」= light 去掉 radius (共 31 个)', () => {
    expect(themeInlineBlockMatch).not.toBeNull();
    const colorMatches = [...themeInlineBlock.matchAll(/^\s*--color-([a-zA-Z0-9-]+)\s*:/gm)];
    const themeColors = colorMatches.map((m) => m[1]).sort();

    const expectedRootColors = neutralInlineColors.light.filter((name) => name !== 'radius').sort();
    expect(themeColors).toEqual(expectedRootColors);
    expect(themeColors).toHaveLength(31);
  });

  it('.dark 里显式不定义 --radius (刻意设计：注册表里 radius 仅在 light 定义，dark 继承同值)', () => {
    const darkVars = extractVarNames(darkBlock);
    // 注册表里 radius 只在 light 定义，dark 继承同值；这是有意为之，不是遗漏。
    expect(darkVars).not.toContain('radius');
    expect(darkBlock).not.toMatch(/^\s*--radius\s*:/m);
  });
});
