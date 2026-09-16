import React, { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ApiError, ResponseCode } from '@/api/types';
import { rbacApi, type RbacRoleDTO } from '@/api/rbac';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { LoadingButton } from '@/components/LoadingButton';
import { AppAlert } from '@/components/AppAlert';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';

interface RoleFormModalProps {
  open: boolean;
  role: RbacRoleDTO | null; // null 表示新增，非 null 表示编辑
  onClose: () => void;
  onSuccess: () => void;
}

const roleSchema = z.object({
  roleCode: z.string().min(1, '请输入角色编码').max(64, '角色编码长度不能超过 64 个字符'),
  roleName: z.string().min(1, '请输入角色名称').max(128, '角色名称长度不能超过 128 个字符'),
  roleDesc: z.string().max(255, '角色描述长度不能超过 255 个字符').optional(),
  status: z.boolean(),
});

type RoleFormValues = z.infer<typeof roleSchema>;

export const RoleFormModal: React.FC<RoleFormModalProps> = ({ open, role, onClose, onSuccess }) => {
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isEdit = Boolean(role);

  // 打开目标变化时，在渲染期重置派生状态（React 官方「prop 变化时调整 state」模式），
  // 避免在 effect 同步主体里 setState 造成级联渲染
  const openKey = open ? (role ? String(role.id) : 'new') : null;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  if (openKey !== loadedKey) {
    setLoadedKey(openKey);
    if (openKey !== null) {
      setFormError(null);
    }
  }

  const { control, handleSubmit, reset } = useForm<RoleFormValues>({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      roleCode: '',
      roleName: '',
      roleDesc: '',
      status: true,
    },
  });

  useEffect(() => {
    if (!openKey) return;
    if (role) {
      reset({
        roleCode: role.roleCode,
        roleName: role.roleName,
        roleDesc: role.roleDesc || '',
        status: role.status,
      });
    } else {
      reset({
        roleCode: '',
        roleName: '',
        roleDesc: '',
        status: true,
      });
    }
  }, [openKey, role, reset]);

  const onValid = async (values: RoleFormValues) => {
    try {
      setSubmitting(true);
      setFormError(null);

      const payload = {
        roleCode: values.roleCode.trim(),
        roleName: values.roleName.trim(),
        roleDesc: values.roleDesc ? values.roleDesc.trim() : undefined,
        status: values.status,
      };

      if (isEdit && role) {
        await rbacApi.updateRole(role.id, payload);
      } else {
        await rbacApi.createRole(payload);
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
          <DialogTitle>{isEdit ? `编辑角色 - ${role?.roleName}` : '新增角色'}</DialogTitle>
        </DialogHeader>

        {formError && (
          <AppAlert
            variant="error"
            title={formError}
            closable
            onClose={() => setFormError(null)}
            className="mb-4"
          />
        )}

        <form key={openKey ?? 'closed'} onSubmit={handleSubmit(onValid)}>
          <FieldGroup>
            <Controller
              name="roleCode"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="roleCode">角色编码</FieldLabel>
                  <Input
                    {...field}
                    id="roleCode"
                    aria-invalid={fieldState.invalid}
                    placeholder="如 admin, role_operator"
                    maxLength={64}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            <Controller
              name="roleName"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="roleName">角色名称</FieldLabel>
                  <Input
                    {...field}
                    id="roleName"
                    aria-invalid={fieldState.invalid}
                    placeholder="如 业务管理员, 审计专员"
                    maxLength={128}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            <Controller
              name="roleDesc"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="roleDesc">角色描述</FieldLabel>
                  <Textarea
                    {...field}
                    id="roleDesc"
                    aria-invalid={fieldState.invalid}
                    placeholder="简要描述该角色的职能与权限范围"
                    maxLength={255}
                    rows={3}
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
                  <FieldLabel htmlFor="status">角色状态</FieldLabel>
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
