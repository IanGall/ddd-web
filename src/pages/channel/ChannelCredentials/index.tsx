import React, { useState } from 'react';
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  message,
  Popconfirm,
  Result,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  KeyOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  channelApi,
  type ChannelCredentialDTO,
  type ChannelCredentialQueryParams,
  type ChannelCredentialSecretDTO,
} from '@/api/channel';
import { usePermission } from '@/hooks/usePermission';
import { SecretModal } from './SecretModal';
import { CreateEditModal } from './CreateEditModal';
import { DetailDrawer } from './DetailDrawer';
import { DataScopeModal } from './DataScopeModal';
import { PageHeader } from '@/components/PageHeader';

const { Text } = Typography;

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
  const [searchForm] = Form.useForm<ChannelCredentialQueryParams>();
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
    const values = searchForm.getFieldsValue();
    setQueryParams((prev) => ({
      ...prev,
      pageNum: 1,
      channelCode: values.channelCode?.trim() || undefined,
      channelName: values.channelName?.trim() || undefined,
      status: values.status,
    }));
  };

  const handleReset = () => {
    searchForm.resetFields();
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
      message.success(nextStatus ? '已启用该渠道凭证' : '已停用该渠道凭证');
      queryClient.invalidateQueries({ queryKey: ['channelCredentials'] });
    } catch (err) {
      console.error('更新渠道凭证状态失败', err);
    }
  };

  // 轮换密钥
  const handleRotateSecret = async (record: ChannelCredentialDTO) => {
    try {
      const secretDto = await channelApi.rotateSecret(record.id);
      message.success('密钥轮换成功，请立即保存新密钥！');
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
      message.success('已成功删除渠道凭证');
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
        <Result
          status="403"
          title="无权访问"
          subTitle="您当前尚未分配「渠道凭证查看 (rbac:channel-credential:read)」权限，无法查看此页面。"
        />
      </Card>
    );
  }

  const columns: ColumnsType<ChannelCredentialDTO> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 70,
    },
    {
      title: '渠道编码',
      dataIndex: 'channelCode',
      key: 'channelCode',
      ellipsis: true,
      render: (code: string) => (
        <Text strong copyable>
          {code}
        </Text>
      ),
    },
    {
      title: '渠道名称',
      dataIndex: 'channelName',
      key: 'channelName',
      ellipsis: true,
    },
    {
      title: '密钥版本',
      dataIndex: 'secretVersion',
      key: 'secretVersion',
      width: 100,
      render: (ver: number) => <Tag color="cyan">v{ver}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: boolean, record) => (
        <Popconfirm
          title={status ? '确定要停用此渠道凭证吗？' : '确定要启用此渠道凭证吗？'}
          description={
            status ? '停用后使用该凭证的外部请求将被网关拦截。' : '启用后将恢复外部渠道的访问权限。'
          }
          onConfirm={() => handleToggleStatus(record)}
          okText="确定"
          cancelText="取消"
          disabled={!canUpdate}
        >
          <Tooltip
            title={!canUpdate ? '暂无更新权限 (需 rbac:channel-credential:update)' : '点击切换状态'}
          >
            <Tag
              color={status ? 'success' : 'error'}
              className={canUpdate ? 'cursor-pointer' : 'cursor-not-allowed'}
            >
              {status ? '启用中' : '已停用'}
            </Tag>
          </Tooltip>
        </Popconfirm>
      ),
    },
    {
      title: '上次轮换时间',
      dataIndex: 'lastRotatedAt',
      key: 'lastRotatedAt',
      width: 180,
      render: (val: string) => val || '-',
    },
    {
      title: '创建时间',
      dataIndex: 'createTime',
      key: 'createTime',
      width: 180,
      render: (val: string) => val || '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 320,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small" wrap>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleOpenDetail(record)}
          >
            详情
          </Button>

          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            disabled={!canUpdate}
            title={!canUpdate ? '暂无编辑权限 (需 rbac:channel-credential:update)' : undefined}
            onClick={() => handleOpenEdit(record)}
          >
            编辑
          </Button>

          <Button
            type="link"
            size="small"
            icon={<SafetyCertificateOutlined />}
            disabled={!canRead}
            onClick={() => handleOpenDataScope(record)}
          >
            数据范围
          </Button>

          <Popconfirm
            title="确定要轮换该渠道的密钥吗？"
            description="警告：轮换后旧密钥立即失效，且新密钥仅展示一次，请确保各业务端已做好接收准备。"
            onConfirm={() => handleRotateSecret(record)}
            okText="立即轮换"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            disabled={!canRotate}
          >
            <Button
              type="link"
              size="small"
              icon={<KeyOutlined />}
              disabled={!canRotate}
              title={!canRotate ? '暂无轮换权限 (需 rbac:channel-credential:rotate)' : undefined}
            >
              轮换密钥
            </Button>
          </Popconfirm>

          <Popconfirm
            title="确定要删除该渠道凭证吗？"
            description="删除操作无法撤回，该渠道关联的数据范围也将同步移除。"
            onConfirm={() => handleDelete(record)}
            okText="确定删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            disabled={!canDelete}
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              disabled={!canDelete}
              title={!canDelete ? '暂无删除权限 (需 rbac:channel-credential:delete)' : undefined}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
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
            type="primary"
            icon={<PlusOutlined />}
            disabled={!canCreate}
            title={!canCreate ? '暂无创建权限 (需 rbac:channel-credential:create)' : undefined}
            onClick={handleOpenCreate}
          >
            新建渠道凭证
          </Button>
        }
      />
      <Card>
        {/* 筛选过滤表单 */}
        <Form form={searchForm} layout="horizontal">
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Form.Item name="channelCode" label="渠道编码" className="mb-0">
                <Input placeholder="请输入渠道编码（≤25）" maxLength={25} allowClear />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Form.Item name="channelName" label="渠道名称" className="mb-0">
                <Input placeholder="请输入渠道名称（≤128）" maxLength={128} allowClear />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Form.Item name="status" label="状态" className="mb-0">
                <Select
                  placeholder="全部状态"
                  allowClear
                  options={[
                    { value: true, label: '启用中' },
                    { value: false, label: '已停用' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Space>
                <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
                  查询
                </Button>
                <Button icon={<ReloadOutlined />} onClick={handleReset}>
                  重置
                </Button>
                <Button onClick={() => refetch()} loading={isFetching} title="刷新当前表格数据">
                  刷新
                </Button>
              </Space>
            </Col>
          </Row>
        </Form>
      </Card>

      <Card>
        <Table<ChannelCredentialDTO>
          rowKey="id"
          columns={columns}
          dataSource={data?.list || []}
          loading={isLoading}
          scroll={{ x: 1200 }}
          pagination={{
            current: queryParams.pageNum || 1,
            pageSize: queryParams.pageSize || 20,
            total: data?.total || 0,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (total) => `共 ${total} 条记录`,
            onChange: (page, size) => {
              setQueryParams((prev) => ({
                ...prev,
                pageNum: page,
                pageSize: size,
              }));
            },
          }}
        />
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
