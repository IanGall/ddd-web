import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { notifySuccess, notifyError } from '@/lib/toast';
import { cn } from 'cn';

export interface CopyButtonProps {
  value: string;
  successMessage?: string;
  className?: string;
}

export function CopyButton({
  value,
  successMessage = '已成功复制到剪贴板',
  className,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      let succeeded = false;
      if (navigator?.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(value);
          succeeded = true;
        } catch {
          // writeText failed, fall through to execCommand fallback
        }
      }

      if (!succeeded) {
        const textarea = document.createElement('textarea');
        textarea.value = value;
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
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      notifyError('复制失败，请手动选中文本复制');
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      onClick={handleCopy}
      aria-label="复制"
      className={cn('text-muted-foreground hover:text-foreground', className)}
    >
      {copied ? <Check className="size-3 text-primary" /> : <Copy className="size-3" />}
    </Button>
  );
}
