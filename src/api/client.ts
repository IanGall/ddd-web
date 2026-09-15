import axios, {
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { message } from 'antd';
import { useAuthStore } from '@/store/auth';
import { ApiError, ResponseCode, type Response, type TokenResponse } from './types';
import { randomId } from '@/utils/randomId';

export { randomId } from '@/utils/randomId';

declare module 'axios' {
  export interface AxiosRequestConfig {
    _retry?: boolean;
    skipGlobalNotice?: boolean;
  }
}

const baseURL = import.meta.env.VITE_API_BASE || '';

// 基础客户端实例
export const apiClient = axios.create({
  baseURL,
  timeout: 30000,
});

// 专用于 token 刷新的客户端实例（避免与 apiClient 的拦截器产生循环依赖）
export const refreshClient = axios.create({
  baseURL,
  timeout: 10000,
});

let redirectHandler: ((path: string) => void) | null = null;

export function setRedirectHandler(handler: ((path: string) => void) | null) {
  redirectHandler = handler;
}

export function redirectToLogin() {
  if (redirectHandler) {
    redirectHandler('/login');
    return;
  }
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

function notifyUiError(content: string) {
  try {
    if (typeof window !== 'undefined') {
      message.error(content);
    }
  } catch {
    // 降级兼容非 DOM 环境
  }
}

function isAuthEndpoint(url?: string): boolean {
  if (!url) return false;
  return url.includes('/auth/login') || url.includes('/auth/refresh');
}

// 单飞互斥 Promise：同一时刻全局只允许一个 refresh 请求在途
let refreshPromise: Promise<string | null> | null = null;

async function performTokenRefresh(): Promise<string | null> {
  const { refreshToken, deviceId } = useAuthStore.getState();
  if (!refreshToken) {
    useAuthStore.getState().clear();
    redirectToLogin();
    return null;
  }

  try {
    const requestId = randomId();
    const res = await refreshClient.post<Response<TokenResponse>>(
      '/api/admin/auth/refresh',
      {
        refreshToken,
        clientType: 'admin-web',
        deviceId,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
        },
      },
    );

    if (res.data && res.data.code === ResponseCode.SUCCESS && res.data.data) {
      const tokenData = res.data.data;
      useAuthStore.getState().setToken(tokenData);
      return tokenData.accessToken;
    }

    // 后端明确返回 AUTH_REQUIRED 为终态
    useAuthStore.getState().clear();
    redirectToLogin();
    return null;
  } catch {
    useAuthStore.getState().clear();
    redirectToLogin();
    return null;
  }
}

// 请求拦截器：注入 Authorization 与 X-Request-Id
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const accessToken = useAuthStore.getState().accessToken;
  if (accessToken) {
    config.headers.set('Authorization', `Bearer ${accessToken}`);
  }

  if (!config.headers.has('X-Request-Id')) {
    config.headers.set('X-Request-Id', randomId());
  }

  return config;
});

// 处理错误码分流逻辑（照 admin-web-plan.md §4.1 的 12 行表格）
async function handleCodeDispatch(
  code: string,
  info: string,
  data: unknown,
  requestId: string | undefined,
  config: AxiosRequestConfig,
  status?: number,
): Promise<unknown> {
  const apiError = new ApiError({
    code,
    info,
    requestId,
    status,
    data,
  });

  // 1. AUTH_REQUIRED：触发单飞 refresh；失败则清态跳 /login
  if (code === ResponseCode.AUTH_REQUIRED) {
    // /auth/login 与 /auth/refresh 自身返回 401 时不得再触发 refresh
    if (isAuthEndpoint(config.url)) {
      if (config.url?.includes('/auth/refresh')) {
        useAuthStore.getState().clear();
        redirectToLogin();
      }
      return Promise.reject(apiError);
    }

    // 已重试过一次的请求放弃，避免无限循环；清空登录态并跳转 /login
    if (config._retry) {
      useAuthStore.getState().clear();
      redirectToLogin();
      return Promise.reject(apiError);
    }
    config._retry = true;

    // 单飞刷新：若已有在途 Promise，直接复用等待结果
    if (!refreshPromise) {
      refreshPromise = performTokenRefresh().finally(() => {
        refreshPromise = null;
      });
    }

    const newAccessToken = await refreshPromise;
    if (newAccessToken) {
      config.headers = config.headers || {};
      (config.headers as Record<string, string>)['Authorization'] = `Bearer ${newAccessToken}`;
      return apiClient(config);
    }

    return Promise.reject(apiError);
  }

  // 其他错误码按需展示提示
  if (!config.skipGlobalNotice) {
    switch (code) {
      case ResponseCode.INVALID_ARGUMENT:
        // 表单就地报错，展示 info（不弹全局 Toast）
        break;
      case ResponseCode.ACCESS_DENIED:
        notifyUiError(info || '无权访问此资源');
        break;
      case ResponseCode.NOT_FOUND:
        notifyUiError(info || '请求的资源不存在');
        break;
      case ResponseCode.CONFLICT:
        notifyUiError(info || '资源状态冲突');
        break;
      case ResponseCode.PAYLOAD_TOO_LARGE:
        notifyUiError(info || '请求数据体超限');
        break;
      case ResponseCode.AUTH_RATE_LIMITED:
        notifyUiError(info || '登录尝试过于频繁，请稍后再试');
        break;
      case ResponseCode.RPC_ERROR:
      case ResponseCode.RPC_NO_PROVIDER:
      case ResponseCode.AUTH_UNAVAILABLE:
        notifyUiError(info || '下游服务不可用，请稍后重试');
        break;
      case ResponseCode.RPC_TIMEOUT:
        notifyUiError(info || '下游服务调用超时，请稍后重试');
        break;
      case ResponseCode.INTERNAL_ERROR:
      default:
        notifyUiError(
          requestId ? `系统内部错误 [请求ID: ${requestId}]: ${info}` : `系统内部错误: ${info}`,
        );
        break;
    }
  }

  return Promise.reject(apiError);
}

// 响应拦截器：按响应体的 code 分流，不要按 HTTP 状态码或 0000~0003 数字码判断
apiClient.interceptors.response.use(
  (response: AxiosResponse<Response<unknown>>) => {
    const resBody = response.data;
    const requestId =
      (response.headers?.['x-request-id'] as string) ||
      (response.config?.headers?.['X-Request-Id'] as string);

    if (resBody && typeof resBody === 'object' && 'code' in resBody) {
      if (resBody.code === ResponseCode.SUCCESS) {
        return resBody.data as unknown as AxiosResponse;
      }
      return handleCodeDispatch(
        resBody.code,
        resBody.info,
        resBody.data,
        requestId,
        response.config,
        response.status,
      ) as unknown as AxiosResponse;
    }

    return response.data as unknown as AxiosResponse;
  },
  async (error) => {
    const response = error.response;
    const config = (error.config || {}) as AxiosRequestConfig;
    const status = response?.status;
    const responseData = response?.data;
    const requestId =
      (response?.headers?.['x-request-id'] as string) ||
      (config?.headers as Record<string, string> | undefined)?.['X-Request-Id'];

    // 优先从网关返回的 JSON 响应体中提取 code 与 info
    const code =
      responseData?.code ||
      (status === 401
        ? ResponseCode.AUTH_REQUIRED
        : status === 403
          ? ResponseCode.ACCESS_DENIED
          : status === 404
            ? ResponseCode.NOT_FOUND
            : status === 409
              ? ResponseCode.CONFLICT
              : status === 413
                ? ResponseCode.PAYLOAD_TOO_LARGE
                : status === 429
                  ? ResponseCode.AUTH_RATE_LIMITED
                  : status === 502 || status === 503
                    ? ResponseCode.RPC_ERROR
                    : status === 504
                      ? ResponseCode.RPC_TIMEOUT
                      : ResponseCode.INTERNAL_ERROR);

    const info = responseData?.info || error.message || '网络请求异常';

    return handleCodeDispatch(code, info, responseData?.data, requestId, config, status);
  },
);

export const request = {
  get: <T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> =>
    apiClient.get(url, config) as unknown as Promise<T>,
  post: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> =>
    apiClient.post(url, data, config) as unknown as Promise<T>,
  put: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> =>
    apiClient.put(url, data, config) as unknown as Promise<T>,
  delete: <T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> =>
    apiClient.delete(url, config) as unknown as Promise<T>,
};
