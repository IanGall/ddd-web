import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { DetailDrawer } from '@/pages/channel/ChannelCredentials/DetailDrawer';
import { channelApi, type ChannelCredentialDTO } from '@/api/channel';

vi.mock('@/api/channel', () => ({
  channelApi: {
    getById: vi.fn(),
  },
}));

describe('DetailDrawer (渠道凭证 只读详情抽屉)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  const mockDetail1: ChannelCredentialDTO = {
    id: '101',
    channelCode: 'CH_ALIPAY_DETAIL',
    channelName: '支付宝详情测试渠道',
    secretVersion: 3,
    status: true,
    lastRotatedAt: '2026-09-17T12:00:00',
    createTime: '2026-09-15T10:00:00',
    updateTime: '2026-09-18T11:00:00',
  };

  const mockDetail2: ChannelCredentialDTO = {
    id: '102',
    channelCode: 'CH_WXPAY_DETAIL',
    channelName: '微信支付详情测试渠道',
    secretVersion: 1,
    status: false,
    lastRotatedAt: '',
    createTime: '2026-09-16T10:00:00',
    updateTime: '2026-09-16T10:00:00',
  };

  it('加载成功后的展示 - 请求返回后正确展示凭证详情各字段与安全提示', async () => {
    vi.mocked(channelApi.getById).mockResolvedValueOnce(mockDetail1);

    render(<DetailDrawer open={true} credentialId="101" onClose={vi.fn()} />);

    expect(screen.getByRole('heading', { name: '渠道凭证详情' })).toBeInTheDocument();

    await waitFor(() => {
      expect(channelApi.getById).toHaveBeenCalledWith('101');
      // 验证安全提示文案
      expect(screen.getByText('安全保护说明')).toBeInTheDocument();
      // 验证核心字段正确渲染
      expect(screen.getByText('CH_ALIPAY_DETAIL')).toBeInTheDocument();
      expect(screen.getByText('支付宝详情测试渠道')).toBeInTheDocument();
      expect(screen.getByText('v3')).toBeInTheDocument();
      expect(screen.getByText('启用中')).toBeInTheDocument();
      expect(screen.getByText('2026-09-17T12:00:00')).toBeInTheDocument();
      expect(screen.getByText('2026-09-15T10:00:00')).toBeInTheDocument();
    });
  });

  it('请求失败后 loading 结束（不能一直转圈） - 接口报错时 spinner 消失并展示暂无数据', async () => {
    vi.mocked(channelApi.getById).mockRejectedValueOnce(new Error('服务端 500 异常'));

    render(<DetailDrawer open={true} credentialId="101" onClose={vi.fn()} />);

    // 等待请求结束
    await waitFor(() => {
      expect(channelApi.getById).toHaveBeenCalledWith('101');
    });

    // 验证 loading 状态已退出，不可一直处于转圈态
    await waitFor(() => {
      expect(screen.queryByText('加载渠道凭证详情中...')).not.toBeInTheDocument();
    });

    // 数据为空时呈现暂无数据兜底
    expect(screen.getByText('暂无数据')).toBeInTheDocument();
  });

  it('关闭后重开 - 关闭后再打开同一目标重新触发 getById 并渲染', async () => {
    vi.mocked(channelApi.getById).mockResolvedValue(mockDetail1);

    const { rerender } = render(<DetailDrawer open={true} credentialId="101" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('支付宝详情测试渠道')).toBeInTheDocument();
    });

    // 关闭抽屉
    rerender(<DetailDrawer open={false} credentialId="101" onClose={vi.fn()} />);

    // 重新打开抽屉
    rerender(<DetailDrawer open={true} credentialId="101" onClose={vi.fn()} />);

    // 重新发起了详情请求
    await waitFor(() => {
      expect(channelApi.getById).toHaveBeenCalledTimes(2);
      expect(screen.getByText('支付宝详情测试渠道')).toBeInTheDocument();
    });
  });

  it('切换 credentialId 时重新加载 - 从 ID A 切换到 ID B 发起新请求并展示新凭证内容', async () => {
    vi.mocked(channelApi.getById).mockImplementation((id: string) => {
      if (id === '101') return Promise.resolve(mockDetail1);
      if (id === '102') return Promise.resolve(mockDetail2);
      return Promise.reject(new Error('not found'));
    });

    const { rerender } = render(<DetailDrawer open={true} credentialId="101" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('支付宝详情测试渠道')).toBeInTheDocument();
      expect(screen.getByText('CH_ALIPAY_DETAIL')).toBeInTheDocument();
    });

    // 切换到目标 102
    rerender(<DetailDrawer open={true} credentialId="102" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(channelApi.getById).toHaveBeenCalledWith('102');
      expect(screen.getByText('微信支付详情测试渠道')).toBeInTheDocument();
      expect(screen.getByText('CH_WXPAY_DETAIL')).toBeInTheDocument();
      expect(screen.getByText('已停用')).toBeInTheDocument();
    });

    // 旧目标内容已被清除
    expect(screen.queryByText('支付宝详情测试渠道')).not.toBeInTheDocument();
  });

  it('竞态防护 - 旧请求延迟返回的结果不得覆盖新目标数据', async () => {
    let resolveFirstReq!: (val: ChannelCredentialDTO) => void;
    let resolveSecondReq!: (val: ChannelCredentialDTO) => void;

    const firstPromise = new Promise<ChannelCredentialDTO>((res) => {
      resolveFirstReq = res;
    });
    const secondPromise = new Promise<ChannelCredentialDTO>((res) => {
      resolveSecondReq = res;
    });

    vi.mocked(channelApi.getById).mockImplementation((id: string) => {
      if (id === '101') return firstPromise;
      if (id === '102') return secondPromise;
      return Promise.reject(new Error('unknown id'));
    });

    const { rerender } = render(<DetailDrawer open={true} credentialId="101" onClose={vi.fn()} />);

    // 切换到 102，此时 101 的请求还在 pending 中
    rerender(<DetailDrawer open={true} credentialId="102" onClose={vi.fn()} />);

    // 后发起的 102 请求先返回结果
    await act(async () => {
      resolveSecondReq(mockDetail2);
    });

    await waitFor(() => {
      expect(screen.getByText('微信支付详情测试渠道')).toBeInTheDocument();
    });

    // 先发起的 101 请求延迟完成返回
    await act(async () => {
      resolveFirstReq(mockDetail1);
    });

    // 等待微任务队列清空
    await new Promise((resolve) => setTimeout(resolve, 50));

    // 严苛验证：当前依然展示 102 的内容，101 的过时结果被忽略，不得覆盖新目标
    expect(screen.getByText('微信支付详情测试渠道')).toBeInTheDocument();
    expect(screen.queryByText('支付宝详情测试渠道')).not.toBeInTheDocument();
  });

  it('点击关闭叉号按钮触发 onClose 回调', async () => {
    const handleClose = vi.fn();
    vi.mocked(channelApi.getById).mockResolvedValueOnce(mockDetail1);

    render(<DetailDrawer open={true} credentialId="101" onClose={handleClose} />);

    await waitFor(() => {
      expect(screen.getByText('支付宝详情测试渠道')).toBeInTheDocument();
    });

    const closeBtn = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeBtn);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
