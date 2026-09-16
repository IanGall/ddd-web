import React from 'react';
import { LogOut, User } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth';
import { useLogout } from '@/hooks/useLogout';

export const SideUserCard: React.FC = () => {
  const username = useAuthStore((state) => state.username);
  const userType = useAuthStore((state) => state.userType);
  const { logout, loading } = useLogout();

  const avatarText = username?.trim().slice(0, 2) || '';

  return (
    <div className="flex items-center gap-3 border-t border-sidebar-border p-4">
      <Avatar className="size-9">
        <AvatarFallback className="bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
          {avatarText || <User className="size-4" />}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-semibold text-sidebar-foreground">
          {username || '管理员'}
        </span>
        <span className="text-xs text-muted-foreground">
          {userType === 'ADMIN_PRIMARY' ? '主管理员' : '子账号'}
        </span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        aria-label="退出登录"
        disabled={loading}
        onClick={() => {
          void logout();
        }}
      >
        <LogOut className="size-4" />
      </Button>
    </div>
  );
};
