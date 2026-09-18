import { request } from './client';
import type { PageResponse } from './types';

/**
 * RBAC 用户 DTO
 * 对应 docs/plans/admin-web-plan.md §5.4
 */
export interface RbacUserDTO {
  id: string;
  accountId: string;
  username: string;
  displayName: string | null;
  email: string | null;
  mobile: string | null;
  status: boolean;
  createTime: string;
  updateTime: string;
}

/**
 * 创建用户请求体
 */
export interface CreateUserRequest {
  username: string; // 必填，正则 ^[A-Za-z0-9_.-]{1,64}$
  password: string; // 必填，8..72 位
  displayName?: string; // 选填，<=128
  email?: string; // 选填，邮箱格式，<=128
  mobile?: string; // 选填，<=32
  status?: boolean; // 选填，启用状态
}

/**
 * 更新用户请求体
 */
export interface UpdateUserRequest {
  password?: string; // 8..72 位，不传表示不修改
  displayName?: string; // <=128
  email?: string; // <=128
  mobile?: string; // <=32
  status?: boolean;
}

/**
 * 用户列表查询参数
 */
export interface QueryUserParams {
  pageNum?: number; // >=1，默认 1
  pageSize?: number; // 1..100，默认 20
  username?: string; // <=64
  status?: boolean;
}

/**
 * RBAC 角色 DTO
 * 对应 docs/plans/admin-web-plan.md §5.5
 */
export interface RbacRoleDTO {
  id: string;
  roleCode: string;
  roleName: string;
  roleDesc: string | null;
  status: boolean;
  createTime: string;
  updateTime: string;
}

/**
 * 创建角色请求体
 */
export interface CreateRoleRequest {
  roleCode: string; // 必填，<=64
  roleName: string; // 必填，<=128
  roleDesc?: string; // 选填，<=255
  status?: boolean;
}

/**
 * 更新角色请求体
 */
export interface UpdateRoleRequest {
  roleCode: string; // 必填，<=64
  roleName: string; // 必填，<=128
  roleDesc?: string; // 选填，<=255
  status?: boolean;
}

/**
 * 角色列表查询参数
 */
export interface QueryRoleParams {
  pageNum?: number;
  pageSize?: number;
  roleCode?: string; // <=64
  roleName?: string; // <=128
  status?: boolean;
}

/**
 * RBAC 权限 DTO
 * 对应 docs/plans/admin-web-plan.md §5.6
 */
export interface RbacPermissionDTO {
  id: string;
  permCode: string;
  permName: string;
  permType: number; // 1=目录 / 2=菜单 / 3=按钮
  parentId: string; // 根节点为 '0'
  path: string | null;
  method: string | null;
  status: boolean;
  systemManaged: boolean;
  createTime: string;
  updateTime: string;
}

/**
 * 创建权限请求体
 */
export interface CreatePermissionRequest {
  permCode: string; // 必填，<=64；自定义权限不得使用 rbac: 前缀
  permName: string; // 必填，<=128
  permType: number; // 枚举 1=目录 / 2=菜单 / 3=按钮，缺省 2
  parentId?: string; // 根节点传 '0'（不是 null）；负数非法
  path?: string; // 选填，<=255
  method?: string; // 选填，<=16（GET/POST/PUT/DELETE）
  status?: boolean;
}

/**
 * 更新权限请求体（permCode 不可修改）
 */
export interface UpdatePermissionRequest {
  permName: string; // 必填，<=128
  permType: number; // 必填，1=目录 / 2=菜单 / 3=按钮
  parentId?: string; // 根节点 '0'
  path?: string; // 选填，<=255
  method?: string; // 选填，<=16
  status?: boolean;
}

/**
 * 权限列表查询参数
 */
export interface QueryPermissionParams {
  pageNum?: number;
  pageSize?: number;
  permCode?: string; // <=64
  permName?: string; // <=128
  permType?: number; // 1/2/3
  parentId?: string;
  status?: boolean;
}

/**
 * 用户-角色查询响应
 * 对应 docs/plans/admin-web-plan.md §5.7 #23
 */
export interface QueryUserRoleIdsResp {
  userId: string;
  roleIds: string[];
}

/**
 * 角色-权限查询响应
 * 对应 docs/plans/admin-web-plan.md §5.7 #25
 */
export interface QueryRolePermissionIdsResp {
  roleId: string;
  permissionIds: string[];
}

/**
 * 清理参数中的空串与 undefined，保留 boolean false 与数字 0
 */
function cleanParams<T extends Record<string, unknown>>(
  params?: T,
): Record<string, unknown> | undefined {
  if (!params) return undefined;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      result[key] = value;
    }
  }
  return result;
}

/**
 * RBAC 管理端 API 封装
 * 严格对齐 docs/plans/admin-web-plan.md §5.4 ~ §5.7
 */
export const rbacApi = {
  // ===================== 用户管理 =====================
  /**
   * 分页查询用户列表
   * GET /api/admin/rbac/users
   */
  getUsers: (params?: QueryUserParams): Promise<PageResponse<RbacUserDTO>> => {
    return request.get<PageResponse<RbacUserDTO>>('/api/admin/rbac/users', {
      params: cleanParams(params as Record<string, unknown>),
    });
  },

  /**
   * 新增用户
   * POST /api/admin/rbac/users
   */
  createUser: (data: CreateUserRequest): Promise<RbacUserDTO> => {
    return request.post<RbacUserDTO>('/api/admin/rbac/users', data);
  },

  /**
   * 更新用户
   * PUT /api/admin/rbac/users/{id}
   */
  updateUser: (id: string, data: UpdateUserRequest): Promise<RbacUserDTO> => {
    return request.put<RbacUserDTO>(`/api/admin/rbac/users/${id}`, data);
  },

  /**
   * 删除用户
   * DELETE /api/admin/rbac/users/{id}
   */
  deleteUser: (id: string): Promise<boolean> => {
    return request.delete<boolean>(`/api/admin/rbac/users/${id}`);
  },

  // ===================== 角色管理 =====================
  /**
   * 分页查询角色列表
   * GET /api/admin/rbac/roles
   */
  getRoles: (params?: QueryRoleParams): Promise<PageResponse<RbacRoleDTO>> => {
    return request.get<PageResponse<RbacRoleDTO>>('/api/admin/rbac/roles', {
      params: cleanParams(params as Record<string, unknown>),
    });
  },

  /**
   * 新增角色
   * POST /api/admin/rbac/roles
   */
  createRole: (data: CreateRoleRequest): Promise<RbacRoleDTO> => {
    return request.post<RbacRoleDTO>('/api/admin/rbac/roles', data);
  },

  /**
   * 更新角色
   * PUT /api/admin/rbac/roles/{id}
   */
  updateRole: (id: string, data: UpdateRoleRequest): Promise<RbacRoleDTO> => {
    return request.put<RbacRoleDTO>(`/api/admin/rbac/roles/${id}`, data);
  },

  /**
   * 删除角色
   * DELETE /api/admin/rbac/roles/{id}
   */
  deleteRole: (id: string): Promise<boolean> => {
    return request.delete<boolean>(`/api/admin/rbac/roles/${id}`);
  },

  // ===================== 权限项管理 =====================
  /**
   * 分页查询权限项列表
   * GET /api/admin/rbac/permissions
   */
  getPermissions: (params?: QueryPermissionParams): Promise<PageResponse<RbacPermissionDTO>> => {
    return request.get<PageResponse<RbacPermissionDTO>>('/api/admin/rbac/permissions', {
      params: cleanParams(params as Record<string, unknown>),
    });
  },

  /**
   * 新增权限项
   * POST /api/admin/rbac/permissions
   */
  createPermission: (data: CreatePermissionRequest): Promise<RbacPermissionDTO> => {
    return request.post<RbacPermissionDTO>('/api/admin/rbac/permissions', data);
  },

  /**
   * 更新权限项（不含 permCode）
   * PUT /api/admin/rbac/permissions/{id}
   */
  updatePermission: (id: string, data: UpdatePermissionRequest): Promise<RbacPermissionDTO> => {
    return request.put<RbacPermissionDTO>(`/api/admin/rbac/permissions/${id}`, data);
  },

  /**
   * 删除权限项（systemManaged=true 的权限服务端将拒绝）
   * DELETE /api/admin/rbac/permissions/{id}
   */
  deletePermission: (id: string): Promise<boolean> => {
    return request.delete<boolean>(`/api/admin/rbac/permissions/${id}`);
  },

  // ===================== 关系授权 =====================
  /**
   * 查询用户已授予的角色 ID 列表
   * GET /api/admin/rbac/users/{userId}/roles
   */
  getUserRoles: (userId: string): Promise<QueryUserRoleIdsResp> => {
    return request.get<QueryUserRoleIdsResp>(`/api/admin/rbac/users/${userId}/roles`);
  },

  /**
   * 全量替换用户角色关系（空数组表示清空）
   * PUT /api/admin/rbac/users/{userId}/roles
   */
  grantUserRoles: (userId: string, roleIds: string[]): Promise<boolean> => {
    return request.put<boolean>(`/api/admin/rbac/users/${userId}/roles`, { roleIds });
  },

  /**
   * 查询角色已授予的权限 ID 列表
   * GET /api/admin/rbac/roles/{roleId}/permissions
   */
  getRolePermissions: (roleId: string): Promise<QueryRolePermissionIdsResp> => {
    return request.get<QueryRolePermissionIdsResp>(`/api/admin/rbac/roles/${roleId}/permissions`);
  },

  /**
   * 全量替换角色权限关系（空数组表示清空）
   * PUT /api/admin/rbac/roles/{roleId}/permissions
   */
  grantRolePermissions: (roleId: string, permissionIds: string[]): Promise<boolean> => {
    return request.put<boolean>(`/api/admin/rbac/roles/${roleId}/permissions`, {
      permissionIds,
    });
  },
};
