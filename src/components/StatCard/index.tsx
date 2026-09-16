import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DATA_PALETTE, hexToRgba, type DataAccent } from '@/lib/palette';
import { cn } from 'cn';

export interface StatCardProps {
  title: string;
  value: string | number;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  accent?: DataAccent;
  dimmed?: boolean;
  tip?: string;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  hint,
  icon,
  accent,
  dimmed,
  tip,
  className,
}) => {
  const badgeStyle: React.CSSProperties | undefined =
    accent && DATA_PALETTE[accent]
      ? {
          backgroundColor: hexToRgba(DATA_PALETTE[accent], 0.12),
          color: DATA_PALETTE[accent],
        }
      : undefined;

  const card = (
    <Card size="sm" className={className}>
      <CardContent className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-muted-foreground">{title}</span>
          {icon ? (
            <div
              className={cn(
                'flex size-9 items-center justify-center rounded-full',
                !badgeStyle && 'bg-muted text-muted-foreground',
              )}
              style={badgeStyle}
            >
              {icon}
            </div>
          ) : null}
        </div>
        <div
          className={cn(
            'text-2xl font-bold tracking-tight',
            dimmed ? 'text-muted-foreground' : 'text-foreground',
          )}
        >
          {value}
        </div>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );

  if (tip) {
    return (
      <Tooltip>
        <TooltipTrigger render={card} />
        <TooltipContent>{tip}</TooltipContent>
      </Tooltip>
    );
  }

  return card;
};

StatCard.displayName = 'StatCard';

export default StatCard;
