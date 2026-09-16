import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ConfirmPopover } from '@/components/ConfirmPopover';
import { Button } from '@/components/ui/button';

describe('ConfirmPopover', () => {
  it('点触发器只开确认不开业务（断言 onConfirm 未被调用）', async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmPopover title="确认删除吗？" description="此操作不可撤销" onConfirm={onConfirm}>
        <Button>删除</Button>
      </ConfirmPopover>,
    );

    const trigger = screen.getByRole('button', { name: '删除' });
    fireEvent.click(trigger);

    expect(await screen.findByText('确认删除吗？')).toBeInTheDocument();
    expect(screen.getByText('此操作不可撤销')).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('点「取消」不调用 onConfirm 且关闭', async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmPopover title="确认删除吗？" onConfirm={onConfirm}>
        <Button>删除</Button>
      </ConfirmPopover>,
    );

    fireEvent.click(screen.getByRole('button', { name: '删除' }));
    expect(await screen.findByText('确认删除吗？')).toBeInTheDocument();

    const cancelBtn = screen.getByRole('button', { name: '取消' });
    fireEvent.click(cancelBtn);

    expect(onConfirm).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByText('确认删除吗？')).not.toBeInTheDocument();
    });
  });

  it('点「确定」恰好调用一次', async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmPopover title="确认删除吗？" onConfirm={onConfirm}>
        <Button>删除</Button>
      </ConfirmPopover>,
    );

    fireEvent.click(screen.getByRole('button', { name: '删除' }));
    expect(await screen.findByText('确认删除吗？')).toBeInTheDocument();

    const okBtn = screen.getByRole('button', { name: '确定' });
    fireEvent.click(okBtn);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryByText('确认删除吗？')).not.toBeInTheDocument();
    });
  });

  it('异步 onConfirm resolve 后自动关闭', async () => {
    let resolveFn: () => void;
    const promise = new Promise<void>((resolve) => {
      resolveFn = resolve;
    });
    const onConfirm = vi.fn().mockReturnValue(promise);

    render(
      <ConfirmPopover title="确认异步操作？" onConfirm={onConfirm}>
        <Button>异步操作</Button>
      </ConfirmPopover>,
    );

    fireEvent.click(screen.getByRole('button', { name: '异步操作' }));
    expect(await screen.findByText('确认异步操作？')).toBeInTheDocument();

    const okBtn = screen.getByRole('button', { name: '确定' });
    fireEvent.click(okBtn);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    // 异步期间应保持打开
    expect(screen.getByText('确认异步操作？')).toBeInTheDocument();

    // resolve 异步
    resolveFn!();
    await waitFor(() => {
      expect(screen.queryByText('确认异步操作？')).not.toBeInTheDocument();
    });
  });

  it('disabled 时不打开', async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmPopover title="确认删除吗？" onConfirm={onConfirm} disabled>
        <Button>删除</Button>
      </ConfirmPopover>,
    );

    const trigger = screen.getByRole('button', { name: '删除' });
    expect(trigger).toBeDisabled();
    fireEvent.click(trigger);

    expect(screen.queryByText('确认删除吗？')).not.toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('自定义 okText/cancelText 文案生效', async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmPopover
        title="确认退出吗？"
        okText="退出登录"
        cancelText="留在此页"
        onConfirm={onConfirm}
      >
        <Button>退出</Button>
      </ConfirmPopover>,
    );

    fireEvent.click(screen.getByRole('button', { name: '退出' }));
    expect(await screen.findByText('确认退出吗？')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: '退出登录' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '留在此页' })).toBeInTheDocument();
  });

  it('danger 为真时标题具有 text-destructive 类，确定按钮为 destructive', async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmPopover title="危险操作警告" danger onConfirm={onConfirm}>
        <Button>危险操作</Button>
      </ConfirmPopover>,
    );

    fireEvent.click(screen.getByRole('button', { name: '危险操作' }));
    const title = await screen.findByText('危险操作警告');
    expect(title).toHaveClass('text-destructive');

    const okBtn = screen.getByRole('button', { name: '确定' });
    expect(okBtn).toHaveClass('text-destructive');
  });

  it('异步 onConfirm reject 时保持打开', async () => {
    let rejectFn: (reason?: any) => void;
    const promise = new Promise<void>((_, reject) => {
      rejectFn = reject;
    });
    const onConfirm = vi.fn().mockReturnValue(promise);

    render(
      <ConfirmPopover title="会失败的操作" onConfirm={onConfirm}>
        <Button>操作</Button>
      </ConfirmPopover>,
    );

    fireEvent.click(screen.getByRole('button', { name: '操作' }));
    expect(await screen.findByText('会失败的操作')).toBeInTheDocument();

    const okBtn = screen.getByRole('button', { name: '确定' });
    fireEvent.click(okBtn);

    await act(async () => {
      rejectFn!(new Error('failed'));
    });

    // reject 时保持打开
    expect(screen.getByText('会失败的操作')).toBeInTheDocument();
  });
});
