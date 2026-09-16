import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TagInput } from '@/components/TagInput';

describe('TagInput', () => {
  it('输入后按回车新增 tag', () => {
    const onChange = vi.fn();
    render(<TagInput value={['react']} onChange={onChange} placeholder="输入标签" />);

    const input = screen.getByPlaceholderText('输入标签');
    fireEvent.change(input, { target: { value: 'vue' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith(['react', 'vue']);
  });

  it('逗号与空格也能分隔', () => {
    const onChange = vi.fn();
    render(<TagInput value={['react']} onChange={onChange} placeholder="输入标签" />);

    const input = screen.getByPlaceholderText('输入标签');

    // 逗号分隔
    fireEvent.change(input, { target: { value: 'angular' } });
    fireEvent.keyDown(input, { key: ',' });
    expect(onChange).toHaveBeenCalledWith(['react', 'angular']);

    onChange.mockClear();

    // 空格分隔
    fireEvent.change(input, { target: { value: 'svelte' } });
    fireEvent.keyDown(input, { key: ' ' });
    expect(onChange).toHaveBeenCalledWith(['react', 'svelte']);

    onChange.mockClear();

    // 直接在 input 中输入带逗号或空格的内容（如输入法或粘帖）
    fireEvent.change(input, { target: { value: 'solid,' } });
    expect(onChange).toHaveBeenCalledWith(['react', 'solid']);
  });

  it('重复值被忽略、首尾空白被裁剪', () => {
    const onChange = vi.fn();
    render(<TagInput value={['react']} onChange={onChange} placeholder="输入标签" />);

    const input = screen.getByPlaceholderText('输入标签');

    // 输入首尾有空格的新 tag
    fireEvent.change(input, { target: { value: '  vue   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(['react', 'vue']);

    onChange.mockClear();

    // 输入重复 tag
    fireEvent.change(input, { target: { value: 'react' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();

    // 输入仅空格
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('点 tag 的删除按钮移除该 tag', () => {
    const onChange = vi.fn();
    render(<TagInput value={['react', 'vue', 'angular']} onChange={onChange} />);

    expect(screen.getByText('react')).toBeInTheDocument();
    expect(screen.getByText('vue')).toBeInTheDocument();
    expect(screen.getByText('angular')).toBeInTheDocument();

    // 删除 'vue' (索引 1)
    const removeVueBtn = screen.getByRole('button', { name: 'Remove vue' });
    fireEvent.click(removeVueBtn);

    expect(onChange).toHaveBeenCalledWith(['react', 'angular']);
  });

  it('maxVisible 超出时显示 +N', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <TagInput value={['t1', 't2', 't3', 't4', 't5']} onChange={onChange} maxVisible={3} />,
    );

    expect(screen.getByText('t1')).toBeInTheDocument();
    expect(screen.getByText('t2')).toBeInTheDocument();
    expect(screen.getByText('t3')).toBeInTheDocument();
    expect(screen.queryByText('t4')).not.toBeInTheDocument();
    expect(screen.queryByText('t5')).not.toBeInTheDocument();

    // 超出 2 个，显示 +2
    expect(screen.getByText('+2')).toBeInTheDocument();

    // 未超出时不显示 +N
    rerender(<TagInput value={['t1', 't2']} onChange={onChange} maxVisible={3} />);
    expect(screen.queryByText(/\+\d+/)).not.toBeInTheDocument();
  });

  it('输入为空时按退格删除最后一个 tag', () => {
    const onChange = vi.fn();
    render(<TagInput value={['alpha', 'beta']} onChange={onChange} placeholder="输入标签" />);

    const input = screen.getByPlaceholderText('输入标签');
    // 输入框为空时按 Backspace
    fireEvent.keyDown(input, { key: 'Backspace' });

    expect(onChange).toHaveBeenCalledWith(['alpha']);
  });

  it('disabled 时不可输入、不可删', () => {
    const onChange = vi.fn();
    render(<TagInput value={['locked']} onChange={onChange} placeholder="输入标签" disabled />);

    const input = screen.getByPlaceholderText('输入标签');
    expect(input).toBeDisabled();

    // 无法通过回车添加
    fireEvent.change(input, { target: { value: 'new' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();

    // 无法通过退格删除
    fireEvent.keyDown(input, { key: 'Backspace' });
    expect(onChange).not.toHaveBeenCalled();

    // 无法点击删除按钮
    const removeBtn = screen.getByRole('button', { name: 'Remove locked' });
    expect(removeBtn).toBeDisabled();
    fireEvent.click(removeBtn);
    expect(onChange).not.toHaveBeenCalled();
  });
});
