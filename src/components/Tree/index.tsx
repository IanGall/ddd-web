import React, { useMemo, useRef, useState } from 'react';
import { cn } from 'cn';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronRightIcon } from 'lucide-react';

export interface TreeNode {
  key: string; // 全程 string（雪花 ID 转 number 会丢精度）
  title: React.ReactNode; // 含 Badge 等复合内容
  disabled?: boolean;
  children?: TreeNode[];
}

export interface FlatNode {
  node: TreeNode;
  level: number;
  parentKey: string | null;
  index: number;
  setSize: number;
}

export interface TreeProps {
  nodes: TreeNode[];
  checkedKeys: string[]; // 受控
  onCheckedChange: (checked: string[], halfChecked: string[]) => void;
  expandedKeys: string[];
  onExpandedChange: (keys: string[]) => void;
  disabled?: boolean;
  className?: string;
  emptyText?: React.ReactNode; // 默认「暂无可选权限项」
}

export function collectAllKeys(nodes: TreeNode[]): string[] {
  const keys: string[] = [];
  function traverse(list: TreeNode[]) {
    for (const node of list) {
      keys.push(node.key);
      if (node.children && node.children.length > 0) {
        traverse(node.children);
      }
    }
  }
  traverse(nodes);
  return keys;
}

export type NodeCheckStatus = 'checked' | 'indeterminate' | 'unchecked';

export function deriveTreeStatus(
  nodes: TreeNode[],
  checkedKeys: string[],
  treeDisabled?: boolean,
): {
  statusMap: Map<string, NodeCheckStatus>;
  allChecked: string[];
  allHalfChecked: string[];
} {
  const initialCheckedSet = new Set(checkedKeys);
  const statusMap = new Map<string, NodeCheckStatus>();

  // If a parent key is in checkedKeys, propagate downward to enabled descendants
  const activeCheckedSet = new Set(initialCheckedSet);
  function expandParentDown(list: TreeNode[], parentChecked: boolean) {
    for (const node of list) {
      const isSelfDisabled = Boolean(treeDisabled || node.disabled);
      const isChecked = parentChecked || activeCheckedSet.has(node.key);
      if (isChecked && !isSelfDisabled) {
        activeCheckedSet.add(node.key);
      }
      if (node.children && node.children.length > 0) {
        expandParentDown(node.children, isChecked && !isSelfDisabled);
      }
    }
  }
  expandParentDown(nodes, false);

  function evaluate(node: TreeNode): NodeCheckStatus {
    const enabledChildren = (node.children || []).filter((c) => !treeDisabled && !c.disabled);

    if (enabledChildren.length === 0) {
      const isChecked = activeCheckedSet.has(node.key);
      const status: NodeCheckStatus = isChecked ? 'checked' : 'unchecked';
      statusMap.set(node.key, status);
      return status;
    }

    let allChecked = true;
    let someCheckedOrIndeterminate = false;

    for (const child of enabledChildren) {
      const childStatus = evaluate(child);
      if (childStatus === 'checked') {
        someCheckedOrIndeterminate = true;
      } else if (childStatus === 'indeterminate') {
        allChecked = false;
        someCheckedOrIndeterminate = true;
      } else {
        allChecked = false;
      }
    }

    // Also evaluate any disabled children so their statusMap is filled
    if (node.children) {
      for (const child of node.children) {
        if (treeDisabled || child.disabled) {
          evaluate(child);
        }
      }
    }

    let status: NodeCheckStatus;
    if (allChecked) {
      status = 'checked';
    } else if (someCheckedOrIndeterminate) {
      status = 'indeterminate';
    } else {
      status = 'unchecked';
    }

    statusMap.set(node.key, status);
    return status;
  }

  for (const node of nodes) {
    evaluate(node);
  }

  const allChecked: string[] = [];
  const allHalfChecked: string[] = [];

  function collect(list: TreeNode[]) {
    for (const node of list) {
      const st = statusMap.get(node.key) ?? 'unchecked';
      if (st === 'checked') {
        allChecked.push(node.key);
      } else if (st === 'indeterminate') {
        allHalfChecked.push(node.key);
      }
      if (node.children && node.children.length > 0) {
        collect(node.children);
      }
    }
  }
  collect(nodes);

  return { statusMap, allChecked, allHalfChecked };
}

function collectEnabledKeys(nodes: TreeNode[], treeDisabled?: boolean): string[] {
  const keys: string[] = [];
  function traverse(list: TreeNode[]) {
    for (const node of list) {
      const isSelfDisabled = Boolean(treeDisabled || node.disabled);
      if (!isSelfDisabled) {
        keys.push(node.key);
      }
      if (node.children && node.children.length > 0) {
        traverse(node.children);
      }
    }
  }
  traverse(nodes);
  return keys;
}

export const Tree: React.FC<TreeProps> = ({
  nodes,
  checkedKeys,
  onCheckedChange,
  expandedKeys,
  onExpandedChange,
  disabled = false,
  className,
  emptyText = '暂无可选权限项',
}) => {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const itemRefs = useRef<Map<string, HTMLElement>>(new Map());

  const { statusMap, allChecked } = useMemo(
    () => deriveTreeStatus(nodes, checkedKeys, disabled),
    [nodes, checkedKeys, disabled],
  );

  // 遍历可见节点生成平铺元数据（只计入已展开的子节点）
  const { visibleNodes, flatNodeMap } = useMemo(() => {
    const visible: FlatNode[] = [];
    const map = new Map<string, FlatNode & { flatIndex: number }>();

    function traverse(list: TreeNode[], level: number, parentKey: string | null) {
      const setSize = list.length;
      for (let i = 0; i < setSize; i++) {
        const node = list[i];
        const flatNode: FlatNode = {
          node,
          level,
          parentKey,
          index: i + 1,
          setSize,
        };
        const flatIndex = visible.length;
        visible.push(flatNode);
        map.set(node.key, { ...flatNode, flatIndex });

        const hasChildren = Boolean(node.children && node.children.length > 0);
        if (hasChildren && expandedKeys.includes(node.key)) {
          traverse(node.children!, level + 1, node.key);
        }
      }
    }

    traverse(nodes, 1, null);
    return { visibleNodes: visible, flatNodeMap: map };
  }, [nodes, expandedKeys]);

  // roving tabindex：全树恰好一个 tab 停点（当前活动节点，若不在可见集合中回退到第一个可见节点）
  const tabbableKey = useMemo(() => {
    if (visibleNodes.length === 0) return null;
    if (activeKey && flatNodeMap.has(activeKey)) {
      return activeKey;
    }
    return visibleNodes[0].node.key;
  }, [visibleNodes, flatNodeMap, activeKey]);

  const handleToggleExpand = (key: string) => {
    if (expandedKeys.includes(key)) {
      onExpandedChange(expandedKeys.filter((k) => k !== key));
    } else {
      onExpandedChange([...expandedKeys, key]);
    }
  };

  const handleToggleCheck = (targetNode: TreeNode) => {
    if (disabled || targetNode.disabled) return;

    const currentStatus = statusMap.get(targetNode.key) ?? 'unchecked';
    const targetEnabledKeys = collectEnabledKeys([targetNode], disabled);

    let nextCheckedKeys: string[];
    if (currentStatus === 'checked') {
      // Uncheck target and all its enabled descendants
      const targetSet = new Set(targetEnabledKeys);
      nextCheckedKeys = allChecked.filter((k) => !targetSet.has(k));
    } else {
      // Check target and all its enabled descendants
      const mergedSet = new Set([...allChecked, ...targetEnabledKeys]);
      nextCheckedKeys = Array.from(mergedSet);
    }

    const { allChecked: nextChecked, allHalfChecked: nextHalfChecked } = deriveTreeStatus(
      nodes,
      nextCheckedKeys,
      disabled,
    );

    onCheckedChange(nextChecked, nextHalfChecked);
  };

  // 键盘导航：本实现按 WAI-ARIA 标准，不声称与 Ant Design 逐位一致（已从依赖移除，无法确证其 Space/Enter 行为）
  const handleKeyDown = (event: React.KeyboardEvent<HTMLLIElement>, item: FlatNode) => {
    const hasChildren = Boolean(item.node.children && item.node.children.length > 0);
    const isExpanded = expandedKeys.includes(item.node.key);
    const currentFlat = flatNodeMap.get(item.node.key);

    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        event.stopPropagation();
        if (!currentFlat) return;
        if (currentFlat.flatIndex < visibleNodes.length - 1) {
          const nextKey = visibleNodes[currentFlat.flatIndex + 1].node.key;
          setActiveKey(nextKey);
          itemRefs.current.get(nextKey)?.focus();
        }
        return;
      }

      case 'ArrowUp': {
        event.preventDefault();
        event.stopPropagation();
        if (!currentFlat) return;
        if (currentFlat.flatIndex > 0) {
          const prevKey = visibleNodes[currentFlat.flatIndex - 1].node.key;
          setActiveKey(prevKey);
          itemRefs.current.get(prevKey)?.focus();
        }
        return;
      }

      case 'ArrowRight': {
        event.preventDefault();
        event.stopPropagation();
        if (hasChildren && !isExpanded) {
          // 可展开且折叠 → 展开（焦点不动）
          handleToggleExpand(item.node.key);
          if (document.activeElement !== event.currentTarget) {
            itemRefs.current.get(item.node.key)?.focus();
            setActiveKey(item.node.key);
          }
        } else if (hasChildren && isExpanded) {
          // 已展开 → 移到第一个子节点
          const firstChildKey = item.node.children![0].key;
          setActiveKey(firstChildKey);
          itemRefs.current.get(firstChildKey)?.focus();
        } else {
          // 叶子 → 仅 preventDefault
          if (document.activeElement !== event.currentTarget) {
            itemRefs.current.get(item.node.key)?.focus();
            setActiveKey(item.node.key);
          }
        }
        return;
      }

      case 'ArrowLeft': {
        event.preventDefault();
        event.stopPropagation();
        if (hasChildren && isExpanded) {
          // 可展开且展开 → 折叠（焦点不动）
          handleToggleExpand(item.node.key);
          if (document.activeElement !== event.currentTarget) {
            itemRefs.current.get(item.node.key)?.focus();
            setActiveKey(item.node.key);
          }
        } else if (item.parentKey) {
          // 否则 → 移到父节点
          setActiveKey(item.parentKey);
          itemRefs.current.get(item.parentKey)?.focus();
        } else {
          // 根节点 → 无操作
          if (document.activeElement !== event.currentTarget) {
            itemRefs.current.get(item.node.key)?.focus();
            setActiveKey(item.node.key);
          }
        }
        return;
      }

      case 'Home': {
        event.preventDefault();
        event.stopPropagation();
        if (visibleNodes.length > 0) {
          const firstKey = visibleNodes[0].node.key;
          setActiveKey(firstKey);
          itemRefs.current.get(firstKey)?.focus();
        }
        return;
      }

      case 'End': {
        event.preventDefault();
        event.stopPropagation();
        if (visibleNodes.length > 0) {
          const lastKey = visibleNodes[visibleNodes.length - 1].node.key;
          setActiveKey(lastKey);
          itemRefs.current.get(lastKey)?.focus();
        }
        return;
      }

      case ' ': {
        // Space 双切换防范：焦点在 Checkbox/展开按钮上时交给 Base UI 处理
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        event.stopPropagation();
        handleToggleCheck(item.node);
        return;
      }

      case 'Enter': {
        // Enter：切换展开/折叠，不切换勾选
        event.preventDefault();
        event.stopPropagation();
        if (hasChildren) {
          handleToggleExpand(item.node.key);
        }
        return;
      }

      default:
        break;
    }
  };

  if (nodes.length === 0) {
    return (
      <div className={cn('py-6 text-center text-sm text-muted-foreground', className)}>
        {emptyText}
      </div>
    );
  }

  const renderNode = (node: TreeNode) => {
    const hasChildren = Boolean(node.children && node.children.length > 0);
    const isExpanded = expandedKeys.includes(node.key);
    const status = statusMap.get(node.key) ?? 'unchecked';
    const isNodeDisabled = Boolean(disabled || node.disabled);
    const checkboxId = `tree-${node.key}`;
    const flatNode = flatNodeMap.get(node.key);

    const ariaCheckedValue =
      status === 'checked' ? 'true' : status === 'indeterminate' ? 'mixed' : 'false';

    return (
      <li
        key={node.key}
        id={`tree-item-${node.key}`}
        ref={(el) => {
          if (el) {
            itemRefs.current.set(node.key, el);
          } else {
            itemRefs.current.delete(node.key);
          }
        }}
        role="treeitem"
        tabIndex={tabbableKey === node.key ? 0 : -1}
        aria-expanded={hasChildren ? isExpanded : undefined}
        aria-checked={ariaCheckedValue}
        aria-disabled={isNodeDisabled ? true : undefined}
        aria-level={flatNode?.level ?? 1}
        aria-posinset={flatNode?.index ?? 1}
        aria-setsize={flatNode?.setSize ?? 1}
        onFocus={(e) => {
          if (e.target === e.currentTarget) {
            setActiveKey(node.key);
          }
        }}
        onKeyDown={(e) => {
          if (flatNode) {
            handleKeyDown(e, flatNode);
          }
        }}
        className="list-none rounded-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <div className="flex items-center gap-1.5 py-1">
          {hasChildren ? (
            <button
              type="button"
              tabIndex={-1}
              aria-label={isExpanded ? '折叠' : '展开'}
              onClick={() => handleToggleExpand(node.key)}
              className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted"
            >
              <ChevronRightIcon
                className={cn(
                  'size-3.5 transition-transform duration-150',
                  isExpanded && 'rotate-90',
                )}
              />
            </button>
          ) : (
            <span className="size-5 shrink-0" aria-hidden="true" />
          )}

          <Checkbox
            id={checkboxId}
            tabIndex={-1}
            checked={status === 'checked'}
            indeterminate={status === 'indeterminate'}
            disabled={isNodeDisabled}
            onFocus={() => setActiveKey(node.key)}
            onCheckedChange={() => handleToggleCheck(node)}
          />

          <label
            htmlFor={checkboxId}
            className={cn(
              'flex flex-1 cursor-pointer items-center gap-2 text-sm text-foreground select-none',
              isNodeDisabled && 'cursor-not-allowed opacity-50',
            )}
          >
            {node.title}
          </label>
        </div>

        {hasChildren && isExpanded && (
          <ul role="group" className="space-y-0.5 pl-6">
            {node.children!.map(renderNode)}
          </ul>
        )}
      </li>
    );
  };

  return (
    <ul
      role="tree"
      aria-multiselectable="true"
      className={cn('space-y-0.5 select-none', className)}
    >
      {nodes.map(renderNode)}
    </ul>
  );
};
