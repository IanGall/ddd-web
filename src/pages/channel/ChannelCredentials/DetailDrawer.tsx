import React, { useEffect, useState } from 'react';
import { Alert, Descriptions, Drawer, Spin, Tag, Typography } from 'antd';
import { channelApi, type ChannelCredentialDTO } from '@/api/channel';

const { Text } = Typography;

export interface DetailDrawerProps {
  open: boolean;
  credentialId: string | null;
  onClose: () => void;
}

export const DetailDrawer: React.FC<DetailDrawerProps> = ({ open, credentialId, onClose }) => {
  const [data, setData] = useState<ChannelCredentialDTO | null>(null);
  const [loading, setLoading] = useState(false);

  // 打开目标变化时，在渲染期重置派生状态（React 官方「prop 变化时调整 state」模式），
  // 避免在 effect 同步主体里 setState 造成级联渲染
  const openKey = open && credentialId ? String(credentialId) : null;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  if (openKey !== loadedKey) {
    setLoadedKey(openKey);
    setData(null);
    if (openKey !== null) {
      setLoading(true);
    }
  }

  useEffect(() => {
    if (!openKey || !credentialId) {
      return;
    }
    let active = true;
    channelApi
      .getById(credentialId)
      .then((res) => {
        if (active) {
          setData(res);
        }
      })
      .catch((err) => {
        console.error('获取渠道凭证详情失败', err);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [openKey, credentialId]);

  return (
    <Drawer title="渠道凭证详情" placement="right" size={560} open={open} onClose={onClose}>
      <Spin spinning={loading}>
        {data ? (
          <div className="flex flex-col gap-4">
            <Alert
              type="info"
              showIcon
              title="安全保护说明"
              description="根据平台安全架构规约，ChannelCredentialDTO 永不包含任何密钥材料。明文密钥仅在首次创建或轮换时返回一次。"
            />

            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="ID">{data.id}</Descriptions.Item>
              <Descriptions.Item label="渠道编码">
                <Text strong copyable>
                  {data.channelCode}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="渠道名称">{data.channelName}</Descriptions.Item>
              <Descriptions.Item label="密钥版本">
                <Tag color="cyan">v{data.secretVersion}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={data.status ? 'success' : 'error'}>
                  {data.status ? '启用中' : '已停用'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="上次轮换时间">
                {data.lastRotatedAt || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">{data.createTime || '-'}</Descriptions.Item>
              <Descriptions.Item label="更新时间">{data.updateTime || '-'}</Descriptions.Item>
            </Descriptions>
          </div>
        ) : (
          !loading && <Text type="secondary">暂无数据</Text>
        )}
      </Spin>
    </Drawer>
  );
};
