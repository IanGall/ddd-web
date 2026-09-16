import React from 'react';
import { Avatar, Button, theme } from 'antd';
import { LogoutOutlined, UserOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/store/auth';
import { useLogout } from '@/hooks/useLogout';

export const SideUserCard: React.FC = () => {
  const { token } = theme.useToken();
  const username = useAuthStore((state) => state.username);
  const userType = useAuthStore((state) => state.userType);
  const { logout, loading } = useLogout();

  const avatarText = username?.trim().slice(0, 2) || '';

  return (
    <div className="flex items-center gap-3 border-t p-4" style={{ borderColor: token.colorSplit }}>
      <Avatar
        size={36}
        style={{
          backgroundColor: token.colorPrimary,
          color: token.colorTextLightSolid,
        }}
        icon={avatarText ? undefined : <UserOutlined />}
      >
        {avatarText || null}
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-semibold" style={{ color: token.colorText }}>
          {username || '管理员'}
        </span>
        <span className="text-xs" style={{ color: token.colorTextTertiary }}>
          {userType === 'ADMIN_PRIMARY' ? '主管理员' : '子账号'}
        </span>
      </div>
      <Button
        type="text"
        shape="circle"
        icon={<LogoutOutlined />}
        aria-label="退出登录"
        loading={loading}
        onClick={logout}
      />
    </div>
  );
};
