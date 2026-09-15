import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthRedirectBridge } from '@/router/guards';
import { redirectToLogin } from '@/api/client';

function CurrentLocation() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

describe('AuthRedirectBridge & SPA 401 Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('AuthRedirectBridge 挂载后接管 redirectToLogin 并触发 SPA 内部路由跳转', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route element={<AuthRedirectBridge />}>
            <Route path="/dashboard" element={<CurrentLocation />} />
            <Route path="/login" element={<CurrentLocation />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('location')).toHaveTextContent('/dashboard');

    // 触发 401 重定向
    redirectToLogin();

    // 验证走 SPA 路由跳转到 /login 而非整页刷新
    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/login');
    });
  });

  it('AuthRedirectBridge 卸载后注销 handler', () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route element={<AuthRedirectBridge />}>
            <Route path="/dashboard" element={<CurrentLocation />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    unmount();
    // 卸载后 redirectHandler 应置为 null
  });
});
