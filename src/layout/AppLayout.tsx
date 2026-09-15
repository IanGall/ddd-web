import React, { useMemo } from 'react';
import { Button, Dropdown, Layout, Menu, Space, Tag, Typography } from 'antd';
import type { MenuProps } from 'antd';
import {
  DashboardOutlined,
  DesktopOutlined,
  LogoutOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { usePermission } from '@/hooks/usePermission';
import { authApi } from '@/api/auth';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

export interface DomainMenuItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  permission?: string;
  children?: DomainMenuItem[];
}

interface DomainModule {
  menuItems?: DomainMenuItem[];
}

// 自动收集各域模块菜单定义（如 rbac.tsx, channel.tsx 等），避免硬编码与直接 import 未落盘文件
const domainModuleFiles = import.meta.glob<DomainModule>('../router/modules/*.tsx', {
  eager: true,
});

export const AppLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const username = useAuthStore((state) => state.username);
  const userType = useAuthStore((state) => state.userType);
  const clearAuth = useAuthStore((state) => state.clear);

  const { hasPermission } = usePermission();

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch (err) {
      console.warn('退出登录接口调用失败，直接清理本地状态', err);
    } finally {
      clearAuth();
      navigate('/login');
    }
  };

  // 合并内置菜单项与各域模块收集的 menuItems
  const allMenuItems: DomainMenuItem[] = useMemo(() => {
    const domainMenuItems: DomainMenuItem[] = Object.entries(domainModuleFiles)
      .sort(([pathA], [pathB]) => {
        // RBAC 权限管理优先排在前列，其余按字典序
        if (pathA.includes('rbac')) return -1;
        if (pathB.includes('rbac')) return 1;
        return pathA.localeCompare(pathB);
      })
      .flatMap(([_, mod]) => mod.menuItems || []);

    return [
      {
        key: '/dashboard',
        label: '控制台概览',
        icon: <DashboardOutlined />,
      },
      ...domainMenuItems,
      {
        key: '/sessions',
        label: '我的会话',
        icon: <DesktopOutlined />,
      },
    ];
  }, []);

  // 严格按有效权限码过滤菜单：叶子项无权限过滤；分组子项全部过滤时隐藏整组
  const filteredMenuItems: MenuProps['items'] = useMemo(() => {
    type MenuItem = NonNullable<MenuProps['items']>[number];

    const filterItem = (item: DomainMenuItem): MenuItem | null => {
      if (item.children && item.children.length > 0) {
        const allowedChildren = item.children
          .map(filterItem)
          .filter((child): child is MenuItem => child !== null);
        if (allowedChildren.length === 0) {
          return null;
        }
        return {
          key: item.key,
          label: item.label,
          icon: item.icon,
          children: allowedChildren,
        };
      }

      if (item.permission && !hasPermission(item.permission)) {
        return null;
      }

      return {
        key: item.key,
        label: item.label,
        icon: item.icon,
      };
    };

    return allMenuItems.map(filterItem).filter((item): item is MenuItem => item !== null);
  }, [allMenuItems, hasPermission]);

  const defaultOpenKeys = useMemo(
    () =>
      allMenuItems
        .filter((item) => item.children && item.children.length > 0)
        .map((item) => item.key),
    [allMenuItems],
  );

  const userDropdownItems: MenuProps['items'] = [
    {
      key: 'sessions',
      label: '我的会话',
      icon: <DesktopOutlined />,
      onClick: () => navigate('/sessions'),
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      label: '退出登录',
      icon: <LogoutOutlined />,
      danger: true,
      onClick: handleLogout,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={220} theme="light" style={{ borderRight: '1px solid #f0f0f0' }}>
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: '1px solid #f0f0f0',
            fontWeight: 'bold',
            fontSize: 16,
            color: '#1677ff',
          }}
        >
          Admin Console
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          defaultOpenKeys={defaultOpenKeys}
          items={filteredMenuItems}
          onClick={({ key }) => {
            if (key.startsWith('/')) {
              navigate(key);
            }
          }}
          style={{ borderRight: 0 }}
        />
      </Sider>

      <Layout>
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          <Text strong style={{ fontSize: 16 }}>
            DDD 管理端基座
          </Text>

          <Space size="middle">
            <Tag color={userType === 'ADMIN_PRIMARY' ? 'gold' : 'blue'}>
              {userType === 'ADMIN_PRIMARY' ? '主管理员' : '子账号'}
            </Tag>

            <Dropdown menu={{ items: userDropdownItems }} placement="bottomRight">
              <Button type="text" icon={<UserOutlined />}>
                {username || '管理员'}
              </Button>
            </Dropdown>

            <Button type="text" danger icon={<LogoutOutlined />} onClick={handleLogout}>
              退出
            </Button>
          </Space>
        </Header>

        <Content style={{ margin: 24, minHeight: 280 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};
