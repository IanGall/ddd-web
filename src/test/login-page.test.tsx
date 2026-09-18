import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { LoginPage } from '@/pages/Login';
import { authApi } from '@/api/auth';
import { useAuthStore } from '@/store/auth';
import { ApiError, ResponseCode, type TokenResponse } from '@/api/types';

vi.mock('@/api/auth', () => ({
  authApi: {
    login: vi.fn(),
    getPermissions: vi.fn(),
  },
}));

function LocationTracker() {
  const location = useLocation();
  return <div data-testid="location-display">{location.pathname}</div>;
}

const mockTokenSuccess: TokenResponse = {
  accessToken: 'test-access-token-123',
  refreshToken: 'test-refresh-token-456',
  tokenType: 'Bearer',
  expiresIn: 3600,
  refreshExpiresIn: 7200,
  sessionId: 'test-session-001',
  userId: '1001',
  accountId: '2001',
  username: 'admin',
  userType: 'ADMIN_PRIMARY',
};

function renderLoginPage(
  initialEntries: Array<string | { pathname: string; state?: unknown }> = ['/login'],
) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <LocationTracker />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<div data-testid="dashboard-view">控制台首页</div>} />
        <Route
          path="/platform/channel-credentials"
          element={<div data-testid="channel-view">渠道凭证管理页面</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('LoginPage (登录页)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().clear();
  });

  describe('页面渲染', () => {
    it('正常渲染页面标题、描述、表单输入项及提交按钮', () => {
      renderLoginPage();

      // 验证控制台卡片标题与副标题
      expect(screen.getByText('管理端控制台')).toBeInTheDocument();
      expect(screen.getByText('领域驱动架构基础认证体系')).toBeInTheDocument();

      // 验证输入框及其占位符
      const accountInput = screen.getByPlaceholderText('管理员账号 / 登录名');
      expect(accountInput).toBeInTheDocument();
      expect(accountInput).toHaveValue('');

      const passwordInput = screen.getByPlaceholderText('密码');
      expect(passwordInput).toBeInTheDocument();
      expect(passwordInput).toHaveAttribute('type', 'password');
      expect(passwordInput).toHaveValue('');

      // 验证登录按钮初始可用且无旋转指示器
      const submitBtn = screen.getByRole('button', { name: '登 录' });
      expect(submitBtn).toBeInTheDocument();
      expect(submitBtn).not.toBeDisabled();

      // 初始无错误提示
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('表单校验拦截', () => {
    it('空账号与空密码提交时拦截请求并展示对应提示', async () => {
      renderLoginPage();

      const submitBtn = screen.getByRole('button', { name: '登 录' });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText('请输入管理员账号')).toBeInTheDocument();
        expect(screen.getByText('请输入密码')).toBeInTheDocument();
      });

      expect(authApi.login).not.toHaveBeenCalled();
    });

    it('仅输入账号但密码为空时拦截请求并提示「请输入密码」', async () => {
      renderLoginPage();

      fireEvent.change(screen.getByPlaceholderText('管理员账号 / 登录名'), {
        target: { value: 'admin' },
      });

      fireEvent.click(screen.getByRole('button', { name: '登 录' }));

      await waitFor(() => {
        expect(screen.getByText('请输入密码')).toBeInTheDocument();
      });

      expect(screen.queryByText('请输入管理员账号')).not.toBeInTheDocument();
      expect(authApi.login).not.toHaveBeenCalled();
    });

    it('仅输入密码但账号为空时拦截请求并提示「请输入管理员账号」', async () => {
      renderLoginPage();

      fireEvent.change(screen.getByPlaceholderText('密码'), {
        target: { value: 'validPassword123' },
      });

      fireEvent.click(screen.getByRole('button', { name: '登 录' }));

      await waitFor(() => {
        expect(screen.getByText('请输入管理员账号')).toBeInTheDocument();
      });

      expect(screen.queryByText('请输入密码')).not.toBeInTheDocument();
      expect(authApi.login).not.toHaveBeenCalled();
    });

    it('密码长度少于 8 位时拦截请求并提示「密码长度为 8~72 位」', async () => {
      renderLoginPage();

      fireEvent.change(screen.getByPlaceholderText('管理员账号 / 登录名'), {
        target: { value: 'admin' },
      });
      fireEvent.change(screen.getByPlaceholderText('密码'), {
        target: { value: 'short1' }, // 6 位
      });

      fireEvent.click(screen.getByRole('button', { name: '登 录' }));

      await waitFor(() => {
        expect(screen.getByText('密码长度为 8~72 位')).toBeInTheDocument();
      });

      expect(authApi.login).not.toHaveBeenCalled();
    });

    it('密码长度超过 72 位时拦截请求并提示「密码长度为 8~72 位」', async () => {
      renderLoginPage();

      fireEvent.change(screen.getByPlaceholderText('管理员账号 / 登录名'), {
        target: { value: 'admin' },
      });
      fireEvent.change(screen.getByPlaceholderText('密码'), {
        target: { value: 'A'.repeat(73) }, // 73 位
      });

      fireEvent.click(screen.getByRole('button', { name: '登 录' }));

      await waitFor(() => {
        expect(screen.getByText('密码长度为 8~72 位')).toBeInTheDocument();
      });

      expect(authApi.login).not.toHaveBeenCalled();
    });
  });

  describe('提交成功后的跳转与状态变化', () => {
    it('登录成功后写入 Zustand 登录态、拉取权限码并默认跳转至 /dashboard', async () => {
      vi.mocked(authApi.login).mockResolvedValueOnce(mockTokenSuccess);
      vi.mocked(authApi.getPermissions).mockResolvedValueOnce(['rbac:user:read', 'rbac:role:read']);

      renderLoginPage();

      // 输入合法凭据（测试账号前后带空格，验证 trim 逻辑）
      fireEvent.change(screen.getByPlaceholderText('管理员账号 / 登录名'), {
        target: { value: '  admin  ' },
      });
      fireEvent.change(screen.getByPlaceholderText('密码'), {
        target: { value: 'password123' },
      });

      fireEvent.click(screen.getByRole('button', { name: '登 录' }));

      // 验证 login 接口调用参数
      await waitFor(() => {
        expect(authApi.login).toHaveBeenCalledTimes(1);
      });

      const currentDeviceId = useAuthStore.getState().deviceId;
      expect(authApi.login).toHaveBeenCalledWith({
        loginName: 'admin',
        password: 'password123',
        clientType: 'admin-web',
        deviceId: currentDeviceId,
      });

      // 验证 token 写入 Zustand 内存状态
      expect(useAuthStore.getState().accessToken).toBe('test-access-token-123');
      expect(useAuthStore.getState().username).toBe('admin');
      expect(useAuthStore.getState().isAuthenticated()).toBe(true);

      // 验证拉取有效权限码并写入 store
      await waitFor(() => {
        expect(authApi.getPermissions).toHaveBeenCalledTimes(1);
      });
      expect(useAuthStore.getState().permissionCodes).toEqual(['rbac:user:read', 'rbac:role:read']);

      // 验证默认路由跳转至 /dashboard
      await waitFor(() => {
        expect(screen.getByTestId('location-display')).toHaveTextContent('/dashboard');
        expect(screen.getByTestId('dashboard-view')).toBeInTheDocument();
      });
    });

    it('当 location.state 携带来源路径时，登录成功后跳转至该来源路径', async () => {
      vi.mocked(authApi.login).mockResolvedValueOnce(mockTokenSuccess);
      vi.mocked(authApi.getPermissions).mockResolvedValueOnce(['rbac:channel-credential:read']);

      renderLoginPage([
        {
          pathname: '/login',
          state: {
            from: {
              pathname: '/platform/channel-credentials',
            },
          },
        },
      ]);

      fireEvent.change(screen.getByPlaceholderText('管理员账号 / 登录名'), {
        target: { value: 'admin' },
      });
      fireEvent.change(screen.getByPlaceholderText('密码'), {
        target: { value: 'password123' },
      });

      fireEvent.click(screen.getByRole('button', { name: '登 录' }));

      await waitFor(() => {
        expect(screen.getByTestId('location-display')).toHaveTextContent(
          '/platform/channel-credentials',
        );
        expect(screen.getByTestId('channel-view')).toBeInTheDocument();
      });
    });

    it('登录成功但拉取权限码失败时（契约 #37 容错），不阻断登录流程与页面跳转', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.mocked(authApi.login).mockResolvedValueOnce(mockTokenSuccess);
      vi.mocked(authApi.getPermissions).mockRejectedValueOnce(new Error('500 Permissions Error'));

      renderLoginPage();

      fireEvent.change(screen.getByPlaceholderText('管理员账号 / 登录名'), {
        target: { value: 'admin' },
      });
      fireEvent.change(screen.getByPlaceholderText('密码'), {
        target: { value: 'password123' },
      });

      fireEvent.click(screen.getByRole('button', { name: '登 录' }));

      await waitFor(() => {
        expect(authApi.login).toHaveBeenCalledTimes(1);
        expect(authApi.getPermissions).toHaveBeenCalledTimes(1);
      });

      // 验证控制台输出了容错警告
      expect(warnSpy).toHaveBeenCalledWith('获取主体初始权限码失败', expect.any(Error));

      // 登录态仍然写入且跳转至 /dashboard
      expect(useAuthStore.getState().accessToken).toBe('test-access-token-123');
      await waitFor(() => {
        expect(screen.getByTestId('location-display')).toHaveTextContent('/dashboard');
      });

      warnSpy.mockRestore();
    });
  });

  describe('提交失败与错误提示', () => {
    it('接口返回 ApiError 时展示错误信息，并可通过关闭按钮关闭提示', async () => {
      vi.mocked(authApi.login).mockRejectedValueOnce(
        new ApiError({
          code: ResponseCode.AUTH_REQUIRED,
          info: '账号或密码错误',
        }),
      );

      renderLoginPage();

      fireEvent.change(screen.getByPlaceholderText('管理员账号 / 登录名'), {
        target: { value: 'admin' },
      });
      fireEvent.change(screen.getByPlaceholderText('密码'), {
        target: { value: 'wrong-password' },
      });

      fireEvent.click(screen.getByRole('button', { name: '登 录' }));

      await waitFor(() => {
        expect(screen.getByText('账号或密码错误')).toBeInTheDocument();
      });

      // 登录失败未写入 token，停留于登录页
      expect(useAuthStore.getState().accessToken).toBeNull();
      expect(screen.getByTestId('location-display')).toHaveTextContent('/login');

      // 提交按钮恢复可用状态
      const submitBtn = screen.getByRole('button', { name: '登 录' });
      expect(submitBtn).not.toBeDisabled();

      // 点击关闭按钮可清除 Alert
      const closeAlertBtn = screen.getByRole('button', { name: '关闭' });
      fireEvent.click(closeAlertBtn);

      expect(screen.queryByText('账号或密码错误')).not.toBeInTheDocument();
    });

    it('接口返回无 info 的 ApiError 时展示兜底提示「登录失败，请检查用户名或密码」', async () => {
      vi.mocked(authApi.login).mockRejectedValueOnce(
        new ApiError({
          code: ResponseCode.AUTH_REQUIRED,
          info: '',
        }),
      );

      renderLoginPage();

      fireEvent.change(screen.getByPlaceholderText('管理员账号 / 登录名'), {
        target: { value: 'admin' },
      });
      fireEvent.change(screen.getByPlaceholderText('密码'), {
        target: { value: 'wrong-password' },
      });

      fireEvent.click(screen.getByRole('button', { name: '登 录' }));

      await waitFor(() => {
        expect(screen.getByText('登录失败，请检查用户名或密码')).toBeInTheDocument();
      });
    });

    it('接口抛出网络异常时展示「网络连接异常，请稍后重试」', async () => {
      vi.mocked(authApi.login).mockRejectedValueOnce(new Error('Network disconnected'));

      renderLoginPage();

      fireEvent.change(screen.getByPlaceholderText('管理员账号 / 登录名'), {
        target: { value: 'admin' },
      });
      fireEvent.change(screen.getByPlaceholderText('密码'), {
        target: { value: 'wrong-password' },
      });

      fireEvent.click(screen.getByRole('button', { name: '登 录' }));

      await waitFor(() => {
        expect(screen.getByText('网络连接异常，请稍后重试')).toBeInTheDocument();
      });

      // 按钮恢复可用
      expect(screen.getByRole('button', { name: '登 录' })).not.toBeDisabled();
    });
  });

  describe('交互状态', () => {
    it('提交等待期间按钮处于 disabled 状态', async () => {
      let resolveLogin!: (value: TokenResponse) => void;
      const loginPromise = new Promise<TokenResponse>((resolve) => {
        resolveLogin = resolve;
      });
      vi.mocked(authApi.login).mockReturnValueOnce(loginPromise);
      vi.mocked(authApi.getPermissions).mockResolvedValueOnce([]);

      renderLoginPage();

      fireEvent.change(screen.getByPlaceholderText('管理员账号 / 登录名'), {
        target: { value: 'admin' },
      });
      fireEvent.change(screen.getByPlaceholderText('密码'), {
        target: { value: 'password123' },
      });

      const submitBtn = screen.getByRole('button', { name: '登 录' });
      fireEvent.click(submitBtn);

      // 请求处于 pending 状态时，按钮禁用
      await waitFor(() => {
        expect(submitBtn).toBeDisabled();
      });

      // 完成登录请求
      await act(async () => {
        resolveLogin(mockTokenSuccess);
      });

      // 路由跳转至 /dashboard
      await waitFor(() => {
        expect(screen.getByTestId('location-display')).toHaveTextContent('/dashboard');
      });
    });
  });
});
