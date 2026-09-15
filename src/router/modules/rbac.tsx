import type { RouteObject } from 'react-router-dom';
import type { ReactNode } from 'react';
import {
  KeyOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { UserListPage } from '@/pages/rbac/users';
import { RoleListPage } from '@/pages/rbac/roles';
import { PermissionListPage } from '@/pages/rbac/permissions';

/**
 * 域模块导出的菜单项契约
 */
export interface DomainMenuItem {
  key: string; // 路由绝对路径或分组唯一标识
  label: string;
  icon?: ReactNode;
  permission?: string; // 权限码；缺省表示无需权限
  children?: DomainMenuItem[];
}

/**
 * RBAC 域菜单定义
 * 导出至 AppLayout 进行自动收集与权限过滤
 */
export const menuItems: DomainMenuItem[] = [
  {
    key: 'rbac-group',
    label: 'RBAC 权限管理',
    icon: <SafetyCertificateOutlined />,
    children: [
      {
        key: '/rbac/users',
        label: '用户管理',
        icon: <UserOutlined />,
        permission: 'rbac:user:read',
      },
      {
        key: '/rbac/roles',
        label: '角色管理',
        icon: <TeamOutlined />,
        permission: 'rbac:role:read',
      },
      {
        key: '/rbac/permissions',
        label: '权限项管理',
        icon: <KeyOutlined />,
        permission: 'rbac:permission:read',
      },
    ],
  },
];

/**
 * RBAC 域路由定义
 * path 使用相对路径（不带前导 '/'），挂在 AppLayout 之下
 */
export const routes: RouteObject[] = [
  {
    path: 'rbac/users',
    element: <UserListPage />,
  },
  {
    path: 'rbac/roles',
    element: <RoleListPage />,
  },
  {
    path: 'rbac/permissions',
    element: <PermissionListPage />,
  },
];
