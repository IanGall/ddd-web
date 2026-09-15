import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import { AuthRedirectBridge, RequireAnonymous, RequireAuth } from './guards';
import { LoginPage } from '@/pages/Login';
import { AppLayout } from '@/layout/AppLayout';
import { DashboardPage } from '@/pages/Dashboard';
import { SessionsPage } from '@/pages/Sessions';
import { ForbiddenPage } from '@/pages/Error/ForbiddenPage';
import { NotFoundPage } from '@/pages/Error/NotFoundPage';

interface DomainModule {
  routes?: RouteObject[];
}

// 自动收集所有域模块路由（如 rbac.tsx, channel.tsx 等），无须硬编码引入
const domainModules = import.meta.glob<DomainModule>('./modules/*.tsx', { eager: true });
const domainRoutes: RouteObject[] = Object.values(domainModules).flatMap((mod) => mod.routes || []);

export const router: ReturnType<typeof createBrowserRouter> = createBrowserRouter([
  {
    element: <AuthRedirectBridge />,
    children: [
      {
        element: <RequireAnonymous />,
        children: [
          {
            path: '/login',
            element: <LoginPage />,
          },
        ],
      },
      {
        path: '/',
        element: <RequireAuth />,
        children: [
          {
            element: <AppLayout />,
            children: [
              {
                index: true,
                element: <Navigate to="/dashboard" replace />,
              },
              {
                path: 'dashboard',
                element: <DashboardPage />,
              },
              {
                path: 'sessions',
                element: <SessionsPage />,
              },
              {
                path: '403',
                element: <ForbiddenPage />,
              },
              ...domainRoutes,
              {
                path: '*',
                element: <NotFoundPage />,
              },
            ],
          },
        ],
      },
    ],
  },
]);
