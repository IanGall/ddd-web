import React, { useMemo } from 'react';
import { cn } from 'cn';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronRightIcon } from 'lucide-react';

export interface TreeNode {
  key: string; // 全程 string（雪花 ID 转 number 会丢精度）
  title: React.ReactNode; // 含 Badge 等复合内容
  disabled?: boolean;
  children?: TreeNode[];
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
  const { statusMap, allChecked } = useMemo(
    () => deriveTreeStatus(nodes, checkedKeys, disabled),
    [nodes, checkedKeys, disabled],
  );

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

    const ariaCheckedValue =
      status === 'checked' ? 'true' : status === 'indeterminate' ? 'mixed' : 'false';

    return (
      <li
        key={node.key}
        role="treeitem"
        aria-expanded={hasChildren ? isExpanded : undefined}
        aria-checked={ariaCheckedValue}
        className="list-none"
      >
        <div className="flex items-center gap-1.5 py-1">
          {hasChildren ? (
            <button
              type="button"
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
            checked={status === 'checked'}
            indeterminate={status === 'indeterminate'}
            disabled={isNodeDisabled}
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
    <ul role="tree" className={cn('space-y-0.5 select-none', className)}>
      {nodes.map(renderNode)}
    </ul>
  );
};
