import { describe, it, expect, vi, beforeEach } from 'vitest';
import { rbacApi } from '@/api/rbac';
import { request } from '@/api/client';
import { buildPermissionTree } from '@/pages/rbac/permissions/utils';

vi.mock('@/api/client', () => ({
  request: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('rbacApi - 用户管理接口', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getUsers 应传递清洗后的分页与查询参数', async () => {
    const mockResp = {
      total: 1,
      pageNum: 1,
      pageSize: 20,
      list: [
        {
          id: '1',
          accountId: '100',
          username: 'admin',
          displayName: '管理员',
          email: 'admin@example.com',
          mobile: '13800000000',
          status: true,
          createTime: '2026-09-15T12:00:00',
          updateTime: '2026-09-15T12:00:00',
        },
      ],
    };

    vi.mocked(request.get).mockResolvedValueOnce(mockResp);

    const result = await rbacApi.getUsers({
      pageNum: 1,
      pageSize: 20,
      username: 'admin',
      status: true,
    });

    expect(request.get).toHaveBeenCalledWith('/api/admin/rbac/users', {
      params: {
        pageNum: 1,
        pageSize: 20,
        username: 'admin',
        status: true,
      },
    });
    expect(result.total).toBe(1);
    expect(result.list[0].username).toBe('admin');
  });

  it('getUsers 应过滤空字符串与 undefined 参数', async () => {
    vi.mocked(request.get).mockResolvedValueOnce({
      total: 0,
      pageNum: 1,
      pageSize: 20,
      list: [],
    });

    await rbacApi.getUsers({
      pageNum: 1,
      pageSize: 20,
      username: '',
      status: undefined,
    });

    expect(request.get).toHaveBeenCalledWith('/api/admin/rbac/users', {
      params: {
        pageNum: 1,
        pageSize: 20,
      },
    });
  });

  it('createUser 应正确发送 POST 请求', async () => {
    const payload = {
      username: 'operator',
      password: 'password123',
      displayName: '操作员',
      status: true,
    };
    vi.mocked(request.post).mockResolvedValueOnce({ id: '3', ...payload });

    const created = await rbacApi.createUser(payload);
    expect(request.post).toHaveBeenCalledWith('/api/admin/rbac/users', payload);
    expect(created.id).toBe('3');
  });

  it('updateUser 应正确发送 PUT 请求', async () => {
    const payload = {
      displayName: '新名字',
      status: false,
    };
    vi.mocked(request.put).mockResolvedValueOnce({ id: '3', ...payload });

    const updated = await rbacApi.updateUser('3', payload);
    expect(request.put).toHaveBeenCalledWith('/api/admin/rbac/users/3', payload);
    expect(updated.displayName).toBe('新名字');
  });

  it('deleteUser 应正确发送 DELETE 请求', async () => {
    vi.mocked(request.delete).mockResolvedValueOnce(true);
    const success = await rbacApi.deleteUser('3');
    expect(request.delete).toHaveBeenCalledWith('/api/admin/rbac/users/3');
    expect(success).toBe(true);
  });
});

describe('rbacApi - 角色管理接口', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getRoles 应请求正确路径', async () => {
    vi.mocked(request.get).mockResolvedValueOnce({
      total: 0,
      pageNum: 1,
      pageSize: 20,
      list: [],
    });
    await rbacApi.getRoles({ roleCode: 'admin' });
    expect(request.get).toHaveBeenCalledWith('/api/admin/rbac/roles', {
      params: { roleCode: 'admin' },
    });
  });

  it('createRole 应正确调用 POST', async () => {
    const payload = { roleCode: 'auditor', roleName: '审计员', status: true };
    vi.mocked(request.post).mockResolvedValueOnce({ id: '10', ...payload });
    const res = await rbacApi.createRole(payload);
    expect(request.post).toHaveBeenCalledWith('/api/admin/rbac/roles', payload);
    expect(res.id).toBe('10');
  });

  it('updateRole 应正确调用 PUT', async () => {
    const payload = { roleCode: 'auditor', roleName: '高级审计员', status: true };
    vi.mocked(request.put).mockResolvedValueOnce({ id: '10', ...payload });
    const res = await rbacApi.updateRole('10', payload);
    expect(request.put).toHaveBeenCalledWith('/api/admin/rbac/roles/10', payload);
    expect(res.roleName).toBe('高级审计员');
  });

  it('deleteRole 应正确调用 DELETE', async () => {
    vi.mocked(request.delete).mockResolvedValueOnce(true);
    const res = await rbacApi.deleteRole('10');
    expect(request.delete).toHaveBeenCalledWith('/api/admin/rbac/roles/10');
    expect(res).toBe(true);
  });
});

describe('rbacApi - 权限项管理接口', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getPermissions 应保留 parentId 为 0 的参数', async () => {
    vi.mocked(request.get).mockResolvedValueOnce({
      total: 0,
      pageNum: 1,
      pageSize: 20,
      list: [],
    });
    await rbacApi.getPermissions({ parentId: '0' });
    expect(request.get).toHaveBeenCalledWith('/api/admin/rbac/permissions', {
      params: { parentId: '0' },
    });
  });

  it('createPermission 应正确调用 POST', async () => {
    const payload = {
      permCode: 'custom:order:view',
      permName: '订单查看',
      permType: 2,
      parentId: '0',
      status: true,
    };
    vi.mocked(request.post).mockResolvedValueOnce({ id: '100', ...payload });
    const res = await rbacApi.createPermission(payload);
    expect(request.post).toHaveBeenCalledWith('/api/admin/rbac/permissions', payload);
    expect(res.id).toBe('100');
  });

  it('updatePermission 应正确调用 PUT 且请求体不含 permCode', async () => {
    const payload = {
      permName: '修改后名称',
      permType: 2,
      parentId: '0',
      status: true,
    };
    vi.mocked(request.put).mockResolvedValueOnce({ id: '100', ...payload });
    const res = await rbacApi.updatePermission('100', payload);
    expect(request.put).toHaveBeenCalledWith('/api/admin/rbac/permissions/100', payload);
    expect((payload as Record<string, unknown>).permCode).toBeUndefined();
    expect(res.permName).toBe('修改后名称');
  });

  it('deletePermission 应正确调用 DELETE', async () => {
    vi.mocked(request.delete).mockResolvedValueOnce(true);
    const res = await rbacApi.deletePermission('100');
    expect(request.delete).toHaveBeenCalledWith('/api/admin/rbac/permissions/100');
    expect(res).toBe(true);
  });
});

describe('rbacApi - 关系授权接口', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getUserRoles 应获取用户所属角色 ID 列表', async () => {
    vi.mocked(request.get).mockResolvedValueOnce({ userId: '1', roleIds: ['10', '20'] });
    const res = await rbacApi.getUserRoles('1');
    expect(request.get).toHaveBeenCalledWith('/api/admin/rbac/users/1/roles');
    expect(res.roleIds).toEqual(['10', '20']);
  });

  it('grantUserRoles 全量替换用户角色', async () => {
    vi.mocked(request.put).mockResolvedValueOnce(true);
    const res = await rbacApi.grantUserRoles('1', ['10', '20']);
    expect(request.put).toHaveBeenCalledWith('/api/admin/rbac/users/1/roles', {
      roleIds: ['10', '20'],
    });
    expect(res).toBe(true);
  });

  it('grantUserRoles 支持空数组清空角色', async () => {
    vi.mocked(request.put).mockResolvedValueOnce(true);
    const res = await rbacApi.grantUserRoles('1', []);
    expect(request.put).toHaveBeenCalledWith('/api/admin/rbac/users/1/roles', {
      roleIds: [],
    });
    expect(res).toBe(true);
  });

  it('getRolePermissions 应获取角色所属权限 ID 列表', async () => {
    vi.mocked(request.get).mockResolvedValueOnce({
      roleId: '10',
      permissionIds: ['101', '102'],
    });
    const res = await rbacApi.getRolePermissions('10');
    expect(request.get).toHaveBeenCalledWith('/api/admin/rbac/roles/10/permissions');
    expect(res.permissionIds).toEqual(['101', '102']);
  });

  it('grantRolePermissions 全量替换角色权限', async () => {
    vi.mocked(request.put).mockResolvedValueOnce(true);
    const res = await rbacApi.grantRolePermissions('10', ['101', '102']);
    expect(request.put).toHaveBeenCalledWith('/api/admin/rbac/roles/10/permissions', {
      permissionIds: ['101', '102'],
    });
    expect(res).toBe(true);
  });
});

describe('buildPermissionTree - 权限树构建逻辑', () => {
  it('正确将平铺权限列表构建为层级树形结构', () => {
    const flatList = [
      {
        id: '1',
        permCode: 'system',
        permName: '系统管理',
        permType: 1,
        parentId: '0',
        path: '/system',
        method: null,
        status: true,
        systemManaged: true,
        createTime: '2026-09-15T00:00:00',
        updateTime: '2026-09-15T00:00:00',
      },
      {
        id: '2',
        permCode: 'system:user',
        permName: '用户菜单',
        permType: 2,
        parentId: '1',
        path: '/system/user',
        method: null,
        status: true,
        systemManaged: true,
        createTime: '2026-09-15T00:00:00',
        updateTime: '2026-09-15T00:00:00',
      },
      {
        id: '3',
        permCode: 'system:user:add',
        permName: '新增用户',
        permType: 3,
        parentId: '2',
        path: null,
        method: 'POST',
        status: true,
        systemManaged: true,
        createTime: '2026-09-15T00:00:00',
        updateTime: '2026-09-15T00:00:00',
      },
    ];

    const tree = buildPermissionTree(flatList);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe('1');
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children![0].id).toBe('2');
    expect(tree[0].children![0].children).toHaveLength(1);
    expect(tree[0].children![0].children![0].id).toBe('3');
    expect(tree[0].children![0].children![0].children).toBeUndefined(); // 叶子节点无空 children 属性
  });

  it('当父节点不存在时提升至顶层展示（保证数据不丢失）', () => {
    const orphanList = [
      {
        id: '10',
        permCode: 'orphan:btn',
        permName: '孤儿节点',
        permType: 3,
        parentId: '999', // 不存在
        path: null,
        method: null,
        status: true,
        systemManaged: false,
        createTime: '2026-09-15T00:00:00',
        updateTime: '2026-09-15T00:00:00',
      },
    ];

    const tree = buildPermissionTree(orphanList);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe('10');
  });
});
