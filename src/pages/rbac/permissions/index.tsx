import React, { useMemo, useState } from 'react';
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  message,
  Popconfirm,
  Radio,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { rbacApi, type RbacPermissionDTO } from '@/api/rbac';
import { usePermission } from '@/hooks/usePermission';
import { PermissionFormModal } from './PermissionFormModal';
import { buildPermissionTree } from './utils';

const { Title, Text } = Typography;

export const PermissionListPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermission();
  const canRead = hasPermission('rbac:permission:read');

  // 筛选与分页状态
  const [form] = Form.useForm();
  const [pageNum, setPageNum] = useState(1);
  const [pageSize, setPageSize] = useState(50); // 权限树形展示，默认适度大一些的分页
  const [filterParams, setFilterParams] = useState<{
    permCode?: string;
    permName?: string;
    permType?: number;
    parentId?: number;
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
    const values = form.getFieldsValue();
    setPageNum(1);
    setFilterParams({
      permCode: values.permCode ? values.permCode.trim() : undefined,
      permName: values.permName ? values.permName.trim() : undefined,
      permType: values.permType,
      parentId: typeof values.parentId === 'number' ? values.parentId : undefined,
      status: values.status,
    });
  };

  const handleReset = () => {
    form.resetFields();
    setPageNum(1);
    setFilterParams({});
  };

  const handleDelete = async (id: number) => {
    try {
      await rbacApi.deletePermission(id);
      message.success('权限项已成功删除');
      queryClient.invalidateQueries({ queryKey: ['rbac-permissions'] });
    } catch (err) {
      console.error('删除权限项失败', err);
    }
  };

  const columns: ColumnsType<RbacPermissionDTO> = [
    {
      title: '权限名称',
      dataIndex: 'permName',
      key: 'permName',
      render: (val: string, record) => (
        <Space>
          <Text strong>{val}</Text>
          {record.systemManaged && <Tag color="purple">内置</Tag>}
        </Space>
      ),
    },
    {
      title: '权限编码 (permCode)',
      dataIndex: 'permCode',
      key: 'permCode',
      render: (val: string) => <Tag color="blue">{val}</Tag>,
    },
    {
      title: '类型',
      dataIndex: 'permType',
      key: 'permType',
      width: 90,
      render: (type: number) => {
        switch (type) {
          case 1:
            return <Tag color="geekblue">目录</Tag>;
          case 2:
            return <Tag color="green">菜单</Tag>;
          case 3:
            return <Tag color="orange">按钮</Tag>;
          default:
            return <Tag>{type}</Tag>;
        }
      },
    },
    {
      title: '父级 ID',
      dataIndex: 'parentId',
      key: 'parentId',
      width: 90,
      render: (val?: number) => (val === 0 ? <Text type="secondary">0 (根)</Text> : (val ?? '-')),
    },
    {
      title: '路由 / 接口路径',
      dataIndex: 'path',
      key: 'path',
      ellipsis: true,
      render: (val?: string) => val || '-',
    },
    {
      title: '请求方法',
      dataIndex: 'method',
      key: 'method',
      width: 90,
      render: (val?: string) =>
        val ? <Tag color={val === 'GET' ? 'cyan' : 'gold'}>{val}</Tag> : '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status: boolean) =>
        status ? <Tag color="success">启用</Tag> : <Tag color="error">停用</Tag>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 140,
      render: (_, record) => (
        <Space size="small">
          {hasPermission('rbac:permission:update') && (
            <Button
              type="link"
              size="small"
              onClick={() => {
                setEditingPermission(record);
                setFormModalOpen(true);
              }}
            >
              编辑
            </Button>
          )}

          {hasPermission('rbac:permission:delete') &&
            (record.systemManaged ? (
              <Tooltip title="系统内置权限不可删除">
                <Button type="link" danger size="small" disabled>
                  删除
                </Button>
              </Tooltip>
            ) : (
              <Popconfirm
                title="确定要删除该权限项吗？此操作不可逆。"
                onConfirm={() => handleDelete(record.id)}
                okText="确定"
                cancelText="取消"
              >
                <Button type="link" danger size="small">
                  删除
                </Button>
              </Popconfirm>
            ))}
        </Space>
      ),
    },
  ];

  if (!canRead) {
    return <Navigate to="/403" replace />;
  }

  return (
    <Card>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <div>
          <Title level={4} style={{ margin: 0 }}>
            权限项管理
          </Title>
          <Text type="secondary">管理目录、菜单与按钮三级权限节点，内置权限禁止删除</Text>
        </div>

        <Space>
          <Radio.Group
            value={displayMode}
            onChange={(e) => setDisplayMode(e.target.value)}
            optionType="button"
            buttonStyle="solid"
          >
            <Radio.Button value="tree">层级树形</Radio.Button>
            <Radio.Button value="flat">平铺列表</Radio.Button>
          </Radio.Group>

          {hasPermission('rbac:permission:create') && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingPermission(null);
                setFormModalOpen(true);
              }}
            >
              新增权限项
            </Button>
          )}
        </Space>
      </div>

      {/* 搜索与过滤表单 */}
      <Form
        form={form}
        layout="inline"
        style={{ marginBottom: 16, flexWrap: 'wrap', gap: '8px 0' }}
      >
        <Form.Item name="permCode" label="权限编码">
          <Input placeholder="支持模糊编码" maxLength={64} allowClear />
        </Form.Item>

        <Form.Item name="permName" label="权限名称">
          <Input placeholder="支持名称模糊" maxLength={128} allowClear />
        </Form.Item>

        <Form.Item name="permType" label="类型">
          <Select
            placeholder="全部类型"
            allowClear
            style={{ width: 110 }}
            options={[
              { label: '目录', value: 1 },
              { label: '菜单', value: 2 },
              { label: '按钮', value: 3 },
            ]}
          />
        </Form.Item>

        <Form.Item name="parentId" label="父节点 ID">
          <InputNumber placeholder="0 为根" min={0} style={{ width: 100 }} />
        </Form.Item>

        <Form.Item name="status" label="状态">
          <Select
            placeholder="状态"
            allowClear
            style={{ width: 100 }}
            options={[
              { label: '启用', value: true },
              { label: '停用', value: false },
            ]}
          />
        </Form.Item>

        <Form.Item>
          <Space>
            <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
              查询
            </Button>
            <Button icon={<ReloadOutlined />} onClick={handleReset}>
              重置
            </Button>
          </Space>
        </Form.Item>
      </Form>

      {/* 权限数据表格（支持按 parentId 呈现父子层级） */}
      <Table
        rowKey="id"
        columns={columns}
        dataSource={tableData}
        loading={isLoading}
        pagination={{
          current: pageNum,
          pageSize,
          total: data?.total || 0,
          pageSizeOptions: ['20', '50', '100'],
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (page, size) => {
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
          message.success(editingPermission ? '权限项已更新' : '权限项创建成功');
          queryClient.invalidateQueries({ queryKey: ['rbac-permissions'] });
        }}
      />
    </Card>
  );
};
