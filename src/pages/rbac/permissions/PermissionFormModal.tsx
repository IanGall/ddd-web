import React, { useEffect, useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ApiError, ResponseCode } from '@/api/types';
import { rbacApi, type RbacPermissionDTO } from '@/api/rbac';
import { ROOT_PARENT_ID } from './utils';
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
import { ClearableSelect } from '@/components/ClearableSelect';
import { LoadingButton } from '@/components/LoadingButton';
import { AppAlert } from '@/components/AppAlert';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';

interface PermissionFormModalProps {
  open: boolean;
  permission: RbacPermissionDTO | null; // null 表示新增，非 null 表示编辑
  allPermissions: RbacPermissionDTO[]; // 用于选择父级权限
  onClose: () => void;
  onSuccess: () => void;
}

interface ParentOption {
  label: string;
  value: string;
}

const makePermissionSchema = (isEdit: boolean) =>
  z.object({
    permCode: z
      .string()
      .min(1, '请输入权限编码')
      .max(64, '权限编码长度不能超过 64 个字符')
      .regex(/^[A-Za-z0-9_:.-]{1,64}$/, '权限编码格式不正确')
      .refine((val) => isEdit || !val.trim().startsWith('rbac:'), {
        message: "自定义权限码不得以 'rbac:' 开头（系统保留前缀）",
      }),
    permName: z.string().min(1, '请输入权限名称').max(128, '权限名称长度不能超过 128 个字符'),
    permType: z.number({ message: '请选择权限类型' }),
    parentId: z.string().min(1, '请选择上级权限'),
    path: z.string().max(255, '路径长度不能超过 255 个字符').optional(),
    method: z.string().optional(),
    status: z.boolean(),
  });

type PermissionFormValues = z.infer<ReturnType<typeof makePermissionSchema>>;

export const PermissionFormModal: React.FC<PermissionFormModalProps> = ({
  open,
  permission,
  allPermissions,
  onClose,
  onSuccess,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isEdit = Boolean(permission);

  // 打开目标变化时，在渲染期重置派生状态（React 官方「prop 变化时调整 state」模式），
  // 避免在 effect 同步主体里 setState 造成级联渲染
  const openKey = open ? (permission ? String(permission.id) : 'new') : null;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  if (openKey !== loadedKey) {
    setLoadedKey(openKey);
    if (openKey !== null) {
      setFormError(null);
    }
  }

  const schema = useMemo(() => makePermissionSchema(isEdit), [isEdit]);

  const { control, handleSubmit, reset } = useForm<PermissionFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      permCode: '',
      permName: '',
      permType: 2,
      parentId: ROOT_PARENT_ID,
      path: '',
      method: undefined,
      status: true,
    },
  });

  useEffect(() => {
    if (!openKey) return;
    if (permission) {
      reset({
        permCode: permission.permCode,
        permName: permission.permName,
        permType: permission.permType,
        parentId: permission.parentId ? String(permission.parentId) : ROOT_PARENT_ID,
        path: permission.path || '',
        method: permission.method || undefined,
        status: permission.status,
      });
    } else {
      reset({
        permCode: '',
        permName: '',
        permType: 2,
        parentId: ROOT_PARENT_ID,
        path: '',
        method: undefined,
        status: true,
      });
    }
  }, [openKey, permission, reset]);

  // 父级选项：排除当前正在编辑的节点自身，避免出现自循环
  const parentOptions: ParentOption[] = useMemo(
    () => [
      { label: '根节点 (ID: 0)', value: ROOT_PARENT_ID },
      ...allPermissions
        .filter((p) => !isEdit || p.id !== permission?.id)
        .map((p) => ({
          label: `${p.permName} (${p.permCode}) [ID: ${p.id}]`,
          value: String(p.id),
        })),
    ],
    [allPermissions, isEdit, permission],
  );

  const onValid = async (values: PermissionFormValues) => {
    try {
      setSubmitting(true);
      setFormError(null);

      if (isEdit && permission) {
        // 编辑权限：严禁发送 permCode 字段（契约规定 permCode 不可修改，编辑接口不接受）
        await rbacApi.updatePermission(permission.id, {
          permName: values.permName.trim(),
          permType: values.permType,
          parentId: values.parentId,
          path: values.path ? values.path.trim() : undefined,
          method: values.method ? values.method : undefined,
          status: values.status,
        });
      } else {
        // 新增权限
        await rbacApi.createPermission({
          permCode: values.permCode.trim(),
          permName: values.permName.trim(),
          permType: values.permType,
          parentId: values.parentId,
          path: values.path ? values.path.trim() : undefined,
          method: values.method ? values.method : undefined,
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
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `编辑权限项 - ${permission?.permName}` : '新增权限项'}
          </DialogTitle>
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
              name="permCode"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="permCode">权限编码 (permCode)</FieldLabel>
                  <Input
                    {...field}
                    id="permCode"
                    aria-invalid={fieldState.invalid}
                    placeholder="如 business:order:read, report:export"
                    disabled={isEdit}
                    maxLength={64}
                  />
                  <FieldDescription>
                    {isEdit
                      ? '系统唯一标识，创建后不可修改'
                      : "自定义权限码禁止以 'rbac:' 开头（'rbac:' 为系统保留前缀）"}
                  </FieldDescription>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            <Controller
              name="permName"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="permName">权限名称</FieldLabel>
                  <Input
                    {...field}
                    id="permName"
                    aria-invalid={fieldState.invalid}
                    placeholder="如 订单查看, 报表导出"
                    maxLength={128}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            <Controller
              name="permType"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="permType">权限类型</FieldLabel>
                  <ClearableSelect<number>
                    id="permType"
                    aria-invalid={fieldState.invalid}
                    placeholder="选择权限类型"
                    allowClear={false}
                    value={field.value}
                    onChange={(val) => field.onChange(val ?? 2)}
                    options={[
                      { label: '目录 (Directory) - 1', value: 1 },
                      { label: '菜单 (Menu) - 2', value: 2 },
                      { label: '按钮 (Button) - 3', value: 3 },
                    ]}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            <Controller
              name="parentId"
              control={control}
              render={({ field, fieldState }) => {
                const selectedOption =
                  parentOptions.find((opt) => opt.value === field.value) ?? null;
                return (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="parentId">父级节点 (parentId)</FieldLabel>
                    <Combobox<ParentOption>
                      items={parentOptions}
                      value={selectedOption}
                      onValueChange={(next: ParentOption | null) => {
                        field.onChange(next ? next.value : ROOT_PARENT_ID);
                      }}
                      isItemEqualToValue={(a, b) => a?.value === b?.value}
                      itemToStringLabel={(item) => item?.label ?? ''}
                    >
                      <ComboboxInput
                        id="parentId"
                        aria-invalid={fieldState.invalid}
                        placeholder="请选择父级节点（默认根节点 0）"
                        className="w-full"
                      />
                      <ComboboxContent>
                        <ComboboxEmpty>无匹配项</ComboboxEmpty>
                        <ComboboxList>
                          {(opt: ParentOption) => (
                            <ComboboxItem key={opt.value} value={opt}>
                              {opt.label}
                            </ComboboxItem>
                          )}
                        </ComboboxList>
                      </ComboboxContent>
                    </Combobox>
                    <FieldDescription>根节点传 0，不能为负数</FieldDescription>
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                );
              }}
            />

            <Controller
              name="path"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="path">路由路径 / API 路径 (path)</FieldLabel>
                  <Input
                    {...field}
                    id="path"
                    aria-invalid={fieldState.invalid}
                    placeholder="前端路由路径或后端接口路径，如 /orders"
                    maxLength={255}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            <Controller
              name="method"
              control={control}
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="method">HTTP 方法 (method)</FieldLabel>
                  <ClearableSelect<string>
                    id="method"
                    placeholder="接口请求方法"
                    value={field.value ?? null}
                    onChange={(val) => field.onChange(val ?? undefined)}
                    options={[
                      { label: 'GET', value: 'GET' },
                      { label: 'POST', value: 'POST' },
                      { label: 'PUT', value: 'PUT' },
                      { label: 'DELETE', value: 'DELETE' },
                    ]}
                  />
                </Field>
              )}
            />

            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <Field orientation="horizontal" className="justify-between">
                  <FieldLabel htmlFor="status">状态</FieldLabel>
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
