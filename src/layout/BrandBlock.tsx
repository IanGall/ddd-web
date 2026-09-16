import React from 'react';
import { Boxes } from 'lucide-react';

export const BrandBlock: React.FC = () => {
  return (
    <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-sidebar-primary text-sidebar-primary-foreground">
        <Boxes className="size-5" />
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="text-sm leading-tight font-bold text-sidebar-foreground">
          Admin Console
        </span>
        <span className="text-[10px] leading-tight tracking-widest text-muted-foreground uppercase">
          DDD PLATFORM
        </span>
      </div>
    </div>
  );
};
