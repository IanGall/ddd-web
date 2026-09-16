import React from 'react';
import { Avatar, Button, Dropdown, Input, Layout, Space, theme } from 'antd';
import type { MenuProps } from 'antd';
import { DesktopOutlined, LogoutOutlined, SearchOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { useLogout } from '@/hooks/useLogout';

export interface HeaderBarProps {
  keyword: string;
  onKeywordChange: (value: string) => void;
  username?: string | null;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  keyword,
  onKeywordChange,
  username: propUsername,
}) => {
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const storeUsername = useAuthStore((state) => state.username);
  const username = propUsername !== undefined ? propUsername : storeUsername;
  const { logout } = useLogout();

  const avatarText = username?.trim().slice(0, 2) || '';

  const dropdownItems: MenuProps['items'] = [
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
      onClick: () => {
        void logout();
      },
    },
  ];

  return (
    <Layout.Header className="flex items-center justify-between gap-4">
      <Input
        variant="filled"
        size="large"
        allowClear
        prefix={<SearchOutlined />}
        placeholder="搜索菜单"
        className="w-[360px] rounded-full"
        value={keyword}
        onChange={(e) => onKeywordChange(e.target.value)}
      />

      <Space size="middle">
        <Button
          type="text"
          shape="circle"
          icon={<DesktopOutlined />}
          aria-label="我的会话"
          onClick={() => navigate('/sessions')}
        />
        <Dropdown menu={{ items: dropdownItems }} placement="bottomRight">
          <Avatar
            size={36}
            className="cursor-pointer"
            style={{
              backgroundColor: token.colorPrimary,
              color: token.colorTextLightSolid,
            }}
            icon={avatarText ? undefined : <UserOutlined />}
          >
            {avatarText || null}
          </Avatar>
        </Dropdown>
      </Space>
    </Layout.Header>
  );
};
