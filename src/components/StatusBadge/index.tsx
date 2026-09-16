import React from 'react';
import { cva } from 'class-variance-authority';
import { Badge } from '@/components/ui/badge';
import { cn } from 'cn';

export const statusBadgeVariants = cva('', {
  variants: {
    variant: {
      success: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400',
      destructive: 'bg-red-500/12 text-red-700 dark:text-red-400',
      info: 'bg-blue-500/12 text-blue-700 dark:text-blue-400',
      warning: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
      cyan: 'bg-cyan-500/12 text-cyan-700 dark:text-cyan-400',
      builtin: 'bg-purple-500/12 text-purple-700 dark:text-purple-400',
      processing: 'bg-sky-500/12 text-sky-700 dark:text-sky-400',
      'type-dir': 'bg-indigo-500/12 text-indigo-700 dark:text-indigo-400',
      'type-menu': 'bg-green-500/12 text-green-700 dark:text-green-400',
      'type-action': 'bg-orange-500/12 text-orange-700 dark:text-orange-400',
      current: 'bg-green-500/12 text-green-700 dark:text-green-400',
      muted: 'bg-muted text-muted-foreground',
    },
  },
  defaultVariants: {
    variant: 'muted',
  },
});

export type StatusBadgeVariant =
  | 'success'
  | 'destructive'
  | 'info'
  | 'warning'
  | 'cyan'
  | 'builtin'
  | 'processing'
  | 'type-dir'
  | 'type-menu'
  | 'type-action'
  | 'current'
  | 'muted';

export interface StatusBadgeProps {
  variant?: StatusBadgeVariant; // 默认 'muted'
  children: React.ReactNode;
  className?: string;
}

export function StatusBadge({ variant = 'muted', children, className }: StatusBadgeProps) {
  return (
    <Badge className={cn(statusBadgeVariants({ variant }), className)}>
      {variant === 'processing' && (
        <span
          data-slot="status-badge-dot"
          className="size-1.5 animate-pulse rounded-full bg-current"
          aria-hidden="true"
        />
      )}
      {children}
    </Badge>
  );
}
