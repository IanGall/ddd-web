import React from 'react';
import { cn } from 'cn';

export interface TextCellProps {
  value?: React.ReactNode | null;
  children?: React.ReactNode;
  className?: string;
}

export function TextCell({ value, children, className }: TextCellProps) {
  const content = value !== undefined ? value : children;
  if (content === null || content === undefined || content === '') {
    return <span className={cn('text-muted-foreground', className)}>-</span>;
  }
  return <span className={className}>{content}</span>;
}

export interface StrongCellProps {
  value?: React.ReactNode | null;
  children?: React.ReactNode;
  className?: string;
}

export function StrongCell({ value, children, className }: StrongCellProps) {
  const content = value !== undefined ? value : children;
  if (content === null || content === undefined || content === '') {
    return <span className={cn('font-medium text-muted-foreground', className)}>-</span>;
  }
  return <span className={cn('font-medium text-foreground', className)}>{content}</span>;
}

export interface TimeCellProps {
  value?: string | null;
  children?: string | null;
  className?: string;
}

export function TimeCell({ value, children, className }: TimeCellProps) {
  const raw = value !== undefined ? value : children;
  if (!raw) {
    return <span className={cn('text-muted-foreground', className)}>-</span>;
  }
  const formatted = typeof raw === 'string' ? raw.replace('T', ' ') : String(raw);
  return (
    <span className={cn('whitespace-nowrap text-muted-foreground', className)}>{formatted}</span>
  );
}

export interface ActionsCellProps {
  children?: React.ReactNode;
  className?: string;
}

export function ActionsCell({ children, className }: ActionsCellProps) {
  return <div className={cn('flex items-center justify-end gap-2', className)}>{children}</div>;
}
