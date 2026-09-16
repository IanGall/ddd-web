import React from 'react';
import { theme } from 'antd';
import { CodeSandboxOutlined } from '@ant-design/icons';

export const BrandBlock: React.FC = () => {
  const { token } = theme.useToken();

  return (
    <div
      className="flex h-16 items-center gap-3 border-b px-5"
      style={{ borderColor: token.colorSplit }}
    >
      <div
        className="flex size-9 shrink-0 items-center justify-center rounded-[10px]"
        style={{ backgroundColor: token.colorPrimary }}
      >
        <CodeSandboxOutlined style={{ color: token.colorTextLightSolid, fontSize: 18 }} />
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="text-sm leading-tight font-bold" style={{ color: token.colorText }}>
          Admin Console
        </span>
        <span
          className="text-[10px] leading-tight tracking-widest uppercase"
          style={{ color: token.colorTextTertiary }}
        >
          DDD PLATFORM
        </span>
      </div>
    </div>
  );
};
