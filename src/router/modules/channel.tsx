import type { RouteObject } from 'react-router-dom';
import { LayoutGrid, Lock } from 'lucide-react';
import { ChannelCredentialsPage } from '@/pages/channel/ChannelCredentials';
import type { DomainMenuItem } from '@/layout/menuFilter';

export const menuItems: DomainMenuItem[] = [
  {
    key: 'platform-group',
    label: '平台凭证',
    icon: <LayoutGrid />,
    children: [
      {
        key: '/platform/channel-credentials',
        label: '渠道凭证管理',
        icon: <Lock />,
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
