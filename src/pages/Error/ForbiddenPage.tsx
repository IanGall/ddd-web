import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ResultBlock } from '@/components/ResultBlock';

export const ForbiddenPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <ResultBlock
      status="403"
      title="403"
      subTitle="抱歉，您没有权限访问此页面 (ACCESS_DENIED)"
      extra={<Button onClick={() => navigate('/dashboard')}>返回首页</Button>}
    />
  );
};
