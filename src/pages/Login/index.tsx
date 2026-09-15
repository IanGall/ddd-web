import React, { useState } from 'react';
import { Button, Card, Form, Input, Typography, Alert } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { authApi } from '@/api/auth';
import { useAuthStore } from '@/store/auth';
import { ApiError } from '@/api/types';

const { Title, Text } = Typography;

export const LoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const setToken = useAuthStore((state) => state.setToken);
  const setPermissionCodes = useAuthStore((state) => state.setPermissionCodes);
  const deviceId = useAuthStore((state) => state.deviceId);

  const fromPath =
    (location.state as { from?: { pathname?: string } })?.from?.pathname || '/dashboard';

  const onFinish = async (values: { loginName: string; password: string }) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      // 1. 调用登录接口，固定 clientType 为 admin-web，透传内存中的 deviceId
      const tokenResp = await authApi.login({
        loginName: values.loginName.trim(),
        password: values.password,
        clientType: 'admin-web',
        deviceId,
      });

      // 2. 登录态写入 Zustand 内存
      setToken(tokenResp);

      // 3. 引导拉取当前主体有效权限码（契约 #37）
      try {
        const perms = await authApi.getPermissions();
        setPermissionCodes(perms);
      } catch (permError) {
        console.warn('获取主体初始权限码失败', permError);
      }

      // 4. 跳转至目标页面
      navigate(fromPath, { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.info || '登录失败，请检查用户名或密码');
      } else {
        setErrorMessage('网络连接异常，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: '#f0f2f5',
      }}
    >
      <Card
        style={{
          width: 400,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
          borderRadius: 8,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={3} style={{ marginBottom: 8 }}>
            管理端控制台
          </Title>
          <Text type="secondary">领域驱动架构基础认证体系</Text>
        </div>

        {errorMessage && (
          <Alert
            title={errorMessage}
            type="error"
            showIcon
            closable
            onClose={() => setErrorMessage(null)}
            style={{ marginBottom: 20 }}
          />
        )}

        <Form
          name="admin_login"
          initialValues={{ loginName: '', password: '' }}
          onFinish={onFinish}
          layout="vertical"
          size="large"
        >
          <Form.Item name="loginName" rules={[{ required: true, message: '请输入管理员账号' }]}>
            <Input
              prefix={<UserOutlined />}
              placeholder="管理员账号 / 登录名"
              autoComplete="username"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 8, max: 72, message: '密码长度为 8~72 位' },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
              autoComplete="current-password"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" block loading={loading}>
              登 录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};
