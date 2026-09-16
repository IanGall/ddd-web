import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConfigProvider } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { StatCard } from '@/components/StatCard';
import { DATA_PALETTE, hexToRgba, themeConfig } from '@/theme';

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
    const { rerender } = render(
      <ConfigProvider theme={themeConfig}>
        <StatCard title="用户总数" value={42} dimmed={false} />
      </ConfigProvider>,
    );
    const normalValueNode = screen.getByText('42');
    const normalContentContainer = normalValueNode.closest('div');
    // 正常态不设 content inline color，保持 Antd 默认文字颜色
    expect(normalContentContainer?.style.color).toBe('');

    // 重新渲染为 dimmed 为 true（置灰态）
    rerender(
      <ConfigProvider theme={themeConfig}>
        <StatCard title="用户总数" value={42} dimmed={true} />
      </ConfigProvider>,
    );
    const dimmedValueNode = screen.getByText('42');
    const dimmedContentContainer = dimmedValueNode.closest('div');
    // 置灰态生效 token.colorTextTertiary (#9CA3AF -> rgb(156, 163, 175))
    expect(dimmedContentContainer?.style.color).toBe('rgb(156, 163, 175)');
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
        icon={<UserOutlined data-testid="user-icon" />}
        accent="orange"
      />,
    );
    const badge = container.querySelector('.rounded-full') as HTMLElement;
    expect(badge).toBeInTheDocument();
    expect(badge).toContainElement(screen.getByTestId('user-icon'));
    expect(badge.style.backgroundColor).toBe(hexToRgba(DATA_PALETTE.orange, 0.12));
    // DATA_PALETTE.orange 为 #F0562B -> rgb(240, 86, 43)
    expect(badge.style.color).toBe('rgb(240, 86, 43)');

    // 4.3 accent 缺省时使用 tertiary 回退色
    rerender(
      <ConfigProvider theme={themeConfig}>
        <StatCard title="用户总数" value={42} icon={<UserOutlined data-testid="user-icon" />} />
      </ConfigProvider>,
    );
    const defaultBadge = container.querySelector('.rounded-full') as HTMLElement;
    expect(defaultBadge).toBeInTheDocument();
    // token.colorFillTertiary: #F2F2F3 -> rgb(242, 242, 243)
    expect(defaultBadge.style.backgroundColor).toBe('rgb(242, 242, 243)');
    // token.colorTextTertiary: #9CA3AF -> rgb(156, 163, 175)
    expect(defaultBadge.style.color).toBe('rgb(156, 163, 175)');
  });

  describe('5. hexToRgba 纯函数用例', () => {
    it('正确转换 #RRGGBB 完整十六进制颜色与透明度', () => {
      expect(hexToRgba('#F0562B', 0.12)).toBe('rgba(240, 86, 43, 0.12)');
      expect(hexToRgba('#14A79D', 0.5)).toBe('rgba(20, 167, 157, 0.5)');
      expect(hexToRgba('#17324F', 1)).toBe('rgba(23, 50, 79, 1)');
      expect(hexToRgba('#F5B21A', 0)).toBe('rgba(245, 178, 26, 0)');
    });

    it('正确转换 #RGB 缩写形式', () => {
      expect(hexToRgba('#FFF', 1)).toBe('rgba(255, 255, 255, 1)');
      expect(hexToRgba('#fff', 0.5)).toBe('rgba(255, 255, 255, 0.5)');
      expect(hexToRgba('#000', 0)).toBe('rgba(0, 0, 0, 0)');
      expect(hexToRgba('#123', 0.8)).toBe('rgba(17, 34, 51, 0.8)');
    });

    it('对非法输入提供安全可预期的兜底值，不产生 NaN', () => {
      // 非法十六进制字符串
      expect(hexToRgba('invalid', 0.12)).toBe('rgba(0, 0, 0, 0.12)');
      expect(hexToRgba('#12', 0.5)).toBe('rgba(0, 0, 0, 0.5)');
      expect(hexToRgba('#gggggg', 0.5)).toBe('rgba(0, 0, 0, 0.5)');
      expect(hexToRgba('', 0.5)).toBe('rgba(0, 0, 0, 0.5)');
      expect(hexToRgba(null as unknown as string, 0.5)).toBe('rgba(0, 0, 0, 0.5)');

      // 非法 alpha 输入
      expect(hexToRgba('#F0562B', Number.NaN)).toBe('rgba(240, 86, 43, 1)');
      // alpha 越界截断
      expect(hexToRgba('#F0562B', -0.5)).toBe('rgba(240, 86, 43, 0)');
      expect(hexToRgba('#F0562B', 1.5)).toBe('rgba(240, 86, 43, 1)');
    });
  });
});
