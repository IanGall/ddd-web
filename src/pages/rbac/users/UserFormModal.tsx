import React, { useEffect, useState } from 'react';
import { Alert, Form, Input, Modal, Switch } from 'antd';
import { ApiError, ResponseCode } from '@/api/types';
import { rbacApi, type RbacUserDTO } from '@/api/rbac';

interface UserFormModalProps {
  open: boolean;
  user: RbacUserDTO | null; // null 表示新增，非 null 表示编辑
  onClose: () => void;
  onSuccess: () => void;
}

export const UserFormModal: React.FC<UserFormModalProps> = ({ open, user, onClose, onSuccess }) => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isEdit = Boolean(user);

  useEffect(() => {
    if (open) {
      setFormError(null);
      if (user) {
        form.setFieldsValue({
          username: user.username,
          password: '',
          displayName: user.displayName || '',
          email: user.email || '',
          mobile: user.mobile || '',
          status: user.status,
        });
      } else {
        form.resetFields();
        form.setFieldsValue({
          status: true,
        });
      }
    }
  }, [open, user, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      setFormError(null);

      if (isEdit && user) {
        // 编辑模式：密码为空则不传
        const updatePayload: {
          password?: string;
          displayName?: string;
          email?: string;
          mobile?: string;
          status?: boolean;
        } = {
          displayName: values.displayName ? values.displayName.trim() : undefined,
          email: values.email ? values.email.trim() : undefined,
          mobile: values.mobile ? values.mobile.trim() : undefined,
          status: values.status,
        };

        if (values.password && values.password.trim()) {
          updatePayload.password = values.password;
        }

        await rbacApi.updateUser(user.id, updatePayload);
      } else {
        // 新增模式
        await rbacApi.createUser({
          username: values.username.trim(),
          password: values.password,
          displayName: values.displayName ? values.displayName.trim() : undefined,
          email: values.email ? values.email.trim() : undefined,
          mobile: values.mobile ? values.mobile.trim() : undefined,
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

  return (
    <Modal
      title={isEdit ? `编辑用户 - ${user?.username}` : '新增用户'}
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
          label="用户名"
          name="username"
          rules={[
            { required: true, message: '请输入用户名' },
            { max: 64, message: '用户名最长 64 个字符' },
            {
              pattern: /^[A-Za-z0-9_.-]{1,64}$/,
              message: '用户名只能包含字母、数字、下划线、点号和短横线',
            },
          ]}
        >
          <Input placeholder="请输入用户名（1~64位）" disabled={isEdit} maxLength={64} />
        </Form.Item>

        <Form.Item
          label={isEdit ? '登录密码（留空表示不修改）' : '登录密码'}
          name="password"
          rules={[
            { required: !isEdit, message: '请输入登录密码' },
            {
              validator: (_, value) => {
                if (!value) {
                  if (isEdit) return Promise.resolve();
                  return Promise.reject(new Error('请输入登录密码'));
                }
                if (value.length < 8 || value.length > 72) {
                  return Promise.reject(new Error('密码长度须在 8~72 位之间'));
                }
                return Promise.resolve();
              },
            },
          ]}
        >
          <Input.Password
            placeholder={isEdit ? '留空表示不修改当前密码' : '请输入 8~72 位登录密码'}
            maxLength={72}
          />
        </Form.Item>

        <Form.Item
          label="显示名称"
          name="displayName"
          rules={[{ max: 128, message: '显示名称长度不能超过 128 个字符' }]}
        >
          <Input placeholder="请输入用户显示名称" maxLength={128} />
        </Form.Item>

        <Form.Item
          label="电子邮箱"
          name="email"
          rules={[
            { type: 'email', message: '请输入合法的邮箱格式' },
            { max: 128, message: '邮箱长度不能超过 128 个字符' },
          ]}
        >
          <Input placeholder="name@example.com" maxLength={128} />
        </Form.Item>

        <Form.Item
          label="手机号码"
          name="mobile"
          rules={[{ max: 32, message: '手机号长度不能超过 32 个字符' }]}
        >
          <Input placeholder="请输入手机号码" maxLength={32} />
        </Form.Item>

        <Form.Item label="账号状态" name="status" valuePropName="checked">
          <Switch checkedChildren="启用" unCheckedChildren="停用" />
        </Form.Item>
      </Form>
    </Modal>
  );
};
