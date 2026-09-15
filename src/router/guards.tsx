import React, { useEffect } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { setRedirectHandler } from '@/api/client';

/**
 * 根路由桥接组件：将 HTTP 客户端的 401 重定向对接至 SPA useNavigate
 */
export const AuthRedirectBridge: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    setRedirectHandler((path) => {
      navigate(path);
    });
    return () => {
      setRedirectHandler(null);
    };
  }, [navigate]);

  return <Outlet />;
};

/**
 * 路由守卫：必须已登录方可访问，未登录跳转至 /login
 */
export const RequireAuth: React.FC = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated());
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
};

/**
 * 路由守卫：公开页面（如登录页），已登录时自动跳转首页
 */
export const RequireAnonymous: React.FC = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated());

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};
