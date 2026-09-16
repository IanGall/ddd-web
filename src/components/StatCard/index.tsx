import React from 'react';
import { Card, Statistic, Tooltip, Typography, theme } from 'antd';
import { DATA_PALETTE, hexToRgba, type DataAccent } from '@/lib/palette';

const { Text } = Typography;

export interface StatCardProps {
  title: string;
  value: string | number;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  accent?: DataAccent;
  dimmed?: boolean;
  tip?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  hint,
  icon,
  accent,
  dimmed,
  tip,
}) => {
  const { token } = theme.useToken();

  const badgeStyle: React.CSSProperties =
    accent && DATA_PALETTE[accent]
      ? {
          backgroundColor: hexToRgba(DATA_PALETTE[accent], 0.12),
          color: DATA_PALETTE[accent],
        }
      : {
          backgroundColor: token.colorFillTertiary,
          color: token.colorTextTertiary,
        };

  const titleNode = (
    <div className="flex items-center justify-between gap-2">
      <span>{title}</span>
      {icon ? (
        <div className="flex size-9 items-center justify-center rounded-full" style={badgeStyle}>
          {icon}
        </div>
      ) : null}
    </div>
  );

  const content = (
    <div>
      <Statistic
        title={titleNode}
        value={value}
        styles={{ content: dimmed ? { color: token.colorTextTertiary } : undefined }}
      />
      {hint ? (
        <Text type="secondary" className="text-xs">
          {hint}
        </Text>
      ) : null}
    </div>
  );

  return <Card size="small">{tip ? <Tooltip title={tip}>{content}</Tooltip> : content}</Card>;
};

StatCard.displayName = 'StatCard';

export default StatCard;
