import React, { useEffect, useState } from 'react';
import {
  Alert,
  AutoComplete,
  Button,
  Divider,
  Form,
  message,
  Modal,
  Select,
  Space,
  Spin,
  Typography,
} from 'antd';
import { channelApi, type ChannelCredentialDTO } from '@/api/channel';
import { usePermission } from '@/hooks/usePermission';
import { ApiError, ResponseCode } from '@/api/types';

const { Text } = Typography;

export interface DataScopeModalProps {
  open: boolean;
  credential: ChannelCredentialDTO | null;
  onClose: () => void;
}

const COMMON_SCOPE_TYPES = [
  { value: 'api', label: 'api (接口路径)' },
  { value: 'merchant', label: 'merchant (商户标识)' },
  { value: 'dept', label: 'dept (部门组织)' },
  { value: 'region', label: 'region (地域分区)' },
];

export const DataScopeModal: React.FC<DataScopeModalProps> = ({ open, credential, onClose }) => {
  const { hasPermission } = usePermission();
  const canUpdate = hasPermission('rbac:channel-credential:update');

  const [scopeType, setScopeType] = useState('api');
  const [scopeValues, setScopeValues] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadDataScopes = React.useCallback(
    async (typeToLoad: string) => {
      if (!credential || !typeToLoad.trim()) return;
      setLoading(true);
      setErrorMessage(null);
      try {
        const list = await channelApi.getDataScopes(credential.id, typeToLoad.trim());
        const values = list.map((item) => item.scopeValue);
        setScopeValues(values);
      } catch (err) {
        console.error('获取数据范围失败', err);
        if (err instanceof ApiError && err.code === ResponseCode.INVALID_ARGUMENT) {
          setErrorMessage(err.info || '参数错误');
        }
      } finally {
        setLoading(false);
      }
    },
    [credential],
  );

  useEffect(() => {
    if (open && credential) {
      setScopeType('api');
      setScopeValues([]);
      setErrorMessage(null);
      loadDataScopes('api');
    }
  }, [open, credential, loadDataScopes]);

  const handleSave = async () => {
    if (!credential) return;
    if (!scopeType.trim()) {
      setErrorMessage('请输入或选择数据范围类型 (scopeType)');
      return;
    }

    if (scopeValues.length > 1000) {
      setErrorMessage('数据范围项数不得超过 1000 项');
      return;
    }

    const hasEmpty = scopeValues.some((v) => !v || !v.trim());
    if (hasEmpty) {
      setErrorMessage('数据范围项中不得包含空字符串');
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    try {
      const cleanValues = scopeValues.map((v) => v.trim());
      await channelApi.replaceDataScopes(credential.id, scopeType.trim(), {
        scopeValues: cleanValues,
      });
      message.success(`数据范围 [${scopeType}] 替换保存成功`);
    } catch (err) {
      if (err instanceof ApiError && err.code === ResponseCode.INVALID_ARGUMENT) {
        setErrorMessage(err.info || '参数不合法，保存失败');
        return;
      }
      console.error('保存数据范围失败', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={
        <span>
          配置数据范围 — {credential?.channelName} ({credential?.channelCode})
        </span>
      }
      open={open}
      onCancel={onClose}
      width={640}
      footer={[
        <Button key="close" onClick={onClose}>
          关闭
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={saving}
          disabled={!canUpdate}
          onClick={handleSave}
          title={!canUpdate ? '暂无修改权限 (需 rbac:channel-credential:update)' : undefined}
        >
          保存此类型数据范围
        </Button>,
      ]}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 12 }}>
        <Alert
          type="info"
          showIcon
          message="数据范围说明"
          description="按 scopeType 全量替换指定类型下的授权范围值；每项须为非空字符串，上限 1000 项。输入值后按回车即可添加标签。"
        />

        {errorMessage && (
          <Alert
            type="error"
            showIcon
            message={errorMessage}
            onClose={() => setErrorMessage(null)}
          />
        )}

        <Form layout="vertical">
          <Form.Item
            label="数据范围类型 (scopeType)"
            extra="可直接选择常用预设或手动输入自定义范围类型"
          >
            <Space.Compact style={{ width: '100%' }}>
              <AutoComplete
                style={{ width: '100%' }}
                value={scopeType}
                options={COMMON_SCOPE_TYPES}
                placeholder="例如：api、merchant、dept"
                onChange={(val) => setScopeType(val)}
              />
              <Button type="default" loading={loading} onClick={() => loadDataScopes(scopeType)}>
                切换/重新加载
              </Button>
            </Space.Compact>
          </Form.Item>

          <Divider style={{ margin: '12px 0' }} />

          <Form.Item
            label={
              <Space>
                <span>范围值列表 (scopeValues)</span>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  已选 {scopeValues.length} / 1000 项
                </Text>
              </Space>
            }
          >
            <Spin spinning={loading}>
              <Select
                mode="tags"
                style={{ width: '100%' }}
                placeholder="输入范围值并回车添加标签（如 /api/v1/order/** 或 MCH_001）"
                value={scopeValues}
                onChange={(vals) => {
                  setScopeValues(vals);
                  if (errorMessage) setErrorMessage(null);
                }}
                tokenSeparators={[',', ' ']}
                maxTagCount="responsive"
                disabled={!canUpdate}
              />
            </Spin>
          </Form.Item>
        </Form>
      </div>
    </Modal>
  );
};
