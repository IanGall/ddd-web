import React, { useEffect, useState } from 'react';
import { channelApi, type ChannelCredentialDTO } from '@/api/channel';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AppAlert } from '@/components/AppAlert';
import { AppSpinner } from '@/components/AppSpinner';
import { CopyButton } from '@/components/CopyButton';
import { StatusBadge } from '@/components/StatusBadge';

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
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="w-[560px] overflow-y-auto p-6 sm:max-w-[560px] data-[side=right]:sm:max-w-[560px]"
      >
        <SheetHeader>
          <SheetTitle>渠道凭证详情</SheetTitle>
        </SheetHeader>

        {loading ? (
          <AppSpinner description="加载渠道凭证详情中..." className="py-12" />
        ) : data ? (
          <div className="flex flex-col gap-4">
            <AppAlert
              variant="info"
              title="安全保护说明"
              description="根据平台安全架构规约，ChannelCredentialDTO 永不包含任何密钥材料。明文密钥仅在首次创建或轮换时返回一次。"
            />

            <dl className="divide-y divide-border rounded-lg border border-border text-sm">
              <div className="grid grid-cols-[120px_1fr]">
                <dt className="border-r border-border bg-muted/50 px-3 py-2.5 font-medium text-muted-foreground">
                  ID
                </dt>
                <dd className="px-3 py-2.5 text-foreground">{data.id}</dd>
              </div>
              <div className="grid grid-cols-[120px_1fr]">
                <dt className="border-r border-border bg-muted/50 px-3 py-2.5 font-medium text-muted-foreground">
                  渠道编码
                </dt>
                <dd className="flex items-center gap-2 px-3 py-2.5 font-semibold text-foreground">
                  <span>{data.channelCode}</span>
                  <CopyButton value={data.channelCode} />
                </dd>
              </div>
              <div className="grid grid-cols-[120px_1fr]">
                <dt className="border-r border-border bg-muted/50 px-3 py-2.5 font-medium text-muted-foreground">
                  渠道名称
                </dt>
                <dd className="px-3 py-2.5 text-foreground">{data.channelName}</dd>
              </div>
              <div className="grid grid-cols-[120px_1fr]">
                <dt className="border-r border-border bg-muted/50 px-3 py-2.5 font-medium text-muted-foreground">
                  密钥版本
                </dt>
                <dd className="px-3 py-2.5 text-foreground">
                  <StatusBadge variant="cyan">v{data.secretVersion}</StatusBadge>
                </dd>
              </div>
              <div className="grid grid-cols-[120px_1fr]">
                <dt className="border-r border-border bg-muted/50 px-3 py-2.5 font-medium text-muted-foreground">
                  状态
                </dt>
                <dd className="px-3 py-2.5 text-foreground">
                  <StatusBadge variant={data.status ? 'success' : 'destructive'}>
                    {data.status ? '启用中' : '已停用'}
                  </StatusBadge>
                </dd>
              </div>
              <div className="grid grid-cols-[120px_1fr]">
                <dt className="border-r border-border bg-muted/50 px-3 py-2.5 font-medium text-muted-foreground">
                  上次轮换时间
                </dt>
                <dd className="px-3 py-2.5 text-foreground">{data.lastRotatedAt || '-'}</dd>
              </div>
              <div className="grid grid-cols-[120px_1fr]">
                <dt className="border-r border-border bg-muted/50 px-3 py-2.5 font-medium text-muted-foreground">
                  创建时间
                </dt>
                <dd className="px-3 py-2.5 text-foreground">{data.createTime || '-'}</dd>
              </div>
              <div className="grid grid-cols-[120px_1fr]">
                <dt className="border-r border-border bg-muted/50 px-3 py-2.5 font-medium text-muted-foreground">
                  更新时间
                </dt>
                <dd className="px-3 py-2.5 text-foreground">{data.updateTime || '-'}</dd>
              </div>
            </dl>
          </div>
        ) : (
          !loading && <p className="text-sm text-muted-foreground">暂无数据</p>
        )}
      </SheetContent>
    </Sheet>
  );
};
