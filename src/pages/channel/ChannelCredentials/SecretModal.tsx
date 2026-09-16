import React, { useState } from 'react';
import { TriangleAlert, Copy } from 'lucide-react';
import type { ChannelCredentialSecretDTO } from '@/api/channel';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { AppAlert } from '@/components/AppAlert';
import { CopyButton } from '@/components/CopyButton';
import { notifySuccess, notifyError } from '@/lib/toast';

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

  const copyText = async (text: string, successMessage: string) => {
    try {
      let succeeded = false;
      if (navigator?.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(text);
          succeeded = true;
        } catch {
          // writeText failed, fall through to execCommand
        }
      }
      if (!succeeded) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const res = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (!res) {
          throw new Error('execCommand failed');
        }
      }
      notifySuccess(successMessage);
    } catch {
      notifyError('复制失败，请手动选中文本复制');
    }
  };

  const handleCopySecret = () => {
    copyText(data.channelSecret, '渠道密钥已成功复制到剪贴板');
  };

  const handleCopyAll = () => {
    const fullText = `渠道编码: ${data.channelCode}\n密钥版本: v${data.secretVersion}\n渠道密钥: ${data.channelSecret}`;
    copyText(fullText, '完整渠道凭证信息已复制到剪贴板');
  };

  const handleConfirmClose = () => {
    if (!confirmedSaved) {
      return;
    }
    setConfirmedSaved(false);
    onClose();
  };

  return (
    <Dialog
      open={open}
      disablePointerDismissal={true}
      onOpenChange={(nextOpen, eventDetails) => {
        if (!nextOpen) {
          if (eventDetails?.reason === 'escape-key' || eventDetails?.reason === 'outside-press') {
            eventDetails?.cancel?.();
            return;
          }
        }
      }}
    >
      <DialogContent showCloseButton={false} className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TriangleAlert className="size-4 text-muted-foreground" />
            <span>渠道密钥凭据（仅展示一次）</span>
          </DialogTitle>
        </DialogHeader>

        <AppAlert
          variant="warning"
          className="mb-1"
          title="安全须知：密钥材料关闭后无法再次获取"
          description="渠道密钥（channelSecret）在生成后仅通过当前窗口返回一次，服务端永不返回明文，亦不会持久化保存在任何前端缓存中。关闭本弹窗后将无法再次查看，若丢失只能重新轮换密钥。请立即复制并妥善保存在安全的密钥管理系统中！"
        />

        <dl className="divide-y divide-border rounded-lg border border-border text-sm">
          <div className="grid grid-cols-[140px_1fr]">
            <dt className="border-r border-border bg-muted/50 px-3 py-2.5 font-medium text-muted-foreground">
              渠道编码
            </dt>
            <dd className="flex items-center gap-2 px-3 py-2.5 font-semibold text-foreground">
              <span>{data.channelCode}</span>
              <CopyButton value={data.channelCode} />
            </dd>
          </div>
          <div className="grid grid-cols-[140px_1fr]">
            <dt className="border-r border-border bg-muted/50 px-3 py-2.5 font-medium text-muted-foreground">
              密钥版本
            </dt>
            <dd className="px-3 py-2.5 text-foreground">
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                v{data.secretVersion}
              </code>
            </dd>
          </div>
          <div className="grid grid-cols-[140px_1fr]">
            <dt className="border-r border-border bg-muted/50 px-3 py-2.5 font-medium text-muted-foreground">
              渠道密钥 (channelSecret)
            </dt>
            <dd className="flex flex-col gap-2 px-3 py-2.5 text-foreground">
              <div className="rounded border border-border bg-muted/40 p-2.5 font-mono text-xs break-all select-all">
                {data.channelSecret}
              </div>
              <div>
                <Button type="button" variant="outline" size="sm" onClick={handleCopySecret}>
                  <Copy className="mr-1.5 size-3.5" />
                  单独复制密钥
                </Button>
              </div>
            </dd>
          </div>
        </dl>

        <div className="mt-2 rounded-md border border-border bg-muted/40 px-4 py-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="confirm-saved-checkbox"
              aria-labelledby=""
              checked={confirmedSaved}
              onCheckedChange={(checked) => setConfirmedSaved(Boolean(checked))}
            />
            <Label
              htmlFor="confirm-saved-checkbox"
              className="cursor-pointer text-sm leading-normal font-medium"
            >
              我已复制并妥善保存该渠道密钥，知晓关闭后无法再次查看
            </Label>
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button type="button" variant="outline" onClick={handleCopyAll}>
            <Copy className="mr-1.5 size-3.5" />
            复制全部凭据
          </Button>
          <Button type="submit" disabled={!confirmedSaved} onClick={handleConfirmClose}>
            我已保存，关闭窗口
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
