import { describe, it, expect } from 'vitest';
import { filterMenuItems, collectGroupKeys, type DomainMenuItem } from '@/layout/menuFilter';

const testMenuFixture: readonly DomainMenuItem[] = [
  {
    key: '/dashboard',
    label: '控制台概览',
  },
  {
    key: 'rbac-group',
    label: 'RBAC 权限管理',
    children: [
      {
        key: '/rbac/users',
        label: '用户管理',
        permission: 'rbac:user:read',
      },
      {
        key: '/rbac/roles',
        label: '角色管理',
        permission: 'rbac:role:read',
      },
      {
        key: '/rbac/permissions',
        label: '权限项管理',
        permission: 'rbac:permission:read',
      },
    ],
  },
  {
    key: 'platform-group',
    label: '平台凭证',
    children: [
      {
        key: '/platform/channel-credentials',
        label: '渠道凭证管理',
        permission: 'rbac:channel-credential:read',
      },
    ],
  },
  {
    key: '/sessions',
    label: '我的会话',
  },
];

describe('menuFilter 菜单过滤纯逻辑与分组 Key 收集', () => {
  it('1. 关键字为空 + 全权限 → 结构与输入一致', () => {
    const result = filterMenuItems(testMenuFixture, '', () => true);
    expect(result).toEqual(testMenuFixture);
  });

  it('2. 关键字为空 + 无任何权限 → 分组整组消失，不产生空分组', () => {
    const result = filterMenuItems(testMenuFixture, '', () => false);
    // 所有带权限子项的分组均被滤除，仅保留无 permission 的顶级叶子项
    expect(result).toEqual([
      {
        key: '/dashboard',
        label: '控制台概览',
      },
      {
        key: '/sessions',
        label: '我的会话',
      },
    ]);
    // 确保结果中没有任何分组存在，且绝不产生空分组
    expect(result.some((item) => item.children !== undefined)).toBe(false);
  });

  it('3. 关键字命中某个叶子 → 只保留命中的叶子，同组其他叶子被剔除，分组保留', () => {
    const result = filterMenuItems(testMenuFixture, '用户管理', () => true);
    expect(result).toEqual([
      {
        key: 'rbac-group',
        label: 'RBAC 权限管理',
        children: [
          {
            key: '/rbac/users',
            label: '用户管理',
            permission: 'rbac:user:read',
          },
        ],
      },
    ]);
  });

  it('4. 关键字命中分组 label → 该组以「全部已授权子项」保留（不是只留匹配的子项）', () => {
    // 关键字命中 'RBAC'（各子项 label 均不包含 'RBAC'）
    const result = filterMenuItems(testMenuFixture, 'RBAC', () => true);
    expect(result).toEqual([
      {
        key: 'rbac-group',
        label: 'RBAC 权限管理',
        children: [
          {
            key: '/rbac/users',
            label: '用户管理',
            permission: 'rbac:user:read',
          },
          {
            key: '/rbac/roles',
            label: '角色管理',
            permission: 'rbac:role:read',
          },
          {
            key: '/rbac/permissions',
            label: '权限项管理',
            permission: 'rbac:permission:read',
          },
        ],
      },
    ]);
  });

  it('5. 关键字命中分组 label、但部分子项无权限 → 只留已授权子项', () => {
    // 关键字命中 'RBAC'，但当前用户仅具备 rbac:user:read 权限
    const hasPermission = (code: string) => code === 'rbac:user:read';
    const result = filterMenuItems(testMenuFixture, 'RBAC', hasPermission);
    expect(result).toEqual([
      {
        key: 'rbac-group',
        label: 'RBAC 权限管理',
        children: [
          {
            key: '/rbac/users',
            label: '用户管理',
            permission: 'rbac:user:read',
          },
        ],
      },
    ]);
  });

  it('6. 关键字命中但该叶子无权限 → 不出现（越权不因命中而泄露）', () => {
    // 关键字命中 '用户'，但用户仅具备 rbac:role:read，无 rbac:user:read 权限
    const hasPermission = (code: string) => code === 'rbac:role:read';
    const result = filterMenuItems(testMenuFixture, '用户', hasPermission);
    expect(result).toEqual([]);
  });

  it('7. 无 permission 字段的叶子，在关键字为空时保留', () => {
    // 即使权限校验全部返回 false，无 permission 字段的叶子恒保留
    const result = filterMenuItems(testMenuFixture, '', () => false);
    const keys = result.map((item) => item.key);
    expect(keys).toContain('/dashboard');
    expect(keys).toContain('/sessions');
  });

  it('8. 无 permission 字段的叶子，在关键字不匹配时被剔除', () => {
    // 关键字为 '角色'，不匹配 /dashboard 与 /sessions
    const result = filterMenuItems(testMenuFixture, '角色', () => true);
    const keys = result.map((item) => item.key);
    expect(keys).not.toContain('/dashboard');
    expect(keys).not.toContain('/sessions');
  });

  it('9. 关键字匹配大小写不敏感、前后空格被容忍', () => {
    const result1 = filterMenuItems(testMenuFixture, '  rbac  ', () => true);
    const result2 = filterMenuItems(testMenuFixture, '  rBaC  ', () => true);
    expect(result1).toHaveLength(1);
    expect(result1[0].key).toBe('rbac-group');
    expect(result1).toEqual(result2);
  });

  it('10. 分组自带 permission 且无权限 → 整组消失', () => {
    const itemsWithGroupPermission: DomainMenuItem[] = [
      {
        key: 'audit-group',
        label: '审计中心',
        permission: 'audit:group:view',
        children: [
          {
            key: '/audit/logs',
            label: '审计日志',
            permission: 'audit:log:read',
          },
        ],
      },
    ];

    // 用户即使具备子项权限 audit:log:read，但缺失分组权限 audit:group:view 时整组被过滤
    const hasOnlyChildPermission = (code: string) => code === 'audit:log:read';
    const result = filterMenuItems(itemsWithGroupPermission, '', hasOnlyChildPermission);
    expect(result).toEqual([]);

    // 关键字匹配该分组名称时，因越权同样必须整组丢弃
    const resultWithKw = filterMenuItems(itemsWithGroupPermission, '审计', hasOnlyChildPermission);
    expect(resultWithKw).toEqual([]);
  });

  it('11. collectGroupKeys 只返回有子项的分组 key', () => {
    const items: DomainMenuItem[] = [
      { key: '/dashboard', label: '控制台概览' },
      {
        key: 'rbac-group',
        label: 'RBAC 权限管理',
        children: [{ key: '/rbac/users', label: '用户管理' }],
      },
      { key: 'empty-group', label: '空分组', children: [] },
      {
        key: 'platform-group',
        label: '平台凭证',
        children: [{ key: '/platform/channel-credentials', label: '渠道凭证管理' }],
      },
      { key: '/sessions', label: '我的会话' },
    ];

    expect(collectGroupKeys(items)).toEqual(['rbac-group', 'platform-group']);

    // 递归嵌套测试：多层分组按输入与深度优先顺序收集非空分组 key
    const nestedItems: DomainMenuItem[] = [
      {
        key: 'parent-group',
        label: '父分组',
        children: [
          {
            key: 'child-group',
            label: '子分组',
            children: [{ key: '/nested/item', label: '嵌套叶子' }],
          },
        ],
      },
    ];
    expect(collectGroupKeys(nestedItems)).toEqual(['parent-group', 'child-group']);
  });
});
