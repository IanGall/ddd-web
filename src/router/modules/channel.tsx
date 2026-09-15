import type { ReactNode } from 'react';
import type { RouteObject } from 'react-router-dom';
import { AppstoreOutlined, LockOutlined } from '@ant-design/icons';
import { ChannelCredentialsPage } from '@/pages/channel/ChannelCredentials';

export interface DomainMenuItem {
  key: string; // 路由绝对路径，如 '/platform/channel-credentials'
  label: string;
  icon?: ReactNode;
  permission?: string; // 权限码；缺省表示无需权限
  children?: DomainMenuItem[];
}

export const menuItems: DomainMenuItem[] = [
  {
    key: 'platform-group',
    label: '平台凭证',
    icon: <AppstoreOutlined />,
    children: [
      {
        key: '/platform/channel-credentials',
        label: '渠道凭证管理',
        icon: <LockOutlined />,
        permission: 'rbac:channel-credential:read',
      },
    ],
  },
];

export const routes: RouteObject[] = [
  {
    path: 'platform/channel-credentials',
    element: <ChannelCredentialsPage />,
  },
];
