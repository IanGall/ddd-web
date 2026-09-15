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
import { rbacApi, type RbacRoleDTO } from '@/api/rbac';
import { usePermission } from '@/hooks/usePermission';
import { RoleFormModal } from './RoleFormModal';
import { RolePermissionModal } from './RolePermissionModal';

const { Title, Text } = Typography;

export const RoleListPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermission();
  const canRead = hasPermission('rbac:role:read');

  // 筛选与分页状态
  const [form] = Form.useForm();
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
    const values = form.getFieldsValue();
    setPageNum(1);
    setFilterParams({
      roleCode: values.roleCode ? values.roleCode.trim() : undefined,
      roleName: values.roleName ? values.roleName.trim() : undefined,
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
      await rbacApi.deleteRole(id);
      message.success('角色已成功删除');
      queryClient.invalidateQueries({ queryKey: ['rbac-roles'] });
    } catch (err) {
      console.error('删除角色失败', err);
    }
  };

  const columns: ColumnsType<RbacRoleDTO> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '角色编码',
      dataIndex: 'roleCode',
      key: 'roleCode',
      render: (val: string) => <Tag color="blue">{val}</Tag>,
    },
    {
      title: '角色名称',
      dataIndex: 'roleName',
      key: 'roleName',
      render: (val: string) => <Text strong>{val}</Text>,
    },
    {
      title: '角色描述',
      dataIndex: 'roleDesc',
      key: 'roleDesc',
      ellipsis: true,
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
          {hasPermission('rbac:role-permission:grant') && (
            <Button
              type="link"
              size="small"
              onClick={() => {
                setAuthorizingRole(record);
                setPermissionModalOpen(true);
              }}
            >
              分配权限
            </Button>
          )}

          {hasPermission('rbac:role:update') && (
            <Button
              type="link"
              size="small"
              onClick={() => {
                setEditingRole(record);
                setFormModalOpen(true);
              }}
            >
              编辑
            </Button>
          )}

          {hasPermission('rbac:role:delete') && (
            <Popconfirm
              title="确定要删除该角色吗？此操作不可逆。"
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
            角色管理
          </Title>
          <Text type="secondary">管理系统角色及其关联的权限集合</Text>
        </div>

        {hasPermission('rbac:role:create') && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingRole(null);
              setFormModalOpen(true);
            }}
          >
            新增角色
          </Button>
        )}
      </div>

      {/* 搜索过滤表单 */}
      <Form
        form={form}
        layout="inline"
        style={{ marginBottom: 16, flexWrap: 'wrap', gap: '8px 0' }}
      >
        <Form.Item name="roleCode" label="角色编码">
          <Input placeholder="输入编码搜索" maxLength={64} allowClear />
        </Form.Item>

        <Form.Item name="roleName" label="角色名称">
          <Input placeholder="输入名称搜索" maxLength={128} allowClear />
        </Form.Item>

        <Form.Item name="status" label="状态">
          <Select
            placeholder="角色状态"
            allowClear
            style={{ width: 120 }}
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

      {/* 角色数据表格 */}
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

      {/* 新增/编辑角色弹窗 */}
      <RoleFormModal
        open={formModalOpen}
        role={editingRole}
        onClose={() => setFormModalOpen(false)}
        onSuccess={() => {
          setFormModalOpen(false);
          message.success(editingRole ? '角色已更新' : '角色创建成功');
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
          message.success('角色权限已更新');
          refetch();
        }}
      />
    </Card>
  );
};
