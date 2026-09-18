import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DataScopeModal } from '@/pages/channel/ChannelCredentials/DataScopeModal';
import { channelApi, type ChannelCredentialDTO } from '@/api/channel';
import { useAuthStore } from '@/store/auth';
import { ApiError, ResponseCode } from '@/api/types';

vi.mock('@/api/channel', () => ({
  channelApi: {
    getDataScopes: vi.fn(),
    replaceDataScopes: vi.fn(),
  },
}));

describe('DataScopeModal (渠道凭证 数据范围配置弹窗)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    useAuthStore.getState().clear();
    // 默认赋予修改权限，以便测试主体交互
    useAuthStore.getState().setPermissionCodes(['rbac:channel-credential:update']);
  });

  const mockCredential: ChannelCredentialDTO = {
    id: 'c1',
    channelCode: 'CH_ALIPAY',
    channelName: '支付宝业务渠道',
    secretVersion: 1,
    status: true,
    lastRotatedAt: '2026-09-15T12:00:00',
    createTime: '2026-09-15T10:00:00',
    updateTime: '2026-09-15T12:00:00',
  };

  it('提交成功路径 - 具备权限时加载初始数据，添加新范围值并成功保存', async () => {
    vi.mocked(channelApi.getDataScopes).mockResolvedValueOnce([
      { scopeType: 'ACCOUNT', scopeValue: 'ACC_001' },
    ]);
    vi.mocked(channelApi.replaceDataScopes).mockResolvedValueOnce([]);

    render(<DataScopeModal open={true} credential={mockCredential} onClose={vi.fn()} />);

    // 弹窗标题展示渠道信息
    expect(
      screen.getByRole('heading', { name: /配置数据范围 — 支付宝业务渠道 \(CH_ALIPAY\)/i }),
    ).toBeInTheDocument();

    // 初始 ACCOUNT 类型数据加载
    await waitFor(() => {
      expect(channelApi.getDataScopes).toHaveBeenCalledWith('c1', 'ACCOUNT');
      expect(screen.getByText('ACC_001')).toBeInTheDocument();
    });

    // 通过 TagInput 添加新范围值
    const tagInput = screen.getByPlaceholderText(/输入范围值并回车添加标签/i);
    fireEvent.change(tagInput, { target: { value: 'ACC_002' } });
    fireEvent.keyDown(tagInput, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('ACC_002')).toBeInTheDocument();
    });

    // 点击保存
    const saveBtn = screen.getByRole('button', { name: '保存此类型数据范围' });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(channelApi.replaceDataScopes).toHaveBeenCalledTimes(1);
      expect(channelApi.replaceDataScopes).toHaveBeenCalledWith('c1', 'ACCOUNT', {
        scopeValues: ['ACC_001', 'ACC_002'],
      });
    });
  });

  it('提交失败路径 - 后端返回 INVALID_ARGUMENT 时在 Alert 中展示错误信息', async () => {
    vi.mocked(channelApi.getDataScopes).mockResolvedValueOnce([
      { scopeType: 'ACCOUNT', scopeValue: 'ACC_001' },
    ]);
    vi.mocked(channelApi.replaceDataScopes).mockRejectedValueOnce(
      new ApiError({
        code: ResponseCode.INVALID_ARGUMENT,
        info: '数据范围格式非法，禁止包含通配符',
      }),
    );

    render(<DataScopeModal open={true} credential={mockCredential} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('ACC_001')).toBeInTheDocument();
    });

    const saveBtn = screen.getByRole('button', { name: '保存此类型数据范围' });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText('数据范围格式非法，禁止包含通配符')).toBeInTheDocument();
    });

    // 保存按钮结束 loading，恢复可用
    expect(saveBtn).not.toBeDisabled();
  });

  it('提交失败路径 - 后端返回通用异常时结束 saving 状态且不崩溃', async () => {
    vi.mocked(channelApi.getDataScopes).mockResolvedValueOnce([]);
    vi.mocked(channelApi.replaceDataScopes).mockRejectedValueOnce(new Error('网络请求超时'));

    render(<DataScopeModal open={true} credential={mockCredential} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(channelApi.getDataScopes).toHaveBeenCalled();
    });

    const saveBtn = screen.getByRole('button', { name: '保存此类型数据范围' });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(channelApi.replaceDataScopes).toHaveBeenCalledTimes(1);
      expect(saveBtn).not.toBeDisabled();
    });
  });

  it('表单校验拦截 - 数据范围项数超过 1000 项时拦截请求并提示', async () => {
    // 模拟服务端返回超限的 1001 项
    const oversizedScopes = Array.from({ length: 1001 }, (_, i) => ({
      scopeType: 'ACCOUNT',
      scopeValue: `SCOPE_${i}`,
    }));
    vi.mocked(channelApi.getDataScopes).mockResolvedValueOnce(oversizedScopes);

    render(<DataScopeModal open={true} credential={mockCredential} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('已选 1001 / 1000 项')).toBeInTheDocument();
    });

    const saveBtn = screen.getByRole('button', { name: '保存此类型数据范围' });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText('数据范围项数不得超过 1000 项')).toBeInTheDocument();
    });
    expect(channelApi.replaceDataScopes).not.toHaveBeenCalled();
  });

  it('表单校验拦截 - 数据范围项中包含空字符串时拦截请求并提示', async () => {
    // 模拟初始加载包含空字符串范围值
    vi.mocked(channelApi.getDataScopes).mockResolvedValueOnce([
      { scopeType: 'ACCOUNT', scopeValue: '   ' },
    ]);

    render(<DataScopeModal open={true} credential={mockCredential} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(channelApi.getDataScopes).toHaveBeenCalled();
    });

    const saveBtn = screen.getByRole('button', { name: '保存此类型数据范围' });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText('数据范围项中不得包含空字符串')).toBeInTheDocument();
    });
    expect(channelApi.replaceDataScopes).not.toHaveBeenCalled();
  });

  it('关闭后重开时状态复位 - 错误提示被清除且重新拉取数据', async () => {
    vi.mocked(channelApi.getDataScopes).mockResolvedValue([
      { scopeType: 'ACCOUNT', scopeValue: 'ACC_001' },
    ]);
    vi.mocked(channelApi.replaceDataScopes).mockRejectedValueOnce(
      new ApiError({
        code: ResponseCode.INVALID_ARGUMENT,
        info: '校验失败错误提示',
      }),
    );

    const { rerender } = render(
      <DataScopeModal open={true} credential={mockCredential} onClose={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText('ACC_001')).toBeInTheDocument();
    });

    // 触发错误
    const saveBtn = screen.getByRole('button', { name: '保存此类型数据范围' });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText('校验失败错误提示')).toBeInTheDocument();
    });

    // 关闭弹窗
    rerender(<DataScopeModal open={false} credential={mockCredential} onClose={vi.fn()} />);

    // 重新打开弹窗
    rerender(<DataScopeModal open={true} credential={mockCredential} onClose={vi.fn()} />);

    // 验证错误横幅已被清空，并重新发起了 getDataScopes
    expect(screen.queryByText('校验失败错误提示')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(channelApi.getDataScopes).toHaveBeenCalledTimes(2);
    });
  });

  it('切换/重新加载按钮 - 点击时重新拉取当前类型的数据', async () => {
    vi.mocked(channelApi.getDataScopes).mockResolvedValueOnce([
      { scopeType: 'ACCOUNT', scopeValue: 'ACC_INIT' },
    ]);

    render(<DataScopeModal open={true} credential={mockCredential} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('ACC_INIT')).toBeInTheDocument();
    });

    // 模拟重新加载返回新数据
    vi.mocked(channelApi.getDataScopes).mockResolvedValueOnce([
      { scopeType: 'ACCOUNT', scopeValue: 'ACC_RELOADED' },
    ]);

    const reloadBtn = screen.getByRole('button', { name: '切换/重新加载' });
    fireEvent.click(reloadBtn);

    await waitFor(() => {
      expect(screen.getByText('ACC_RELOADED')).toBeInTheDocument();
    });
    expect(channelApi.getDataScopes).toHaveBeenCalledTimes(2);
  });

  it('权限拦截 - 无 rbac:channel-credential:update 权限时保存按钮与输入框被禁用', async () => {
    // 清空权限
    useAuthStore.getState().setPermissionCodes([]);
    vi.mocked(channelApi.getDataScopes).mockResolvedValueOnce([
      { scopeType: 'ACCOUNT', scopeValue: 'ACC_READONLY' },
    ]);

    render(<DataScopeModal open={true} credential={mockCredential} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('ACC_READONLY')).toBeInTheDocument();
    });

    const saveBtn = screen.getByRole('button', { name: '保存此类型数据范围' });
    expect(saveBtn).toBeDisabled();
    expect(saveBtn).toHaveAttribute('title', '暂无修改权限 (需 rbac:channel-credential:update)');

    const tagInput = screen.getByPlaceholderText(/输入范围值并回车添加标签/i);
    expect(tagInput).toBeDisabled();
  });

  it('点击关闭按钮触发 onClose 回调', async () => {
    const handleClose = vi.fn();
    vi.mocked(channelApi.getDataScopes).mockResolvedValueOnce([]);

    render(<DataScopeModal open={true} credential={mockCredential} onClose={handleClose} />);

    await waitFor(() => {
      expect(channelApi.getDataScopes).toHaveBeenCalled();
    });

    const closeBtn = screen.getByRole('button', { name: '关闭' });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
