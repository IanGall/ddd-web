import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  StatusBadge,
  statusBadgeVariants,
  type StatusBadgeVariant,
} from '@/components/StatusBadge';

describe('StatusBadge 组件与语义色规范', () => {
  it('1. 默认 variant 为 muted，渲染兜底 muted 主题变量类', () => {
    render(<StatusBadge>默认兜底</StatusBadge>);
    const badge = screen.getByText('默认兜底');
    expect(badge).toHaveClass('bg-muted');
    expect(badge).toHaveClass('text-muted-foreground');
  });

  it('2. 全部 12 种语义 variant 均正确注入对应的关键类名与暗黑适配类', () => {
    const variantClassChecks: Record<StatusBadgeVariant, string[]> = {
      success: ['bg-emerald-500/12', 'text-emerald-700', 'dark:text-emerald-400'],
      destructive: ['bg-red-500/12', 'text-red-700', 'dark:text-red-400'],
      info: ['bg-blue-500/12', 'text-blue-700', 'dark:text-blue-400'],
      warning: ['bg-amber-500/15', 'text-amber-700', 'dark:text-amber-400'],
      cyan: ['bg-cyan-500/12', 'text-cyan-700', 'dark:text-cyan-400'],
      builtin: ['bg-purple-500/12', 'text-purple-700', 'dark:text-purple-400'],
      processing: ['bg-sky-500/12', 'text-sky-700', 'dark:text-sky-400'],
      'type-dir': ['bg-indigo-500/12', 'text-indigo-700', 'dark:text-indigo-400'],
      'type-menu': ['bg-green-500/12', 'text-green-700', 'dark:text-green-400'],
      'type-action': ['bg-orange-500/12', 'text-orange-700', 'dark:text-orange-400'],
      current: ['bg-green-500/12', 'text-green-700', 'dark:text-green-400'],
      muted: ['bg-muted', 'text-muted-foreground'],
    };

    (Object.keys(variantClassChecks) as StatusBadgeVariant[]).forEach((variant) => {
      const { unmount } = render(<StatusBadge variant={variant}>文本-{variant}</StatusBadge>);
      const el = screen.getByText(`文本-${variant}`);
      for (const cls of variantClassChecks[variant]) {
        expect(el).toHaveClass(cls);
      }
      unmount();
    });
  });

  it('3. type-menu 与 current 视觉一致但语义名与变体严格独立', () => {
    const menuClasses = statusBadgeVariants({ variant: 'type-menu' });
    const currentClasses = statusBadgeVariants({ variant: 'current' });

    // 视觉产出一致：均产出 green 系语义类
    expect(menuClasses).toContain('bg-green-500/12');
    expect(menuClasses).toContain('text-green-700');
    expect(menuClasses).toContain('dark:text-green-400');
    expect(currentClasses).toBe(menuClasses);

    // 类型与业务语义名互不相等
    const menuVariant: StatusBadgeVariant = 'type-menu';
    const currentVariant: StatusBadgeVariant = 'current';
    expect(menuVariant).not.toBe(currentVariant);
  });

  it('4. processing 变体在前置位置渲染脉冲圆点，其他变体不渲染', () => {
    const { container: procContainer } = render(
      <StatusBadge variant="processing">处理中</StatusBadge>,
    );
    const dot = procContainer.querySelector('[data-slot="status-badge-dot"]');
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveClass('size-1.5', 'animate-pulse', 'rounded-full', 'bg-current');

    // 验证文本也在
    expect(screen.getByText('处理中')).toBeInTheDocument();

    // 验证其他变体不含圆点
    const { container: succContainer } = render(
      <StatusBadge variant="success">已完成</StatusBadge>,
    );
    expect(succContainer.querySelector('[data-slot="status-badge-dot"]')).toBeNull();
  });
});
