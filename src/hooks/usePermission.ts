import { useCallback } from 'react';
import { useAuthStore, hasPermissionPredicate, hasAnyPermissionPredicate } from '@/store/auth';
import { authApi } from '@/api/auth';

/**
 * 权限控制 Hook
 * 提供当前主体权限码获取、判断以及刷新能力
 * 唯一权限事实依据为服务端返回的 permissionCodes，不按 userType 短路推断
 */
export function usePermission() {
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  const userType = useAuthStore((state) => state.userType);
  const setPermissionCodes = useAuthStore((state) => state.setPermissionCodes);

  /**
   * 检查是否具备指定权限码（委托给 store 纯谓词）
   */
  const hasPermission = useCallback(
    (code: string): boolean => {
      return hasPermissionPredicate(permissionCodes, code);
    },
    [permissionCodes],
  );

  /**
   * 检查是否具备给定权限码集合中的任意一个（委托给 store 纯谓词）
   */
  const hasAnyPermission = useCallback(
    (codes: string[]): boolean => {
      return hasAnyPermissionPredicate(permissionCodes, codes);
    },
    [permissionCodes],
  );

  /**
   * 重新拉取服务端权限码并刷新本地登录态
   * 适用场景：用户-角色授权或角色-权限授权写操作成功后
   */
  const refreshPermissions = useCallback(async (): Promise<string[]> => {
    try {
      const codes = await authApi.getPermissions();
      setPermissionCodes(codes);
      return codes;
    } catch (error) {
      console.error('刷新权限列表失败', error);
      throw error;
    }
  }, [setPermissionCodes]);

  return {
    permissionCodes,
    hasPermission,
    hasAnyPermission,
    refreshPermissions,
    isPrimaryAdmin: userType === 'ADMIN_PRIMARY',
  };
}
