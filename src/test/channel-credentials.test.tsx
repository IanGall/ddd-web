import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SecretModal } from '@/pages/channel/ChannelCredentials/SecretModal';
import { ChannelCredentialsPage } from '@/pages/channel/ChannelCredentials';
import { useAuthStore } from '@/store/auth';
import { channelApi } from '@/api/channel';

vi.mock('@/api/channel', () => ({
  channelApi: {
    list: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateStatus: vi.fn(),
    rotateSecret: vi.fn(),
    delete: vi.fn(),
    getDataScopes: vi.fn(),
    replaceDataScopes: vi.fn(),
  },
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

describe('ChannelCredentials Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    useAuthStore.getState().clear();
  });

  describe('SecretModal (硬性交互约束验证)', () => {
    const mockSecretData = {
      id: '99',
      channelCode: 'CH_PAY_01',
      channelSecret: 'sec_very_secret_key_888',
      secretVersion: 1,
    };

    it('展示密钥材料，初始状态下关闭按钮必须处于禁用状态', () => {
      const handleClose = vi.fn();
      render(<SecretModal open={true} data={mockSecretData} onClose={handleClose} />);

      expect(screen.getByText('CH_PAY_01')).toBeInTheDocument();
      expect(screen.getByText('sec_very_secret_key_888')).toBeInTheDocument();
      expect(screen.getByText('v1')).toBeInTheDocument();

      const confirmCloseBtn = screen.getByRole('button', { name: /我已保存，关闭窗口/i });
      expect(confirmCloseBtn).toBeDisabled();
    });

    it('用户显式勾选「我已保存」复选框后，关闭按钮方可点击，触发关闭', () => {
      const handleClose = vi.fn();
      render(<SecretModal open={true} data={mockSecretData} onClose={handleClose} />);

      const checkbox = screen.getByLabelText(/我已复制并妥善保存该渠道密钥/i);
      const confirmCloseBtn = screen.getByRole('button', { name: /我已保存，关闭窗口/i });

      expect(confirmCloseBtn).toBeDisabled();

      fireEvent.click(checkbox);
      expect(confirmCloseBtn).not.toBeDisabled();

      fireEvent.click(confirmCloseBtn);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('点击复制按钮应调用剪贴板 API，且严禁将 secret 写入本地持久化存储', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
        },
      });

      render(<SecretModal open={true} data={mockSecretData} onClose={vi.fn()} />);

      const copySecretBtn = screen.getByRole('button', { name: /单独复制密钥/i });
      fireEvent.click(copySecretBtn);

      await waitFor(() => {
        expect(writeTextMock).toHaveBeenCalledWith('sec_very_secret_key_888');
      });

      // 验证硬约束：禁止将渠道密钥写入 localStorage / sessionStorage
      expect(localStorage.getItem('channelSecret')).toBeNull();
      expect(sessionStorage.getItem('channelSecret')).toBeNull();
      expect(JSON.stringify(localStorage)).not.toContain('sec_very_secret_key_888');
      expect(JSON.stringify(sessionStorage)).not.toContain('sec_very_secret_key_888');
    });

    it('不存在右上角关闭叉号，且初始状态下关闭类按钮无法意外触发 onClose', () => {
      const handleClose = vi.fn();
      render(<SecretModal open={true} data={mockSecretData} onClose={handleClose} />);

      // 验证不存在默认的弹窗关闭叉号（Base UI DialogClose 元素或 accessible name 为 close/关闭 的叉号按钮）
      expect(document.querySelector('[data-slot="dialog-close"]')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^close$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^关闭$/i })).not.toBeInTheDocument();

      // 区分底部带有「关闭窗口」文案的确认按钮，其初始状态必须禁用且点击无法触发 onClose
      const confirmCloseBtn = screen.getByRole('button', { name: /我已保存，关闭窗口/i });
      expect(confirmCloseBtn).toBeInTheDocument();
      expect(confirmCloseBtn).toBeDisabled();
      fireEvent.click(confirmCloseBtn);
      expect(handleClose).not.toHaveBeenCalled();
    });

    it('按 ESC 键无法关闭弹窗，handleClose (onClose) 未被调用', () => {
      const handleClose = vi.fn();
      render(<SecretModal open={true} data={mockSecretData} onClose={handleClose} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();

      // 分别对 document 与 dialog 节点触发 Escape 键盘事件
      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
      fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });

      expect(handleClose).not.toHaveBeenCalled();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('点击或按下遮罩层无法关闭弹窗，handleClose (onClose) 未被调用', () => {
      const handleClose = vi.fn();
      render(<SecretModal open={true} data={mockSecretData} onClose={handleClose} />);

      const overlay = document.querySelector('[data-slot="dialog-overlay"]');
      expect(overlay).toBeInTheDocument();

      // 对遮罩层分别触发 pointerdown、pointerup、click 以及 mousedown 完整交互事件序列
      if (overlay) {
        fireEvent.pointerDown(overlay, { pointerType: 'mouse', button: 0 });
        fireEvent.pointerUp(overlay, { pointerType: 'mouse', button: 0 });
        fireEvent.click(overlay, { button: 0 });
        fireEvent.mouseDown(overlay, { button: 0 });
      }

      expect(handleClose).not.toHaveBeenCalled();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('ChannelCredentialsPage 权限与列表渲染', () => {
    it('当主体无 rbac:channel-credential:read 权限时应展示 403 页面且不请求数据', () => {
      useAuthStore.getState().setToken({
        accessToken: 'sub-token',
        refreshToken: 'sub-refresh',
        tokenType: 'Bearer',
        expiresIn: 3600,
        refreshExpiresIn: 7200,
        sessionId: 'sub-session',
        userId: '2',
        accountId: '1',
        username: 'sub_admin',
        userType: 'ADMIN_SUB_ACCOUNT',
      });
      useAuthStore.getState().setPermissionCodes([]);

      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <ChannelCredentialsPage />
        </QueryClientProvider>,
      );

      expect(screen.getByText('无权访问')).toBeInTheDocument();
      expect(channelApi.list).not.toHaveBeenCalled();
    });

    it('当主体具备 rbac:channel-credential:read 时正常展示表格', async () => {
      useAuthStore.getState().setToken({
        accessToken: 'primary-token',
        refreshToken: 'primary-refresh',
        tokenType: 'Bearer',
        expiresIn: 3600,
        refreshExpiresIn: 7200,
        sessionId: 'primary-session',
        userId: '1',
        accountId: '1',
        username: 'primary_admin',
        userType: 'ADMIN_PRIMARY',
      });
      useAuthStore.getState().setPermissionCodes(['rbac:channel-credential:read']);

      vi.mocked(channelApi.list).mockResolvedValueOnce({
        total: 1,
        pageNum: 1,
        pageSize: 20,
        list: [
          {
            id: '1',
            channelCode: 'CH_ALIPAY',
            channelName: '支付宝业务渠道',
            secretVersion: 2,
            status: true,
            lastRotatedAt: '2026-09-15T12:00:00',
            createTime: '2026-09-15T10:00:00',
            updateTime: '2026-09-15T12:00:00',
          },
        ],
      });

      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <ChannelCredentialsPage />
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText('支付宝业务渠道')).toBeInTheDocument();
        expect(screen.getByText('CH_ALIPAY')).toBeInTheDocument();
      });
    });
  });
});
