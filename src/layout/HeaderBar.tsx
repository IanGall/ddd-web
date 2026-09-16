import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Monitor, Search, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  const navigate = useNavigate();
  const storeUsername = useAuthStore((state) => state.username);
  const username = propUsername !== undefined ? propUsername : storeUsername;
  const { logout } = useLogout();

  const avatarText = username?.trim().slice(0, 2) || '';

  return (
    <header className="flex h-14 items-center justify-between gap-4 border-b border-border bg-background px-6">
      <div className="relative w-[360px]">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="搜索菜单"
          className="h-9 rounded-full pr-4 pl-9"
          value={keyword}
          onChange={(e) => onKeywordChange(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label="我的会话"
          onClick={() => navigate('/sessions')}
        >
          <Monitor className="size-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex cursor-pointer items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Avatar className="size-9">
              <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
                {avatarText || <User className="size-4" />}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => navigate('/sessions')}>
              <Monitor className="size-4" />
              <span>我的会话</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                void logout();
              }}
            >
              <LogOut className="size-4" />
              <span>退出登录</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
