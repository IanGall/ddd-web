import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { type InternalAxiosRequestConfig, type AxiosResponse, AxiosHeaders } from 'axios';
import { randomId } from '@/utils/randomId';
import { apiClient, refreshClient, request, randomId as clientRandomId } from '@/api/client';
import { useAuthStore } from '@/store/auth';
import { ResponseCode, type Response, type TokenResponse } from '@/api/types';

// RFC 4122 v4 UUID 正则规范：36 字符，第 15 位为 '4'，第 20 位为 8/9/a/b
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('randomId 唯一 ID 生成单点与能力降级测试', () => {
  const originalCrypto = globalThis.crypto;

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('1. 安全上下文路径：当原生 crypto.randomUUID 可用时直接调用原生方法', () => {
    // 确保 randomUUID 存在并 spy 它
    expect(typeof originalCrypto?.randomUUID).toBe('function');
    const spy = vi.spyOn(originalCrypto, 'randomUUID');

    const id = randomId();

    expect(spy).toHaveBeenCalled();
    expect(id).toMatch(UUID_V4_REGEX);
    expect(id).toHaveLength(36);
  });

  it('2. 非安全上下文路径（核心场景）：crypto.randomUUID 为 undefined 时，降级到 crypto.getRandomValues 且不抛错', () => {
    // 模拟真实非安全上下文（如 http://gateway.example.com）：
    // 浏览器保留 getRandomValues，但 window.crypto.randomUUID 是 undefined
    const mockGetRandomValues = vi.fn((array: Uint8Array<ArrayBuffer>) => {
      return originalCrypto.getRandomValues(array);
    });

    const insecureCrypto = {
      getRandomValues: mockGetRandomValues,
      randomUUID: undefined,
    };

    vi.stubGlobal('crypto', insecureCrypto);

    expect(globalThis.crypto.randomUUID).toBeUndefined();
    expect(typeof globalThis.crypto.getRandomValues).toBe('function');

    // 严禁抛出 TypeError: crypto.randomUUID is not a function
    let id = '';
    expect(() => {
      id = randomId();
    }).not.toThrow();

    expect(mockGetRandomValues).toHaveBeenCalledTimes(1);
    expect(id).toMatch(UUID_V4_REGEX);
    expect(id).toHaveLength(36);
    // 验证 UUID v4 版本位 (第 14 字符索引，从 0 开始对应第 14 位字符是 '4')
    expect(id.charAt(14)).toBe('4');
    // 验证 RFC 4122 变体位 (第 19 字符索引是 8, 9, a, 或 b)
    expect(['8', '9', 'a', 'b']).toContain(id.charAt(19));
  });

  it('3. 极端环境路径：无 Crypto 支持（或 getRandomValues 不可用）时降级至 Math.random', () => {
    // 模拟既没有 randomUUID 也没有 getRandomValues 的极端环境
    vi.stubGlobal('crypto', {});

    let id = '';
    expect(() => {
      id = randomId();
    }).not.toThrow();

    expect(id).toMatch(UUID_V4_REGEX);
    expect(id).toHaveLength(36);
    expect(id.charAt(14)).toBe('4');
    expect(['8', '9', 'a', 'b']).toContain(id.charAt(19));
  });

  it('4. 碰撞与唯一性验证：非安全上下文下连续生成 1000 个 ID 不重复', () => {
    // 在非安全上下文下
    const insecureCrypto = {
      getRandomValues: (array: Uint8Array<ArrayBuffer>) => originalCrypto.getRandomValues(array),
      randomUUID: undefined,
    };
    vi.stubGlobal('crypto', insecureCrypto);

    const count = 1000;
    const ids = new Set<string>();
    for (let i = 0; i < count; i++) {
      ids.add(randomId());
    }

    expect(ids.size).toBe(count);
  });
});

describe('非安全上下文回归断言：API 拦截器与 Token 刷新链路行为', () => {
  const originalCrypto = globalThis.crypto;

  beforeEach(() => {
    // 每个用例均强制在非安全上下文（无 randomUUID）下运行
    const insecureCrypto = {
      getRandomValues: (array: Uint8Array<ArrayBuffer>) => originalCrypto.getRandomValues(array),
      randomUUID: undefined,
    };
    vi.stubGlobal('crypto', insecureCrypto);
    useAuthStore.getState().clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('5. client.ts 导出的 randomId 在非安全上下文下产出合法 UUID 且不抛错', () => {
    let id = '';
    expect(() => {
      id = clientRandomId();
    }).not.toThrow();

    expect(id).toMatch(UUID_V4_REGEX);
    expect(id).toHaveLength(36);
  });

  it('6. 回归断言：非安全上下文下发起真实请求走请求拦截器，自动生成 X-Request-Id 且不抛错', async () => {
    // 拦截 apiClient 的底层 adapter，避免发出真实网络请求
    let interceptedRequestId: string | undefined = undefined;

    const testAdapter = async (config: InternalAxiosRequestConfig) => {
      interceptedRequestId = config.headers.get('X-Request-Id') as string;
      return {
        data: { code: ResponseCode.SUCCESS, info: 'ok', data: 'success' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    };

    // 发起请求，触发 apiClient.interceptors.request 拦截器链
    const res = await apiClient.get('/api/test-insecure-context', {
      adapter: testAdapter,
      skipGlobalNotice: true,
    });

    expect(res).toBe('success');
    expect(interceptedRequestId).toBeDefined();
    expect(interceptedRequestId).toMatch(UUID_V4_REGEX);
    expect(interceptedRequestId).toHaveLength(36);
  });

  it('7. 请求拦截器对已有 X-Request-Id 保持透传，不重复覆盖', async () => {
    let receivedRequestId: string | undefined = undefined;

    const testAdapter = async (config: InternalAxiosRequestConfig) => {
      receivedRequestId = config.headers.get('X-Request-Id') as string;
      return {
        data: { code: ResponseCode.SUCCESS, info: 'ok', data: 'success' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    };

    await apiClient.get('/api/test-custom-id', {
      adapter: testAdapter,
      headers: {
        'X-Request-Id': 'custom-preset-request-id-12345',
      },
      skipGlobalNotice: true,
    });

    expect(receivedRequestId).toBe('custom-preset-request-id-12345');
  });

  it('8. 回归断言：非安全上下文下 performTokenRefresh 生成 X-Request-Id 且不抛错', async () => {
    // 设置已过期的登录态
    useAuthStore.getState().setToken({
      accessToken: 'expired-access-token',
      refreshToken: 'valid-refresh-token',
      tokenType: 'Bearer',
      expiresIn: 3600,
      refreshExpiresIn: 7200,
      sessionId: 'session-refresh-test',
      userId: '1',
      accountId: '100',
      username: 'test_admin',
      userType: 'ADMIN_SUB_ACCOUNT',
    });

    let refreshRequestId: string | undefined = undefined;

    // Mock refreshClient.post 拦截 refresh 请求
    vi.spyOn(refreshClient, 'post').mockImplementation(async (_url, _data, config) => {
      refreshRequestId = (config?.headers as Record<string, string> | undefined)?.['X-Request-Id'];
      return {
        data: {
          code: ResponseCode.SUCCESS,
          info: '刷新成功',
          data: {
            accessToken: 'new-fresh-token',
            refreshToken: 'new-refresh-token',
            tokenType: 'Bearer',
            expiresIn: 3600,
            refreshExpiresIn: 7200,
            sessionId: 'session-refresh-test',
            userId: '1',
            accountId: '100',
            username: 'test_admin',
            userType: 'ADMIN_SUB_ACCOUNT',
          },
        },
        status: 200,
        statusText: 'OK',
        headers: new AxiosHeaders(),
        config: config as InternalAxiosRequestConfig,
      } as AxiosResponse<Response<TokenResponse>>;
    });

    // 业务请求 adapter：第一次返回 401 AUTH_REQUIRED，第二次重放返回 200 SUCCESS
    let attempts = 0;
    apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
      attempts++;
      const authHeader = config.headers.get('Authorization') as string;
      if (authHeader === 'Bearer expired-access-token') {
        const error = new Error('Unauthorized');
        Object.assign(error, {
          response: {
            data: { code: ResponseCode.AUTH_REQUIRED, info: '令牌已过期', data: null },
            status: 401,
            headers: new AxiosHeaders(),
            config,
          },
          config,
        });
        return Promise.reject(error);
      }
      return {
        data: { code: ResponseCode.SUCCESS, info: 'ok', data: { refreshed: true } },
        status: 200,
        statusText: 'OK',
        headers: new AxiosHeaders(),
        config,
      };
    };

    const result = await request.get<{ refreshed: boolean }>('/api/admin/resource', {
      skipGlobalNotice: true,
    });

    expect(result).toEqual({ refreshed: true });
    expect(attempts).toBe(2);
    // 验证在非安全上下文下，performTokenRefresh 成功生成合法的 X-Request-Id
    expect(refreshRequestId).toBeDefined();
    expect(refreshRequestId).toMatch(UUID_V4_REGEX);
    expect(refreshRequestId).toHaveLength(36);
  });

  it('9. authStore 的 deviceId 在非安全上下文下生成 web-<uuid_v4> 格式', () => {
    const state = useAuthStore.getState();
    expect(state.deviceId).toBeDefined();
    expect(state.deviceId).toMatch(
      /^web-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
