import { create } from 'zustand';
import type { TokenResponse } from '@/api/types';
import { randomId } from '@/utils/randomId';

function generateDeviceId(): string {
  return `web-${randomId()}`;
}

export interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  sessionId: string | null;
  accountId: string | null;
  userId: string | null;
  username: string | null;
  userType: string | null;
  permissionCodes: string[];
  deviceId: string;

  setToken: (tokenData: TokenResponse) => void;
  setPermissionCodes: (codes: string[]) => void;
  clear: () => void;
  hasPermission: (code: string) => boolean;
  hasAnyPermission: (codes: string[]) => boolean;
  isAuthenticated: () => boolean;
}

/**
 * 纯谓词：判断权限清单是否包含指定权限码
 * 唯一权限事实依据，不按 userType 短路推断
 */
export function hasPermissionPredicate(
  permissionCodes: readonly string[] | string[],
  code: string,
): boolean {
  return permissionCodes.includes(code);
}

/**
 * 纯谓词：判断权限清单是否包含任一指定权限码（基于单一谓词）
 */
export function hasAnyPermissionPredicate(
  permissionCodes: readonly string[] | string[],
  codes: string[],
): boolean {
  return codes.some((code) => hasPermissionPredicate(permissionCodes, code));
}

// 令牌与设备ID仅保留在内存中，严禁写入 localStorage / sessionStorage / URL / 日志
export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  refreshToken: null,
  sessionId: null,
  accountId: null,
  userId: null,
  username: null,
  userType: null,
  permissionCodes: [],
  deviceId: generateDeviceId(),

  setToken: (tokenData: TokenResponse) => {
    set({
      accessToken: tokenData.accessToken,
      refreshToken: tokenData.refreshToken,
      sessionId: tokenData.sessionId,
      accountId: tokenData.accountId,
      userId: tokenData.userId,
      username: tokenData.username,
      userType: tokenData.userType,
    });
  },

  setPermissionCodes: (codes: string[]) => {
    set({ permissionCodes: codes });
  },

  clear: () => {
    set({
      accessToken: null,
      refreshToken: null,
      sessionId: null,
      accountId: null,
      userId: null,
      username: null,
      userType: null,
      permissionCodes: [],
      // 保留当前内存中的 deviceId 以便同一会话复用
    });
  },

  hasPermission: (code: string) => {
    return hasPermissionPredicate(get().permissionCodes, code);
  },

  hasAnyPermission: (codes: string[]) => {
    return hasAnyPermissionPredicate(get().permissionCodes, codes);
  },

  isAuthenticated: () => {
    return Boolean(get().accessToken);
  },
}));
