import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { User } from 'lucide-react';
import { StatCard } from '@/components/StatCard';
import { DATA_PALETTE, hexToRgba } from '@/lib/palette';

describe('StatCard 组件', () => {
  it('1. title 与 value 都以原始文本节点渲染，getByText 能精确且唯一匹配', () => {
    render(<StatCard title="用户总数" value={42} />);

    const titleNode = screen.getByText('用户总数');
    expect(titleNode).toBeInTheDocument();
    expect(titleNode.tagName.toLowerCase()).toBe('span');
    expect(screen.getAllByText('用户总数')).toHaveLength(1);

    const valueNode = screen.getByText('42');
    expect(valueNode).toBeInTheDocument();
    expect(screen.getAllByText('42')).toHaveLength(1);
  });

  it('2. 不传 hint 时不渲染说明节点；传了则渲染', () => {
    const { rerender } = render(<StatCard title="用户总数" value={42} />);
    expect(screen.queryByText('系统用户实体规模')).not.toBeInTheDocument();

    rerender(<StatCard title="用户总数" value={42} hint="系统用户实体规模" />);
    expect(screen.getByText('系统用户实体规模')).toBeInTheDocument();
  });

  it('3. dimmed 为 true/false 时数值样式不同', () => {
    // 渲染 dimmed 为 false（正常态）
    const { rerender } = render(<StatCard title="用户总数" value={42} dimmed={false} />);
    const normalValueNode = screen.getByText('42');
    expect(normalValueNode).toHaveClass('text-foreground');
    expect(normalValueNode).not.toHaveClass('text-muted-foreground');

    // 重新渲染为 dimmed 为 true（置灰态）
    rerender(<StatCard title="用户总数" value={42} dimmed={true} />);
    const dimmedValueNode = screen.getByText('42');
    expect(dimmedValueNode).toHaveClass('text-muted-foreground');
    expect(dimmedValueNode).not.toHaveClass('text-foreground');
  });

  it('4. 传入 icon 时徽章被渲染，且徽章的背景色是 hexToRgba(DATA_PALETTE[accent], 0.12) 的结果', () => {
    // 4.1 未传入 icon 时不渲染徽章容器
    const { container, rerender } = render(
      <StatCard title="用户总数" value={42} accent="orange" />,
    );
    expect(container.querySelector('.rounded-full')).toBeNull();

    // 4.2 传入 icon 与 accent="orange"
    rerender(
      <StatCard
        title="用户总数"
        value={42}
        icon={<User data-testid="user-icon" />}
        accent="orange"
      />,
    );
    const badge = container.querySelector('.rounded-full') as HTMLElement;
    expect(badge).toBeInTheDocument();
    expect(badge).toContainElement(screen.getByTestId('user-icon'));
    expect(badge.style.backgroundColor).toBe(hexToRgba(DATA_PALETTE.orange, 0.12));
    // DATA_PALETTE.orange 为 #F0562B -> rgb(240, 86, 43)
    expect(badge.style.color).toBe('rgb(240, 86, 43)');

    // 4.3 accent 缺省时使用回退样式
    rerender(<StatCard title="用户总数" value={42} icon={<User data-testid="user-icon" />} />);
    const defaultBadge = container.querySelector('.rounded-full') as HTMLElement;
    expect(defaultBadge).toBeInTheDocument();
    expect(defaultBadge).toHaveClass('bg-muted');
    expect(defaultBadge).toHaveClass('text-muted-foreground');
  });
});
