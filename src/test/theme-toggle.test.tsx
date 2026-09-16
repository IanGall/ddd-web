import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ThemeProvider } from 'next-themes';
import { ThemeToggle } from '@/components/ThemeToggle';

describe('ThemeToggle 主题切换组件', () => {
  afterEach(() => {
    // 清理 documentElement 上由 next-themes 写入的 class / colorScheme 与 localStorage，避免跨用例污染
    document.documentElement.classList.remove('dark', 'light');
    document.documentElement.style.colorScheme = '';
    localStorage.clear();
  });

  it('1. 无 Provider 时不崩且显示兜底图标 (Monitor)', () => {
    render(<ThemeToggle />);
    const button = screen.getByRole('button', { name: '切换主题' });
    expect(button).toBeInTheDocument();
    // current 归一为 system，触发器显示 Monitor 图标
    expect(button.querySelector('.lucide-monitor')).toBeInTheDocument();
  });

  it('2. 套 Provider 且 defaultTheme="light" 时触发器显示 Sun 图标', () => {
    render(
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
        storageKey="test-theme-light"
      >
        <ThemeToggle />
      </ThemeProvider>,
    );

    const trigger = screen.getByRole('button', { name: '切换主题' });
    expect(trigger.querySelector('.lucide-sun')).toBeInTheDocument();
  });

  it('3. 套 Provider 后点开菜单能看到三个选项（浅色 / 深色 / 跟随系统）', () => {
    render(
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
        storageKey="test-theme-menu"
      >
        <ThemeToggle />
      </ThemeProvider>,
    );

    const trigger = screen.getByRole('button', { name: '切换主题' });
    fireEvent.click(trigger);

    expect(screen.getByText('浅色')).toBeInTheDocument();
    expect(screen.getByText('深色')).toBeInTheDocument();
    expect(screen.getByText('跟随系统')).toBeInTheDocument();
  });

  it('4. 点「深色」成功调用 setTheme 并将 dark class 赋予 documentElement', () => {
    render(
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
        storageKey="test-theme-switch"
      >
        <ThemeToggle />
      </ThemeProvider>,
    );

    const trigger = screen.getByRole('button', { name: '切换主题' });
    fireEvent.click(trigger);

    const darkOption = screen.getByText('深色');
    act(() => {
      fireEvent.click(darkOption);
    });

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    // 切换后触发器图标变为 Moon
    expect(trigger.querySelector('.lucide-moon')).toBeInTheDocument();
  });

  it('5. 点「跟随系统」调用 setTheme 并将 theme 更新为 system', () => {
    render(
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
        storageKey="test-theme-system"
      >
        <ThemeToggle />
      </ThemeProvider>,
    );

    const trigger = screen.getByRole('button', { name: '切换主题' });
    fireEvent.click(trigger);

    const systemOption = screen.getByText('跟随系统');
    act(() => {
      fireEvent.click(systemOption);
    });

    // 触发器图标应切回 Monitor
    expect(trigger.querySelector('.lucide-monitor')).toBeInTheDocument();
  });
});
