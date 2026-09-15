import type { AxiosRequestConfig } from 'axios';
import { request } from './client';
import type { PageResponse } from './types';

/**
 * 渠道凭证 DTO（永不包含密钥材料）
 * 对应 docs/plans/admin-web-plan.md §5.8
 */
export interface ChannelCredentialDTO {
  id: string;
  channelCode: string;
  channelName: string;
  secretVersion: number;
  status: boolean;
  lastRotatedAt: string;
  createTime: string;
  updateTime: string;
}

/**
 * 渠道凭证密钥 DTO（仅创建或轮换时返回一次，之后永不返回）
 */
export interface ChannelCredentialSecretDTO {
  id: string;
  channelCode: string;
  channelSecret: string;
  secretVersion: number;
}

/**
 * 渠道数据范围 DTO
 */
export interface ChannelDataScopeDTO {
  scopeType: string;
  scopeValue: string;
}

/**
 * 渠道凭证列表查询参数
 */
export interface ChannelCredentialQueryParams {
  pageNum?: number;
  pageSize?: number;
  channelCode?: string;
  channelName?: string;
  status?: boolean;
}

/**
 * 创建渠道凭证请求体
 */
export interface CreateChannelCredentialRequest {
  channelName: string;
}

/**
 * 更新渠道凭证请求体
 */
export interface UpdateChannelCredentialRequest {
  channelName: string;
}

/**
 * 更新渠道状态请求体
 */
export interface UpdateChannelStatusRequest {
  status: boolean;
}

/**
 * 替换数据范围请求体
 */
export interface ReplaceChannelDataScopesRequest {
  scopeValues: string[];
}

/**
 * 渠道凭证管理相关 API
 * 契约权威：docs/plans/admin-web-plan.md §5.8（共 9 个接口）
 */
export const channelApi = {
  /**
   * 1. 分页查询渠道凭证列表
   * GET /api/admin/platform/channel-credentials
   * 权限码: rbac:channel-credential:read
   */
  list: (
    params?: ChannelCredentialQueryParams,
    config?: AxiosRequestConfig,
  ): Promise<PageResponse<ChannelCredentialDTO>> => {
    const cleanParams: Record<string, unknown> = {};
    if (params) {
      if (params.pageNum !== undefined) cleanParams.pageNum = params.pageNum;
      if (params.pageSize !== undefined) cleanParams.pageSize = params.pageSize;
      if (params.channelCode && params.channelCode.trim()) {
        cleanParams.channelCode = params.channelCode.trim();
      }
      if (params.channelName && params.channelName.trim()) {
        cleanParams.channelName = params.channelName.trim();
      }
      if (params.status !== undefined) {
        cleanParams.status = params.status;
      }
    }
    return request.get<PageResponse<ChannelCredentialDTO>>(
      '/api/admin/platform/channel-credentials',
      {
        ...config,
        params: cleanParams,
      },
    );
  },

  /**
   * 2. 获取渠道凭证详情
   * GET /api/admin/platform/channel-credentials/{id}
   * 权限码: rbac:channel-credential:read
   */
  getById: (id: string, config?: AxiosRequestConfig): Promise<ChannelCredentialDTO> => {
    return request.get<ChannelCredentialDTO>(
      `/api/admin/platform/channel-credentials/${id}`,
      config,
    );
  },

  /**
   * 3. 创建渠道凭证（一次性返回密钥）
   * POST /api/admin/platform/channel-credentials
   * 权限码: rbac:channel-credential:create
   */
  create: (
    data: CreateChannelCredentialRequest,
    config?: AxiosRequestConfig,
  ): Promise<ChannelCredentialSecretDTO> => {
    return request.post<ChannelCredentialSecretDTO>(
      '/api/admin/platform/channel-credentials',
      data,
      config,
    );
  },

  /**
   * 4. 更新渠道凭证基础信息
   * PUT /api/admin/platform/channel-credentials/{id}
   * 权限码: rbac:channel-credential:update
   */
  update: (
    id: string,
    data: UpdateChannelCredentialRequest,
    config?: AxiosRequestConfig,
  ): Promise<ChannelCredentialDTO> => {
    return request.put<ChannelCredentialDTO>(
      `/api/admin/platform/channel-credentials/${id}`,
      data,
      config,
    );
  },

  /**
   * 5. 启停渠道凭证
   * PUT /api/admin/platform/channel-credentials/{id}/status
   * 权限码: rbac:channel-credential:update
   */
  updateStatus: (
    id: string,
    data: UpdateChannelStatusRequest,
    config?: AxiosRequestConfig,
  ): Promise<ChannelCredentialDTO> => {
    return request.put<ChannelCredentialDTO>(
      `/api/admin/platform/channel-credentials/${id}/status`,
      data,
      config,
    );
  },

  /**
   * 6. 轮换渠道凭证密钥（一次性返回新密钥）
   * POST /api/admin/platform/channel-credentials/{id}/secret/rotate
   * 权限码: rbac:channel-credential:rotate
   */
  rotateSecret: (id: string, config?: AxiosRequestConfig): Promise<ChannelCredentialSecretDTO> => {
    return request.post<ChannelCredentialSecretDTO>(
      `/api/admin/platform/channel-credentials/${id}/secret/rotate`,
      undefined,
      config,
    );
  },

  /**
   * 7. 删除渠道凭证
   * DELETE /api/admin/platform/channel-credentials/{id}
   * 权限码: rbac:channel-credential:delete
   */
  delete: (id: string, config?: AxiosRequestConfig): Promise<boolean> => {
    return request.delete<boolean>(`/api/admin/platform/channel-credentials/${id}`, config);
  },

  /**
   * 8. 查询渠道数据范围
   * GET /api/admin/platform/channel-credentials/{id}/data-scopes/{scopeType}
   * 权限码: rbac:channel-credential:read
   */
  getDataScopes: (
    id: string,
    scopeType: string,
    config?: AxiosRequestConfig,
  ): Promise<ChannelDataScopeDTO[]> => {
    return request.get<ChannelDataScopeDTO[]>(
      `/api/admin/platform/channel-credentials/${id}/data-scopes/${encodeURIComponent(scopeType)}`,
      config,
    );
  },

  /**
   * 9. 替换渠道数据范围（全量替换）
   * PUT /api/admin/platform/channel-credentials/{id}/data-scopes/{scopeType}
   * 权限码: rbac:channel-credential:update
   */
  replaceDataScopes: (
    id: string,
    scopeType: string,
    data: ReplaceChannelDataScopesRequest,
    config?: AxiosRequestConfig,
  ): Promise<ChannelDataScopeDTO[]> => {
    return request.put<ChannelDataScopeDTO[]>(
      `/api/admin/platform/channel-credentials/${id}/data-scopes/${encodeURIComponent(scopeType)}`,
      data,
      config,
    );
  },
};
