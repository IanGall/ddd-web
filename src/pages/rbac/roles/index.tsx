import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { Plus, RotateCcw, Search } from 'lucide-react';
import { rbacApi, type RbacRoleDTO } from '@/api/rbac';
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
import { RoleFormModal } from './RoleFormModal';
import { RolePermissionModal } from './RolePermissionModal';

export const RoleListPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermission();
  const canRead = hasPermission('rbac:role:read');

  // 筛选与分页状态
  const searchForm = useSearchForm<{
    roleCode: string;
    roleName: string;
    status: boolean | null;
  }>({
    roleCode: '',
    roleName: '',
    status: null,
  });

  const [pageNum, setPageNum] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filterParams, setFilterParams] = useState<{
    roleCode?: string;
    roleName?: string;
    status?: boolean;
  }>({});

  // 弹窗状态
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RbacRoleDTO | null>(null);
  const [permissionModalOpen, setPermissionModalOpen] = useState(false);
  const [authorizingRole, setAuthorizingRole] = useState<RbacRoleDTO | null>(null);

  // TanStack Query 获取角色列表
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['rbac-roles', pageNum, pageSize, filterParams],
    queryFn: () =>
      rbacApi.getRoles({
        pageNum,
        pageSize,
        roleCode: filterParams.roleCode || undefined,
        roleName: filterParams.roleName || undefined,
        status: filterParams.status,
      }),
    enabled: canRead,
  });

  const handleSearch = () => {
    const values = searchForm.getValues();
    setPageNum(1);
    setFilterParams({
      roleCode: values.roleCode ? values.roleCode.trim() : undefined,
      roleName: values.roleName ? values.roleName.trim() : undefined,
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
      await rbacApi.deleteRole(id);
      notifySuccess('角色已成功删除');
      queryClient.invalidateQueries({ queryKey: ['rbac-roles'] });
    } catch (err) {
      console.error('删除角色失败', err);
    }
  };

  const columns: ColumnDef<StockFeatures, RbacRoleDTO>[] = [
    {
      id: 'id',
      header: 'ID',
      accessorKey: 'id',
      size: 80,
    },
    {
      id: 'roleCode',
      header: '角色编码',
      accessorKey: 'roleCode',
      cell: ({ row }) => <StatusBadge variant="info">{row.original.roleCode}</StatusBadge>,
    },
    {
      id: 'roleName',
      header: '角色名称',
      accessorKey: 'roleName',
      cell: ({ row }) => <span className="font-semibold">{row.original.roleName}</span>,
    },
    {
      id: 'roleDesc',
      header: '角色描述',
      accessorKey: 'roleDesc',
      cell: ({ row }) => row.original.roleDesc || '-',
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
          {hasPermission('rbac:role-permission:grant') && (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-1"
              onClick={() => {
                setAuthorizingRole(row.original);
                setPermissionModalOpen(true);
              }}
            >
              分配权限
            </Button>
          )}

          {hasPermission('rbac:role:update') && (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-1"
              onClick={() => {
                setEditingRole(row.original);
                setFormModalOpen(true);
              }}
            >
              编辑
            </Button>
          )}

          {hasPermission('rbac:role:delete') && (
            <ConfirmPopover
              title="确定要删除该角色吗？此操作不可逆。"
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
        title="角色管理"
        description="管理系统角色及其关联的权限集合"
        extra={
          hasPermission('rbac:role:create') && (
            <Button
              onClick={() => {
                setEditingRole(null);
                setFormModalOpen(true);
              }}
            >
              <Plus className="mr-1.5 size-4" />
              新增角色
            </Button>
          )
        }
      />
      <Card>
        <CardContent className="pt-6">
          {/* 搜索过滤表单 */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium whitespace-nowrap">角色编码</span>
              <Input
                placeholder="输入编码搜索"
                maxLength={64}
                value={searchForm.values.roleCode}
                onChange={(e) => searchForm.setField('roleCode', e.target.value)}
                className="w-[180px]"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium whitespace-nowrap">角色名称</span>
              <Input
                placeholder="输入名称搜索"
                maxLength={128}
                value={searchForm.values.roleName}
                onChange={(e) => searchForm.setField('roleName', e.target.value)}
                className="w-[180px]"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium whitespace-nowrap">状态</span>
              <ClearableSelect<boolean>
                placeholder="角色状态"
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

          {/* 角色数据表格 */}
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

          {/* 新增/编辑角色弹窗 */}
          <RoleFormModal
            open={formModalOpen}
            role={editingRole}
            onClose={() => setFormModalOpen(false)}
            onSuccess={() => {
              setFormModalOpen(false);
              notifySuccess(editingRole ? '角色已更新' : '角色创建成功');
              queryClient.invalidateQueries({ queryKey: ['rbac-roles'] });
            }}
          />

          {/* 分配权限弹窗 */}
          <RolePermissionModal
            open={permissionModalOpen}
            role={authorizingRole}
            onClose={() => setPermissionModalOpen(false)}
            onSuccess={() => {
              setPermissionModalOpen(false);
              notifySuccess('角色权限已更新');
              refetch();
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
};
