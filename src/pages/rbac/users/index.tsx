import React, { useState } from 'react';
import {
  Button,
  Card,
  Form,
  Input,
  message,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { rbacApi, type RbacUserDTO } from '@/api/rbac';
import { usePermission } from '@/hooks/usePermission';
import { PageHeader } from '@/components/PageHeader';
import { UserFormModal } from './UserFormModal';
import { UserRoleModal } from './UserRoleModal';

const { Text } = Typography;

export const UserListPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermission();
  const canRead = hasPermission('rbac:user:read');

  // 筛选与分页状态
  const [form] = Form.useForm();
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
    const values = form.getFieldsValue();
    setPageNum(1);
    setFilterParams({
      username: values.username ? values.username.trim() : undefined,
      status: values.status,
    });
  };

  const handleReset = () => {
    form.resetFields();
    setPageNum(1);
    setFilterParams({});
  };

  const handleDelete = async (id: string) => {
    try {
      await rbacApi.deleteUser(id);
      message.success('用户已成功删除');
      queryClient.invalidateQueries({ queryKey: ['rbac-users'] });
    } catch (err) {
      console.error('删除用户失败', err);
    }
  };

  const columns: ColumnsType<RbacUserDTO> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      render: (val: string) => <Text strong>{val}</Text>,
    },
    {
      title: '显示名称',
      dataIndex: 'displayName',
      key: 'displayName',
      render: (val?: string) => val || '-',
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      render: (val?: string) => val || '-',
    },
    {
      title: '手机号',
      dataIndex: 'mobile',
      key: 'mobile',
      render: (val?: string) => val || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: boolean) =>
        status ? <Tag color="success">启用</Tag> : <Tag color="error">停用</Tag>,
    },
    {
      title: '创建时间',
      dataIndex: 'createTime',
      key: 'createTime',
      width: 180,
      render: (val?: string) => (val ? val.replace('T', ' ') : '-'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space size="small">
          {hasPermission('rbac:user-role:grant') && (
            <Button
              type="link"
              size="small"
              onClick={() => {
                setAuthorizingUser(record);
                setRoleModalOpen(true);
              }}
            >
              分配角色
            </Button>
          )}

          {hasPermission('rbac:user:update') && (
            <Button
              type="link"
              size="small"
              onClick={() => {
                setEditingUser(record);
                setFormModalOpen(true);
              }}
            >
              编辑
            </Button>
          )}

          {hasPermission('rbac:user:delete') && (
            <Popconfirm
              title="确定要删除该用户吗？此操作不可逆。"
              onConfirm={() => handleDelete(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Button type="link" danger size="small">
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
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
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingUser(null);
                setFormModalOpen(true);
              }}
            >
              新增用户
            </Button>
          )
        }
      />
      <Card>
        {/* 搜索与过滤表单 */}
        <Form form={form} layout="inline" className="mb-4 flex-wrap gap-y-2">
          <Form.Item name="username" label="用户名">
            <Input placeholder="输入用户名搜索" maxLength={64} allowClear />
          </Form.Item>

          <Form.Item name="status" label="状态">
            <Select
              placeholder="账号状态"
              allowClear
              className="w-[120px]"
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

        {/* 用户数据表格 */}
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data?.list || []}
          loading={isLoading}
          pagination={{
            current: pageNum,
            pageSize,
            total: data?.total || 0,
            pageSizeOptions: ['10', '20', '50', '100'],
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (page, size) => {
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
            message.success(editingUser ? '用户已更新' : '用户创建成功');
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
            message.success('角色分配已更新');
            refetch();
          }}
        />
      </Card>
    </div>
  );
};
