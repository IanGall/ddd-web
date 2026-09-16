import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { Tree, collectAllKeys, type TreeNode } from '@/components/Tree';

describe('Tree 组件与父子联动语义', () => {
  const sampleNodes: TreeNode[] = [
    {
      key: 'sys',
      title: '系统管理',
      children: [
        { key: 'user', title: '用户管理' },
        { key: 'role', title: '角色管理' },
      ],
    },
    {
      key: 'content',
      title: '内容管理',
      children: [{ key: 'article', title: '文章管理' }],
    },
  ];

  it('1. 勾父节点选中共全部后代（onCheckedChange 的 checked 含全部后代 key）', () => {
    const onCheckedChange = vi.fn();
    render(
      <Tree
        nodes={sampleNodes}
        checkedKeys={[]}
        onCheckedChange={onCheckedChange}
        expandedKeys={['sys', 'content']}
        onExpandedChange={() => {}}
      />,
    );

    const sysCheckbox = screen.getByRole('checkbox', { name: '系统管理' });
    fireEvent.click(sysCheckbox);

    expect(onCheckedChange).toHaveBeenCalledTimes(1);
    const [checked, halfChecked] = onCheckedChange.mock.calls[0];
    expect(checked).toContain('sys');
    expect(checked).toContain('user');
    expect(checked).toContain('role');
    expect(halfChecked).toEqual([]);
  });

  it('2. 取消父节点清空全部后代', () => {
    const onCheckedChange = vi.fn();
    render(
      <Tree
        nodes={sampleNodes}
        checkedKeys={['sys', 'user', 'role']}
        onCheckedChange={onCheckedChange}
        expandedKeys={['sys', 'content']}
        onExpandedChange={() => {}}
      />,
    );

    const sysCheckbox = screen.getByRole('checkbox', { name: '系统管理' });
    fireEvent.click(sysCheckbox);

    expect(onCheckedChange).toHaveBeenCalledTimes(1);
    const [checked, halfChecked] = onCheckedChange.mock.calls[0];
    expect(checked).not.toContain('sys');
    expect(checked).not.toContain('user');
    expect(checked).not.toContain('role');
    expect(checked).toEqual([]);
    expect(halfChecked).toEqual([]);
  });

  it('3. 勾一个子节点时父节点进入 halfChecked 而不进入 checked', () => {
    const onCheckedChange = vi.fn();
    render(
      <Tree
        nodes={sampleNodes}
        checkedKeys={[]}
        onCheckedChange={onCheckedChange}
        expandedKeys={['sys']}
        onExpandedChange={() => {}}
      />,
    );

    const userCheckbox = screen.getByRole('checkbox', { name: '用户管理' });
    fireEvent.click(userCheckbox);

    expect(onCheckedChange).toHaveBeenCalledTimes(1);
    const [checked, halfChecked] = onCheckedChange.mock.calls[0];
    expect(checked).toEqual(['user']);
    expect(checked).not.toContain('sys');
    expect(halfChecked).toEqual(['sys']);
  });

  it('4. 勾满某父的所有子节点时父进入 checked', () => {
    const onCheckedChange = vi.fn();
    render(
      <Tree
        nodes={sampleNodes}
        checkedKeys={['user']}
        onCheckedChange={onCheckedChange}
        expandedKeys={['sys']}
        onExpandedChange={() => {}}
      />,
    );

    const roleCheckbox = screen.getByRole('checkbox', { name: '角色管理' });
    fireEvent.click(roleCheckbox);

    expect(onCheckedChange).toHaveBeenCalledTimes(1);
    const [checked, halfChecked] = onCheckedChange.mock.calls[0];
    expect(checked).toContain('user');
    expect(checked).toContain('role');
    expect(checked).toContain('sys');
    expect(halfChecked).not.toContain('sys');
  });

  it('5. disabled 节点不可勾选且不参与父状态推导', () => {
    const onCheckedChange = vi.fn();
    const nodesWithDisabled: TreeNode[] = [
      {
        key: 'parent',
        title: '父级权限',
        children: [
          { key: 'child-enabled', title: '可用子权限' },
          { key: 'child-disabled', title: '禁用子权限', disabled: true },
        ],
      },
    ];

    render(
      <Tree
        nodes={nodesWithDisabled}
        checkedKeys={[]}
        onCheckedChange={onCheckedChange}
        expandedKeys={['parent']}
        onExpandedChange={() => {}}
      />,
    );

    const disabledCheckbox = screen.getByRole('checkbox', { name: '禁用子权限' });
    expect(disabledCheckbox).toHaveAttribute('aria-disabled', 'true');
    expect(disabledCheckbox).toHaveAttribute('data-disabled');

    // 点击 disabled 节点不触发回调
    fireEvent.click(disabledCheckbox);
    expect(onCheckedChange).not.toHaveBeenCalled();

    // 勾选唯一可用的子节点，disabled 子节点不阻止父节点成为 checked
    const enabledCheckbox = screen.getByRole('checkbox', { name: '可用子权限' });
    fireEvent.click(enabledCheckbox);

    expect(onCheckedChange).toHaveBeenCalledTimes(1);
    const [checked, halfChecked] = onCheckedChange.mock.calls[0];
    expect(checked).toContain('parent');
    expect(checked).toContain('child-enabled');
    expect(checked).not.toContain('child-disabled');
    expect(halfChecked).toEqual([]);
  });

  it('6. collectAllKeys 递归收集所有节点 key', () => {
    const keys = collectAllKeys(sampleNodes);
    expect(keys).toEqual(['sys', 'user', 'role', 'content', 'article']);

    // 空树
    expect(collectAllKeys([])).toEqual([]);

    // 三层深树
    const deepNodes: TreeNode[] = [
      {
        key: 'lvl1',
        title: 'L1',
        children: [
          {
            key: 'lvl2',
            title: 'L2',
            children: [{ key: 'lvl3', title: 'L3' }],
          },
        ],
      },
    ];
    expect(collectAllKeys(deepNodes)).toEqual(['lvl1', 'lvl2', 'lvl3']);
  });

  it('7. title 含 Badge 复合内容时 checkbox 仍能按 name 定位', () => {
    const onCheckedChange = vi.fn();
    const compositeNodes: TreeNode[] = [
      {
        key: 'comp-1',
        title: (
          <div className="flex items-center gap-1.5">
            <span className="font-medium">角色配置项</span>
            <span className="rounded bg-blue-100 px-1 text-xs text-blue-800">菜单</span>
            <span className="text-xs text-muted-foreground">(rbac:role:config)</span>
          </div>
        ),
      },
    ];

    render(
      <Tree
        nodes={compositeNodes}
        checkedKeys={[]}
        onCheckedChange={onCheckedChange}
        expandedKeys={[]}
        onExpandedChange={() => {}}
      />,
    );

    // getByRole('checkbox', { name }) 能精准定位含 Badge 复合标题的复选框
    const checkboxByRole = screen.getByRole('checkbox', { name: /角色配置项/ });
    expect(checkboxByRole).toBeInTheDocument();

    fireEvent.click(checkboxByRole);
    expect(onCheckedChange).toHaveBeenCalledWith(['comp-1'], []);
  });
});
