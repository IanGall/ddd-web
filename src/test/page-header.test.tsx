import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from 'antd';
import { PageHeader } from '@/components/PageHeader';

// Mock window.matchMedia for Ant Design in jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

describe('PageHeader', () => {
  it('只传 title 时只渲染 title，DOM 中不出现空的描述节点', () => {
    const { container } = render(<PageHeader title="用户管理" />);
    const titleNode = screen.getByText('用户管理');
    expect(titleNode).toBeInTheDocument();

    // 标题所在的左侧容器中只有标题元素，不包含任何描述占位节点
    const leftContainer = titleNode.parentElement;
    expect(leftContainer?.children.length).toBe(1);
    expect(container.querySelectorAll('span')).toHaveLength(0);
  });

  it('传 title 与 description 时两者都渲染', () => {
    render(<PageHeader title="角色管理" description="管理系统角色及其关联的权限集合" />);
    expect(screen.getByText('角色管理')).toBeInTheDocument();
    expect(screen.getByText('管理系统角色及其关联的权限集合')).toBeInTheDocument();
  });

  it('传 extra 时 extra 内容被渲染在右侧', () => {
    render(<PageHeader title="权限项管理" extra={<Button type="primary">新增权限项</Button>} />);
    expect(screen.getByText('权限项管理')).toBeInTheDocument();
    const extraButton = screen.getByRole('button', { name: '新增权限项' });
    expect(extraButton).toBeInTheDocument();

    // extra 直接作为外层 flex 容器的子节点渲染在右侧
    const outerContainer = extraButton.parentElement;
    expect(outerContainer?.children[1]).toBe(extraButton);
  });

  it('断言 title 为单一文本节点，getByText 能精确且唯一匹配', () => {
    render(<PageHeader title="渠道凭证管理" description="管理平台各业务渠道的安全访问凭据" />);
    const titleNode = screen.getByText('渠道凭证管理');
    expect(titleNode).toBeInTheDocument();
    expect(titleNode.tagName.toLowerCase()).toBe('h3');
    // 确保 title 没有被拆解或多处渲染，精确匹配且唯一
    expect(screen.getAllByText('渠道凭证管理')).toHaveLength(1);
  });
});
