import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '@/api/auth';
import type { AuthSessionDTO } from '@/api/types';
import { useAuthStore } from '@/store/auth';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ConfirmPopover } from '@/components/ConfirmPopover';
import { DataTable, type ColumnDef, type StockFeatures } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { notifyError, notifySuccess } from '@/lib/toast';

export const SessionsPage: React.FC = () => {
  const [sessions, setSessions] = useState<AuthSessionDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const clearAuth = useAuthStore((state) => state.clear);
  const navigate = useNavigate();

  const load = useCallback(() => {
    return authApi
      .getSessions()
      .then((data) => setSessions(data))
      .catch((err) => console.error('获取会话列表失败', err))
      .finally(() => setLoading(false));
  }, []);

  // 挂载即拉取：初次渲染已处于 loading 态，effect 内只做异步回调写入
  useEffect(() => {
    void load();
  }, [load]);

  const fetchSessions = () => {
    setLoading(true);
    void load();
  };

  const handleRevoke = async (sessionId: string) => {
    try {
      await authApi.revokeSession(sessionId);
      notifySuccess('已吊销该会话');
      fetchSessions();
    } catch (err) {
      console.error('吊销会话失败', err);
      notifyError('吊销会话失败');
    }
  };

  const handleLogoutAll = async () => {
    try {
      await authApi.logoutAll();
      notifySuccess('已强制登出全部会话');
      clearAuth();
      navigate('/login');
    } catch (err) {
      console.error('登出全部会话失败', err);
      notifyError('登出全部会话失败');
    }
  };

  const columns: ColumnDef<StockFeatures, AuthSessionDTO>[] = [
    {
      id: 'clientType',
      header: '客户端类型',
      accessorKey: 'clientType',
      cell: ({ row }) => <StatusBadge variant="info">{row.original.clientType}</StatusBadge>,
    },
    {
      id: 'ipAddress',
      header: '来源 IP',
      accessorKey: 'ipAddress',
      cell: ({ row }) => row.original.ipAddress ?? '-',
    },
    {
      id: 'deviceId',
      header: '设备识别码',
      accessorKey: 'deviceId',
      cell: ({ row }) => (
        <span className="inline-block max-w-[200px] truncate" title={row.original.deviceId}>
          {row.original.deviceId ?? '-'}
        </span>
      ),
    },
    {
      id: 'createdAt',
      header: '创建时间 (UTC)',
      accessorKey: 'createdAt',
      cell: ({ row }) => row.original.createdAt ?? '-',
    },
    {
      id: 'current',
      header: '状态',
      cell: ({ row }) =>
        row.original.current ? (
          <StatusBadge variant="current">当前设备</StatusBadge>
        ) : (
          <StatusBadge variant="muted">其它终端</StatusBadge>
        ),
    },
    {
      id: 'action',
      header: '操作',
      cell: ({ row }) => (
        <div className="flex items-center">
          {!row.original.current && (
            <ConfirmPopover
              title="确定要吊销该设备会话吗？"
              onConfirm={() => handleRevoke(row.original.sessionId)}
              okText="吊销"
              cancelText="取消"
              danger
            >
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-destructive hover:text-destructive/80"
              >
                吊销
              </Button>
            </ConfirmPopover>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="我的会话"
        description="查看已建立登录会话并可随时吊销非本设备登录"
        extra={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={fetchSessions} disabled={loading}>
              刷新
            </Button>
            <ConfirmPopover
              title="确定要强制登出全部会话吗？本设备也需重新登录。"
              onConfirm={handleLogoutAll}
              okText="确定登出"
              cancelText="取消"
              danger
            >
              <Button variant="destructive">登出全部会话</Button>
            </ConfirmPopover>
          </div>
        }
      />
      <Card>
        <CardContent>
          <DataTable
            getRowId={(row) => row.sessionId}
            columns={columns}
            data={sessions}
            loading={loading}
            pagination={false}
          />
        </CardContent>
      </Card>
    </div>
  );
};
