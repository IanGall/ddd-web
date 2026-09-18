import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UserListPage } from '@/pages/rbac/users';
import { RoleListPage } from '@/pages/rbac/roles';
import { PermissionListPage } from '@/pages/rbac/permissions';
import { useAuthStore } from '@/store/auth';
import { rbacApi } from '@/api/rbac';

vi.mock('@/api/rbac', () => ({
  rbacApi: {
    getUsers: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
    deleteUser: vi.fn(),
    getRoles: vi.fn(),
    createRole: vi.fn(),
    updateRole: vi.fn(),
    deleteRole: vi.fn(),
    getPermissions: vi.fn(),
    createPermission: vi.fn(),
    updatePermission: vi.fn(),
    deletePermission: vi.fn(),
    getUserRoles: vi.fn(),
    grantUserRoles: vi.fn(),
    getRolePermissions: vi.fn(),
    grantRolePermissions: vi.fn(),
  },
}));

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={ui} />
          <Route path="/403" element={<div>403 无权访问</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('UserListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().clear();
  });

  it('当没有 rbac:user:read 权限时重定向至 403', () => {
    useAuthStore.getState().setPermissionCodes([]);
    renderWithProviders(<UserListPage />);
    expect(screen.getByText('403 无权访问')).toBeInTheDocument();
  });

  it('具备 rbac:user:read 时展示用户管理列表', async () => {
    useAuthStore.getState().setPermissionCodes(['rbac:user:read']);
    vi.mocked(rbacApi.getUsers).mockResolvedValueOnce({
      total: 1,
      pageNum: 1,
      pageSize: 20,
      list: [
        {
          id: '1',
          accountId: '10',
          username: 'user_test',
          displayName: '测试用户',
          status: true,
          createTime: '2026-09-15T10:00:00',
          email: null,
          mobile: null,
          updateTime: '2026-09-15T10:00:00',
        },
      ],
    });

    renderWithProviders(<UserListPage />);
    expect(screen.getByText('用户管理')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('user_test')).toBeInTheDocument();
    });
  });

  it('按钮级权限控制：仅具备 rbac:user:create 时展示新增按钮', async () => {
    vi.mocked(rbacApi.getUsers).mockResolvedValue({
      total: 0,
      pageNum: 1,
      pageSize: 20,
      list: [],
    });

    // 仅有 read，无 create
    useAuthStore.getState().setPermissionCodes(['rbac:user:read']);
    const { rerender } = renderWithProviders(<UserListPage />);
    expect(screen.queryByText('新增用户')).not.toBeInTheDocument();

    // 补充 create 权限
    useAuthStore.getState().setPermissionCodes(['rbac:user:read', 'rbac:user:create']);
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <UserListPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('新增用户')).toBeInTheDocument();
  });
});

describe('RoleListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().clear();
  });

  it('当没有 rbac:role:read 权限时重定向至 403', () => {
    useAuthStore.getState().setPermissionCodes([]);
    renderWithProviders(<RoleListPage />);
    expect(screen.getByText('403 无权访问')).toBeInTheDocument();
  });

  it('具备 rbac:role:read 时展示角色管理列表', async () => {
    useAuthStore.getState().setPermissionCodes(['rbac:role:read']);
    vi.mocked(rbacApi.getRoles).mockResolvedValueOnce({
      total: 1,
      pageNum: 1,
      pageSize: 20,
      list: [
        {
          id: '1',
          roleCode: 'admin_role',
          roleName: '运维管理员',
          roleDesc: '运维管理角色',
          status: true,
          createTime: '2026-09-15T10:00:00',
          updateTime: '2026-09-15T10:00:00',
        },
      ],
    });

    renderWithProviders(<RoleListPage />);
    expect(screen.getByText('角色管理')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('admin_role')).toBeInTheDocument();
      expect(screen.getByText('运维管理员')).toBeInTheDocument();
    });
  });
});

describe('PermissionListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().clear();
  });

  it('当没有 rbac:permission:read 权限时重定向至 403', () => {
    useAuthStore.getState().setPermissionCodes([]);
    renderWithProviders(<PermissionListPage />);
    expect(screen.getByText('403 无权访问')).toBeInTheDocument();
  });

  it('systemManaged=true 的权限删除按钮置灰禁用', async () => {
    useAuthStore.getState().setPermissionCodes(['rbac:permission:read', 'rbac:permission:delete']);
    vi.mocked(rbacApi.getPermissions).mockResolvedValueOnce({
      total: 1,
      pageNum: 1,
      pageSize: 50,
      list: [
        {
          id: '1',
          permCode: 'rbac:user:read',
          permName: '查看用户',
          permType: 2,
          parentId: '0',
          status: true,
          systemManaged: true, // 系统内置
          createTime: '2026-09-15T10:00:00',
          updateTime: '2026-09-15T10:00:00',
          path: null,
          method: null,
        },
      ],
    });

    renderWithProviders(<PermissionListPage />);

    await waitFor(() => {
      expect(screen.getByText('查看用户')).toBeInTheDocument();
      expect(screen.getByText('内置')).toBeInTheDocument();
    });

    // 寻找表格中的删除按钮，验证其为 disabled 状态
    const deleteBtn = screen.getByRole('button', { name: '删除' });
    expect(deleteBtn).toBeDisabled();
  });
});
