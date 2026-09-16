import React from 'react';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { LoadingButton } from '@/components/LoadingButton';
import { cn } from 'cn';

export interface ConfirmPopoverProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  onConfirm: () => void | Promise<void>;
  okText?: string; // 默认「确定」
  cancelText?: string; // 默认「取消」
  danger?: boolean; // 确定按钮 destructive，标题 text-destructive
  okButtonProps?: { disabled?: boolean; loading?: boolean };
  disabled?: boolean; // 触发器 disabled 且不打开
  align?: 'start' | 'end' | 'center'; // 默认 'end'
  children: React.ReactNode; // 触发器，经 render 组合
}

export function ConfirmPopover({
  title,
  description,
  onConfirm,
  okText = '确定',
  cancelText = '取消',
  danger = false,
  okButtonProps,
  disabled = false,
  align = 'end',
  children,
}: ConfirmPopoverProps) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const isOkLoading = loading || Boolean(okButtonProps?.loading);
  const isOkDisabled = Boolean(okButtonProps?.disabled) || isOkLoading;

  React.useEffect(() => {
    if (disabled && open) {
      setOpen(false);
    }
  }, [disabled, open]);

  const handleOpenChange = (nextOpen: boolean, eventDetails?: { cancel?: () => void }) => {
    if (disabled) {
      setOpen(false);
      return;
    }
    if (!nextOpen && isOkLoading) {
      eventDetails?.cancel?.();
      return;
    }
    setOpen(nextOpen);
  };

  const handleCancel = () => {
    if (isOkLoading) return;
    setOpen(false);
  };

  const handleOk = async () => {
    if (isOkDisabled) {
      return;
    }
    try {
      const result = onConfirm();
      if (result && typeof (result as Promise<void>).then === 'function') {
        setLoading(true);
        await result;
        setOpen(false);
      } else {
        setOpen(false);
      }
    } catch {
      // reject 时保持打开（调用方自行 toast）
    } finally {
      setLoading(false);
    }
  };

  const triggerChild = React.isValidElement(children) ? children : <span>{children}</span>;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger disabled={disabled} render={triggerChild} />
      <PopoverContent
        align={align}
        className="w-[280px] p-3 text-sm"
        onKeyDown={(e) => {
          if (isOkLoading && e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
      >
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <PopoverTitle
              className={cn(
                'text-sm leading-normal font-medium text-foreground',
                danger && 'text-destructive',
              )}
            >
              {title}
            </PopoverTitle>
            {description && (
              <PopoverDescription className="text-xs text-muted-foreground">
                {description}
              </PopoverDescription>
            )}
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isOkLoading}
              onClick={handleCancel}
            >
              {cancelText}
            </Button>
            <LoadingButton
              type="button"
              size="sm"
              variant={danger ? 'destructive' : 'default'}
              loading={isOkLoading}
              disabled={Boolean(okButtonProps?.disabled)}
              onClick={handleOk}
            >
              {okText}
            </LoadingButton>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
