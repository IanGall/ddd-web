import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ResultBlock } from '@/components/ResultBlock';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <ResultBlock
      status="404"
      title="404"
      subTitle="抱歉，您访问的页面不存在 (NOT_FOUND)"
      extra={<Button onClick={() => navigate('/dashboard')}>返回首页</Button>}
    />
  );
};
