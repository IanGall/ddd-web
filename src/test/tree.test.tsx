import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
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

  it('8. roving tabindex: 全树恰好 1 个 tab 停点，所有 checkbox 的 tabindex 为 -1', () => {
    const { container } = render(
      <Tree
        nodes={sampleNodes}
        checkedKeys={[]}
        onCheckedChange={() => {}}
        expandedKeys={['sys']}
        onExpandedChange={() => {}}
      />,
    );

    // 全树只有当前活动节点（默认首个可见节点）设置 tabindex="0"
    const zeroTabIndexElements = container.querySelectorAll('[tabindex="0"]');
    expect(zeroTabIndexElements).toHaveLength(1);
    expect(zeroTabIndexElements[0]).toHaveAttribute('id', 'tree-item-sys');

    // 所有 checkbox 的 tabindex 均被强制设为 -1，不作为独立 tab 停点
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(0);
    checkboxes.forEach((cb) => {
      expect(cb).toHaveAttribute('tabindex', '-1');
    });
  });

  it('9. 键盘导航: ↓/↑ 在可见节点间同步移动焦点', () => {
    const { container } = render(
      <Tree
        nodes={sampleNodes}
        checkedKeys={[]}
        onCheckedChange={() => {}}
        expandedKeys={['sys']}
        onExpandedChange={() => {}}
      />,
    );

    const sysLi = container.querySelector('#tree-item-sys') as HTMLElement;
    const userLi = container.querySelector('#tree-item-user') as HTMLElement;
    const roleLi = container.querySelector('#tree-item-role') as HTMLElement;

    act(() => {
      sysLi.focus();
    });
    expect(sysLi).toHaveFocus();

    // ↓ 移至下一个可见节点
    fireEvent.keyDown(sysLi, { key: 'ArrowDown' });
    expect(userLi).toHaveFocus();

    // ↓ 再次移动
    fireEvent.keyDown(userLi, { key: 'ArrowDown' });
    expect(roleLi).toHaveFocus();

    // ↑ 回退至上一个可见节点
    fireEvent.keyDown(roleLi, { key: 'ArrowUp' });
    expect(userLi).toHaveFocus();

    // ↑ 再次回退
    fireEvent.keyDown(userLi, { key: 'ArrowUp' });
    expect(sysLi).toHaveFocus();
  });

  it('10. 键盘导航: →/← 支持受控展开、深入子节点、回退父节点与折叠', () => {
    const onExpandedChangeSpy = vi.fn();

    const ControlledHost: React.FC = () => {
      const [checkedKeys, setCheckedKeys] = useState<string[]>([]);
      const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

      return (
        <Tree
          nodes={sampleNodes}
          checkedKeys={checkedKeys}
          onCheckedChange={setCheckedKeys}
          expandedKeys={expandedKeys}
          onExpandedChange={(keys) => {
            onExpandedChangeSpy(keys);
            setExpandedKeys(keys);
          }}
        />
      );
    };

    const { container } = render(<ControlledHost />);
    const sysLi = container.querySelector('#tree-item-sys') as HTMLElement;
    act(() => {
      sysLi.focus();
    });
    expect(sysLi).toHaveFocus();

    // 1. 折叠父节点上 ArrowRight → 触发展开回调，焦点仍留在当前父节点
    fireEvent.keyDown(sysLi, { key: 'ArrowRight' });
    expect(onExpandedChangeSpy).toHaveBeenCalledWith(['sys']);
    expect(sysLi).toHaveFocus();

    // 2. 展开后在已展开的父节点上再次 ArrowRight → 焦点进入第一个子节点
    const userLi = container.querySelector('#tree-item-user') as HTMLElement;
    expect(userLi).toBeInTheDocument();
    fireEvent.keyDown(sysLi, { key: 'ArrowRight' });
    expect(userLi).toHaveFocus();

    // 3. 在叶子节点上 ArrowLeft → 焦点回退至父节点
    fireEvent.keyDown(userLi, { key: 'ArrowLeft' });
    expect(sysLi).toHaveFocus();

    // 4. 在已展开的父节点上 ArrowLeft → 触发折叠，焦点仍在父节点
    fireEvent.keyDown(sysLi, { key: 'ArrowLeft' });
    expect(onExpandedChangeSpy).toHaveBeenLastCalledWith([]);
    expect(sysLi).toHaveFocus();
  });

  it('11. 键盘导航: Home/End 落在首/末可见节点（折叠的子节点不计入）', () => {
    const { container } = render(
      <Tree
        nodes={sampleNodes}
        checkedKeys={[]}
        onCheckedChange={() => {}}
        expandedKeys={['sys']}
        onExpandedChange={() => {}}
      />,
    );

    // sampleNodes 中 sys 展开（含 user, role），content 折叠（article 不可见）
    // 可见顺序为：sys -> user -> role -> content
    const sysLi = container.querySelector('#tree-item-sys') as HTMLElement;
    const contentLi = container.querySelector('#tree-item-content') as HTMLElement;

    // article 处于折叠状态，不在 DOM 和可见集合中
    expect(container.querySelector('#tree-item-article')).not.toBeInTheDocument();

    act(() => {
      sysLi.focus();
    });
    expect(sysLi).toHaveFocus();

    // End 移动到最后一个可见节点 (content)
    fireEvent.keyDown(sysLi, { key: 'End' });
    expect(contentLi).toHaveFocus();

    // Home 移动回第一个可见节点 (sys)
    fireEvent.keyDown(contentLi, { key: 'Home' });
    expect(sysLi).toHaveFocus();
  });

  it('12. 键盘事件: Space 在 li 与 checkbox 上均恰好触发一次勾选切换（无双切换）', () => {
    const onCheckedChange = vi.fn();
    const { container } = render(
      <Tree
        nodes={sampleNodes}
        checkedKeys={[]}
        onCheckedChange={onCheckedChange}
        expandedKeys={['sys']}
        onExpandedChange={() => {}}
      />,
    );

    const sysLi = container.querySelector('#tree-item-sys') as HTMLElement;
    act(() => {
      sysLi.focus();
    });
    expect(sysLi).toHaveFocus();

    // 1. 焦点在 li 上按 Space (keyDown)：触发 handleToggleCheck，回调恰好 1 次
    fireEvent.keyDown(sysLi, { key: ' ' });
    expect(onCheckedChange).toHaveBeenCalledTimes(1);

    onCheckedChange.mockClear();

    // 2. 对照组：残余路径下焦点落在 checkbox 上，按 Space（keyDown 冒泡到 li 被过滤，由 Base UI 的 keyUp 处理）
    const sysCheckbox = screen.getByRole('checkbox', { name: '系统管理' });
    act(() => {
      sysCheckbox.focus();
    });
    fireEvent.keyDown(sysCheckbox, { key: ' ' });
    fireEvent.keyUp(sysCheckbox, { key: ' ' });
    expect(onCheckedChange).toHaveBeenCalledTimes(1);
  });

  it('13. 键盘事件: disabled 节点上 Space 不触发勾选且保留 aria-disabled', () => {
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

    const { container } = render(
      <Tree
        nodes={nodesWithDisabled}
        checkedKeys={[]}
        onCheckedChange={onCheckedChange}
        expandedKeys={['parent']}
        onExpandedChange={() => {}}
      />,
    );

    const disabledLi = container.querySelector('#tree-item-child-disabled') as HTMLElement;
    expect(disabledLi).toHaveAttribute('aria-disabled', 'true');

    const disabledCheckbox = screen.getByRole('checkbox', { name: '禁用子权限' });
    expect(disabledCheckbox).toHaveAttribute('aria-disabled', 'true');
    expect(disabledCheckbox).toHaveAttribute('data-disabled');

    // disabled 节点允许聚焦（WAI-ARIA 要求），但按 Space 不触发勾选
    act(() => {
      disabledLi.focus();
    });
    expect(disabledLi).toHaveFocus();

    fireEvent.keyDown(disabledLi, { key: ' ' });
    expect(onCheckedChange).not.toHaveBeenCalled();
  });

  it('14. ARIA 语义: 树与节点的 aria-multiselectable、aria-level、aria-posinset、aria-setsize 正确', () => {
    const { container } = render(
      <Tree
        nodes={sampleNodes}
        checkedKeys={[]}
        onCheckedChange={() => {}}
        expandedKeys={['sys']}
        onExpandedChange={() => {}}
      />,
    );

    // 树根节点增加 aria-multiselectable="true"
    const treeRoot = screen.getByRole('tree');
    expect(treeRoot).toHaveAttribute('aria-multiselectable', 'true');

    // 二级节点 user：sys 的第 1 个子节点（共 2 个同级节点）
    const userLi = container.querySelector('#tree-item-user') as HTMLElement;
    expect(userLi).toHaveAttribute('role', 'treeitem');
    expect(userLi).toHaveAttribute('aria-level', '2');
    expect(userLi).toHaveAttribute('aria-posinset', '1');
    expect(userLi).toHaveAttribute('aria-setsize', '2');

    // 二级节点 role：sys 的第 2 个子节点（共 2 个同级节点）
    const roleLi = container.querySelector('#tree-item-role') as HTMLElement;
    expect(roleLi).toHaveAttribute('role', 'treeitem');
    expect(roleLi).toHaveAttribute('aria-level', '2');
    expect(roleLi).toHaveAttribute('aria-posinset', '2');
    expect(roleLi).toHaveAttribute('aria-setsize', '2');
  });
});
