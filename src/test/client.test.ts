import { describe, it, expect, beforeEach, vi, type MockInstance } from 'vitest';
import axios, { AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { message } from 'antd';
import { apiClient, refreshClient, setRedirectHandler, request } from '@/api/client';
import { useAuthStore } from '@/store/auth';
import { ApiError, ResponseCode } from '@/api/types';

describe('HTTP Client & Refresh Single-Flight', () => {
  let redirectedPath: string | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    redirectedPath = null;
    setRedirectHandler((path) => {
      redirectedPath = path;
    });

    useAuthStore.getState().clear();
  });

  it('并发 N 个 401 只触发 1 次 refresh（单飞）且刷新成功后自动重放原请求', async () => {
    // 初始登录态
    useAuthStore.getState().setToken({
      accessToken: 'expired-access-token',
      refreshToken: 'valid-refresh-token',
      tokenType: 'Bearer',
      expiresIn: 3600,
      refreshExpiresIn: 7200,
      sessionId: 'session-1',
      userId: 1,
      accountId: 100,
      username: 'test_admin',
      userType: 'ADMIN_SUB_ACCOUNT',
    });

    let refreshCallCount = 0;

    // Mock refreshClient.post
    vi.spyOn(refreshClient, 'post').mockImplementation(async (_url, data) => {
      refreshCallCount++;
      // 模拟网络延迟以确保并发请求能够排队
      await new Promise((resolve) => setTimeout(resolve, 50));

      const reqBody = data as { refreshToken: string };
      expect(reqBody.refreshToken).toBe('valid-refresh-token');

      return {
        data: {
          code: ResponseCode.SUCCESS,
          info: '刷新成功',
          data: {
            accessToken: 'new-fresh-access-token',
            refreshToken: 'new-fresh-refresh-token',
            tokenType: 'Bearer',
            expiresIn: 3600,
            refreshExpiresIn: 7200,
            sessionId: 'session-1',
            userId: 1,
            accountId: 100,
            username: 'test_admin',
            userType: 'ADMIN_SUB_ACCOUNT',
          },
        },
        status: 200,
        statusText: 'OK',
        headers: new AxiosHeaders(),
        config: {} as InternalAxiosRequestConfig,
      } as AxiosResponse;
    });

    // 记录各业务请求的执行历史
    const businessCallAttempts: Record<string, number> = {};

    apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
      const url = config.url || '';
      businessCallAttempts[url] = (businessCallAttempts[url] || 0) + 1;

      const authHeader = config.headers.get('Authorization') as string;

      // 第一次请求携带过期 token，返回 401 AUTH_REQUIRED
      if (authHeader === 'Bearer expired-access-token') {
        const error = new axios.AxiosError(
          'Request failed with status code 401',
          'ERR_BAD_REQUEST',
          config,
          null,
          {
            data: {
              code: ResponseCode.AUTH_REQUIRED,
              info: '令牌已过期',
              data: null,
            },
            status: 401,
            statusText: 'Unauthorized',
            headers: new AxiosHeaders({ 'x-request-id': 'req-401' }),
            config,
          },
        );
        return Promise.reject(error);
      }

      // 重放请求携带新 token，返回 200 SUCCESS
      if (authHeader === 'Bearer new-fresh-access-token') {
        return {
          data: {
            code: ResponseCode.SUCCESS,
            info: '成功',
            data: { message: `result for ${url}` },
          },
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders({ 'x-request-id': 'req-200' }),
          config,
        };
      }

      throw new Error(`Unexpected Authorization header: ${authHeader}`);
    };

    // 并发触发 5 个业务请求
    const urls = [
      '/api/admin/resource/1',
      '/api/admin/resource/2',
      '/api/admin/resource/3',
      '/api/admin/resource/4',
      '/api/admin/resource/5',
    ];

    const results = await Promise.all(
      urls.map((url) => request.get<{ message: string }>(url, { skipGlobalNotice: true })),
    );

    // 1. 验证单飞：刷新接口只被调用了 EXACTLY 1 次
    expect(refreshCallCount).toBe(1);

    // 2. 验证所有并发请求均收到重放后的正确业务数据
    expect(results).toHaveLength(5);
    results.forEach((res, index) => {
      expect(res).toEqual({ message: `result for ${urls[index]}` });
    });

    // 3. 验证内存中登录态已更新为新 token
    const storeState = useAuthStore.getState();
    expect(storeState.accessToken).toBe('new-fresh-access-token');
    expect(storeState.refreshToken).toBe('new-fresh-refresh-token');

    // 4. 每个资源请求各调用了 2 次（初次 401 + 重放 200）
    urls.forEach((url) => {
      expect(businessCallAttempts[url]).toBe(2);
    });
  });

  it('refresh 返回 AUTH_REQUIRED 时清态跳 /login 且不再重试', async () => {
    // 初始登录态
    useAuthStore.getState().setToken({
      accessToken: 'expired-access-token',
      refreshToken: 'revoked-refresh-token',
      tokenType: 'Bearer',
      expiresIn: 3600,
      refreshExpiresIn: 7200,
      sessionId: 'session-2',
      userId: 2,
      accountId: 200,
      username: 'revoked_user',
      userType: 'ADMIN_SUB_ACCOUNT',
    });

    let refreshCallCount = 0;

    // 模拟 refresh 返回 AUTH_REQUIRED（终态）
    vi.spyOn(refreshClient, 'post').mockImplementation(async () => {
      refreshCallCount++;
      return {
        data: {
          code: ResponseCode.AUTH_REQUIRED,
          info: '会话已失效，请重新登录',
          data: null,
        },
        status: 401,
        statusText: 'Unauthorized',
        headers: new AxiosHeaders(),
        config: {} as InternalAxiosRequestConfig,
      } as AxiosResponse;
    });

    let businessAttemptCount = 0;
    apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
      businessAttemptCount++;
      const error = new axios.AxiosError(
        'Request failed with status code 401',
        'ERR_BAD_REQUEST',
        config,
        null,
        {
          data: {
            code: ResponseCode.AUTH_REQUIRED,
            info: '令牌已过期',
            data: null,
          },
          status: 401,
          statusText: 'Unauthorized',
          headers: new AxiosHeaders({ 'x-request-id': 'req-401' }),
          config,
        },
      );
      return Promise.reject(error);
    };

    // 发起请求，预期失败拒绝
    await expect(request.get('/api/admin/users', { skipGlobalNotice: true })).rejects.toThrow(
      ApiError,
    );

    // 1. refresh 仅尝试 1 次
    expect(refreshCallCount).toBe(1);

    // 2. 原业务请求未进行二次无意义重试
    expect(businessAttemptCount).toBe(1);

    // 3. 内存登录态被彻底清空
    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.sessionId).toBeNull();
    expect(state.isAuthenticated()).toBe(false);

    // 4. 重定向至 /login
    expect(redirectedPath).toBe('/login');
  });

  it('登录/刷新接口自身返回 401 时不得递归触发 refresh', async () => {
    let refreshCallCount = 0;
    vi.spyOn(refreshClient, 'post').mockImplementation(async () => {
      refreshCallCount++;
      return {} as AxiosResponse;
    });

    apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
      const error = new axios.AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, null, {
        data: {
          code: ResponseCode.AUTH_REQUIRED,
          info: '用户名或密码错误',
          data: null,
        },
        status: 401,
        statusText: 'Unauthorized',
        headers: new AxiosHeaders(),
        config,
      });
      return Promise.reject(error);
    };

    await expect(
      request.post(
        '/api/admin/auth/login',
        { loginName: 'bad_user', password: 'bad_password' },
        { skipGlobalNotice: true },
      ),
    ).rejects.toThrow(ApiError);

    // refresh 未被递归触发
    expect(refreshCallCount).toBe(0);
  });

  it('按响应体 code 正确返回 data 或抛出保留完整信息的 ApiError', async () => {
    // 成功用例
    apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
      return {
        data: {
          code: ResponseCode.SUCCESS,
          info: '成功',
          data: { foo: 'bar' },
        },
        status: 200,
        statusText: 'OK',
        headers: new AxiosHeaders({ 'x-request-id': 'req-success-123' }),
        config,
      };
    };

    const res = await request.get<{ foo: string }>('/api/admin/test', {
      skipGlobalNotice: true,
    });
    expect(res).toEqual({ foo: 'bar' });

    // 错误码分流（如 INVALID_ARGUMENT）
    apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
      const error = new axios.AxiosError('Bad Request', 'ERR_BAD_REQUEST', config, null, {
        data: {
          code: ResponseCode.INVALID_ARGUMENT,
          info: '用户名格式不符合规范',
          data: { field: 'username' },
        },
        status: 400,
        statusText: 'Bad Request',
        headers: new AxiosHeaders({ 'x-request-id': 'req-err-456' }),
        config,
      });
      return Promise.reject(error);
    };

    try {
      await request.post('/api/admin/users', {}, { skipGlobalNotice: true });
      expect.fail('Should have rejected with ApiError');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.code).toBe(ResponseCode.INVALID_ARGUMENT);
      expect(apiErr.info).toBe('用户名格式不符合规范');
      expect(apiErr.requestId).toBe('req-err-456');
      expect(apiErr.status).toBe(400);
      expect(apiErr.data).toEqual({ field: 'username' });
    }
  });
});

describe('A4 错误码语义分流与前端行为断言', () => {
  let redirectedPath: string | null = null;
  let messageErrorSpy: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    redirectedPath = null;
    setRedirectHandler((path) => {
      redirectedPath = path;
    });
    messageErrorSpy = vi
      .spyOn(message, 'error')
      .mockImplementation(() => (() => {}) as unknown as ReturnType<typeof message.error>);
    useAuthStore.getState().clear();
  });

  // 1. ACCESS_DENIED(403)
  it('ACCESS_DENIED(403) 弹出「无权访问」提示，且不得触发跳转 /login 或清除已有登录态', async () => {
    // 设置有效登录态
    useAuthStore.getState().setToken({
      accessToken: 'valid-access-token',
      refreshToken: 'valid-refresh-token',
      tokenType: 'Bearer',
      expiresIn: 3600,
      refreshExpiresIn: 7200,
      sessionId: 'session-403',
      userId: 1,
      accountId: 100,
      username: 'sub_admin',
      userType: 'ADMIN_SUB_ACCOUNT',
    });

    const refreshSpy = vi.spyOn(refreshClient, 'post');

    apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
      const error = new axios.AxiosError('Forbidden', 'ERR_BAD_REQUEST', config, null, {
        data: {
          code: ResponseCode.ACCESS_DENIED,
          info: '无权访问此资源',
          data: null,
        },
        status: 403,
        statusText: 'Forbidden',
        headers: new AxiosHeaders({ 'x-request-id': 'req-403' }),
        config,
      });
      return Promise.reject(error);
    };

    let caughtError: ApiError | null = null;
    try {
      await request.get('/api/admin/roles');
    } catch (err) {
      caughtError = err as ApiError;
    }

    // 断言抛错为 ApiError 且带有对应错误码
    expect(caughtError).toBeInstanceOf(ApiError);
    expect(caughtError?.code).toBe(ResponseCode.ACCESS_DENIED);

    // 断言行为 1：弹出「无权访问」类用户可见提示
    expect(messageErrorSpy).toHaveBeenCalledTimes(1);
    expect(messageErrorSpy).toHaveBeenCalledWith(expect.stringContaining('无权访问'));

    // 断言行为 2：严禁跳转 /login（403 是权限问题不是认证问题，跳登录会让用户误以为掉线）
    expect(redirectedPath).toBeNull();

    // 断言行为 3：严禁触发 refresh
    expect(refreshSpy).not.toHaveBeenCalled();

    // 断言行为 4：已有登录态保持完整
    expect(useAuthStore.getState().accessToken).toBe('valid-access-token');
  });

  // 2. AUTH_RATE_LIMITED(429)
  it('AUTH_RATE_LIMITED(429) 提示「登录尝试过于频繁」文案，且不得自动重试', async () => {
    let attemptCount = 0;
    const refreshSpy = vi.spyOn(refreshClient, 'post');

    apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
      attemptCount++;
      const error = new axios.AxiosError('Too Many Requests', 'ERR_BAD_REQUEST', config, null, {
        data: {
          code: ResponseCode.AUTH_RATE_LIMITED,
          info: '登录尝试过于频繁，请稍后再试',
          data: null,
        },
        status: 429,
        statusText: 'Too Many Requests',
        headers: new AxiosHeaders({ 'x-request-id': 'req-429' }),
        config,
      });
      return Promise.reject(error);
    };

    let caughtError: ApiError | null = null;
    try {
      await request.post('/api/admin/auth/login', { loginName: 'test', password: 'password' });
    } catch (err) {
      caughtError = err as ApiError;
    }

    expect(caughtError).toBeInstanceOf(ApiError);
    expect(caughtError?.code).toBe(ResponseCode.AUTH_RATE_LIMITED);

    // 断言行为 1：提示「登录尝试过于频繁」文案
    expect(messageErrorSpy).toHaveBeenCalledTimes(1);
    expect(messageErrorSpy).toHaveBeenCalledWith(expect.stringContaining('登录尝试过于频繁'));

    // 断言行为 2：不得自动重试（自动重试只会把 IP 打进更长的封禁）
    expect(attemptCount).toBe(1);

    // 断言行为 3：不触发 refresh 与跳转
    expect(refreshSpy).not.toHaveBeenCalled();
    expect(redirectedPath).toBeNull();
  });

  // 3. INTERNAL_ERROR(500)
  it('INTERNAL_ERROR(500) 弹出通用错误提示，且必须把 X-Request-Id 展示出来便于排障', async () => {
    apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
      const error = new axios.AxiosError(
        'Internal Server Error',
        'ERR_BAD_RESPONSE',
        config,
        null,
        {
          data: {
            code: ResponseCode.INTERNAL_ERROR,
            info: '数据库连接池等待超时',
            data: null,
          },
          status: 500,
          statusText: 'Internal Server Error',
          headers: new AxiosHeaders({ 'x-request-id': 'trace-uuid-500-abc' }),
          config,
        },
      );
      return Promise.reject(error);
    };

    let caughtError: ApiError | null = null;
    try {
      await request.get('/api/admin/status');
    } catch (err) {
      caughtError = err as ApiError;
    }

    expect(caughtError).toBeInstanceOf(ApiError);
    expect(caughtError?.code).toBe(ResponseCode.INTERNAL_ERROR);
    expect(caughtError?.requestId).toBe('trace-uuid-500-abc');

    // 断言行为：必须弹出通用错误提示，且必须包含 X-Request-Id 便于排障
    expect(messageErrorSpy).toHaveBeenCalledTimes(1);
    expect(messageErrorSpy).toHaveBeenCalledWith(expect.stringContaining('trace-uuid-500-abc'));
    expect(messageErrorSpy).toHaveBeenCalledWith(expect.stringContaining('系统内部错误'));
    expect(redirectedPath).toBeNull();
  });

  // 4. RPC_TIMEOUT(504) / RPC_ERROR(502) / RPC_NO_PROVIDER(503) / AUTH_UNAVAILABLE(503)
  it.each([
    {
      code: ResponseCode.RPC_TIMEOUT,
      status: 504,
      info: '下游服务调用超时，请稍后重试',
      expectedMsg: '下游服务调用超时，请稍后重试',
    },
    {
      code: ResponseCode.RPC_ERROR,
      status: 502,
      info: '下游服务不可用，请稍后重试',
      expectedMsg: '下游服务不可用，请稍后重试',
    },
    {
      code: ResponseCode.RPC_NO_PROVIDER,
      status: 503,
      info: '下游服务不可用，请稍后重试',
      expectedMsg: '下游服务不可用，请稍后重试',
    },
    {
      code: ResponseCode.AUTH_UNAVAILABLE,
      status: 503,
      info: '下游服务不可用，请稍后重试',
      expectedMsg: '下游服务不可用，请稍后重试',
    },
  ])(
    '$code($status) 提示下游不可用，且不触发 refresh、不跳登录（服务不可用不等于令牌失效）',
    async ({ code, status, info, expectedMsg }) => {
      useAuthStore.getState().setToken({
        accessToken: 'active-token-before-rpc-error',
        refreshToken: 'active-refresh-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
        refreshExpiresIn: 7200,
        sessionId: 'session-rpc',
        userId: 1,
        accountId: 100,
        username: 'test_admin',
        userType: 'ADMIN_PRIMARY',
      });

      const refreshSpy = vi.spyOn(refreshClient, 'post');

      apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
        const error = new axios.AxiosError('Bad Gateway', 'ERR_BAD_RESPONSE', config, null, {
          data: {
            code,
            info,
            data: null,
          },
          status,
          statusText: 'Bad Gateway',
          headers: new AxiosHeaders({ 'x-request-id': `req-${code}` }),
          config,
        });
        return Promise.reject(error);
      };

      let caughtError: ApiError | null = null;
      try {
        await request.get('/api/admin/channels');
      } catch (err) {
        caughtError = err as ApiError;
      }

      expect(caughtError).toBeInstanceOf(ApiError);
      expect(caughtError?.code).toBe(code);

      // 断言行为 1：提示下游不可用或超时
      expect(messageErrorSpy).toHaveBeenCalledTimes(1);
      expect(messageErrorSpy).toHaveBeenCalledWith(expectedMsg);

      // 断言行为 2：严禁触发 refresh（服务不可用不等于令牌失效）
      expect(refreshSpy).not.toHaveBeenCalled();

      // 断言行为 3：严禁跳登录
      expect(redirectedPath).toBeNull();

      // 断言行为 4：保留已有登录态
      expect(useAuthStore.getState().accessToken).toBe('active-token-before-rpc-error');
    },
  );

  // 5. INVALID_ARGUMENT(400)
  it('INVALID_ARGUMENT(400) 不弹全局提示（交由表单就地报错），异常携带完整 code/info/data 供表单使用', async () => {
    apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
      const error = new axios.AxiosError('Bad Request', 'ERR_BAD_REQUEST', config, null, {
        data: {
          code: ResponseCode.INVALID_ARGUMENT,
          info: '手机号格式不符合规范',
          data: { field: 'mobile', reason: 'REGEX_MISMATCH' },
        },
        status: 400,
        statusText: 'Bad Request',
        headers: new AxiosHeaders({ 'x-request-id': 'req-invalid-arg' }),
        config,
      });
      return Promise.reject(error);
    };

    let caughtError: ApiError | null = null;
    try {
      await request.post('/api/admin/users', { mobile: 'invalid' });
    } catch (err) {
      caughtError = err as ApiError;
    }

    expect(caughtError).toBeInstanceOf(ApiError);
    // 异常携带完整 code / info / data / status
    expect(caughtError?.code).toBe(ResponseCode.INVALID_ARGUMENT);
    expect(caughtError?.info).toBe('手机号格式不符合规范');
    expect(caughtError?.data).toEqual({ field: 'mobile', reason: 'REGEX_MISMATCH' });
    expect(caughtError?.status).toBe(400);

    // 断言行为 1：严禁弹出全局错误 Toast（交由表单就地捕获并显示）
    expect(messageErrorSpy).not.toHaveBeenCalled();

    // 断言行为 2：不触发跳转
    expect(redirectedPath).toBeNull();
  });

  // 6. NOT_FOUND(404) / CONFLICT(409) / PAYLOAD_TOO_LARGE(413)
  it.each([
    {
      code: ResponseCode.NOT_FOUND,
      status: 404,
      info: '请求的资源不存在',
      expectedMsg: '请求的资源不存在',
    },
    {
      code: ResponseCode.CONFLICT,
      status: 409,
      info: '资源状态冲突',
      expectedMsg: '资源状态冲突',
    },
    {
      code: ResponseCode.PAYLOAD_TOO_LARGE,
      status: 413,
      info: '请求数据体超限',
      expectedMsg: '请求数据体超限',
    },
  ])(
    '$code($status) 弹出对应的业务提示文案 ($expectedMsg)',
    async ({ code, status, info, expectedMsg }) => {
      apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
        const error = new axios.AxiosError('Client Error', 'ERR_BAD_REQUEST', config, null, {
          data: {
            code,
            info,
            data: null,
          },
          status,
          statusText: 'Client Error',
          headers: new AxiosHeaders({ 'x-request-id': `req-${code}` }),
          config,
        });
        return Promise.reject(error);
      };

      let caughtError: ApiError | null = null;
      try {
        await request.post('/api/admin/resource', {});
      } catch (err) {
        caughtError = err as ApiError;
      }

      expect(caughtError).toBeInstanceOf(ApiError);
      expect(caughtError?.code).toBe(code);

      // 断言行为：弹出对应的业务提示文案
      expect(messageErrorSpy).toHaveBeenCalledTimes(1);
      expect(messageErrorSpy).toHaveBeenCalledWith(expectedMsg);
      expect(redirectedPath).toBeNull();
    },
  );

  // 7. SUCCESS(200)
  it('SUCCESS(200) 直接解包返回 data，不抛错且不弹全局错误提示', async () => {
    apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
      return {
        data: {
          code: ResponseCode.SUCCESS,
          info: '成功',
          data: {
            roleId: 10,
            roleCode: 'ROLE_ADMIN',
            roleName: '系统管理员',
          },
        },
        status: 200,
        statusText: 'OK',
        headers: new AxiosHeaders({ 'x-request-id': 'req-success-10' }),
        config,
      };
    };

    const data = await request.get<{ roleId: number; roleCode: string; roleName: string }>(
      '/api/admin/roles/10',
    );

    // 断言行为 1：直接返回 data，不抛错
    expect(data).toEqual({
      roleId: 10,
      roleCode: 'ROLE_ADMIN',
      roleName: '系统管理员',
    });

    // 断言行为 2：不弹全局错误提示
    expect(messageErrorSpy).not.toHaveBeenCalled();

    // 断言行为 3：不触发跳转
    expect(redirectedPath).toBeNull();
  });

  // 8. HTTP 状态码兜底
  it.each([
    {
      status: 401,
      expectedCode: ResponseCode.AUTH_REQUIRED,
      expectRedirect: true,
    },
    {
      status: 403,
      expectedCode: ResponseCode.ACCESS_DENIED,
      expectRedirect: false,
    },
    {
      status: 404,
      expectedCode: ResponseCode.NOT_FOUND,
      expectRedirect: false,
    },
    {
      status: 409,
      expectedCode: ResponseCode.CONFLICT,
      expectRedirect: false,
    },
    {
      status: 413,
      expectedCode: ResponseCode.PAYLOAD_TOO_LARGE,
      expectRedirect: false,
    },
    {
      status: 429,
      expectedCode: ResponseCode.AUTH_RATE_LIMITED,
      expectRedirect: false,
    },
    {
      status: 502,
      expectedCode: ResponseCode.RPC_ERROR,
      expectRedirect: false,
    },
    {
      status: 503,
      expectedCode: ResponseCode.RPC_ERROR,
      expectRedirect: false,
    },
    {
      status: 504,
      expectedCode: ResponseCode.RPC_TIMEOUT,
      expectRedirect: false,
    },
    {
      status: 500,
      expectedCode: ResponseCode.INTERNAL_ERROR,
      expectRedirect: false,
    },
    {
      status: 508,
      expectedCode: ResponseCode.INTERNAL_ERROR,
      expectRedirect: false,
    },
  ])(
    'HTTP 状态码兜底：响应体无 code 字段时，status=$status 兜底映射为 $expectedCode',
    async ({ status, expectedCode, expectRedirect }) => {
      // 每次迭代清空上下文
      redirectedPath = null;
      messageErrorSpy.mockClear();

      apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
        const error = new axios.AxiosError(
          'Network Error without code',
          'ERR_BAD_REQUEST',
          config,
          null,
          {
            data: { rawError: `HTTP status ${status} response without code property` },
            status,
            statusText: 'Error',
            headers: new AxiosHeaders({ 'x-request-id': `fallback-req-${status}` }),
            config,
          },
        );
        return Promise.reject(error);
      };

      let caughtError: ApiError | null = null;
      try {
        await request.get(`/api/admin/fallback/${status}`);
      } catch (err) {
        caughtError = err as ApiError;
      }

      expect(caughtError).toBeInstanceOf(ApiError);
      // 验证按 HTTP 状态码兜底映射到正确的语义码
      expect(caughtError?.code).toBe(expectedCode);
      expect(caughtError?.status).toBe(status);

      // 验证跳转行为：401 映射为 AUTH_REQUIRED，无 token 终态触发跳登录；其余状态码不跳登录
      if (expectRedirect) {
        expect(redirectedPath).toBe('/login');
      } else {
        expect(redirectedPath).toBeNull();
      }
    },
  );

  // 9. 下游不可用组：防误杀断言（RPC_TIMEOUT / RPC_ERROR / RPC_NO_PROVIDER / AUTH_UNAVAILABLE）
  it.each([
    {
      code: ResponseCode.RPC_TIMEOUT,
      status: 504,
      expectedMsg: '下游服务调用超时，请稍后重试',
    },
    {
      code: ResponseCode.RPC_ERROR,
      status: 502,
      expectedMsg: '下游服务不可用，请稍后重试',
    },
    {
      code: ResponseCode.RPC_NO_PROVIDER,
      status: 503,
      expectedMsg: '下游服务不可用，请稍后重试',
    },
    {
      code: ResponseCode.AUTH_UNAVAILABLE,
      status: 503,
      expectedMsg: '下游服务不可用，请稍后重试',
    },
  ])(
    '$code($status) 抛出下游不可用异常，展示对应提示且登录态完整保留、零 refresh、零跳登录',
    async ({ code, status, expectedMsg }) => {
      useAuthStore.getState().setToken({
        accessToken: 'active-token-downstream',
        refreshToken: 'active-refresh-downstream',
        tokenType: 'Bearer',
        expiresIn: 3600,
        refreshExpiresIn: 7200,
        sessionId: 'session-downstream',
        userId: 99,
        accountId: 999,
        username: 'operator',
        userType: 'ADMIN_SUB_ACCOUNT',
      });

      const refreshSpy = vi.spyOn(refreshClient, 'post');

      apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
        const error = new axios.AxiosError(expectedMsg, 'ERR_BAD_RESPONSE', config, null, {
          data: {
            code,
            info: expectedMsg,
            data: null,
          },
          status,
          statusText: 'Service Unavailable',
          headers: new AxiosHeaders({ 'x-request-id': `req-downstream-${code}` }),
          config,
        });
        return Promise.reject(error);
      };

      let caughtError: ApiError | null = null;
      try {
        await request.get('/api/admin/channels');
      } catch (err) {
        caughtError = err as ApiError;
      }

      expect(caughtError).toBeInstanceOf(ApiError);
      expect(caughtError?.code).toBe(code);
      expect(caughtError?.status).toBe(status);

      // 行为断言 1：展示规范对应提示
      expect(messageErrorSpy).toHaveBeenCalledTimes(1);
      expect(messageErrorSpy).toHaveBeenCalledWith(expectedMsg);

      // 行为断言 2：绝不触发 refresh
      expect(refreshSpy).not.toHaveBeenCalled();

      // 行为断言 3：绝不跳登录
      expect(redirectedPath).toBeNull();

      // 行为断言 4：登录态全量字段保持完好
      const state = useAuthStore.getState();
      expect(state.accessToken).toBe('active-token-downstream');
      expect(state.refreshToken).toBe('active-refresh-downstream');
      expect(state.sessionId).toBe('session-downstream');
      expect(state.isAuthenticated()).toBe(true);
    },
  );

  // 10. HTTP 200 业务错误包缺少 info 时的缺省提示文案回退
  it.each([
    {
      code: ResponseCode.NOT_FOUND,
      expectedMsg: '请求的资源不存在',
    },
    {
      code: ResponseCode.CONFLICT,
      expectedMsg: '资源状态冲突',
    },
    {
      code: ResponseCode.PAYLOAD_TOO_LARGE,
      expectedMsg: '请求数据体超限',
    },
    {
      code: ResponseCode.RPC_ERROR,
      expectedMsg: '下游服务不可用，请稍后重试',
    },
    {
      code: ResponseCode.RPC_TIMEOUT,
      expectedMsg: '下游服务调用超时，请稍后重试',
    },
  ])(
    'HTTP 200 响应中携带业务错误码但缺少 info 字段时，回退展示内置规范文案「$expectedMsg」',
    async ({ code, expectedMsg }) => {
      apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
        return {
          data: {
            code,
            // 故意不传 info
            data: null,
          },
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders({ 'x-request-id': `req-no-info-${code}` }),
          config,
        };
      };

      let caughtError: ApiError | null = null;
      try {
        await request.post('/api/admin/resource-action', {});
      } catch (err) {
        caughtError = err as ApiError;
      }

      expect(caughtError).toBeInstanceOf(ApiError);
      expect(caughtError?.code).toBe(code);
      expect(messageErrorSpy).toHaveBeenCalledTimes(1);
      expect(messageErrorSpy).toHaveBeenCalledWith(expectedMsg);
      expect(redirectedPath).toBeNull();
    },
  );

  // 11. NOT_FOUND(404) / CONFLICT(409) / PAYLOAD_TOO_LARGE(413)：登录态防误杀断言
  it.each([
    {
      code: ResponseCode.NOT_FOUND,
      status: 404,
      info: '请求的用户不存在',
    },
    {
      code: ResponseCode.CONFLICT,
      status: 409,
      info: '角色编码已存在，请勿重复创建',
    },
    {
      code: ResponseCode.PAYLOAD_TOO_LARGE,
      status: 413,
      info: '上传渠道凭证数据超过 1 MiB 上限',
    },
  ])(
    '$code($status) 业务错误正常展示提示，且绝不误杀登录态、零 refresh、零跳登录',
    async ({ code, status, info }) => {
      useAuthStore.getState().setToken({
        accessToken: 'active-token-biz-err',
        refreshToken: 'active-refresh-biz-err',
        tokenType: 'Bearer',
        expiresIn: 3600,
        refreshExpiresIn: 7200,
        sessionId: 'session-biz-err',
        userId: 88,
        accountId: 888,
        username: 'admin',
        userType: 'ADMIN_PRIMARY',
      });

      const refreshSpy = vi.spyOn(refreshClient, 'post');

      apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
        const error = new axios.AxiosError('Client Error', 'ERR_BAD_REQUEST', config, null, {
          data: {
            code,
            info,
            data: null,
          },
          status,
          statusText: 'Client Error',
          headers: new AxiosHeaders({ 'x-request-id': `req-biz-${code}` }),
          config,
        });
        return Promise.reject(error);
      };

      let caughtError: ApiError | null = null;
      try {
        await request.post('/api/admin/roles', { name: 'test' });
      } catch (err) {
        caughtError = err as ApiError;
      }

      expect(caughtError).toBeInstanceOf(ApiError);
      expect(caughtError?.code).toBe(code);
      expect(caughtError?.status).toBe(status);

      // 行为断言 1：弹出对应业务提示文案
      expect(messageErrorSpy).toHaveBeenCalledTimes(1);
      expect(messageErrorSpy).toHaveBeenCalledWith(info);

      // 行为断言 2：严禁触发 refresh
      expect(refreshSpy).not.toHaveBeenCalled();

      // 行为断言 3：严禁跳转登录
      expect(redirectedPath).toBeNull();

      // 行为断言 4：登录态防误杀，全量保持有效
      const state = useAuthStore.getState();
      expect(state.accessToken).toBe('active-token-biz-err');
      expect(state.refreshToken).toBe('active-refresh-biz-err');
      expect(state.sessionId).toBe('session-biz-err');
      expect(state.isAuthenticated()).toBe(true);
    },
  );

  // 12. HTTP 状态码兜底：非 401 异常在无 code 时保持登录态并弹出对应全局提示
  it.each([
    {
      status: 403,
      expectedCode: ResponseCode.ACCESS_DENIED,
      info: 'Forbidden without code',
    },
    {
      status: 404,
      expectedCode: ResponseCode.NOT_FOUND,
      info: 'Not Found without code',
    },
    {
      status: 409,
      expectedCode: ResponseCode.CONFLICT,
      info: 'Conflict without code',
    },
    {
      status: 413,
      expectedCode: ResponseCode.PAYLOAD_TOO_LARGE,
      info: 'Payload Too Large without code',
    },
    {
      status: 429,
      expectedCode: ResponseCode.AUTH_RATE_LIMITED,
      info: 'Too Many Requests without code',
    },
    {
      status: 502,
      expectedCode: ResponseCode.RPC_ERROR,
      info: 'Bad Gateway without code',
    },
    {
      status: 503,
      expectedCode: ResponseCode.RPC_ERROR,
      info: 'Service Unavailable without code',
    },
    {
      status: 504,
      expectedCode: ResponseCode.RPC_TIMEOUT,
      info: 'Gateway Timeout without code',
    },
    {
      status: 500,
      expectedCode: ResponseCode.INTERNAL_ERROR,
      info: 'Internal Server Error without code',
    },
  ])(
    'HTTP 状态码兜底：status=$status 无 code 时映射为 $expectedCode，展示错误并保留登录态',
    async ({ status, expectedCode, info }) => {
      useAuthStore.getState().setToken({
        accessToken: 'active-token-http-fallback',
        refreshToken: 'active-refresh-http-fallback',
        tokenType: 'Bearer',
        expiresIn: 3600,
        refreshExpiresIn: 7200,
        sessionId: 'session-http-fallback',
        userId: 1,
        accountId: 100,
        username: 'admin',
        userType: 'ADMIN_PRIMARY',
      });

      const refreshSpy = vi.spyOn(refreshClient, 'post');

      apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
        const error = new axios.AxiosError(info, 'ERR_BAD_REQUEST', config, null, {
          data: { error: 'upstream proxy error' },
          status,
          statusText: 'Error',
          headers: new AxiosHeaders({ 'x-request-id': `fallback-notice-${status}` }),
          config,
        });
        return Promise.reject(error);
      };

      let caughtError: ApiError | null = null;
      try {
        await request.get(`/api/admin/gateway-error/${status}`);
      } catch (err) {
        caughtError = err as ApiError;
      }

      expect(caughtError).toBeInstanceOf(ApiError);
      expect(caughtError?.code).toBe(expectedCode);
      expect(caughtError?.status).toBe(status);

      // 行为断言 1：展示错误提示（500 包含系统内部错误与 requestId，其余展示 info）
      expect(messageErrorSpy).toHaveBeenCalledTimes(1);
      if (expectedCode === ResponseCode.INTERNAL_ERROR) {
        expect(messageErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining(`fallback-notice-${status}`),
        );
        expect(messageErrorSpy).toHaveBeenCalledWith(expect.stringContaining('系统内部错误'));
      } else {
        expect(messageErrorSpy).toHaveBeenCalledWith(info);
      }

      // 行为断言 2：绝不误触发 refresh
      expect(refreshSpy).not.toHaveBeenCalled();

      // 行为断言 3：绝不跳转登录页
      expect(redirectedPath).toBeNull();

      // 行为断言 4：登录态保持完好
      expect(useAuthStore.getState().accessToken).toBe('active-token-http-fallback');
      expect(useAuthStore.getState().isAuthenticated()).toBe(true);
    },
  );

  // 13. HTTP 401 兜底容错：即使网关/代理层返回无 code 的裸 401，仍能正确触发单飞 refresh 并成功重放业务请求
  it('HTTP 401 状态码兜底：即使网关/代理层返回无 code 的裸 401，仍能触发单飞 refresh 并成功重放请求', async () => {
    useAuthStore.getState().setToken({
      accessToken: 'stale-access-token',
      refreshToken: 'valid-refresh-token',
      tokenType: 'Bearer',
      expiresIn: 3600,
      refreshExpiresIn: 7200,
      sessionId: 'session-fallback-401',
      userId: 1,
      accountId: 100,
      username: 'test_admin',
      userType: 'ADMIN_PRIMARY',
    });

    let refreshCallCount = 0;
    vi.spyOn(refreshClient, 'post').mockImplementation(async () => {
      refreshCallCount++;
      return {
        data: {
          code: ResponseCode.SUCCESS,
          info: '刷新成功',
          data: {
            accessToken: 'recovered-access-token',
            refreshToken: 'recovered-refresh-token',
            tokenType: 'Bearer',
            expiresIn: 3600,
            refreshExpiresIn: 7200,
            sessionId: 'session-fallback-401',
            userId: 1,
            accountId: 100,
            username: 'test_admin',
            userType: 'ADMIN_PRIMARY',
          },
        },
        status: 200,
        statusText: 'OK',
        headers: new AxiosHeaders(),
        config: {} as InternalAxiosRequestConfig,
      } as AxiosResponse;
    });

    let businessAttemptCount = 0;
    apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
      businessAttemptCount++;
      const authHeader = config.headers.get('Authorization') as string;

      // 第一次携带过期 token，网关/反向代理返回无 code 的裸 401 HTML/Text 错误
      if (authHeader === 'Bearer stale-access-token') {
        const error = new axios.AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, null, {
          data: '<html>401 Authorization Required</html>',
          status: 401,
          statusText: 'Unauthorized',
          headers: new AxiosHeaders({ 'x-request-id': 'req-bare-401' }),
          config,
        });
        return Promise.reject(error);
      }

      // 重放携带刷新后的 token
      if (authHeader === 'Bearer recovered-access-token') {
        return {
          data: {
            code: ResponseCode.SUCCESS,
            info: '成功',
            data: { recovered: true },
          },
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders({ 'x-request-id': 'req-bare-401-replayed' }),
          config,
        };
      }

      throw new Error(`Unexpected Authorization header: ${authHeader}`);
    };

    const res = await request.get<{ recovered: boolean }>('/api/admin/protected-resource', {
      skipGlobalNotice: true,
    });

    // 验证成功重放并得到业务数据
    expect(res).toEqual({ recovered: true });
    // 验证触发了且仅触发了 1 次 refresh
    expect(refreshCallCount).toBe(1);
    // 验证业务请求经历了 初次 401 + 重试 200 两次执行
    expect(businessAttemptCount).toBe(2);
    // 验证未跳转登录
    expect(redirectedPath).toBeNull();
    // 验证登录态更新为新 token
    expect(useAuthStore.getState().accessToken).toBe('recovered-access-token');
  });
});
