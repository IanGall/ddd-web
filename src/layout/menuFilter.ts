import type { ReactNode } from 'react';

export interface DomainMenuItem {
  key: string; // 路由绝对路径或分组唯一标识
  label: string;
  icon?: ReactNode;
  permission?: string; // 缺省表示无需权限
  children?: DomainMenuItem[];
}

/**
 * 菜单项过滤（纯逻辑，单趟递归同时处理权限与关键字）
 *
 * 语义规则：
 * 1. 若 item.permission 存在且 hasPermission 为 false → 直接丢弃；
 * 2. 若 item.children 存在（分组）：
 *    - matched = filterMenuItems(item.children, kw, hasPermission)（带关键字递归）
 *    - matched.length > 0 → 保留该分组，children 为 matched
 *    - 否则若 kw !== '' 且分组 label 匹配 kw → 该分组以「全部已授权子项」保留
 *    - 否则 → 丢弃
 * 3. 否则（叶子）：
 *    - kw === '' 或 label 匹配 kw → 保留，否则丢弃
 */
export function filterMenuItems(
  items: readonly DomainMenuItem[],
  keyword: string,
  hasPermission: (code: string) => boolean,
): DomainMenuItem[] {
  const kw = keyword.trim().toLowerCase();
  const result: DomainMenuItem[] = [];

  for (const item of items) {
    // 1. 权限校验：若显式要求权限且未授权，直接丢弃（对分组与叶子均适用）
    if (item.permission && !hasPermission(item.permission)) {
      continue;
    }

    // 2. 分组项处理
    if (item.children) {
      if (item.children.length === 0) {
        continue;
      }

      const matched = filterMenuItems(item.children, kw, hasPermission);
      if (matched.length > 0) {
        result.push({
          ...item,
          children: matched,
        });
      } else if (kw !== '' && item.label.trim().toLowerCase().includes(kw)) {
        const allAllowed = filterMenuItems(item.children, '', hasPermission);
        if (allAllowed.length > 0) {
          result.push({
            ...item,
            children: allAllowed,
          });
        }
      }
      continue;
    }

    // 3. 叶子项处理（无 permission 字段在 kw 为空时恒保留）
    if (kw === '' || item.label.trim().toLowerCase().includes(kw)) {
      result.push(item);
    }
  }

  return result;
}

/**
 * 收集所有包含非空子项的分组 key（按输入顺序递归收集）
 */
export function collectGroupKeys(items: readonly DomainMenuItem[]): string[] {
  const keys: string[] = [];

  for (const item of items) {
    if (item.children && item.children.length > 0) {
      keys.push(item.key);
      keys.push(...collectGroupKeys(item.children));
    }
  }

  return keys;
}
