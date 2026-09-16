import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { Plus, RotateCcw, Search } from 'lucide-react';
import { rbacApi, type RbacPermissionDTO } from '@/api/rbac';
import { usePermission } from '@/hooks/usePermission';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ClearableSelect } from '@/components/ClearableSelect';
import { ConfirmPopover } from '@/components/ConfirmPopover';
import { DataTable, type ColumnDef, type StockFeatures } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSearchForm } from '@/hooks/useSearchForm';
import { notifySuccess } from '@/lib/toast';
import { PermissionFormModal } from './PermissionFormModal';
import { buildPermissionTree, ROOT_PARENT_ID, type PermissionTreeNode } from './utils';

export const PermissionListPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermission();
  const canRead = hasPermission('rbac:permission:read');

  // 筛选与分页状态
  const searchForm = useSearchForm<{
    permCode: string;
    permName: string;
    permType: number | null;
    parentId: string;
    status: boolean | null;
  }>({
    permCode: '',
    permName: '',
    permType: null,
    parentId: '',
    status: null,
  });

  const [pageNum, setPageNum] = useState(1);
  const [pageSize, setPageSize] = useState(50); // 权限树形展示，默认适度大一些的分页
  const [filterParams, setFilterParams] = useState<{
    permCode?: string;
    permName?: string;
    permType?: number;
    parentId?: string;
    status?: boolean;
  }>({});

  const [displayMode, setDisplayMode] = useState<'tree' | 'flat'>('tree');

  // 弹窗状态
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingPermission, setEditingPermission] = useState<RbacPermissionDTO | null>(null);

  // TanStack Query 获取权限项列表
  const { data, isLoading } = useQuery({
    queryKey: ['rbac-permissions', pageNum, pageSize, filterParams],
    queryFn: () =>
      rbacApi.getPermissions({
        pageNum,
        pageSize,
        permCode: filterParams.permCode || undefined,
        permName: filterParams.permName || undefined,
        permType: filterParams.permType,
        parentId: filterParams.parentId,
        status: filterParams.status,
      }),
    enabled: canRead,
  });

  const rawList = useMemo(() => data?.list || [], [data?.list]);

  // 计算树形结构展示数据
  const tableData = useMemo(() => {
    if (displayMode === 'tree') {
      return buildPermissionTree(rawList);
    }
    return rawList;
  }, [rawList, displayMode]);

  const handleSearch = () => {
    const values = searchForm.getValues();
    setPageNum(1);
    setFilterParams({
      permCode: values.permCode ? values.permCode.trim() : undefined,
      permName: values.permName ? values.permName.trim() : undefined,
      permType: values.permType ?? undefined,
      parentId: values.parentId ? values.parentId.trim() : undefined,
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
      await rbacApi.deletePermission(id);
      notifySuccess('权限项已成功删除');
      queryClient.invalidateQueries({ queryKey: ['rbac-permissions'] });
    } catch (err) {
      console.error('删除权限项失败', err);
    }
  };

  const columns: ColumnDef<StockFeatures, RbacPermissionDTO>[] = [
    {
      id: 'permName',
      header: '权限名称',
      accessorKey: 'permName',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="font-semibold">{row.original.permName}</span>
          {row.original.systemManaged && <StatusBadge variant="builtin">内置</StatusBadge>}
        </div>
      ),
    },
    {
      id: 'permCode',
      header: '权限编码 (permCode)',
      accessorKey: 'permCode',
      cell: ({ row }) => <StatusBadge variant="info">{row.original.permCode}</StatusBadge>,
    },
    {
      id: 'permType',
      header: '类型',
      accessorKey: 'permType',
      size: 90,
      cell: ({ row }) => {
        switch (row.original.permType) {
          case 1:
            return <StatusBadge variant="type-dir">目录</StatusBadge>;
          case 2:
            return <StatusBadge variant="type-menu">菜单</StatusBadge>;
          case 3:
            return <StatusBadge variant="type-action">按钮</StatusBadge>;
          default:
            return <StatusBadge variant="muted">{row.original.permType}</StatusBadge>;
        }
      },
    },
    {
      id: 'parentId',
      header: '父级 ID',
      accessorKey: 'parentId',
      size: 90,
      cell: ({ row }) =>
        row.original.parentId === ROOT_PARENT_ID ? (
          <span className="text-muted-foreground">0 (根)</span>
        ) : (
          (row.original.parentId ?? '-')
        ),
    },
    {
      id: 'path',
      header: '路由 / 接口路径',
      accessorKey: 'path',
      cell: ({ row }) => row.original.path || '-',
    },
    {
      id: 'method',
      header: '请求方法',
      accessorKey: 'method',
      size: 90,
      cell: ({ row }) =>
        row.original.method ? (
          <StatusBadge variant={row.original.method === 'GET' ? 'cyan' : 'warning'}>
            {row.original.method}
          </StatusBadge>
        ) : (
          '-'
        ),
    },
    {
      id: 'status',
      header: '状态',
      accessorKey: 'status',
      size: 90,
      cell: ({ row }) =>
        row.original.status ? (
          <StatusBadge variant="success">启用</StatusBadge>
        ) : (
          <StatusBadge variant="destructive">停用</StatusBadge>
        ),
    },
    {
      id: 'actions',
      header: '操作',
      size: 140,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          {hasPermission('rbac:permission:update') && (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-1"
              onClick={() => {
                setEditingPermission(row.original);
                setFormModalOpen(true);
              }}
            >
              编辑
            </Button>
          )}

          {hasPermission('rbac:permission:delete') &&
            (row.original.systemManaged ? (
              <Button
                variant="link"
                size="sm"
                className="h-auto p-1 text-destructive"
                disabled
                title="系统内置权限不可删除"
              >
                删除
              </Button>
            ) : (
              <ConfirmPopover
                title="确定要删除该权限项吗？此操作不可逆。"
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
            ))}
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
        title="权限项管理"
        description="管理目录、菜单与按钮三级权限节点，内置权限禁止删除"
        extra={
          <div className="flex items-center gap-3">
            <Tabs
              value={displayMode}
              onValueChange={(val) => setDisplayMode(val as 'tree' | 'flat')}
            >
              <TabsList>
                <TabsTrigger value="tree">层级树形</TabsTrigger>
                <TabsTrigger value="flat">平铺列表</TabsTrigger>
              </TabsList>
            </Tabs>

            {hasPermission('rbac:permission:create') && (
              <Button
                onClick={() => {
                  setEditingPermission(null);
                  setFormModalOpen(true);
                }}
              >
                <Plus className="mr-1.5 size-4" />
                新增权限项
              </Button>
            )}
          </div>
        }
      />
      <Card>
        <CardContent className="pt-6">
          {/* 搜索与过滤表单 */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium whitespace-nowrap">权限编码</span>
              <Input
                placeholder="支持模糊编码"
                maxLength={64}
                value={searchForm.values.permCode}
                onChange={(e) => searchForm.setField('permCode', e.target.value)}
                className="w-[160px]"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium whitespace-nowrap">权限名称</span>
              <Input
                placeholder="支持名称模糊"
                maxLength={128}
                value={searchForm.values.permName}
                onChange={(e) => searchForm.setField('permName', e.target.value)}
                className="w-[160px]"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium whitespace-nowrap">类型</span>
              <ClearableSelect<number>
                placeholder="全部类型"
                value={searchForm.values.permType}
                onChange={(val) => searchForm.setField('permType', val)}
                options={[
                  { label: '目录', value: 1 },
                  { label: '菜单', value: 2 },
                  { label: '按钮', value: 3 },
                ]}
                className="w-[110px]"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium whitespace-nowrap">父节点 ID</span>
              <Input
                placeholder="0 为根"
                value={searchForm.values.parentId}
                onChange={(e) => searchForm.setField('parentId', e.target.value)}
                className="w-[100px]"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium whitespace-nowrap">状态</span>
              <ClearableSelect<boolean>
                placeholder="状态"
                value={searchForm.values.status}
                onChange={(val) => searchForm.setField('status', val)}
                options={[
                  { label: '启用', value: true },
                  { label: '停用', value: false },
                ]}
                className="w-[100px]"
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

          {/* 权限数据表格（支持按 parentId 呈现父子层级） */}
          <DataTable
            getRowId={(row) => row.id}
            columns={columns}
            data={tableData}
            loading={isLoading}
            getSubRows={
              displayMode === 'tree' ? (r) => (r as PermissionTreeNode).children : undefined
            }
            pagination={{
              pageNum,
              pageSize,
              total: data?.total || 0,
              pageSizeOptions: [20, 50, 100],
              showSizeChanger: true,
              onPageChange: (page, size) => {
                setPageNum(page);
                setPageSize(size);
              },
            }}
          />

          {/* 新增/编辑权限项弹窗 */}
          <PermissionFormModal
            open={formModalOpen}
            permission={editingPermission}
            allPermissions={rawList}
            onClose={() => setFormModalOpen(false)}
            onSuccess={() => {
              setFormModalOpen(false);
              notifySuccess(editingPermission ? '权限项已更新' : '权限项创建成功');
              queryClient.invalidateQueries({ queryKey: ['rbac-permissions'] });
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
};
