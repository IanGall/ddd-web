import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { Plus, RotateCcw, Search } from 'lucide-react';
import { rbacApi, type RbacUserDTO } from '@/api/rbac';
import { usePermission } from '@/hooks/usePermission';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ClearableSelect } from '@/components/ClearableSelect';
import { ConfirmPopover } from '@/components/ConfirmPopover';
import { DataTable, type ColumnDef, type StockFeatures } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { useSearchForm } from '@/hooks/useSearchForm';
import { notifySuccess } from '@/lib/toast';
import { UserFormModal } from './UserFormModal';
import { UserRoleModal } from './UserRoleModal';

export const UserListPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermission();
  const canRead = hasPermission('rbac:user:read');

  // 筛选与分页状态
  const searchForm = useSearchForm<{
    username: string;
    status: boolean | null;
  }>({
    username: '',
    status: null,
  });

  const [pageNum, setPageNum] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filterParams, setFilterParams] = useState<{
    username?: string;
    status?: boolean;
  }>({});

  // 弹窗状态
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<RbacUserDTO | null>(null);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [authorizingUser, setAuthorizingUser] = useState<RbacUserDTO | null>(null);

  // TanStack Query 获取用户列表
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['rbac-users', pageNum, pageSize, filterParams],
    queryFn: () =>
      rbacApi.getUsers({
        pageNum,
        pageSize,
        username: filterParams.username || undefined,
        status: filterParams.status,
      }),
    enabled: canRead,
  });

  const handleSearch = () => {
    const values = searchForm.getValues();
    setPageNum(1);
    setFilterParams({
      username: values.username ? values.username.trim() : undefined,
      status: values.status ?? undefined,
    });
  };

  const handleReset = () => {
    searchForm.reset();
    setPageNum(1);
    setFilterParams({});
  };

  const handleDelete = async (id: string) => {
    try {
      await rbacApi.deleteUser(id);
      notifySuccess('用户已成功删除');
      queryClient.invalidateQueries({ queryKey: ['rbac-users'] });
    } catch (err) {
      console.error('删除用户失败', err);
    }
  };

  const columns: ColumnDef<StockFeatures, RbacUserDTO>[] = [
    {
      id: 'id',
      header: 'ID',
      accessorKey: 'id',
      size: 80,
    },
    {
      id: 'username',
      header: '用户名',
      accessorKey: 'username',
      cell: ({ row }) => <span className="font-semibold">{row.original.username}</span>,
    },
    {
      id: 'displayName',
      header: '显示名称',
      accessorKey: 'displayName',
      cell: ({ row }) => row.original.displayName || '-',
    },
    {
      id: 'email',
      header: '邮箱',
      accessorKey: 'email',
      cell: ({ row }) => row.original.email || '-',
    },
    {
      id: 'mobile',
      header: '手机号',
      accessorKey: 'mobile',
      cell: ({ row }) => row.original.mobile || '-',
    },
    {
      id: 'status',
      header: '状态',
      accessorKey: 'status',
      size: 100,
      cell: ({ row }) =>
        row.original.status ? (
          <StatusBadge variant="success">启用</StatusBadge>
        ) : (
          <StatusBadge variant="destructive">停用</StatusBadge>
        ),
    },
    {
      id: 'createTime',
      header: '创建时间',
      accessorKey: 'createTime',
      size: 180,
      cell: ({ row }) =>
        row.original.createTime ? row.original.createTime.replace('T', ' ') : '-',
    },
    {
      id: 'actions',
      header: '操作',
      size: 200,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          {hasPermission('rbac:user-role:grant') && (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-1"
              onClick={() => {
                setAuthorizingUser(row.original);
                setRoleModalOpen(true);
              }}
            >
              分配角色
            </Button>
          )}

          {hasPermission('rbac:user:update') && (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-1"
              onClick={() => {
                setEditingUser(row.original);
                setFormModalOpen(true);
              }}
            >
              编辑
            </Button>
          )}

          {hasPermission('rbac:user:delete') && (
            <ConfirmPopover
              title="确定要删除该用户吗？此操作不可逆。"
              onConfirm={() => handleDelete(row.original.id)}
              okText="确定"
              cancelText="取消"
              danger
            >
              <Button
                variant="link"
                size="sm"
                className="h-auto p-1 text-destructive hover:text-destructive/80"
              >
                删除
              </Button>
            </ConfirmPopover>
          )}
        </div>
      ),
    },
  ];

  if (!canRead) {
    return <Navigate to="/403" replace />;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="用户管理"
        description="管理当前账号下的系统管理员与子账号信息"
        extra={
          hasPermission('rbac:user:create') && (
            <Button
              onClick={() => {
                setEditingUser(null);
                setFormModalOpen(true);
              }}
            >
              <Plus className="mr-1.5 size-4" />
              新增用户
            </Button>
          )
        }
      />
      <Card>
        <CardContent className="pt-6">
          {/* 搜索与过滤表单 */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium whitespace-nowrap">用户名</span>
              <Input
                placeholder="输入用户名搜索"
                maxLength={64}
                value={searchForm.values.username}
                onChange={(e) => searchForm.setField('username', e.target.value)}
                className="w-[180px]"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium whitespace-nowrap">状态</span>
              <ClearableSelect<boolean>
                placeholder="账号状态"
                value={searchForm.values.status}
                onChange={(val) => searchForm.setField('status', val)}
                options={[
                  { label: '启用', value: true },
                  { label: '停用', value: false },
                ]}
                className="w-[120px]"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={handleSearch}>
                <Search className="mr-1.5 size-4" />
                查询
              </Button>
              <Button variant="outline" onClick={handleReset}>
                <RotateCcw className="mr-1.5 size-4" />
                重置
              </Button>
            </div>
          </div>

          {/* 用户数据表格 */}
          <DataTable
            getRowId={(row) => row.id}
            columns={columns}
            data={data?.list || []}
            loading={isLoading}
            pagination={{
              pageNum,
              pageSize,
              total: data?.total || 0,
              pageSizeOptions: [10, 20, 50, 100],
              showSizeChanger: true,
              onPageChange: (page, size) => {
                setPageNum(page);
                setPageSize(size);
              },
            }}
          />

          {/* 新增/编辑用户弹窗 */}
          <UserFormModal
            open={formModalOpen}
            user={editingUser}
            onClose={() => setFormModalOpen(false)}
            onSuccess={() => {
              setFormModalOpen(false);
              notifySuccess(editingUser ? '用户已更新' : '用户创建成功');
              queryClient.invalidateQueries({ queryKey: ['rbac-users'] });
            }}
          />

          {/* 分配角色弹窗 */}
          <UserRoleModal
            open={roleModalOpen}
            user={authorizingUser}
            onClose={() => setRoleModalOpen(false)}
            onSuccess={() => {
              setRoleModalOpen(false);
              notifySuccess('角色分配已更新');
              refetch();
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
};
