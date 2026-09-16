import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ClearableSelect } from '@/components/ClearableSelect';

describe('ClearableSelect', () => {
  it('渲染 options 的 label', () => {
    const options = [
      { label: '选项一', value: 'opt1' },
      { label: '选项二', value: 'opt2' },
    ];
    const onChange = vi.fn();

    render(
      <ClearableSelect value="opt1" onChange={onChange} options={options} placeholder="请选择" />,
    );

    expect(screen.getByText('选项一')).toBeInTheDocument();
  });

  it('boolean 值不丢（给 value={true} 时触发器显示对应 label，且 onChange(null) 在点清空后触发）', () => {
    const options = [
      { label: '启用状态', value: true },
      { label: '停用状态', value: false },
    ];
    const onChange = vi.fn();

    render(
      <ClearableSelect value={true} onChange={onChange} options={options} placeholder="选择状态" />,
    );

    // 触发器中正确显示 boolean 对应的 label
    expect(screen.getByText('启用状态')).toBeInTheDocument();

    // 存在清空按钮
    const clearBtn = screen.getByRole('button', { name: 'Clear' });
    expect(clearBtn).toBeInTheDocument();

    // 点击清空
    fireEvent.click(clearBtn);
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('allowClear={false} 时无清空按钮', () => {
    const options = [
      { label: '男', value: 'male' },
      { label: '女', value: 'female' },
    ];
    const onChange = vi.fn();

    render(
      <ClearableSelect value="male" onChange={onChange} options={options} allowClear={false} />,
    );

    expect(screen.getByText('男')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
  });

  it('无值时显示 placeholder', () => {
    const options = [
      { label: '选项一', value: '1' },
      { label: '选项二', value: '2' },
    ];
    const onChange = vi.fn();

    const { rerender } = render(
      <ClearableSelect
        value={null}
        onChange={onChange}
        options={options}
        placeholder="请选择一项"
      />,
    );

    expect(screen.getByText('请选择一项')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();

    // 当 value 为 undefined 时同样显示 placeholder
    rerender(
      <ClearableSelect
        value={undefined}
        onChange={onChange}
        options={options}
        placeholder="请选择一项"
      />,
    );

    expect(screen.getByText('请选择一项')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
  });

  it('支持数字类型 value（包括 0）', () => {
    const options = [
      { label: '等级零', value: 0 },
      { label: '等级一', value: 1 },
    ];
    const onChange = vi.fn();

    render(
      <ClearableSelect value={0} onChange={onChange} options={options} placeholder="选择等级" />,
    );

    expect(screen.getByText('等级零')).toBeInTheDocument();
    const clearBtn = screen.getByRole('button', { name: 'Clear' });
    expect(clearBtn).toBeInTheDocument();

    fireEvent.click(clearBtn);
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
