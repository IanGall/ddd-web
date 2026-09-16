import React from 'react';

export const MenuGroupLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <span className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
      {children}
    </span>
  );
};
