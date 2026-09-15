import React, { useEffect, useState } from 'react';
import { Form, Input, message, Modal } from 'antd';
import {
  channelApi,
  type ChannelCredentialDTO,
  type ChannelCredentialSecretDTO,
} from '@/api/channel';
import { ApiError, ResponseCode } from '@/api/types';

export interface CreateEditModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialData: ChannelCredentialDTO | null;
  onClose: () => void;
  onSuccess: (secretData?: ChannelCredentialSecretDTO) => void;
}

export const CreateEditModal: React.FC<CreateEditModalProps> = ({
  open,
  mode,
  initialData,
  onClose,
  onSuccess,
}) => {
  const [form] = Form.useForm<{ channelName: string }>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      if (mode === 'edit' && initialData) {
        form.setFieldsValue({
          channelName: initialData.channelName,
        });
      } else {
        form.resetFields();
      }
    }
  }, [open, mode, initialData, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const channelName = values.channelName.trim();
      setSubmitting(true);

      if (mode === 'create') {
        const secretDto = await channelApi.create({ channelName });
        message.success('创建渠道凭证成功');
        onSuccess(secretDto);
      } else if (mode === 'edit' && initialData) {
        await channelApi.update(initialData.id, { channelName });
        message.success('修改渠道凭证成功');
        onSuccess();
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === ResponseCode.INVALID_ARGUMENT) {
        // INVALID_ARGUMENT (400) 走表单就地报错展示，不触发全局 Toast
        form.setFields([
          {
            name: 'channelName',
            errors: [err.info || '渠道名称不合法'],
          },
        ]);
        return;
      }
      // 验证未通过或其它异常由客户端统一规则/form 处理
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={mode === 'create' ? '新建渠道凭证' : '编辑渠道凭证'}
      open={open}
      onOk={handleSubmit}
      onCancel={onClose}
      confirmLoading={submitting}
      destroyOnHidden
      width={520}
    >
      <Form form={form} layout="vertical" preserve={false} style={{ marginTop: 16 }}>
        {mode === 'edit' && initialData && (
          <Form.Item label="渠道编码">
            <Input value={initialData.channelCode} disabled />
          </Form.Item>
        )}

        <Form.Item
          name="channelName"
          label="渠道名称"
          rules={[
            { required: true, message: '请输入渠道名称' },
            { max: 128, message: '渠道名称长度不可超过 128 字符' },
            {
              validator: (_, value) => {
                if (value && !value.trim()) {
                  return Promise.reject(new Error('渠道名称不可为空白字符'));
                }
                return Promise.resolve();
              },
            },
          ]}
        >
          <Input placeholder="请输入渠道名称（≤128 字符）" maxLength={128} showCount allowClear />
        </Form.Item>
      </Form>
    </Modal>
  );
};
