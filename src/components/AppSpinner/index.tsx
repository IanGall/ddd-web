import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from 'cn';

export interface AppSpinnerProps {
  description?: React.ReactNode;
  className?: string;
}

export function AppSpinner({ description, className }: AppSpinnerProps) {
  return (
    <div
      role="status"
      className={cn('flex flex-col items-center justify-center gap-2 p-4', className)}
    >
      <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      <span className="sr-only">加载中...</span>
    </div>
  );
}
