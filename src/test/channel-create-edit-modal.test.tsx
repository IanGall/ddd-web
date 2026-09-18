import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreateEditModal } from '@/pages/channel/ChannelCredentials/CreateEditModal';
import { channelApi, type ChannelCredentialDTO } from '@/api/channel';
import { ApiError, ResponseCode } from '@/api/types';

vi.mock('@/api/channel', () => ({
  channelApi: {
    create: vi.fn(),
    update: vi.fn(),
  },
}));

describe('CreateEditModal (渠道凭证 新建/编辑弹窗)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockInitialCredential: ChannelCredentialDTO = {
    id: '10',
    channelCode: 'CH_ALIPAY_01',
    channelName: '支付宝官方渠道',
    secretVersion: 1,
    status: true,
    lastRotatedAt: '2026-09-15T12:00:00',
    createTime: '2026-09-15T10:00:00',
    updateTime: '2026-09-15T12:00:00',
  };

  it('提交成功路径 - 新建模式：提交合法渠道名称并调用 create 接口，携带密钥材料回调 onSuccess', async () => {
    const handleSuccess = vi.fn();
    const handleClose = vi.fn();
    const mockSecretData = {
      id: '101',
      channelCode: 'CH_WXPAY_01',
      channelSecret: 'sec_mock_key_001',
      secretVersion: 1,
    };
    vi.mocked(channelApi.create).mockResolvedValueOnce(mockSecretData);

    render(
      <CreateEditModal
        open={true}
        mode="create"
        initialData={null}
        onClose={handleClose}
        onSuccess={handleSuccess}
      />,
    );

    expect(screen.getByRole('heading', { name: '新建渠道凭证' })).toBeInTheDocument();

    const input = screen.getByPlaceholderText('请输入渠道名称（≤128 字符）');
    fireEvent.change(input, { target: { value: '微信支付渠道' } });

    const submitBtn = screen.getByRole('button', { name: '确定' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(channelApi.create).toHaveBeenCalledTimes(1);
      expect(channelApi.create).toHaveBeenCalledWith({ channelName: '微信支付渠道' });
      expect(handleSuccess).toHaveBeenCalledWith(mockSecretData);
    });
  });

  it('提交成功路径 - 编辑模式：回显原始数据与禁用编码，修改名称后调用 update 接口触发 onSuccess', async () => {
    const handleSuccess = vi.fn();
    const handleClose = vi.fn();
    vi.mocked(channelApi.update).mockResolvedValueOnce(mockInitialCredential);

    render(
      <CreateEditModal
        open={true}
        mode="edit"
        initialData={mockInitialCredential}
        onClose={handleClose}
        onSuccess={handleSuccess}
      />,
    );

    expect(screen.getByRole('heading', { name: '编辑渠道凭证' })).toBeInTheDocument();

    // 验证渠道编码字段存在且禁用
    const codeInput = screen.getByLabelText('渠道编码');
    expect(codeInput).toBeDisabled();
    expect(codeInput).toHaveValue('CH_ALIPAY_01');

    // 验证渠道名称回显
    const nameInput = screen.getByLabelText('渠道名称');
    expect(nameInput).toHaveValue('支付宝官方渠道');

    // 修改并提交
    fireEvent.change(nameInput, { target: { value: '支付宝新版支付渠道' } });
    const submitBtn = screen.getByRole('button', { name: '确定' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(channelApi.update).toHaveBeenCalledTimes(1);
      expect(channelApi.update).toHaveBeenCalledWith('10', {
        channelName: '支付宝新版支付渠道',
      });
      expect(handleSuccess).toHaveBeenCalledWith();
    });
  });

  it('提交失败路径 - 后端返回 INVALID_ARGUMENT 时在对应字段展示服务端错误信息', async () => {
    const handleSuccess = vi.fn();
    vi.mocked(channelApi.create).mockRejectedValueOnce(
      new ApiError({
        code: ResponseCode.INVALID_ARGUMENT,
        info: '渠道名称已存在，请更换后重试',
      }),
    );

    render(
      <CreateEditModal
        open={true}
        mode="create"
        initialData={null}
        onClose={vi.fn()}
        onSuccess={handleSuccess}
      />,
    );

    const input = screen.getByPlaceholderText('请输入渠道名称（≤128 字符）');
    fireEvent.change(input, { target: { value: '重复的渠道名称' } });

    const submitBtn = screen.getByRole('button', { name: '确定' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('渠道名称已存在，请更换后重试')).toBeInTheDocument();
    });

    expect(handleSuccess).not.toHaveBeenCalled();
    expect(submitBtn).not.toBeDisabled();
  });

  it('提交失败路径 - 后端返回通用异常时结束提交加载态且不崩溃', async () => {
    const handleSuccess = vi.fn();
    vi.mocked(channelApi.create).mockRejectedValueOnce(new Error('网络中断'));

    render(
      <CreateEditModal
        open={true}
        mode="create"
        initialData={null}
        onClose={vi.fn()}
        onSuccess={handleSuccess}
      />,
    );

    const input = screen.getByPlaceholderText('请输入渠道名称（≤128 字符）');
    fireEvent.change(input, { target: { value: '测试渠道' } });

    const submitBtn = screen.getByRole('button', { name: '确定' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(channelApi.create).toHaveBeenCalledTimes(1);
    });

    // 确认 loading 恢复正常，onSuccess 未被触发
    await waitFor(() => {
      expect(submitBtn).not.toBeDisabled();
    });
    expect(handleSuccess).not.toHaveBeenCalled();
  });

  it('表单校验拦截 - 渠道名称为空时不发起请求并展示必填错误', async () => {
    render(
      <CreateEditModal
        open={true}
        mode="create"
        initialData={null}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    const submitBtn = screen.getByRole('button', { name: '确定' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('请输入渠道名称')).toBeInTheDocument();
    });
    expect(channelApi.create).not.toHaveBeenCalled();
  });

  it('表单校验拦截 - 渠道名称全为空白字符时不发起请求并展示校验错误', async () => {
    render(
      <CreateEditModal
        open={true}
        mode="create"
        initialData={null}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    const input = screen.getByPlaceholderText('请输入渠道名称（≤128 字符）');
    fireEvent.change(input, { target: { value: '    ' } });

    const submitBtn = screen.getByRole('button', { name: '确定' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('渠道名称不可为空白字符')).toBeInTheDocument();
    });
    expect(channelApi.create).not.toHaveBeenCalled();
  });

  it('表单校验拦截 - 渠道名称超过 128 字符时被拦截不发起请求', async () => {
    render(
      <CreateEditModal
        open={true}
        mode="create"
        initialData={null}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    const input = screen.getByPlaceholderText('请输入渠道名称（≤128 字符）');
    fireEvent.change(input, { target: { value: 'a'.repeat(129) } });

    const submitBtn = screen.getByRole('button', { name: '确定' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('渠道名称长度不可超过 128 字符')).toBeInTheDocument();
    });
    expect(channelApi.create).not.toHaveBeenCalled();
  });

  it('关闭后重开时状态复位 - 清除上一次的输入内容与错误提示', async () => {
    const { rerender } = render(
      <CreateEditModal
        open={true}
        mode="create"
        initialData={null}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    // 触发必填校验错误
    const submitBtn = screen.getByRole('button', { name: '确定' });
    fireEvent.click(submitBtn);
    await waitFor(() => {
      expect(screen.getByText('请输入渠道名称')).toBeInTheDocument();
    });

    // 关闭弹窗
    rerender(
      <CreateEditModal
        open={false}
        mode="create"
        initialData={null}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    // 重新打开弹窗
    rerender(
      <CreateEditModal
        open={true}
        mode="create"
        initialData={null}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    // 验证错误提示已被清除，输入框为空
    expect(screen.queryByText('请输入渠道名称')).not.toBeInTheDocument();
    const input = screen.getByPlaceholderText('请输入渠道名称（≤128 字符）');
    expect(input).toHaveValue('');
  });

  it('关闭后重新打开不同编辑目标时，更新表单回显内容', async () => {
    const { rerender } = render(
      <CreateEditModal
        open={true}
        mode="edit"
        initialData={mockInitialCredential}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('渠道编码')).toHaveValue('CH_ALIPAY_01');
    expect(screen.getByLabelText('渠道名称')).toHaveValue('支付宝官方渠道');

    // 关闭
    rerender(
      <CreateEditModal
        open={false}
        mode="edit"
        initialData={mockInitialCredential}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    // 以另一凭证重新打开
    const anotherCredential: ChannelCredentialDTO = {
      id: '20',
      channelCode: 'CH_UNIONPAY',
      channelName: '银联渠道',
      secretVersion: 2,
      status: false,
      lastRotatedAt: '2026-09-16T12:00:00',
      createTime: '2026-09-16T10:00:00',
      updateTime: '2026-09-16T12:00:00',
    };

    rerender(
      <CreateEditModal
        open={true}
        mode="edit"
        initialData={anotherCredential}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('渠道编码')).toHaveValue('CH_UNIONPAY');
    expect(screen.getByLabelText('渠道名称')).toHaveValue('银联渠道');
  });

  it('点击取消按钮触发 onClose 回调', () => {
    const handleClose = vi.fn();
    render(
      <CreateEditModal
        open={true}
        mode="create"
        initialData={null}
        onClose={handleClose}
        onSuccess={vi.fn()}
      />,
    );

    const cancelBtn = screen.getByRole('button', { name: '取消' });
    fireEvent.click(cancelBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
