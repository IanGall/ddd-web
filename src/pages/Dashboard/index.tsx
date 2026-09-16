import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { KeyRound, LayoutDashboard, Monitor, Plug, User, Users } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { usePermission } from '@/hooks/usePermission';
import { authApi } from '@/api/auth';
import { channelApi } from '@/api/channel';
import { request } from '@/api/client';
import { ApiError, type PageResponse } from '@/api/types';
import { StatCard } from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const username = useAuthStore((state) => state.username);
  const userType = useAuthStore((state) => state.userType);
  const accountId = useAuthStore((state) => state.accountId);
  const userId = useAuthStore((state) => state.userId);
  const permissionCodes = useAuthStore((state) => state.permissionCodes);

  const { hasPermission } = usePermission();

  // 细粒度权限判定：无权限则不发起必然 403 的统计请求
  const canReadUsers = hasPermission('rbac:user:read');
  const canReadRoles = hasPermission('rbac:role:read');
  const canReadPermissions = hasPermission('rbac:permission:read');
  const canReadChannels = hasPermission('rbac:channel-credential:read');

  // 1. 网关服务状态
  const gatewayQuery = useQuery({
    queryKey: ['dashboard', 'gatewayStatus'],
    queryFn: () => authApi.getStatus(),
    retry: false,
  });

  // 2. 活跃会话数
  const sessionsQuery = useQuery({
    queryKey: ['dashboard', 'sessionsCount'],
    queryFn: () => authApi.getSessions(),
    retry: false,
  });

  // 3. 四个 total 统计（并行请求，任一失败不影响其他卡片）
  const usersQuery = useQuery({
    queryKey: ['dashboard', 'total', 'users'],
    queryFn: () =>
      request.get<PageResponse<unknown>>('/api/admin/rbac/users', {
        params: { pageNum: 1, pageSize: 1 },
        skipGlobalNotice: true,
      }),
    enabled: canReadUsers,
    retry: false,
  });

  const rolesQuery = useQuery({
    queryKey: ['dashboard', 'total', 'roles'],
    queryFn: () =>
      request.get<PageResponse<unknown>>('/api/admin/rbac/roles', {
        params: { pageNum: 1, pageSize: 1 },
        skipGlobalNotice: true,
      }),
    enabled: canReadRoles,
    retry: false,
  });

  const permissionsQuery = useQuery({
    queryKey: ['dashboard', 'total', 'permissions'],
    queryFn: () =>
      request.get<PageResponse<unknown>>('/api/admin/rbac/permissions', {
        params: { pageNum: 1, pageSize: 1 },
        skipGlobalNotice: true,
      }),
    enabled: canReadPermissions,
    retry: false,
  });

  const channelsQuery = useQuery({
    queryKey: ['dashboard', 'total', 'channels'],
    queryFn: () => channelApi.list({ pageNum: 1, pageSize: 1 }, { skipGlobalNotice: true }),
    enabled: canReadChannels,
    retry: false,
  });

  // 辅助函数：根据查询状态与权限返回展示值和提示
  const renderStatValue = (
    query: typeof usersQuery,
    hasPerm: boolean,
    requiredPerm: string,
  ): { value: string | number; tip: string; isDimmed: boolean } => {
    if (!hasPerm) {
      return {
        value: '-',
        tip: `当前主体无权限查看（需拥有 ${requiredPerm} 权限）`,
        isDimmed: true,
      };
    }
    if (query.isLoading) {
      return {
        value: '...',
        tip: '正在加载统计数据...',
        isDimmed: false,
      };
    }
    if (query.isError) {
      const errorMsg =
        query.error instanceof ApiError
          ? query.error.info
          : (query.error as Error)?.message || '加载统计失败';
      return {
        value: '-',
        tip: `获取失败: ${errorMsg}`,
        isDimmed: true,
      };
    }
    return {
      value: query.data?.total ?? 0,
      tip: `总记录数: ${query.data?.total ?? 0}`,
      isDimmed: false,
    };
  };

  const usersStat = renderStatValue(usersQuery, canReadUsers, 'rbac:user:read');
  const rolesStat = renderStatValue(rolesQuery, canReadRoles, 'rbac:role:read');
  const permissionsStat = renderStatValue(
    permissionsQuery,
    canReadPermissions,
    'rbac:permission:read',
  );
  const channelsStat = renderStatValue(
    channelsQuery,
    canReadChannels,
    'rbac:channel-credential:read',
  );

  return (
    <div className="flex flex-col gap-4">
      {/* 顶部欢迎卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{`欢迎，${username || '管理员'}！`}</CardTitle>
          <CardDescription>
            欢迎使用 DDD 平台管理控制台，当前登录会话令牌严格存储于内存中，保障操作安全与鉴权隔离。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge variant={userType === 'ADMIN_PRIMARY' ? 'warning' : 'info'}>
              {userType === 'ADMIN_PRIMARY'
                ? '主管理员 (ADMIN_PRIMARY)'
                : '子账号 (ADMIN_SUB_ACCOUNT)'}
            </StatusBadge>
            <StatusBadge variant="muted">{`账号 ID: ${accountId ?? '-'}`}</StatusBadge>
            <StatusBadge variant="muted">{`用户 ID: ${userId ?? '-'}`}</StatusBadge>
            <StatusBadge variant="cyan">{`当前有效权限项: ${permissionCodes.length} 项`}</StatusBadge>
          </div>
        </CardContent>
      </Card>

      {/* 四个 total 业务实体统计卡片 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
        <StatCard
          title="用户总数"
          value={usersStat.value}
          hint={canReadUsers ? '系统用户实体规模' : '无读取权限'}
          icon={<User className="size-5" />}
          accent="orange"
          dimmed={usersStat.isDimmed}
          tip={usersStat.tip}
        />
        <StatCard
          title="角色总数"
          value={rolesStat.value}
          hint={canReadRoles ? '安全权限角色定义' : '无读取权限'}
          icon={<Users className="size-5" />}
          accent="teal"
          dimmed={rolesStat.isDimmed}
          tip={rolesStat.tip}
        />
        <StatCard
          title="权限项总数"
          value={permissionsStat.value}
          hint={canReadPermissions ? '功能与接口权限配置' : '无读取权限'}
          icon={<KeyRound className="size-5" />}
          accent="navy"
          dimmed={permissionsStat.isDimmed}
          tip={permissionsStat.tip}
        />
        <StatCard
          title="渠道凭证总数"
          value={channelsStat.value}
          hint={canReadChannels ? '接入渠道密钥凭证' : '无读取权限'}
          icon={<Plug className="size-5" />}
          accent="amber"
          dimmed={channelsStat.isDimmed}
          tip={channelsStat.tip}
        />
      </div>

      {/* 概览快捷卡片 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        <Card size="sm">
          <CardHeader>
            <CardTitle>网关服务状态</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              <strong className="font-semibold">应用名称:</strong>{' '}
              {gatewayQuery.data?.application ||
                (gatewayQuery.isLoading ? '加载中...' : 'ian-ddd-gateway')}
            </p>
            <div className="flex items-center gap-2">
              <strong className="font-semibold">运行状态:</strong>
              <StatusBadge
                variant={
                  gatewayQuery.data?.status === 'UP' || gatewayQuery.data?.status === 'RUNNING'
                    ? 'success'
                    : gatewayQuery.isError
                      ? 'destructive'
                      : 'processing'
                }
              >
                {gatewayQuery.data?.status || (gatewayQuery.isError ? '不可用' : '在线')}
              </StatusBadge>
            </div>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>会话管理概况</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              <strong className="font-semibold">当前活跃会话数:</strong>{' '}
              <span className="text-base font-bold">
                {sessionsQuery.isError
                  ? '-'
                  : (sessionsQuery.data?.length ?? (sessionsQuery.isLoading ? '...' : 0))}
              </span>
            </p>
            <div>
              <Button
                variant="link"
                className="h-auto p-0 text-primary"
                onClick={() => navigate('/sessions')}
              >
                <Monitor className="size-4" />
                前往「我的会话」管理终端 →
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>快捷导航</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-start gap-2">
            <Button
              variant="link"
              className="h-auto p-0 text-primary"
              disabled={!canReadChannels}
              onClick={() => navigate('/platform/channel-credentials')}
            >
              <LayoutDashboard className="size-4" />
              前往「渠道凭证管理」{canReadChannels ? '→' : '（无权限）'}
            </Button>
            <p className="text-xs text-muted-foreground">
              根据登录主体分配的权限动态提供可访问业务模块
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
