import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RolePermissionModal } from '@/pages/rbac/roles/RolePermissionModal';
import { rbacApi, type RbacPermissionDTO, type RbacRoleDTO } from '@/api/rbac';
import { authApi } from '@/api/auth';
import { ApiError, ResponseCode } from '@/api/types';

vi.mock('@/api/rbac', () => ({
  rbacApi: {
    getPermissions: vi.fn(),
    getRolePermissions: vi.fn(),
    grantRolePermissions: vi.fn(),
  },
}));

vi.mock('@/api/auth', () => ({
  authApi: {
    getPermissions: vi.fn(),
  },
}));

describe('RolePermissionModal (RBAC 角色权限分配弹窗)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(authApi.getPermissions).mockResolvedValue([]);
  });

  const mockRole: RbacRoleDTO = {
    id: 'role_01',
    roleCode: 'dept_manager',
    roleName: '部门经理',
    roleDesc: '管理部门日常权限',
    status: true,
    createTime: '2026-09-15T10:00:00',
    updateTime: '2026-09-15T10:00:00',
  };

  const mockPermissions: RbacPermissionDTO[] = [
    {
      id: '1',
      permCode: 'sys:manage',
      permName: '系统管理',
      permType: 1,
      parentId: '0',
      path: null,
      method: null,
      status: true,
      systemManaged: true,
      createTime: '2026-09-15T10:00:00',
      updateTime: '2026-09-15T10:00:00',
    },
    {
      id: '2',
      permCode: 'sys:user:list',
      permName: '用户管理',
      permType: 2,
      parentId: '1',
      path: '/users',
      method: null,
      status: true,
      systemManaged: false,
      createTime: '2026-09-15T10:00:00',
      updateTime: '2026-09-15T10:00:00',
    },
  ];

  it('提交成功路径 - 加载权限树并勾选保存，调用 grantRolePermissions 与 refreshPermissions，触发 onSuccess', async () => {
    const handleSuccess = vi.fn();
    const handleClose = vi.fn();

    vi.mocked(rbacApi.getPermissions).mockResolvedValueOnce({
      total: 2,
      pageNum: 1,
      pageSize: 100,
      list: mockPermissions,
    });
    vi.mocked(rbacApi.getRolePermissions).mockResolvedValueOnce({
      roleId: 'role_01',
      permissionIds: ['2'],
    });
    vi.mocked(rbacApi.grantRolePermissions).mockResolvedValueOnce(true);
    vi.mocked(authApi.getPermissions).mockResolvedValueOnce(['sys:manage', 'sys:user:list']);

    render(
      <RolePermissionModal
        open={true}
        role={mockRole}
        onClose={handleClose}
        onSuccess={handleSuccess}
      />,
    );

    expect(
      screen.getByRole('heading', { name: /分配权限 - 部门经理 \(dept_manager\)/i }),
    ).toBeInTheDocument();

    // 等待权限加载完毕并渲染
    await waitFor(() => {
      expect(screen.getByText('系统管理')).toBeInTheDocument();
      expect(screen.getByText('用户管理')).toBeInTheDocument();
    });

    // 点击「全选」
    const selectAllBtn = screen.getByRole('button', { name: '全选' });
    fireEvent.click(selectAllBtn);

    // 点击保存授权
    const saveBtn = screen.getByRole('button', { name: '保存授权' });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(rbacApi.grantRolePermissions).toHaveBeenCalledTimes(1);
      const [roleId, permIds] = vi.mocked(rbacApi.grantRolePermissions).mock.calls[0];
      expect(roleId).toBe('role_01');
      expect(permIds).toContain('1');
      expect(permIds).toContain('2');
      // 契约硬约束：成功后刷新主体权限缓存
      expect(authApi.getPermissions).toHaveBeenCalledTimes(1);
      expect(handleSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it('提交成功路径 - 点击清空后保存，向接口传递空数组全量清空权限', async () => {
    const handleSuccess = vi.fn();

    vi.mocked(rbacApi.getPermissions).mockResolvedValueOnce({
      total: 2,
      pageNum: 1,
      pageSize: 100,
      list: mockPermissions,
    });
    vi.mocked(rbacApi.getRolePermissions).mockResolvedValueOnce({
      roleId: 'role_01',
      permissionIds: ['1', '2'],
    });
    vi.mocked(rbacApi.grantRolePermissions).mockResolvedValueOnce(true);

    render(
      <RolePermissionModal
        open={true}
        role={mockRole}
        onClose={vi.fn()}
        onSuccess={handleSuccess}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('系统管理')).toBeInTheDocument();
    });

    // 点击「清空」
    const clearAllBtn = screen.getByRole('button', { name: '清空' });
    fireEvent.click(clearAllBtn);

    // 保存
    const saveBtn = screen.getByRole('button', { name: '保存授权' });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(rbacApi.grantRolePermissions).toHaveBeenCalledWith('role_01', []);
      expect(handleSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it('提交失败路径 - 接口报错 INVALID_ARGUMENT 时在 Alert 中展示错误信息', async () => {
    const handleSuccess = vi.fn();

    vi.mocked(rbacApi.getPermissions).mockResolvedValueOnce({
      total: 2,
      pageNum: 1,
      pageSize: 100,
      list: mockPermissions,
    });
    vi.mocked(rbacApi.getRolePermissions).mockResolvedValueOnce({
      roleId: 'role_01',
      permissionIds: ['2'],
    });
    vi.mocked(rbacApi.grantRolePermissions).mockRejectedValueOnce(
      new ApiError({
        code: ResponseCode.INVALID_ARGUMENT,
        info: '包含非法权限项或不存在的权限',
      }),
    );

    render(
      <RolePermissionModal
        open={true}
        role={mockRole}
        onClose={vi.fn()}
        onSuccess={handleSuccess}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('用户管理')).toBeInTheDocument();
    });

    const saveBtn = screen.getByRole('button', { name: '保存授权' });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText('包含非法权限项或不存在的权限')).toBeInTheDocument();
    });

    expect(handleSuccess).not.toHaveBeenCalled();
    expect(saveBtn).not.toBeDisabled();
  });

  it('提交失败路径 - 接口抛出通用异常时展示错误信息且 loading 结束', async () => {
    const handleSuccess = vi.fn();

    vi.mocked(rbacApi.getPermissions).mockResolvedValueOnce({
      total: 2,
      pageNum: 1,
      pageSize: 100,
      list: mockPermissions,
    });
    vi.mocked(rbacApi.getRolePermissions).mockResolvedValueOnce({
      roleId: 'role_01',
      permissionIds: [],
    });
    vi.mocked(rbacApi.grantRolePermissions).mockRejectedValueOnce(new Error('网络传输超时'));

    render(
      <RolePermissionModal
        open={true}
        role={mockRole}
        onClose={vi.fn()}
        onSuccess={handleSuccess}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('系统管理')).toBeInTheDocument();
    });

    const saveBtn = screen.getByRole('button', { name: '保存授权' });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText('网络传输超时')).toBeInTheDocument();
    });

    expect(handleSuccess).not.toHaveBeenCalled();
    expect(saveBtn).not.toBeDisabled();
  });

  it('业务校验拦截 - 分配权限数量超过 500 时拦截请求并提示', async () => {
    const oversizedPermissions = Array.from({ length: 501 }, (_, i) => ({
      id: `p_${i + 1}`,
      permCode: `perm:${i + 1}`,
      permName: `权限_${i + 1}`,
      permType: 3,
      parentId: '0',
      path: null,
      method: null,
      status: true,
      systemManaged: false,
      createTime: '2026-09-15T10:00:00',
      updateTime: '2026-09-15T10:00:00',
    }));

    vi.mocked(rbacApi.getPermissions).mockResolvedValueOnce({
      total: 501,
      pageNum: 1,
      pageSize: 100,
      list: oversizedPermissions,
    });
    vi.mocked(rbacApi.getRolePermissions).mockResolvedValueOnce({
      roleId: 'role_01',
      permissionIds: oversizedPermissions.map((p) => p.id),
    });

    render(
      <RolePermissionModal open={true} role={mockRole} onClose={vi.fn()} onSuccess={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText('权限_1')).toBeInTheDocument();
    });

    // 点击保存授权
    const saveBtn = screen.getByRole('button', { name: '保存授权' });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText('分配权限项数量不得超过 500 个')).toBeInTheDocument();
    });

    expect(rbacApi.grantRolePermissions).not.toHaveBeenCalled();
  });

  it('关闭后重开时状态复位 - 清除错误提示并重新拉取权限树与角色权限', async () => {
    vi.mocked(rbacApi.getPermissions).mockResolvedValue({
      total: 2,
      pageNum: 1,
      pageSize: 100,
      list: mockPermissions,
    });
    vi.mocked(rbacApi.getRolePermissions).mockResolvedValue({
      roleId: 'role_01',
      permissionIds: ['2'],
    });
    vi.mocked(rbacApi.grantRolePermissions).mockRejectedValueOnce(
      new ApiError({
        code: ResponseCode.INVALID_ARGUMENT,
        info: '校验失败错误',
      }),
    );

    const { rerender } = render(
      <RolePermissionModal open={true} role={mockRole} onClose={vi.fn()} onSuccess={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText('用户管理')).toBeInTheDocument();
    });

    // 触发错误
    fireEvent.click(screen.getByRole('button', { name: '保存授权' }));
    await waitFor(() => {
      expect(screen.getByText('校验失败错误')).toBeInTheDocument();
    });

    // 关闭弹窗
    rerender(
      <RolePermissionModal open={false} role={mockRole} onClose={vi.fn()} onSuccess={vi.fn()} />,
    );

    // 重新打开弹窗
    rerender(
      <RolePermissionModal open={true} role={mockRole} onClose={vi.fn()} onSuccess={vi.fn()} />,
    );

    // 错误信息被清除
    expect(screen.queryByText('校验失败错误')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(rbacApi.getRolePermissions).toHaveBeenCalledTimes(2);
    });
  });

  it('权限树工具按钮 - 支持折叠与展开控制', async () => {
    vi.mocked(rbacApi.getPermissions).mockResolvedValueOnce({
      total: 2,
      pageNum: 1,
      pageSize: 100,
      list: mockPermissions,
    });
    vi.mocked(rbacApi.getRolePermissions).mockResolvedValueOnce({
      roleId: 'role_01',
      permissionIds: [],
    });

    render(
      <RolePermissionModal open={true} role={mockRole} onClose={vi.fn()} onSuccess={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText('系统管理')).toBeInTheDocument();
    });

    const collapseBtn = screen.getByText('折叠', { selector: 'button' });
    const expandBtn = screen.getByText('展开', { selector: 'button' });

    fireEvent.click(collapseBtn);
    fireEvent.click(expandBtn);
  });

  it('点击取消按钮调用 onClose 回调', async () => {
    const handleClose = vi.fn();
    vi.mocked(rbacApi.getPermissions).mockResolvedValueOnce({
      total: 0,
      pageNum: 1,
      pageSize: 100,
      list: [],
    });
    vi.mocked(rbacApi.getRolePermissions).mockResolvedValueOnce({
      roleId: 'role_01',
      permissionIds: [],
    });

    render(
      <RolePermissionModal open={true} role={mockRole} onClose={handleClose} onSuccess={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText('暂无可选权限项')).toBeInTheDocument();
    });

    const cancelBtn = screen.getByRole('button', { name: '取消' });
    fireEvent.click(cancelBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
