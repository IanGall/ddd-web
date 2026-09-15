import { describe, it, expect, vi, beforeEach } from 'vitest';
import { request } from '@/api/client';
import { channelApi } from '@/api/channel';

vi.mock('@/api/client', () => ({
  request: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('channelApi Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. list 应正确清洗参数并发起 GET /api/admin/platform/channel-credentials', async () => {
    const mockResponse = {
      total: 2,
      pageNum: 1,
      pageSize: 20,
      list: [
        {
          id: '1',
          channelCode: 'CH_001',
          channelName: '微信支付',
          secretVersion: 1,
          status: true,
          lastRotatedAt: '2026-09-15T12:00:00',
          createTime: '2026-09-15T10:00:00',
          updateTime: '2026-09-15T12:00:00',
        },
      ],
    };

    vi.mocked(request.get).mockResolvedValueOnce(mockResponse);

    const res = await channelApi.list({
      pageNum: 1,
      pageSize: 20,
      channelCode: '  CH_001  ',
      channelName: '  微信支付  ',
      status: true,
    });

    expect(request.get).toHaveBeenCalledWith('/api/admin/platform/channel-credentials', {
      params: {
        pageNum: 1,
        pageSize: 20,
        channelCode: 'CH_001',
        channelName: '微信支付',
        status: true,
      },
    });
    expect(res).toEqual(mockResponse);
  });

  it('1. list 当参数为空时应传递空/默认参数', async () => {
    vi.mocked(request.get).mockResolvedValueOnce({ total: 0, pageNum: 1, pageSize: 20, list: [] });

    await channelApi.list();

    expect(request.get).toHaveBeenCalledWith('/api/admin/platform/channel-credentials', {
      params: {},
    });
  });

  it('2. getById 应发起 GET /api/admin/platform/channel-credentials/{id}', async () => {
    const mockDetail = {
      id: '10',
      channelCode: 'CH_TEST',
      channelName: '测试渠道',
      secretVersion: 2,
      status: true,
      lastRotatedAt: '2026-09-15T10:00:00',
      createTime: '2026-09-14T10:00:00',
      updateTime: '2026-09-15T10:00:00',
    };

    vi.mocked(request.get).mockResolvedValueOnce(mockDetail);

    const res = await channelApi.getById('10');
    expect(request.get).toHaveBeenCalledWith(
      '/api/admin/platform/channel-credentials/10',
      undefined,
    );
    expect(res).toEqual(mockDetail);
  });

  it('3. create 应发起 POST /api/admin/platform/channel-credentials 并返回密钥凭据', async () => {
    const mockSecret = {
      id: '11',
      channelCode: 'CH_NEW',
      channelSecret: 'sec_1234567890abcdef',
      secretVersion: 1,
    };

    vi.mocked(request.post).mockResolvedValueOnce(mockSecret);

    const res = await channelApi.create({ channelName: '新渠道' });
    expect(request.post).toHaveBeenCalledWith(
      '/api/admin/platform/channel-credentials',
      { channelName: '新渠道' },
      undefined,
    );
    expect(res).toEqual(mockSecret);
  });

  it('4. update 应发起 PUT /api/admin/platform/channel-credentials/{id}', async () => {
    const mockUpdated = {
      id: '12',
      channelCode: 'CH_12',
      channelName: '已更名渠道',
      secretVersion: 1,
      status: true,
      lastRotatedAt: '2026-09-15T10:00:00',
      createTime: '2026-09-15T10:00:00',
      updateTime: '2026-09-15T14:00:00',
    };

    vi.mocked(request.put).mockResolvedValueOnce(mockUpdated);

    const res = await channelApi.update('12', { channelName: '已更名渠道' });
    expect(request.put).toHaveBeenCalledWith(
      '/api/admin/platform/channel-credentials/12',
      { channelName: '已更名渠道' },
      undefined,
    );
    expect(res).toEqual(mockUpdated);
  });

  it('5. updateStatus 应发起 PUT /api/admin/platform/channel-credentials/{id}/status', async () => {
    const mockUpdated = {
      id: '13',
      channelCode: 'CH_13',
      channelName: '渠道13',
      secretVersion: 1,
      status: false,
      lastRotatedAt: '2026-09-15T10:00:00',
      createTime: '2026-09-15T10:00:00',
      updateTime: '2026-09-15T14:00:00',
    };

    vi.mocked(request.put).mockResolvedValueOnce(mockUpdated);

    const res = await channelApi.updateStatus('13', { status: false });
    expect(request.put).toHaveBeenCalledWith(
      '/api/admin/platform/channel-credentials/13/status',
      { status: false },
      undefined,
    );
    expect(res.status).toBe(false);
  });

  it('6. rotateSecret 应发起 POST /api/admin/platform/channel-credentials/{id}/secret/rotate', async () => {
    const mockNewSecret = {
      id: '14',
      channelCode: 'CH_14',
      channelSecret: 'sec_rotated_999999',
      secretVersion: 3,
    };

    vi.mocked(request.post).mockResolvedValueOnce(mockNewSecret);

    const res = await channelApi.rotateSecret('14');
    expect(request.post).toHaveBeenCalledWith(
      '/api/admin/platform/channel-credentials/14/secret/rotate',
      undefined,
      undefined,
    );
    expect(res).toEqual(mockNewSecret);
  });

  it('7. delete 应发起 DELETE /api/admin/platform/channel-credentials/{id}', async () => {
    vi.mocked(request.delete).mockResolvedValueOnce(true);

    const res = await channelApi.delete('15');
    expect(request.delete).toHaveBeenCalledWith(
      '/api/admin/platform/channel-credentials/15',
      undefined,
    );
    expect(res).toBe(true);
  });

  it('8. getDataScopes 应发起 GET /api/admin/platform/channel-credentials/{id}/data-scopes/{scopeType}', async () => {
    const mockScopes = [
      { scopeType: 'api', scopeValue: '/api/v1/trade' },
      { scopeType: 'api', scopeValue: '/api/v1/query' },
    ];

    vi.mocked(request.get).mockResolvedValueOnce(mockScopes);

    const res = await channelApi.getDataScopes('16', 'api');
    expect(request.get).toHaveBeenCalledWith(
      '/api/admin/platform/channel-credentials/16/data-scopes/api',
      undefined,
    );
    expect(res).toEqual(mockScopes);
  });

  it('9. replaceDataScopes 应发起 PUT /api/admin/platform/channel-credentials/{id}/data-scopes/{scopeType}', async () => {
    const newScopes = [
      { scopeType: 'merchant', scopeValue: 'MCH_A' },
      { scopeType: 'merchant', scopeValue: 'MCH_B' },
    ];

    vi.mocked(request.put).mockResolvedValueOnce(newScopes);

    const res = await channelApi.replaceDataScopes('17', 'merchant', {
      scopeValues: ['MCH_A', 'MCH_B'],
    });

    expect(request.put).toHaveBeenCalledWith(
      '/api/admin/platform/channel-credentials/17/data-scopes/merchant',
      { scopeValues: ['MCH_A', 'MCH_B'] },
      undefined,
    );
    expect(res).toEqual(newScopes);
  });
});
