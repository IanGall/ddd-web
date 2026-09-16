import React from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon, Monitor, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export const ThemeToggle: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const current = theme ?? 'system';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className="rounded-full" aria-label="切换主题" />
        }
      >
        {current === 'dark' ? (
          <Moon className="size-4" />
        ) : current === 'light' ? (
          <Sun className="size-4" />
        ) : (
          <Monitor className="size-4" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme?.('light')}>
          <Sun className="size-4" />
          <span>浅色</span>
          {current === 'light' ? <Check className="ml-auto size-4" /> : null}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme?.('dark')}>
          <Moon className="size-4" />
          <span>深色</span>
          {current === 'dark' ? <Check className="ml-auto size-4" /> : null}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme?.('system')}>
          <Monitor className="size-4" />
          <span>跟随系统</span>
          {current === 'system' ? <Check className="ml-auto size-4" /> : null}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ThemeToggle;
