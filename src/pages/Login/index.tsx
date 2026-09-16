import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup } from '@/components/ui/field';
import { AppAlert } from '@/components/AppAlert';
import { authApi } from '@/api/auth';
import { useAuthStore } from '@/store/auth';
import { ApiError } from '@/api/types';

const loginSchema = z.object({
  loginName: z.string().min(1, '请输入管理员账号'),
  password: z
    .string()
    .min(1, '请输入密码')
    .refine((val) => val.length === 0 || (val.length >= 8 && val.length <= 72), {
      message: '密码长度为 8~72 位',
    }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

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

  const { control, handleSubmit } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      loginName: '',
      password: '',
    },
  });

  const onFinish = async (values: LoginFormValues) => {
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
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-[400px]">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">管理端控制台</CardTitle>
          <CardDescription>领域驱动架构基础认证体系</CardDescription>
        </CardHeader>
        <CardContent>
          {errorMessage && (
            <AppAlert
              variant="error"
              description={errorMessage}
              closable
              onClose={() => setErrorMessage(null)}
              className="mb-5"
            />
          )}

          <form onSubmit={handleSubmit(onFinish)}>
            <FieldGroup>
              <Controller
                name="loginName"
                control={control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <Input
                      {...field}
                      id="loginName"
                      aria-invalid={fieldState.invalid}
                      placeholder="管理员账号 / 登录名"
                      autoComplete="username"
                    />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />

              <Controller
                name="password"
                control={control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <Input
                      {...field}
                      id="password"
                      type="password"
                      aria-invalid={fieldState.invalid}
                      placeholder="密码"
                      autoComplete="current-password"
                    />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="size-4 animate-spin" />}登 录
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
