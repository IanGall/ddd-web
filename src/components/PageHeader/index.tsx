import React from 'react';
import { Typography } from 'antd';

const { Title, Text } = Typography;

export interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  extra?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, extra, className }) => {
  const rootClassName = className
    ? `mb-6 flex items-start justify-between gap-4 ${className}`
    : 'mb-6 flex items-start justify-between gap-4';

  return (
    <div className={rootClassName}>
      <div>
        <Title level={3} className="m-0">
          {title}
        </Title>
        {description ? <Text type="secondary">{description}</Text> : null}
      </div>
      {extra}
    </div>
  );
};

PageHeader.displayName = 'PageHeader';

export default PageHeader;
