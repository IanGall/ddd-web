/**
 * 权威契约类型定义
 * 对应 docs/plans/admin-web-plan.md §5
 */

/**
 * 统一网关响应体包装
 */
export interface Response<T> {
  code: string;
  info: string;
  data: T;
}

/**
 * 分页数据通用结构
 */
export interface PageResponse<T> {
  total: number;
  pageNum: number;
  pageSize: number;
  list: T[];
}

/**
 * 登录认证响应体
 */
export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  refreshExpiresIn: number;
  sessionId: string;
  userId: number | null;
  accountId: number | null;
  username: string | null;
  userType: string | null;
}

/**
 * 登录请求体
 */
export interface AdminLoginRequest {
  loginName: string;
  password: string;
  clientType?: string;
  deviceId?: string;
}

/**
 * 令牌刷新请求体
 */
export interface RefreshRequest {
  refreshToken: string;
  clientType?: string;
  deviceId?: string;
}

/**
 * 会话信息 DTO
 */
export interface AuthSessionDTO {
  sessionId: string;
  clientType: string;
  deviceId: string;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
  expiresAt: string;
  current: boolean;
}

/**
 * 网关服务状态响应
 */
export interface GatewayStatusDTO {
  application: string;
  status: string;
}

/**
 * 响应语义码枚举定义
 * 与 cn.iantech.common.constant.Constants.ResponseCode 完全对齐
 */
export const ResponseCode = {
  SUCCESS: 'SUCCESS',
  INVALID_ARGUMENT: 'INVALID_ARGUMENT',
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  ACCESS_DENIED: 'ACCESS_DENIED',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  AUTH_RATE_LIMITED: 'AUTH_RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  RPC_ERROR: 'RPC_ERROR',
  AUTH_UNAVAILABLE: 'AUTH_UNAVAILABLE',
  RPC_NO_PROVIDER: 'RPC_NO_PROVIDER',
  RPC_TIMEOUT: 'RPC_TIMEOUT',
} as const;

export type ResponseCodeType = (typeof ResponseCode)[keyof typeof ResponseCode] | string;

/**
 * 前端统一 API 异常类
 * 保留 code / info / requestId，便于页面与排障使用
 */
export class ApiError extends Error {
  readonly code: string;
  readonly info: string;
  readonly requestId?: string;
  readonly status?: number;
  readonly data?: unknown;

  constructor(options: {
    code: string;
    info: string;
    requestId?: string;
    status?: number;
    data?: unknown;
  }) {
    super(options.info || options.code);
    this.name = 'ApiError';
    this.code = options.code;
    this.info = options.info;
    this.requestId = options.requestId;
    this.status = options.status;
    this.data = options.data;
  }
}
