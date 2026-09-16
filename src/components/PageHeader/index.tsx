import React from 'react';
import { cn } from 'cn';

export interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  extra?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, extra, className }) => {
  return (
    <div className={cn('mb-6 flex items-start justify-between gap-4', className)}>
      <div>
        <h3 className="text-2xl font-bold tracking-tight">{title}</h3>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {extra}
    </div>
  );
};

PageHeader.displayName = 'PageHeader';

export default PageHeader;
