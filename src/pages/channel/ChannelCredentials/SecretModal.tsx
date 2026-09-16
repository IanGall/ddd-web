import React, { useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Descriptions,
  message,
  Modal,
  Space,
  theme,
  Typography,
} from 'antd';
import { CopyOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import type { ChannelCredentialSecretDTO } from '@/api/channel';

const { Text, Paragraph } = Typography;

export interface SecretModalProps {
  open: boolean;
  data: ChannelCredentialSecretDTO | null;
  onClose: () => void;
}

/**
 * 渠道密钥凭据一次性展示弹窗
 * 硬性交互约束：
 * 1. 一次性展示 channelCode / channelSecret / secretVersion，并提供复制按钮；
 * 2. 要求用户显式勾选「我已保存」后方可关闭弹窗；
 * 3. 弹窗无法通过遮罩层、ESC 或右上角叉号意外关闭；
 * 4. 严禁将 channelSecret 存入任何持久化存储（localStorage / sessionStorage / 日志 / URL）。
 */
export const SecretModal: React.FC<SecretModalProps> = ({ open, data, onClose }) => {
  const { token } = theme.useToken();
  const [confirmedSaved, setConfirmedSaved] = useState(false);

  // 打开目标变化时，在渲染期重置保存确认状态（React 官方「prop 变化时调整 state」模式）
  const openKey = open && data ? `${data.channelCode}:${data.secretVersion}` : null;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  if (openKey !== loadedKey) {
    setLoadedKey(openKey);
    if (openKey !== null) {
      setConfirmedSaved(false);
    }
  }

  if (!data) {
    return null;
  }

  const handleCopySecret = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(data.channelSecret);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = data.channelSecret;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      message.success('渠道密钥已成功复制到剪贴板');
    } catch {
      message.error('复制失败，请手动选中文本复制');
    }
  };

  const handleCopyAll = async () => {
    const fullText = `渠道编码: ${data.channelCode}\n密钥版本: v${data.secretVersion}\n渠道密钥: ${data.channelSecret}`;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(fullText);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = fullText;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      message.success('完整渠道凭证信息已复制到剪贴板');
    } catch {
      message.error('复制失败，请手动选中文本复制');
    }
  };

  const handleConfirmClose = () => {
    if (!confirmedSaved) {
      return;
    }
    setConfirmedSaved(false);
    onClose();
  };

  return (
    <Modal
      title={
        <Space>
          <Text type="warning">
            <ExclamationCircleOutlined />
          </Text>
          <span>渠道密钥凭据（仅展示一次）</span>
        </Space>
      }
      open={open}
      closable={false}
      mask={{ closable: false }}
      keyboard={false}
      footer={[
        <Button key="copy-all" icon={<CopyOutlined />} onClick={handleCopyAll}>
          复制全部凭据
        </Button>,
        <Button
          key="confirm-close"
          type="primary"
          disabled={!confirmedSaved}
          onClick={handleConfirmClose}
        >
          我已保存，关闭窗口
        </Button>,
      ]}
      width={600}
    >
      <Alert
        type="warning"
        showIcon
        className="mb-5"
        title="安全须知：密钥材料关闭后无法再次获取"
        description="渠道密钥（channelSecret）在生成后仅通过当前窗口返回一次，服务端永不返回明文，亦不会持久化保存在任何前端缓存中。关闭本弹窗后将无法再次查看，若丢失只能重新轮换密钥。请立即复制并妥善保存在安全的密钥管理系统中！"
      />

      <Descriptions bordered column={1} size="small">
        <Descriptions.Item label="渠道编码">
          <Text strong copyable>
            {data.channelCode}
          </Text>
        </Descriptions.Item>
        <Descriptions.Item label="密钥版本">
          <Text code>v{data.secretVersion}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="渠道密钥 (channelSecret)">
          <div className="flex flex-col gap-2">
            <Paragraph
              code
              className="m-0 rounded border px-3 py-2 text-[13px] break-all select-all"
              style={{ borderColor: token.colorBorder, background: token.colorFillQuaternary }}
            >
              {data.channelSecret}
            </Paragraph>
            <div>
              <Button size="small" type="dashed" icon={<CopyOutlined />} onClick={handleCopySecret}>
                单独复制密钥
              </Button>
            </div>
          </div>
        </Descriptions.Item>
      </Descriptions>

      <div
        className="mt-5 rounded-md border px-4 py-3"
        style={{ borderColor: token.colorWarningBorder, background: token.colorWarningBg }}
      >
        <Checkbox
          checked={confirmedSaved}
          onChange={(e) => setConfirmedSaved(e.target.checked)}
          className="font-medium"
        >
          我已复制并妥善保存该渠道密钥，知晓关闭后无法再次查看
        </Checkbox>
      </div>
    </Modal>
  );
};
