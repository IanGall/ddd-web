import React, { useEffect, useState } from 'react';
import { Alert, Form, Input, Modal, Select, Switch } from 'antd';
import { ApiError, ResponseCode } from '@/api/types';
import { rbacApi, type RbacPermissionDTO } from '@/api/rbac';

interface PermissionFormModalProps {
  open: boolean;
  permission: RbacPermissionDTO | null; // null 表示新增，非 null 表示编辑
  allPermissions: RbacPermissionDTO[]; // 用于选择父级权限
  onClose: () => void;
  onSuccess: () => void;
}

export const PermissionFormModal: React.FC<PermissionFormModalProps> = ({
  open,
  permission,
  allPermissions,
  onClose,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isEdit = Boolean(permission);

  useEffect(() => {
    if (open) {
      setFormError(null);
      if (permission) {
        form.setFieldsValue({
          permCode: permission.permCode,
          permName: permission.permName,
          permType: permission.permType,
          parentId: permission.parentId ?? 0,
          path: permission.path || '',
          method: permission.method || undefined,
          status: permission.status,
        });
      } else {
        form.resetFields();
        form.setFieldsValue({
          permType: 2, // 缺省为 2=菜单
          parentId: 0, // 契约要求：根节点必须传 0，不是 null
          status: true,
        });
      }
    }
  }, [open, permission, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      setFormError(null);

      const parentIdValue =
        typeof values.parentId === 'number' && values.parentId >= 0 ? values.parentId : 0;

      if (isEdit && permission) {
        // 编辑权限：严禁发送 permCode 字段（契约规定 permCode 不可修改，编辑接口不接受）
        await rbacApi.updatePermission(permission.id, {
          permName: values.permName.trim(),
          permType: values.permType,
          parentId: parentIdValue,
          path: values.path ? values.path.trim() : undefined,
          method: values.method ? values.method : undefined,
          status: values.status,
        });
      } else {
        // 新增权限
        await rbacApi.createPermission({
          permCode: values.permCode.trim(),
          permName: values.permName.trim(),
          permType: values.permType,
          parentId: parentIdValue,
          path: values.path ? values.path.trim() : undefined,
          method: values.method ? values.method : undefined,
          status: values.status,
        });
      }

      onSuccess();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === ResponseCode.INVALID_ARGUMENT) {
          setFormError(err.info || '参数验证不通过，请检查输入');
          return;
        }
        setFormError(err.info || '操作失败');
      } else if (err instanceof Error && err.name !== 'ValidateError') {
        setFormError(err.message || '操作失败');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // 父级选项：排除当前正在编辑的节点自身，避免出现自循环
  const parentOptions = [
    { label: '根节点 (ID: 0)', value: 0 },
    ...allPermissions
      .filter((p) => !isEdit || p.id !== permission?.id)
      .map((p) => ({
        label: `${p.permName} (${p.permCode}) [ID: ${p.id}]`,
        value: p.id,
      })),
  ];

  return (
    <Modal
      title={isEdit ? `编辑权限项 - ${permission?.permName}` : '新增权限项'}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={submitting}
      destroyOnHidden
      okText={isEdit ? '保存' : '创建'}
      cancelText="取消"
      width={600}
    >
      {formError && (
        <Alert
          message={formError}
          type="error"
          showIcon
          closable
          onClose={() => setFormError(null)}
          style={{ marginBottom: 16 }}
        />
      )}

      <Form form={form} layout="vertical">
        <Form.Item
          label="权限编码 (permCode)"
          name="permCode"
          extra={
            isEdit
              ? '系统唯一标识，创建后不可修改'
              : "自定义权限码禁止以 'rbac:' 开头（'rbac:' 为系统保留前缀）"
          }
          rules={[
            { required: !isEdit, message: '请输入权限编码' },
            { max: 64, message: '权限编码长度不能超过 64 个字符' },
            {
              validator: (_, value) => {
                if (!isEdit && value) {
                  if (value.trim().startsWith('rbac:')) {
                    return Promise.reject(
                      new Error("自定义权限码不得以 'rbac:' 开头（系统保留前缀）"),
                    );
                  }
                }
                return Promise.resolve();
              },
            },
          ]}
        >
          <Input
            placeholder="如 business:order:read, report:export"
            disabled={isEdit}
            maxLength={64}
          />
        </Form.Item>

        <Form.Item
          label="权限名称"
          name="permName"
          rules={[
            { required: true, message: '请输入权限名称' },
            { max: 128, message: '权限名称长度不能超过 128 个字符' },
          ]}
        >
          <Input placeholder="如 订单查看, 报表导出" maxLength={128} />
        </Form.Item>

        <Form.Item
          label="权限类型"
          name="permType"
          rules={[{ required: true, message: '请选择权限类型' }]}
        >
          <Select
            placeholder="选择权限类型"
            options={[
              { label: '目录 (Directory) - 1', value: 1 },
              { label: '菜单 (Menu) - 2', value: 2 },
              { label: '按钮 (Button) - 3', value: 3 },
            ]}
          />
        </Form.Item>

        <Form.Item
          label="父级节点 (parentId)"
          name="parentId"
          extra="根节点传 0，不能为负数"
          rules={[
            { required: true, message: '请选择或输入父级节点' },
            {
              validator: (_, value) => {
                if (typeof value === 'number' && value < 0) {
                  return Promise.reject(new Error('父级节点 ID 不能为负数'));
                }
                return Promise.resolve();
              },
            },
          ]}
        >
          <Select
            showSearch
            placeholder="请选择父级节点（默认根节点 0）"
            options={parentOptions}
            filterOption={(input, option) =>
              (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
            }
          />
        </Form.Item>

        <Form.Item
          label="路由路径 / API 路径 (path)"
          name="path"
          rules={[{ max: 255, message: '路径长度不能超过 255 个字符' }]}
        >
          <Input placeholder="前端路由路径或后端接口路径，如 /orders" maxLength={255} />
        </Form.Item>

        <Form.Item label="HTTP 方法 (method)" name="method">
          <Select
            allowClear
            placeholder="接口请求方法"
            options={[
              { label: 'GET', value: 'GET' },
              { label: 'POST', value: 'POST' },
              { label: 'PUT', value: 'PUT' },
              { label: 'DELETE', value: 'DELETE' },
            ]}
          />
        </Form.Item>

        <Form.Item label="状态" name="status" valuePropName="checked">
          <Switch checkedChildren="启用" unCheckedChildren="停用" />
        </Form.Item>
      </Form>
    </Modal>
  );
};
