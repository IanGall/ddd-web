import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore, hasPermissionPredicate, hasAnyPermissionPredicate } from '@/store/auth';
import type { TokenResponse } from '@/api/types';

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.getState().clear();
  });

  const mockToken: TokenResponse = {
    accessToken: 'mock-access-token-123',
    refreshToken: 'mock-refresh-token-456',
    tokenType: 'Bearer',
    expiresIn: 7200,
    refreshExpiresIn: 604800,
    sessionId: 'sess-001',
    userId: 1001,
    accountId: 2001,
    username: 'admin',
    userType: 'ADMIN_SUB_ACCOUNT',
  };

  it('初始状态未登录且令牌为空', () => {
    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.isAuthenticated()).toBe(false);
    expect(state.permissionCodes).toEqual([]);
    expect(state.deviceId).toBeDefined();
  });

  it('setToken 成功写入内存且 isAuthenticated 返回 true', () => {
    useAuthStore.getState().setToken(mockToken);
    const state = useAuthStore.getState();

    expect(state.accessToken).toBe('mock-access-token-123');
    expect(state.refreshToken).toBe('mock-refresh-token-456');
    expect(state.sessionId).toBe('sess-001');
    expect(state.accountId).toBe(2001);
    expect(state.userId).toBe(1001);
    expect(state.username).toBe('admin');
    expect(state.userType).toBe('ADMIN_SUB_ACCOUNT');
    expect(state.isAuthenticated()).toBe(true);
  });

  it('clear 清空所有登录态字段', () => {
    useAuthStore.getState().setToken(mockToken);
    useAuthStore.getState().setPermissionCodes(['rbac:user:read']);
    expect(useAuthStore.getState().isAuthenticated()).toBe(true);

    useAuthStore.getState().clear();
    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.sessionId).toBeNull();
    expect(state.permissionCodes).toEqual([]);
    expect(state.isAuthenticated()).toBe(false);
  });

  it('主账号 ADMIN_PRIMARY 严格按 permissionCodes 判定权限，不按主体类型短路', () => {
    useAuthStore.getState().setToken({
      ...mockToken,
      userType: 'ADMIN_PRIMARY',
    });
    // 未注入任何 permissionCodes 时一律返回 false
    expect(useAuthStore.getState().hasPermission('rbac:user:delete')).toBe(false);
    expect(useAuthStore.getState().hasPermission('arbitrary:custom:permission')).toBe(false);

    // 注入权限码后严格按清单返回 true
    useAuthStore.getState().setPermissionCodes(['rbac:user:delete']);
    expect(useAuthStore.getState().hasPermission('rbac:user:delete')).toBe(true);
    expect(useAuthStore.getState().hasPermission('arbitrary:custom:permission')).toBe(false);
  });

  it('子账号 ADMIN_SUB_ACCOUNT 严格按 permissionCodes 判定权限', () => {
    useAuthStore.getState().setToken({
      ...mockToken,
      userType: 'ADMIN_SUB_ACCOUNT',
    });
    useAuthStore.getState().setPermissionCodes(['rbac:user:read', 'rbac:role:read']);

    expect(useAuthStore.getState().hasPermission('rbac:user:read')).toBe(true);
    expect(useAuthStore.getState().hasPermission('rbac:role:read')).toBe(true);
    expect(useAuthStore.getState().hasPermission('rbac:user:delete')).toBe(false);
  });

  it('主账号与子账号使用同一份判定逻辑（同样的 permissionCodes 得到同样的结果）', () => {
    const permissions = ['rbac:user:read', 'rbac:role:create'];

    // 1. 主账号
    useAuthStore.getState().setToken({
      ...mockToken,
      userType: 'ADMIN_PRIMARY',
    });
    useAuthStore.getState().setPermissionCodes(permissions);
    const primaryCanReadUser = useAuthStore.getState().hasPermission('rbac:user:read');
    const primaryCanCreateRole = useAuthStore.getState().hasPermission('rbac:role:create');
    const primaryCanDeleteUser = useAuthStore.getState().hasPermission('rbac:user:delete');
    const primaryAnyMatched = useAuthStore
      .getState()
      .hasAnyPermission(['rbac:user:read', 'non:existent']);
    const primaryAnyNone = useAuthStore
      .getState()
      .hasAnyPermission(['non:existent:1', 'non:existent:2']);

    // 2. 子账号
    useAuthStore.getState().setToken({
      ...mockToken,
      userType: 'ADMIN_SUB_ACCOUNT',
    });
    useAuthStore.getState().setPermissionCodes(permissions);
    const subCanReadUser = useAuthStore.getState().hasPermission('rbac:user:read');
    const subCanCreateRole = useAuthStore.getState().hasPermission('rbac:role:create');
    const subCanDeleteUser = useAuthStore.getState().hasPermission('rbac:user:delete');
    const subAnyMatched = useAuthStore
      .getState()
      .hasAnyPermission(['rbac:user:read', 'non:existent']);
    const subAnyNone = useAuthStore
      .getState()
      .hasAnyPermission(['non:existent:1', 'non:existent:2']);

    // 断言结果绝对一致
    expect(primaryCanReadUser).toBe(subCanReadUser);
    expect(primaryCanCreateRole).toBe(subCanCreateRole);
    expect(primaryCanDeleteUser).toBe(subCanDeleteUser);
    expect(primaryAnyMatched).toBe(subAnyMatched);
    expect(primaryAnyNone).toBe(subAnyNone);

    expect(primaryCanReadUser).toBe(true);
    expect(primaryCanCreateRole).toBe(true);
    expect(primaryCanDeleteUser).toBe(false);
    expect(primaryAnyMatched).toBe(true);
    expect(primaryAnyNone).toBe(false);
  });

  it('纯谓词函数 hasPermissionPredicate 与 hasAnyPermissionPredicate 符合单一真相', () => {
    const list = ['a', 'b', 'c'];
    expect(hasPermissionPredicate(list, 'a')).toBe(true);
    expect(hasPermissionPredicate(list, 'd')).toBe(false);
    expect(hasAnyPermissionPredicate(list, ['x', 'b'])).toBe(true);
    expect(hasAnyPermissionPredicate(list, ['x', 'y'])).toBe(false);
  });
});
