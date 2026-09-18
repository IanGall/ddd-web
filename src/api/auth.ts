import { request } from './client';
import type {
  AdminLoginRequest,
  AuthSessionDTO,
  GatewayStatusDTO,
  TokenResponse,
} from './types';

/**
 * 管理端认证与鉴权相关接口
 * 严格对齐 docs/plans/admin-web-plan.md §5.3 与 §5.9
 */
export const authApi = {
  /**
   * 管理员登录
   * POST /api/admin/auth/login
   */
  login: (data: AdminLoginRequest): Promise<TokenResponse> => {
    return request.post<TokenResponse>('/api/admin/auth/login', data);
  },

  /**
   * 退出当前会话
   * POST /api/admin/auth/logout
   */
  logout: (): Promise<null> => {
    return request.post<null>('/api/admin/auth/logout');
  },

  /**
   * 强制登出全部会话
   * POST /api/admin/auth/logout-all
   */
  logoutAll: (): Promise<null> => {
    return request.post<null>('/api/admin/auth/logout-all');
  },

  /**
   * 获取当前有效会话列表
   * GET /api/admin/auth/sessions
   */
  getSessions: (): Promise<AuthSessionDTO[]> => {
    return request.get<AuthSessionDTO[]>('/api/admin/auth/sessions');
  },

  /**
   * 吊销指定会话
   * DELETE /api/admin/auth/sessions/{sessionId}
   */
  revokeSession: (sessionId: string): Promise<null> => {
    return request.delete<null>(`/api/admin/auth/sessions/${encodeURIComponent(sessionId)}`);
  },

  /**
   * 引导端点：获取当前主体有效权限码集合（已排序去重）
   * GET /api/admin/auth/permissions
   */
  getPermissions: (): Promise<string[]> => {
    return request.get<string[]>('/api/admin/auth/permissions');
  },

  /**
   * 获取网关服务状态
   * GET /api/admin/status
   */
  getStatus: (): Promise<GatewayStatusDTO> => {
    return request.get<GatewayStatusDTO>('/api/admin/status');
  },
};
