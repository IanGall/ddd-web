import type { RbacPermissionDTO } from '@/api/rbac';

export interface PermissionTreeNode extends RbacPermissionDTO {
  children?: PermissionTreeNode[];
}

/**
 * 根节点的 parentId 哨兵值。标识以字符串出网，因此哨兵值也是字符串。
 */
export const ROOT_PARENT_ID = '0';

/**
 * 将平铺列表按 parentId 组织为树形结构，未找到父级的节点提升为顶层展示
 */
export function buildPermissionTree(items: RbacPermissionDTO[]): PermissionTreeNode[] {
  const map = new Map<string, PermissionTreeNode>();
  const roots: PermissionTreeNode[] = [];

  items.forEach((item) => {
    map.set(item.id, { ...item, children: [] });
  });

  items.forEach((item) => {
    const node = map.get(item.id)!;
    if (item.parentId && item.parentId !== ROOT_PARENT_ID && map.has(item.parentId)) {
      const parent = map.get(item.parentId)!;
      parent.children!.push(node);
    } else {
      roots.push(node);
    }
  });

  // 递归移除空的 children 属性，避免 Antd Table 为叶子节点呈现展开图标
  const cleanEmptyChildren = (nodes: PermissionTreeNode[]) => {
    nodes.forEach((node) => {
      if (node.children && node.children.length === 0) {
        delete node.children;
      } else if (node.children) {
        cleanEmptyChildren(node.children);
      }
    });
  };

  cleanEmptyChildren(roots);
  return roots;
}
