import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useLogout } from '@/hooks/useLogout';
import { useAuthStore } from '@/store/auth';
import { authApi } from '@/api/auth';
import type { TokenResponse } from '@/api/types';

// Mock window.matchMedia for Ant Design in jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

vi.mock('@/api/auth', () => ({
  authApi: {
    logout: vi.fn(),
  },
}));

const mockToken: TokenResponse = {
  accessToken: 'test-access-token',
  refreshToken: 'test-refresh-token',
  tokenType: 'Bearer',
  expiresIn: 3600,
  refreshExpiresIn: 7200,
  sessionId: 'test-session',
  userId: '100',
  accountId: '200',
  username: 'admin',
  userType: 'ADMIN_PRIMARY',
};

function TestLogoutConsumer() {
  const { logout, loading } = useLogout();
  return (
    <div>
      <button onClick={() => void logout()}>退出登录按钮</button>
      <span data-testid="loading-status">{loading ? 'loading' : 'idle'}</span>
    </div>
  );
}

function LocationTracker() {
  const location = useLocation();
  return <div data-testid="current-location">{location.pathname}</div>;
}

function renderWithRouter(initialEntry = '/dashboard') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <LocationTracker />
      <TestLogoutConsumer />
      <Routes>
        <Route path="/dashboard" element={<div>控制台概览页面</div>} />
        <Route path="/login" element={<div data-testid="login-view">登录页</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('useLogout 统一登出 Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().clear();
  });

  it('1. authApi.logout() 成功后 → 登录态被清空、跳转到 /login', async () => {
    useAuthStore.getState().setToken(mockToken);
    expect(useAuthStore.getState().isAuthenticated()).toBe(true);

    vi.mocked(authApi.logout).mockResolvedValueOnce(null);

    renderWithRouter();
    expect(screen.getByTestId('current-location')).toHaveTextContent('/dashboard');

    fireEvent.click(screen.getByRole('button', { name: '退出登录按钮' }));

    await waitFor(() => {
      expect(screen.getByTestId('current-location')).toHaveTextContent('/login');
    });

    expect(authApi.logout).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().isAuthenticated()).toBe(false);
    expect(screen.getByTestId('login-view')).toBeInTheDocument();
  });

  it('2. authApi.logout() reject → 仍然清空登录态并跳转 /login，且不抛出', async () => {
    useAuthStore.getState().setToken(mockToken);
    expect(useAuthStore.getState().isAuthenticated()).toBe(true);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(authApi.logout).mockRejectedValueOnce(new Error('Network error 500'));

    renderWithRouter();
    expect(screen.getByTestId('current-location')).toHaveTextContent('/dashboard');

    fireEvent.click(screen.getByRole('button', { name: '退出登录按钮' }));

    await waitFor(() => {
      expect(screen.getByTestId('current-location')).toHaveTextContent('/login');
    });

    expect(authApi.logout).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      '退出登录接口调用失败，直接清理本地状态',
      expect.any(Error),
    );
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().isAuthenticated()).toBe(false);
    expect(screen.getByTestId('login-view')).toBeInTheDocument();

    warnSpy.mockRestore();
  });

  it('3. loading 状态在退出调用期间为 true，完成后恢复 false', async () => {
    let resolveLogout!: (value: null) => void;
    const logoutPromise = new Promise<null>((resolve) => {
      resolveLogout = resolve;
    });
    vi.mocked(authApi.logout).mockReturnValueOnce(logoutPromise);

    renderWithRouter();
    expect(screen.getByTestId('loading-status')).toHaveTextContent('idle');

    fireEvent.click(screen.getByRole('button', { name: '退出登录按钮' }));

    // 调用等待期间 loading 状态为 true
    await waitFor(() => {
      expect(screen.getByTestId('loading-status')).toHaveTextContent('loading');
    });

    // 完成异步操作
    await act(async () => {
      resolveLogout(null);
    });

    // 完成后 loading 恢复 idle，路由已到达 /login
    await waitFor(() => {
      expect(screen.getByTestId('loading-status')).toHaveTextContent('idle');
      expect(screen.getByTestId('current-location')).toHaveTextContent('/login');
    });
  });
});
