import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '@/api/auth';
import { useAuthStore } from '@/store/auth';

export interface UseLogoutReturn {
  logout: () => Promise<void>;
  loading: boolean;
}

/**
 * 统一登出 Hook
 * 调用 authApi.logout，无论成功或失败均清理本地登录态并导航至 /login
 */
export function useLogout(): UseLogoutReturn {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await authApi.logout();
    } catch (err) {
      console.warn('退出登录接口调用失败，直接清理本地状态', err);
    } finally {
      useAuthStore.getState().clear();
      navigate('/login');
      setLoading(false);
    }
  }, [navigate]);

  return { logout, loading };
}
