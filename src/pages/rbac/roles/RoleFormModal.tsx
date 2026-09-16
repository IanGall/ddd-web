import React, { useEffect, useState } from 'react';
import { Alert, Form, Input, Modal, Switch } from 'antd';
import { ApiError, ResponseCode } from '@/api/types';
import { rbacApi, type RbacRoleDTO } from '@/api/rbac';

const { TextArea } = Input;

interface RoleFormModalProps {
  open: boolean;
  role: RbacRoleDTO | null; // null 表示新增，非 null 表示编辑
  onClose: () => void;
  onSuccess: () => void;
}

export const RoleFormModal: React.FC<RoleFormModalProps> = ({ open, role, onClose, onSuccess }) => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isEdit = Boolean(role);

  // 打开目标变化时，在渲染期重置派生状态（React 官方「prop 变化时调整 state」模式），
  // 避免在 effect 同步主体里 setState 造成级联渲染
  const openKey = open ? (role ? String(role.id) : 'new') : null;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  if (openKey !== loadedKey) {
    setLoadedKey(openKey);
    if (openKey !== null) {
      setFormError(null);
    }
  }

  useEffect(() => {
    if (!openKey) return;
    if (role) {
      form.setFieldsValue({
        roleCode: role.roleCode,
        roleName: role.roleName,
        roleDesc: role.roleDesc || '',
        status: role.status,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        status: true,
      });
    }
  }, [openKey, role, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      setFormError(null);

      const payload = {
        roleCode: values.roleCode.trim(),
        roleName: values.roleName.trim(),
        roleDesc: values.roleDesc ? values.roleDesc.trim() : undefined,
        status: values.status,
      };

      if (isEdit && role) {
        await rbacApi.updateRole(role.id, payload);
      } else {
        await rbacApi.createRole(payload);
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

  return (
    <Modal
      title={isEdit ? `编辑角色 - ${role?.roleName}` : '新增角色'}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={submitting}
      destroyOnHidden
      okText={isEdit ? '保存' : '创建'}
      cancelText="取消"
    >
      {formError && (
        <Alert
          title={formError}
          type="error"
          showIcon
          closable
          onClose={() => setFormError(null)}
          className="mb-4"
        />
      )}

      <Form form={form} layout="vertical">
        <Form.Item
          label="角色编码"
          name="roleCode"
          rules={[
            { required: true, message: '请输入角色编码' },
            { max: 64, message: '角色编码长度不能超过 64 个字符' },
          ]}
        >
          <Input placeholder="如 admin, role_operator" maxLength={64} />
        </Form.Item>

        <Form.Item
          label="角色名称"
          name="roleName"
          rules={[
            { required: true, message: '请输入角色名称' },
            { max: 128, message: '角色名称长度不能超过 128 个字符' },
          ]}
        >
          <Input placeholder="如 业务管理员, 审计专员" maxLength={128} />
        </Form.Item>

        <Form.Item
          label="角色描述"
          name="roleDesc"
          rules={[{ max: 255, message: '角色描述长度不能超过 255 个字符' }]}
        >
          <TextArea rows={3} placeholder="简要描述该角色的职能与权限范围" maxLength={255} />
        </Form.Item>

        <Form.Item label="角色状态" name="status" valuePropName="checked">
          <Switch checkedChildren="启用" unCheckedChildren="停用" />
        </Form.Item>
      </Form>
    </Modal>
  );
};
