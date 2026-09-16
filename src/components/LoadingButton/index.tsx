import React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

export interface LoadingButtonProps extends React.ComponentProps<typeof Button> {
  loading?: boolean;
}

export function LoadingButton({
  loading = false,
  disabled,
  children,
  ...props
}: LoadingButtonProps) {
  const renderContent = () => {
    if (!loading) {
      return children;
    }

    const childArray = React.Children.toArray(children);
    if (childArray.length === 0) {
      return <Loader2 className="size-4 animate-spin" aria-hidden="true" />;
    }

    const firstChild = childArray[0];
    const isFirstChildIcon =
      React.isValidElement(firstChild) &&
      (firstChild.type === 'svg' ||
        (typeof firstChild.type === 'object' &&
          '$$typeof' in (firstChild.type as object) &&
          !('children' in (firstChild.props as object))) ||
        (typeof firstChild.type === 'function' &&
          !(firstChild.props as Record<string, unknown>)?.children));

    if (isFirstChildIcon) {
      return (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          {childArray.slice(1)}
        </>
      );
    }

    return (
      <>
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        {children}
      </>
    );
  };

  return (
    <Button disabled={disabled || loading} {...props}>
      {renderContent()}
    </Button>
  );
}
