import React from 'react';
import { theme } from 'antd';

export const MenuGroupLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = theme.useToken();

  return (
    <span
      className="text-[11px] font-medium tracking-wider uppercase"
      style={{ color: token.colorTextTertiary }}
    >
      {children}
    </span>
  );
};
