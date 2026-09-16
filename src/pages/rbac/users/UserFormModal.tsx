import React, { useEffect, useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ApiError, ResponseCode } from '@/api/types';
import { rbacApi, type RbacUserDTO } from '@/api/rbac';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { LoadingButton } from '@/components/LoadingButton';
import { AppAlert } from '@/components/AppAlert';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';

interface UserFormModalProps {
  open: boolean;
  user: RbacUserDTO | null; // null 表示新增，非 null 表示编辑
  onClose: () => void;
  onSuccess: () => void;
}

const makeUserSchema = (isEdit: boolean) =>
  z.object({
    username: z
      .string()
      .min(1, '请输入用户名')
      .max(64, '用户名最长 64 个字符')
      .regex(/^[A-Za-z0-9_.-]{1,64}$/, '用户名只能包含字母、数字、下划线、点号和短横线'),
    password: z.string().superRefine((val, ctx) => {
      if (!val) {
        if (!isEdit) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: '请输入登录密码',
          });
        }
        return;
      }
      if (val.length < 8 || val.length > 72) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '密码长度须在 8~72 位之间',
        });
      }
    }),
    displayName: z.string().max(128, '显示名称长度不能超过 128 个字符').optional(),
    email: z
      .string()
      .max(128, '邮箱长度不能超过 128 个字符')
      .refine((val) => !val || z.string().email().safeParse(val).success, '请输入合法的邮箱格式')
      .optional(),
    mobile: z.string().max(32, '手机号长度不能超过 32 个字符').optional(),
    status: z.boolean(),
  });

type UserFormValues = z.infer<ReturnType<typeof makeUserSchema>>;

export const UserFormModal: React.FC<UserFormModalProps> = ({ open, user, onClose, onSuccess }) => {
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isEdit = Boolean(user);

  // 打开目标变化时，在渲染期重置派生状态（React 官方「prop 变化时调整 state」模式），
  // 避免在 effect 同步主体里 setState 造成级联渲染
  const openKey = open ? (user ? String(user.id) : 'new') : null;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  if (openKey !== loadedKey) {
    setLoadedKey(openKey);
    if (openKey !== null) {
      setFormError(null);
    }
  }

  const schema = useMemo(() => makeUserSchema(isEdit), [isEdit]);

  const { control, handleSubmit, reset } = useForm<UserFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      username: '',
      password: '',
      displayName: '',
      email: '',
      mobile: '',
      status: true,
    },
  });

  useEffect(() => {
    if (!openKey) return;
    if (user) {
      reset({
        username: user.username,
        password: '',
        displayName: user.displayName || '',
        email: user.email || '',
        mobile: user.mobile || '',
        status: user.status,
      });
    } else {
      reset({
        username: '',
        password: '',
        displayName: '',
        email: '',
        mobile: '',
        status: true,
      });
    }
  }, [openKey, user, reset]);

  const onValid = async (values: UserFormValues) => {
    try {
      setSubmitting(true);
      setFormError(null);

      if (isEdit && user) {
        // 编辑模式：密码为空则不传
        const updatePayload: {
          password?: string;
          displayName?: string;
          email?: string;
          mobile?: string;
          status?: boolean;
        } = {
          displayName: values.displayName ? values.displayName.trim() : undefined,
          email: values.email ? values.email.trim() : undefined,
          mobile: values.mobile ? values.mobile.trim() : undefined,
          status: values.status,
        };

        if (values.password && values.password.trim()) {
          updatePayload.password = values.password;
        }

        await rbacApi.updateUser(user.id, updatePayload);
      } else {
        // 新增模式
        await rbacApi.createUser({
          username: values.username.trim(),
          password: values.password,
          displayName: values.displayName ? values.displayName.trim() : undefined,
          email: values.email ? values.email.trim() : undefined,
          mobile: values.mobile ? values.mobile.trim() : undefined,
          status: values.status,
        });
      }

      onSuccess();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === ResponseCode.INVALID_ARGUMENT) {
          setFormError(err.info || '参数验证不通过，请检查输入');
          return;
        }
        setFormError(err.info || '操作失败');
      } else if (err instanceof Error) {
        setFormError(err.message || '操作失败');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? `编辑用户 - ${user?.username}` : '新增用户'}</DialogTitle>
        </DialogHeader>

        {formError && (
          <AppAlert variant="error" title={formError} closable onClose={() => setFormError(null)} />
        )}

        <form key={openKey ?? 'closed'} onSubmit={handleSubmit(onValid)}>
          <FieldGroup>
            <Controller
              name="username"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="username">用户名</FieldLabel>
                  <Input
                    {...field}
                    id="username"
                    aria-invalid={fieldState.invalid}
                    placeholder="请输入用户名（1~64位）"
                    disabled={isEdit}
                    maxLength={64}
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
                  <FieldLabel htmlFor="password">
                    {isEdit ? '登录密码（留空表示不修改）' : '登录密码'}
                  </FieldLabel>
                  <Input
                    {...field}
                    id="password"
                    type="password"
                    aria-invalid={fieldState.invalid}
                    placeholder={isEdit ? '留空表示不修改当前密码' : '请输入 8~72 位登录密码'}
                    maxLength={72}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            <Controller
              name="displayName"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="displayName">显示名称</FieldLabel>
                  <Input
                    {...field}
                    id="displayName"
                    aria-invalid={fieldState.invalid}
                    placeholder="请输入用户显示名称"
                    maxLength={128}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            <Controller
              name="email"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="email">电子邮箱</FieldLabel>
                  <Input
                    {...field}
                    id="email"
                    aria-invalid={fieldState.invalid}
                    placeholder="name@example.com"
                    maxLength={128}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            <Controller
              name="mobile"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="mobile">手机号码</FieldLabel>
                  <Input
                    {...field}
                    id="mobile"
                    aria-invalid={fieldState.invalid}
                    placeholder="请输入手机号码"
                    maxLength={32}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <Field orientation="horizontal" className="justify-between">
                  <FieldLabel htmlFor="status">账号状态</FieldLabel>
                  <div className="flex items-center gap-2">
                    <Switch id="status" checked={field.value} onCheckedChange={field.onChange} />
                    <span className="text-sm text-muted-foreground">
                      {field.value ? '启用' : '停用'}
                    </span>
                  </div>
                </Field>
              )}
            />
          </FieldGroup>

          <DialogFooter className="mt-6">
            <Button variant="outline" type="button" onClick={onClose} disabled={submitting}>
              取消
            </Button>
            <LoadingButton loading={submitting} type="submit">
              {isEdit ? '保存' : '创建'}
            </LoadingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
