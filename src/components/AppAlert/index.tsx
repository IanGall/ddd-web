import React from 'react';
import { Alert, AlertTitle, AlertDescription, AlertAction } from '@/components/ui/alert';
import { Info, TriangleAlert, CircleX, CircleCheck, X } from 'lucide-react';

export interface AppAlertProps {
  variant?: 'info' | 'warning' | 'error' | 'success'; // 默认 'info'
  title?: React.ReactNode;
  description?: React.ReactNode;
  closable?: boolean;
  onClose?: () => void;
  className?: string;
  children?: React.ReactNode;
}

const iconMap = {
  info: Info,
  warning: TriangleAlert,
  error: CircleX,
  success: CircleCheck,
};

export function AppAlert({
  variant = 'info',
  title,
  description,
  closable = false,
  onClose,
  className,
  children,
}: AppAlertProps) {
  const Icon = iconMap[variant];
  const alertVariant = variant === 'error' ? 'destructive' : 'default';

  return (
    <Alert variant={alertVariant} className={className}>
      <Icon className="size-4" />
      {title && <AlertTitle>{title}</AlertTitle>}
      {description && <AlertDescription>{description}</AlertDescription>}
      {children}
      {closable && (
        <AlertAction>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <X className="size-4" />
          </button>
        </AlertAction>
      )}
    </Alert>
  );
}
