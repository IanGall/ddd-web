import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardPage } from '@/pages/Dashboard';
import { useAuthStore } from '@/store/auth';
import { channelApi } from '@/api/channel';
import { authApi } from '@/api/auth';
import { request } from '@/api/client';
import { ApiError, ResponseCode } from '@/api/types';

vi.mock('@/api/channel', () => ({
  channelApi: {
    list: vi.fn(),
  },
}));

vi.mock('@/api/auth', () => ({
  authApi: {
    getStatus: vi.fn(),
    getSessions: vi.fn(),
  },
}));

vi.mock('@/api/client', () => ({
  request: {
    get: vi.fn(),
  },
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

describe('DashboardPage 统计卡片与安全契约', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().clear();

    vi.mocked(authApi.getStatus).mockResolvedValue({
      application: 'ian-ddd-gateway',
      status: 'UP',
    });

    vi.mocked(authApi.getSessions).mockResolvedValue([
      {
        sessionId: 'sess-1',
        clientType: 'web',
        deviceId: 'dev-1',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        createdAt: '2026-09-15T12:00:00Z',
        expiresAt: '2026-09-15T14:00:00Z',
        current: true,
      },
    ]);
  });

  it('文案不得包含内部开发任务编号（如 FE-W1 ~ FE-W5），权限项 Tag 直接展示真实数量', async () => {
    useAuthStore.getState().setToken({
      accessToken: 'token-admin',
      refreshToken: 'refresh-admin',
      tokenType: 'Bearer',
      expiresIn: 3600,
      refreshExpiresIn: 7200,
      sessionId: 'sess-admin',
      userId: '1',
      accountId: '100',
      username: 'admin_root',
      userType: 'ADMIN_PRIMARY',
    });
    useAuthStore.getState().setPermissionCodes(['rbac:user:read', 'rbac:role:read']);

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // 验证内部任务编号不出现
    expect(screen.queryByText(/FE-W1/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/FE-W5/i)).not.toBeInTheDocument();

    // 验证权限项 Tag 直接展示服务端实际条目数
    expect(screen.getByText('当前有效权限项: 2 项')).toBeInTheDocument();
    // 验证主账号不再硬编码显示“全部 (主账号放行)”
    expect(screen.queryByText(/全部 \(主账号放行\)/i)).not.toBeInTheDocument();
  });

  it('当主体无 rbac:channel-credential:read 权限时，跳过渠道卡片请求（不发起请求，卡片显示 -）', async () => {
    useAuthStore.getState().setToken({
      accessToken: 'sub-token',
      refreshToken: 'sub-refresh',
      tokenType: 'Bearer',
      expiresIn: 3600,
      refreshExpiresIn: 7200,
      sessionId: 'sess-sub',
      userId: '2',
      accountId: '100',
      username: 'sub_user',
      userType: 'ADMIN_SUB_ACCOUNT',
    });
    // 不包含 rbac:channel-credential:read
    useAuthStore.getState().setPermissionCodes(['rbac:user:read']);

    vi.mocked(request.get).mockImplementation(async (url) => {
      if (url === '/api/admin/rbac/users') {
        return { total: 42, pageNum: 1, pageSize: 1, list: [] };
      }
      return { total: 0, pageNum: 1, pageSize: 1, list: [] };
    });

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    // 关键校验：channelApi.list 绝对未被调用，避免必然 403
    expect(channelApi.list).not.toHaveBeenCalled();

    // 渠道凭证卡片副标题显示 “无读取权限”
    expect(screen.getAllByText('无读取权限').length).toBeGreaterThanOrEqual(1);
  });

  it('当主体有权限且渠道统计成功时，显示渠道 total 数', async () => {
    useAuthStore.getState().setToken({
      accessToken: 'sub-token',
      refreshToken: 'sub-refresh',
      tokenType: 'Bearer',
      expiresIn: 3600,
      refreshExpiresIn: 7200,
      sessionId: 'sess-sub',
      userId: '2',
      accountId: '100',
      username: 'sub_user',
      userType: 'ADMIN_SUB_ACCOUNT',
    });
    useAuthStore.getState().setPermissionCodes(['rbac:channel-credential:read']);

    vi.mocked(channelApi.list).mockResolvedValueOnce({
      total: 18,
      pageNum: 1,
      pageSize: 1,
      list: [],
    });

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('18')).toBeInTheDocument();
    });

    expect(channelApi.list).toHaveBeenCalledWith(
      { pageNum: 1, pageSize: 1 },
      { skipGlobalNotice: true },
    );
  });

  it('任一统计接口调用失败时（如 500），只在该卡片展示 - 且整页与其他卡片正常展示，不发生崩溃', async () => {
    useAuthStore.getState().setToken({
      accessToken: 'admin-token',
      refreshToken: 'admin-refresh',
      tokenType: 'Bearer',
      expiresIn: 3600,
      refreshExpiresIn: 7200,
      sessionId: 'sess-1',
      userId: '1',
      accountId: '1',
      username: 'root',
      userType: 'ADMIN_PRIMARY',
    });
    useAuthStore
      .getState()
      .setPermissionCodes([
        'rbac:user:read',
        'rbac:role:read',
        'rbac:permission:read',
        'rbac:channel-credential:read',
      ]);

    // 模拟 users 接口故障，其它接口正常
    vi.mocked(request.get).mockImplementation(async (url) => {
      if (url === '/api/admin/rbac/users') {
        throw new ApiError({
          code: ResponseCode.INTERNAL_ERROR,
          info: '数据库连接池耗尽',
          status: 500,
        });
      }
      if (url === '/api/admin/rbac/roles') {
        return { total: 5, pageNum: 1, pageSize: 1, list: [] };
      }
      if (url === '/api/admin/rbac/permissions') {
        return { total: 21, pageNum: 1, pageSize: 1, list: [] };
      }
      return { total: 0, pageNum: 1, pageSize: 1, list: [] };
    });

    vi.mocked(channelApi.list).mockResolvedValueOnce({
      total: 9,
      pageNum: 1,
      pageSize: 1,
      list: [],
    });

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      // 其它卡片正常渲染
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('21')).toBeInTheDocument();
      expect(screen.getByText('9')).toBeInTheDocument();
    });

    // 用户总数卡片未崩溃，展示为 -
    expect(screen.getByText('用户总数')).toBeInTheDocument();
  });
});
