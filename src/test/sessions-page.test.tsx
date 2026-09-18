import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { SessionsPage } from '@/pages/Sessions';
import { authApi } from '@/api/auth';
import { notifyError, notifySuccess } from '@/lib/toast';
import { useAuthStore } from '@/store/auth';
import type { AuthSessionDTO } from '@/api/types';

vi.mock('@/api/auth', () => ({
  authApi: {
    getSessions: vi.fn(),
    revokeSession: vi.fn(),
    logoutAll: vi.fn(),
  },
}));

vi.mock('@/lib/toast', () => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

function LocationTracker() {
  const location = useLocation();
  return <div data-testid="location-display">{location.pathname}</div>;
}

const mockSessions: AuthSessionDTO[] = [
  {
    sessionId: 'sess-current-01',
    clientType: 'admin-web',
    deviceId: 'dev-desktop-01',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Macintosh)',
    createdAt: '2026-09-18 10:00:00',
    expiresAt: '2026-09-18 18:00:00',
    current: true,
  },
  {
    sessionId: 'sess-other-02',
    clientType: 'mobile-app',
    deviceId: 'dev-mobile-02',
    ipAddress: '10.0.0.88',
    userAgent: 'DDD-Mobile/1.0.0 iOS',
    createdAt: '2026-09-17 12:00:00',
    expiresAt: '2026-09-18 12:00:00',
    current: false,
  },
];

function renderSessionsPage() {
  return render(
    <MemoryRouter initialEntries={['/sessions']}>
      <LocationTracker />
      <Routes>
        <Route path="/sessions" element={<SessionsPage />} />
        <Route path="/login" element={<div data-testid="login-view">登录页面</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SessionsPage (会话列表页)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().clear();
  });

  describe('列表渲染', () => {
    it('空数据场景：表格骨架屏结束并渲染「暂无数据」，页头信息正常展示', async () => {
      vi.mocked(authApi.getSessions).mockResolvedValueOnce([]);

      renderSessionsPage();

      // 验证页头信息
      expect(screen.getByText('我的会话')).toBeInTheDocument();
      expect(screen.getByText('查看已建立登录会话并可随时吊销非本设备登录')).toBeInTheDocument();

      // 等待骨架屏结束并渲染「暂无数据」
      await waitFor(() => {
        expect(screen.getByText('暂无数据')).toBeInTheDocument();
      });

      // 验证刷新与登出按钮存在且未被禁用
      expect(screen.getByRole('button', { name: '刷新' })).not.toBeDisabled();
      expect(screen.getByRole('button', { name: '登出全部会话' })).not.toBeDisabled();
    });

    it('有数据场景：渲染会话字段、状态徽章，区分当前设备（无吊销按钮）与其它终端（有吊销按钮）', async () => {
      vi.mocked(authApi.getSessions).mockResolvedValueOnce(mockSessions);

      renderSessionsPage();

      await waitFor(() => {
        expect(screen.getByText('admin-web')).toBeInTheDocument();
        expect(screen.getByText('mobile-app')).toBeInTheDocument();
      });

      // 验证 IP 与设备识别码渲染
      expect(screen.getByText('192.168.1.100')).toBeInTheDocument();
      expect(screen.getByText('dev-desktop-01')).toBeInTheDocument();
      expect(screen.getByText('10.0.0.88')).toBeInTheDocument();
      expect(screen.getByText('dev-mobile-02')).toBeInTheDocument();
      expect(screen.getByText('2026-09-18 10:00:00')).toBeInTheDocument();
      expect(screen.getByText('2026-09-17 12:00:00')).toBeInTheDocument();

      // 验证状态徽章
      expect(screen.getByText('当前设备')).toBeInTheDocument();
      expect(screen.getByText('其它终端')).toBeInTheDocument();

      // 验证操作列：当前设备行不提供吊销操作，只有 1 个「吊销」按钮对应其它终端
      const revokeButtons = screen.getAllByRole('button', { name: '吊销' });
      expect(revokeButtons).toHaveLength(1);
    });

    it('字段缺省场景：ipAddress、deviceId、createdAt 为 null 时降级展示「-」', async () => {
      const incompleteSession: AuthSessionDTO = {
        sessionId: 'sess-empty-fields',
        clientType: 'cli-tool',
        deviceId: '',
        ipAddress: '',
        userAgent: '',
        createdAt: '',
        expiresAt: '',
        current: false,
      };

      // 测试 null 或 undefined 的情况
      const sessionWithNulls = {
        ...incompleteSession,
        deviceId: undefined as unknown as string,
        ipAddress: undefined as unknown as string,
        createdAt: undefined as unknown as string,
      };

      vi.mocked(authApi.getSessions).mockResolvedValueOnce([sessionWithNulls]);

      renderSessionsPage();

      await waitFor(() => {
        expect(screen.getByText('cli-tool')).toBeInTheDocument();
      });

      // 缺省时渲染 '-'
      const dashElements = screen.getAllByText('-');
      expect(dashElements.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('加载失败后 loading 结束', () => {
    it('接口报错时捕获异常，loading 状态恢复为 false 且刷新按钮可用', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(authApi.getSessions).mockRejectedValueOnce(new Error('Network error 500'));

      renderSessionsPage();

      // 初始 loading 态下刷新按钮 disabled
      const refreshBtn = screen.getByRole('button', { name: '刷新' });

      await waitFor(() => {
        // loading 结束后刷新按钮恢复可用
        expect(refreshBtn).not.toBeDisabled();
        // 表格展示空状态「暂无数据」
        expect(screen.getByText('暂无数据')).toBeInTheDocument();
      });

      // 验证错误被记录
      expect(errorSpy).toHaveBeenCalledWith('获取会话列表失败', expect.any(Error));

      errorSpy.mockRestore();
    });
  });

  describe('撤销单个会话', () => {
    it('撤销单个会话成功：确认后调用接口、弹出成功通知并自动重新拉取会话列表', async () => {
      vi.mocked(authApi.getSessions)
        .mockResolvedValueOnce(mockSessions)
        .mockResolvedValueOnce([mockSessions[0]]);
      vi.mocked(authApi.revokeSession).mockResolvedValueOnce(null);

      renderSessionsPage();

      await waitFor(() => {
        expect(screen.getByText('dev-mobile-02')).toBeInTheDocument();
      });

      // 点击其它终端行的「吊销」按钮展开 ConfirmPopover
      const revokeTrigger = screen.getByRole('button', { name: '吊销' });
      fireEvent.click(revokeTrigger);

      // 等待 Popover 弹出
      const popoverTitle = await screen.findByText('确定要吊销该设备会话吗？');
      expect(popoverTitle).toBeInTheDocument();

      // 获取 Popover 内部的「吊销」确认按钮并点击
      const popoverContent = popoverTitle.closest<HTMLElement>('[data-slot="popover-content"]')!;
      const confirmOkBtn = within(popoverContent).getByRole('button', { name: '吊销' });
      fireEvent.click(confirmOkBtn);

      await waitFor(() => {
        expect(authApi.revokeSession).toHaveBeenCalledTimes(1);
        expect(authApi.revokeSession).toHaveBeenCalledWith('sess-other-02');
      });

      // 验证成功 toast 与刷新列表调用
      expect(notifySuccess).toHaveBeenCalledWith('已吊销该会话');
      expect(authApi.getSessions).toHaveBeenCalledTimes(2);
    });

    it('撤销单个会话失败：接口报错时捕获异常、弹出错误提示且不触发列表刷新', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(authApi.getSessions).mockResolvedValueOnce(mockSessions);
      vi.mocked(authApi.revokeSession).mockRejectedValueOnce(new Error('Revoke session failed'));

      renderSessionsPage();

      await waitFor(() => {
        expect(screen.getByText('dev-mobile-02')).toBeInTheDocument();
      });

      const revokeTrigger = screen.getByRole('button', { name: '吊销' });
      fireEvent.click(revokeTrigger);

      const popoverTitle = await screen.findByText('确定要吊销该设备会话吗？');
      const popoverContent = popoverTitle.closest<HTMLElement>('[data-slot="popover-content"]')!;
      const confirmOkBtn = within(popoverContent).getByRole('button', { name: '吊销' });
      fireEvent.click(confirmOkBtn);

      await waitFor(() => {
        expect(authApi.revokeSession).toHaveBeenCalledWith('sess-other-02');
      });

      expect(notifyError).toHaveBeenCalledWith('吊销会话失败');
      expect(errorSpy).toHaveBeenCalledWith('吊销会话失败', expect.any(Error));

      // 失败时不应触发重新拉取列表（仅初始的 1 次调用）
      expect(authApi.getSessions).toHaveBeenCalledTimes(1);

      errorSpy.mockRestore();
    });
  });

  describe('登出全部会话', () => {
    it('登出全部会话成功：确认后调用 logoutAll、提示成功、清空登录态并跳转至 /login', async () => {
      useAuthStore.getState().setToken({
        accessToken: 'valid-token',
        refreshToken: 'valid-refresh',
        tokenType: 'Bearer',
        expiresIn: 3600,
        refreshExpiresIn: 7200,
        sessionId: 'sess-current-01',
        userId: '1',
        accountId: '1',
        username: 'admin',
        userType: 'ADMIN_PRIMARY',
      });
      expect(useAuthStore.getState().isAuthenticated()).toBe(true);

      vi.mocked(authApi.getSessions).mockResolvedValueOnce(mockSessions);
      vi.mocked(authApi.logoutAll).mockResolvedValueOnce(null);

      renderSessionsPage();

      await waitFor(() => {
        expect(screen.getByText('admin-web')).toBeInTheDocument();
      });

      // 点击页头「登出全部会话」
      const logoutAllBtn = screen.getByRole('button', { name: '登出全部会话' });
      fireEvent.click(logoutAllBtn);

      // 等待 Popover 确认提示出现
      const confirmTitle =
        await screen.findByText('确定要强制登出全部会话吗？本设备也需重新登录。');
      expect(confirmTitle).toBeInTheDocument();

      // 点击「确定登出」
      const confirmBtn = screen.getByRole('button', { name: '确定登出' });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(authApi.logoutAll).toHaveBeenCalledTimes(1);
      });

      expect(notifySuccess).toHaveBeenCalledWith('已强制登出全部会话');
      // 登录态已被清空
      expect(useAuthStore.getState().accessToken).toBeNull();
      expect(useAuthStore.getState().isAuthenticated()).toBe(false);

      // 跳转至登录页
      await waitFor(() => {
        expect(screen.getByTestId('location-display')).toHaveTextContent('/login');
        expect(screen.getByTestId('login-view')).toBeInTheDocument();
      });
    });

    it('登出全部会话失败：报错时弹出错误提示且不清除本地登录态与路由', async () => {
      useAuthStore.getState().setToken({
        accessToken: 'valid-token',
        refreshToken: 'valid-refresh',
        tokenType: 'Bearer',
        expiresIn: 3600,
        refreshExpiresIn: 7200,
        sessionId: 'sess-current-01',
        userId: '1',
        accountId: '1',
        username: 'admin',
        userType: 'ADMIN_PRIMARY',
      });

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(authApi.getSessions).mockResolvedValueOnce(mockSessions);
      vi.mocked(authApi.logoutAll).mockRejectedValueOnce(new Error('Logout all failed'));

      renderSessionsPage();

      await waitFor(() => {
        expect(screen.getByText('admin-web')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: '登出全部会话' }));

      const confirmBtn = await screen.findByRole('button', { name: '确定登出' });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(authApi.logoutAll).toHaveBeenCalledTimes(1);
      });

      expect(notifyError).toHaveBeenCalledWith('登出全部会话失败');
      expect(errorSpy).toHaveBeenCalledWith('登出全部会话失败', expect.any(Error));

      // 本地状态不被清除，停留在 /sessions
      expect(useAuthStore.getState().accessToken).toBe('valid-token');
      expect(screen.getByTestId('location-display')).toHaveTextContent('/sessions');

      errorSpy.mockRestore();
    });
  });

  describe('手动刷新', () => {
    it('点击「刷新」按钮后重新调用 getSessions 接口', async () => {
      vi.mocked(authApi.getSessions).mockResolvedValue(mockSessions);

      renderSessionsPage();

      await waitFor(() => {
        expect(authApi.getSessions).toHaveBeenCalledTimes(1);
      });

      const refreshBtn = screen.getByRole('button', { name: '刷新' });
      fireEvent.click(refreshBtn);

      await waitFor(() => {
        expect(authApi.getSessions).toHaveBeenCalledTimes(2);
      });
    });
  });
});
