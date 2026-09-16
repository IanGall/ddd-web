import React from 'react';
import { ShieldAlert, FileQuestion, CircleAlert, CircleCheck } from 'lucide-react';
import { cn } from 'cn';

export interface ResultBlockProps {
  status?: '403' | '404' | 'error' | 'success';
  title: React.ReactNode;
  subTitle?: React.ReactNode;
  extra?: React.ReactNode;
  className?: string;
}

const statusIconMap = {
  '403': <ShieldAlert className="size-16 text-muted-foreground" aria-hidden="true" />,
  '404': <FileQuestion className="size-16 text-muted-foreground" aria-hidden="true" />,
  error: <CircleAlert className="size-16 text-destructive" aria-hidden="true" />,
  success: <CircleCheck className="size-16 text-primary" aria-hidden="true" />,
};

export function ResultBlock({
  status = '403',
  title,
  subTitle,
  extra,
  className,
}: ResultBlockProps) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center px-4 py-12 text-center', className)}
    >
      <div className="mb-4">{statusIconMap[status]}</div>
      <h3 className="text-xl font-semibold tracking-tight text-foreground">{title}</h3>
      {subTitle && <p className="mt-2 max-w-md text-sm text-muted-foreground">{subTitle}</p>}
      {extra && <div className="mt-6 flex items-center justify-center gap-2">{extra}</div>}
    </div>
  );
}
