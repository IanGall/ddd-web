import React, { useEffect, useState } from 'react';
import {
  Alert,
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

/**
 * 数据范围类型。服务端只接受这三个值（`ChannelCredentialCaseService.SCOPE_TYPES`），
 * 其余一律返回 400「数据范围类型仅支持 ACCOUNT、TENANT、STORE」。
 */
const COMMON_SCOPE_TYPES = [
  { value: 'ACCOUNT', label: 'ACCOUNT (账号)' },
  { value: 'TENANT', label: 'TENANT (租户)' },
  { value: 'STORE', label: 'STORE (门店)' },
];

const DEFAULT_SCOPE_TYPE = 'ACCOUNT';

export const DataScopeModal: React.FC<DataScopeModalProps> = ({ open, credential, onClose }) => {
  const { hasPermission } = usePermission();
  const canUpdate = hasPermission('rbac:channel-credential:update');

  const [scopeType, setScopeType] = useState(DEFAULT_SCOPE_TYPE);
  const [scopeValues, setScopeValues] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 打开目标变化时，在渲染期重置派生状态（React 官方「prop 变化时调整 state」模式），
  // 避免在 effect 同步主体里 setState 造成级联渲染
  const openKey = open && credential ? String(credential.id) : null;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  if (openKey !== loadedKey) {
    setLoadedKey(openKey);
    if (openKey !== null) {
      setScopeType(DEFAULT_SCOPE_TYPE);
      setScopeValues([]);
      setErrorMessage(null);
      setLoading(true);
    }
  }

  const loadDataScopes = async (typeToLoad: string) => {
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
  };

  useEffect(() => {
    if (!openKey || !credential) return;

    channelApi
      .getDataScopes(credential.id, DEFAULT_SCOPE_TYPE)
      .then((list) => {
        const values = list.map((item) => item.scopeValue);
        setScopeValues(values);
      })
      .catch((err) => {
        console.error('获取数据范围失败', err);
        if (err instanceof ApiError && err.code === ResponseCode.INVALID_ARGUMENT) {
          setErrorMessage(err.info || '参数错误');
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [openKey, credential]);

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
      <div className="mt-3 flex flex-col gap-4">
        <Alert
          type="info"
          showIcon
          title="数据范围说明"
          description="按 scopeType 全量替换指定类型下的授权范围值；每项须为非空字符串，上限 1000 项。输入值后按回车即可添加标签。"
        />

        {errorMessage && (
          <Alert type="error" showIcon title={errorMessage} onClose={() => setErrorMessage(null)} />
        )}

        <Form layout="vertical">
          <Form.Item
            label="数据范围类型 (scopeType)"
            extra="仅支持服务端认可的 ACCOUNT、TENANT、STORE 三种类型"
          >
            <Space.Compact className="w-full">
              <Select
                className="w-full"
                value={scopeType}
                options={COMMON_SCOPE_TYPES}
                onChange={(val) => setScopeType(val)}
              />
              <Button type="default" loading={loading} onClick={() => loadDataScopes(scopeType)}>
                切换/重新加载
              </Button>
            </Space.Compact>
          </Form.Item>

          <Divider className="my-3" />

          <Form.Item
            label={
              <Space>
                <span>范围值列表 (scopeValues)</span>
                <Text type="secondary" className="text-xs">
                  已选 {scopeValues.length} / 1000 项
                </Text>
              </Space>
            }
          >
            <Spin spinning={loading}>
              <Select
                mode="tags"
                className="w-full"
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
