import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Edit,
  Eye,
  Key,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import {
  channelApi,
  type ChannelCredentialDTO,
  type ChannelCredentialQueryParams,
  type ChannelCredentialSecretDTO,
} from '@/api/channel';
import { usePermission } from '@/hooks/usePermission';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ClearableSelect } from '@/components/ClearableSelect';
import { ConfirmPopover } from '@/components/ConfirmPopover';
import { DataTable, type ColumnDef, type StockFeatures } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { ResultBlock } from '@/components/ResultBlock';
import { CopyButton } from '@/components/CopyButton';
import { useSearchForm } from '@/hooks/useSearchForm';
import { notifySuccess } from '@/lib/toast';
import { cn } from 'cn';
import { SecretModal } from './SecretModal';
import { CreateEditModal } from './CreateEditModal';
import { DetailDrawer } from './DetailDrawer';
import { DataScopeModal } from './DataScopeModal';

export const ChannelCredentialsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermission();

  // 权限判断
  const canRead = hasPermission('rbac:channel-credential:read');
  const canCreate = hasPermission('rbac:channel-credential:create');
  const canUpdate = hasPermission('rbac:channel-credential:update');
  const canRotate = hasPermission('rbac:channel-credential:rotate');
  const canDelete = hasPermission('rbac:channel-credential:delete');

  // 查询与分页状态
  const searchForm = useSearchForm<{
    channelCode: string;
    channelName: string;
    status: boolean | null;
  }>({
    channelCode: '',
    channelName: '',
    status: null,
  });

  const [queryParams, setQueryParams] = useState<ChannelCredentialQueryParams>({
    pageNum: 1,
    pageSize: 20,
  });

  // 弹窗与抽屉状态
  const [secretModalOpen, setSecretModalOpen] = useState(false);
  const [secretData, setSecretData] = useState<ChannelCredentialSecretDTO | null>(null);

  const [createEditModalOpen, setCreateEditModalOpen] = useState(false);
  const [createEditMode, setCreateEditMode] = useState<'create' | 'edit'>('create');
  const [editingItem, setEditingItem] = useState<ChannelCredentialDTO | null>(null);

  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const [dataScopeModalOpen, setDataScopeModalOpen] = useState(false);
  const [scopedCredential, setScopedCredential] = useState<ChannelCredentialDTO | null>(null);

  // TanStack Query 列表数据请求
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['channelCredentials', queryParams],
    queryFn: () => channelApi.list(queryParams),
    enabled: canRead,
  });

  // 搜索与重置
  const handleSearch = () => {
    const values = searchForm.getValues();
    setQueryParams((prev) => ({
      ...prev,
      pageNum: 1,
      channelCode: values.channelCode?.trim() || undefined,
      channelName: values.channelName?.trim() || undefined,
      status: values.status ?? undefined,
    }));
  };

  const handleReset = () => {
    searchForm.reset();
    setQueryParams({
      pageNum: 1,
      pageSize: queryParams.pageSize || 20,
    });
  };

  // 启停状态切换
  const handleToggleStatus = async (record: ChannelCredentialDTO) => {
    const nextStatus = !record.status;
    try {
      await channelApi.updateStatus(record.id, { status: nextStatus });
      notifySuccess(nextStatus ? '已启用该渠道凭证' : '已停用该渠道凭证');
      queryClient.invalidateQueries({ queryKey: ['channelCredentials'] });
    } catch (err) {
      console.error('更新渠道凭证状态失败', err);
    }
  };

  // 轮换密钥
  const handleRotateSecret = async (record: ChannelCredentialDTO) => {
    try {
      const secretDto = await channelApi.rotateSecret(record.id);
      notifySuccess('密钥轮换成功，请立即保存新密钥！');
      queryClient.invalidateQueries({ queryKey: ['channelCredentials'] });
      // 打开密钥单次展示弹窗
      setSecretData(secretDto);
      setSecretModalOpen(true);
    } catch (err) {
      console.error('轮换渠道密钥失败', err);
    }
  };

  // 删除渠道凭证
  const handleDelete = async (record: ChannelCredentialDTO) => {
    try {
      await channelApi.delete(record.id);
      notifySuccess('已成功删除渠道凭证');
      queryClient.invalidateQueries({ queryKey: ['channelCredentials'] });
    } catch (err) {
      console.error('删除渠道凭证失败', err);
    }
  };

  // 打开创建弹窗
  const handleOpenCreate = () => {
    setCreateEditMode('create');
    setEditingItem(null);
    setCreateEditModalOpen(true);
  };

  // 打开编辑弹窗
  const handleOpenEdit = (record: ChannelCredentialDTO) => {
    setCreateEditMode('edit');
    setEditingItem(record);
    setCreateEditModalOpen(true);
  };

  // 创建/编辑成功回调
  const handleCreateEditSuccess = (newSecretData?: ChannelCredentialSecretDTO) => {
    setCreateEditModalOpen(false);
    queryClient.invalidateQueries({ queryKey: ['channelCredentials'] });
    if (newSecretData) {
      setSecretData(newSecretData);
      setSecretModalOpen(true);
    }
  };

  // 查看详情
  const handleOpenDetail = (record: ChannelCredentialDTO) => {
    setDetailId(record.id);
    setDetailDrawerOpen(true);
  };

  // 数据范围管理
  const handleOpenDataScope = (record: ChannelCredentialDTO) => {
    setScopedCredential(record);
    setDataScopeModalOpen(true);
  };

  // 权限不足提示
  if (!canRead) {
    return (
      <Card>
        <CardContent className="pt-6">
          <ResultBlock
            status="403"
            title="无权访问"
            subTitle="您当前尚未分配「渠道凭证查看 (rbac:channel-credential:read)」权限，无法查看此页面。"
          />
        </CardContent>
      </Card>
    );
  }

  const columns: ColumnDef<StockFeatures, ChannelCredentialDTO>[] = [
    {
      id: 'id',
      header: 'ID',
      accessorKey: 'id',
      size: 70,
    },
    {
      id: 'channelCode',
      header: '渠道编码',
      accessorKey: 'channelCode',
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 font-semibold">
          <span className="truncate">{row.original.channelCode}</span>
          <CopyButton value={row.original.channelCode} />
        </div>
      ),
    },
    {
      id: 'channelName',
      header: '渠道名称',
      accessorKey: 'channelName',
      cell: ({ row }) => <span className="truncate">{row.original.channelName}</span>,
    },
    {
      id: 'secretVersion',
      header: '密钥版本',
      accessorKey: 'secretVersion',
      size: 100,
      cell: ({ row }) => <StatusBadge variant="cyan">v{row.original.secretVersion}</StatusBadge>,
    },
    {
      id: 'status',
      header: '状态',
      accessorKey: 'status',
      size: 100,
      cell: ({ row }) => {
        const isEnabled = row.original.status;
        return (
          <ConfirmPopover
            title={isEnabled ? '确定要停用此渠道凭证吗？' : '确定要启用此渠道凭证吗？'}
            description={
              isEnabled
                ? '停用后使用该凭证的外部请求将被网关拦截。'
                : '启用后将恢复外部渠道的访问权限。'
            }
            onConfirm={() => handleToggleStatus(row.original)}
            okText="确定"
            cancelText="取消"
            disabled={!canUpdate}
          >
            <button
              type="button"
              disabled={!canUpdate}
              title={
                !canUpdate ? '暂无更新权限 (需 rbac:channel-credential:update)' : '点击切换状态'
              }
              className={cn('inline-flex', canUpdate ? 'cursor-pointer' : 'cursor-not-allowed')}
            >
              <StatusBadge variant={isEnabled ? 'success' : 'destructive'}>
                {isEnabled ? '启用中' : '已停用'}
              </StatusBadge>
            </button>
          </ConfirmPopover>
        );
      },
    },
    {
      id: 'lastRotatedAt',
      header: '上次轮换时间',
      accessorKey: 'lastRotatedAt',
      size: 180,
      cell: ({ row }) => row.original.lastRotatedAt || '-',
    },
    {
      id: 'createTime',
      header: '创建时间',
      accessorKey: 'createTime',
      size: 180,
      cell: ({ row }) => row.original.createTime || '-',
    },
    {
      id: 'actions',
      header: '操作',
      size: 320,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button
            variant="link"
            size="sm"
            className="h-auto p-1"
            onClick={() => handleOpenDetail(row.original)}
          >
            <Eye className="mr-1 size-3.5" />
            详情
          </Button>

          <Button
            variant="link"
            size="sm"
            className="h-auto p-1"
            disabled={!canUpdate}
            title={!canUpdate ? '暂无编辑权限 (需 rbac:channel-credential:update)' : undefined}
            onClick={() => handleOpenEdit(row.original)}
          >
            <Edit className="mr-1 size-3.5" />
            编辑
          </Button>

          <Button
            variant="link"
            size="sm"
            className="h-auto p-1"
            disabled={!canRead}
            onClick={() => handleOpenDataScope(row.original)}
          >
            <ShieldCheck className="mr-1 size-3.5" />
            数据范围
          </Button>

          <ConfirmPopover
            title="确定要轮换该渠道的密钥吗？"
            description="警告：轮换后旧密钥立即失效，且新密钥仅展示一次，请确保各业务端已做好接收准备。"
            onConfirm={() => handleRotateSecret(row.original)}
            okText="立即轮换"
            cancelText="取消"
            danger
            disabled={!canRotate}
          >
            <Button
              variant="link"
              size="sm"
              className="h-auto p-1"
              disabled={!canRotate}
              title={!canRotate ? '暂无轮换权限 (需 rbac:channel-credential:rotate)' : undefined}
            >
              <Key className="mr-1 size-3.5" />
              轮换密钥
            </Button>
          </ConfirmPopover>

          <ConfirmPopover
            title="确定要删除该渠道凭证吗？"
            description="删除操作无法撤回，该渠道关联的数据范围也将同步移除。"
            onConfirm={() => handleDelete(row.original)}
            okText="确定删除"
            cancelText="取消"
            danger
            disabled={!canDelete}
          >
            <Button
              variant="link"
              size="sm"
              className="h-auto p-1 text-destructive hover:text-destructive/80"
              disabled={!canDelete}
              title={!canDelete ? '暂无删除权限 (需 rbac:channel-credential:delete)' : undefined}
            >
              <Trash2 className="mr-1 size-3.5" />
              删除
            </Button>
          </ConfirmPopover>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="渠道凭证管理"
        description="管理平台各业务渠道的安全访问凭据，支持密钥单次展示安全轮换与数据范围授权。"
        extra={
          <Button
            disabled={!canCreate}
            title={!canCreate ? '暂无创建权限 (需 rbac:channel-credential:create)' : undefined}
            onClick={handleOpenCreate}
          >
            <Plus className="mr-1.5 size-4" />
            新建渠道凭证
          </Button>
        }
      />

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium whitespace-nowrap">渠道编码</span>
              <Input
                placeholder="请输入渠道编码（≤25）"
                maxLength={25}
                value={searchForm.values.channelCode}
                onChange={(e) => searchForm.setField('channelCode', e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium whitespace-nowrap">渠道名称</span>
              <Input
                placeholder="请输入渠道名称（≤128）"
                maxLength={128}
                value={searchForm.values.channelName}
                onChange={(e) => searchForm.setField('channelName', e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium whitespace-nowrap">状态</span>
              <ClearableSelect<boolean>
                placeholder="全部状态"
                value={searchForm.values.status}
                onChange={(val) => searchForm.setField('status', val)}
                options={[
                  { label: '启用中', value: true },
                  { label: '已停用', value: false },
                ]}
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
              <Button
                variant="outline"
                onClick={() => refetch()}
                disabled={isFetching}
                title="刷新当前表格数据"
              >
                <RefreshCw className={cn('mr-1.5 size-4', isFetching && 'animate-spin')} />
                刷新
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <DataTable<ChannelCredentialDTO>
            getRowId={(row) => row.id}
            columns={columns}
            data={data?.list || []}
            loading={isLoading}
            scrollX={1200}
            pinnedEndColumnIds={['actions']}
            pagination={{
              pageNum: queryParams.pageNum || 1,
              pageSize: queryParams.pageSize || 20,
              total: data?.total || 0,
              pageSizeOptions: [10, 20, 50, 100],
              showSizeChanger: true,
              onPageChange: (page, size) => {
                setQueryParams((prev) => ({
                  ...prev,
                  pageNum: page,
                  pageSize: size,
                }));
              },
            }}
          />
        </CardContent>
      </Card>

      {/* 密钥一次性展示弹窗 */}
      <SecretModal
        open={secretModalOpen}
        data={secretData}
        onClose={() => {
          setSecretModalOpen(false);
          setSecretData(null);
        }}
      />

      {/* 新建/编辑弹窗 */}
      <CreateEditModal
        open={createEditModalOpen}
        mode={createEditMode}
        initialData={editingItem}
        onClose={() => setCreateEditModalOpen(false)}
        onSuccess={handleCreateEditSuccess}
      />

      {/* 详情抽屉 */}
      <DetailDrawer
        open={detailDrawerOpen}
        credentialId={detailId}
        onClose={() => {
          setDetailDrawerOpen(false);
          setDetailId(null);
        }}
      />

      {/* 数据范围配置弹窗 */}
      <DataScopeModal
        open={dataScopeModalOpen}
        credential={scopedCredential}
        onClose={() => {
          setDataScopeModalOpen(false);
          setScopedCredential(null);
        }}
      />
    </div>
  );
};
