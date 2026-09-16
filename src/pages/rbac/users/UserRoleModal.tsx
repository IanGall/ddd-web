import React, { useEffect, useMemo, useState } from 'react';
import { ApiError, ResponseCode } from '@/api/types';
import { rbacApi, type RbacRoleDTO, type RbacUserDTO } from '@/api/rbac';
import { usePermission } from '@/hooks/usePermission';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LoadingButton } from '@/components/LoadingButton';
import { AppAlert } from '@/components/AppAlert';
import { AppSpinner } from '@/components/AppSpinner';
import { StatusBadge } from '@/components/StatusBadge';
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from '@/components/ui/combobox';

interface UserRoleModalProps {
  open: boolean;
  user: RbacUserDTO | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface RoleOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export const UserRoleModal: React.FC<UserRoleModalProps> = ({ open, user, onClose, onSuccess }) => {
  const { refreshPermissions } = usePermission();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [roles, setRoles] = useState<RbacRoleDTO[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [modalError, setModalError] = useState<string | null>(null);

  const anchorRef = useComboboxAnchor();

  // 打开目标变化时，在渲染期重置派生状态（React 官方「prop 变化时调整 state」模式），
  // 避免在 effect 同步主体里 setState 造成级联渲染
  const openKey = open && user ? String(user.id) : null;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  if (openKey !== loadedKey) {
    setLoadedKey(openKey);
    if (openKey !== null) {
      setModalError(null);
      setLoading(true);
    }
  }

  useEffect(() => {
    if (!openKey || !user) return;

    Promise.all([rbacApi.getRoles({ pageNum: 1, pageSize: 100 }), rbacApi.getUserRoles(user.id)])
      .then(([rolesRes, userRolesRes]) => {
        setRoles(rolesRes.list);
        setSelectedRoleIds(userRolesRes.roleIds || []);
      })
      .catch((err) => {
        if (err instanceof ApiError) {
          setModalError(err.info || '加载角色数据失败');
        } else {
          setModalError('加载角色数据失败');
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [openKey, user]);

  const roleOptions: RoleOption[] = useMemo(
    () =>
      roles.map((role) => ({
        label: `${role.roleName} (${role.roleCode})`,
        value: role.id,
        disabled: !role.status,
      })),
    [roles],
  );

  const selectedOptions: RoleOption[] = useMemo(
    () => roleOptions.filter((opt) => selectedRoleIds.includes(opt.value)),
    [roleOptions, selectedRoleIds],
  );

  const handleSubmit = async () => {
    if (!user) return;

    if (selectedRoleIds.length > 500) {
      setModalError('所选角色数量不得超过 500 个');
      return;
    }

    try {
      setSubmitting(true);
      setModalError(null);

      // 全量替换：空数组表示清空角色
      await rbacApi.grantUserRoles(user.id, selectedRoleIds);

      // 契约硬性要求：授权类写操作成功后刷新当前主体权限码
      await refreshPermissions();

      onSuccess();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === ResponseCode.INVALID_ARGUMENT) {
          setModalError(err.info || '参数验证不通过，请检查所选角色');
          return;
        }
        setModalError(err.info || '角色分配失败');
      } else if (err instanceof Error) {
        setModalError(err.message || '角色分配失败');
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
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>分配角色 - {user?.username || ''}</DialogTitle>
        </DialogHeader>

        {modalError && (
          <AppAlert
            variant="error"
            title={modalError}
            closable
            onClose={() => setModalError(null)}
            className="mb-4"
          />
        )}

        {loading ? (
          <div className="py-10 text-center">
            <AppSpinner description="正在加载角色列表与当前授权..." />
          </div>
        ) : (
          <div>
            <div className="mb-3 text-sm text-muted-foreground">
              为用户 <span className="font-semibold text-foreground">{user?.username}</span>{' '}
              分配所属角色。此操作为
              <StatusBadge variant="warning" className="mx-1">
                全量覆盖
              </StatusBadge>
              ，清空选择则表示移除该用户的全部角色。
            </div>

            <Combobox<RoleOption, true>
              items={roleOptions}
              multiple
              value={selectedOptions}
              onValueChange={(next: RoleOption[]) => {
                setSelectedRoleIds(next.map((item) => item.value));
              }}
              isItemEqualToValue={(item, val) => item.value === val.value}
            >
              <ComboboxValue>
                {(values: RoleOption[]) => (
                  <ComboboxChips ref={anchorRef} className="w-full">
                    {values.map((role) => (
                      <ComboboxChip key={role.value}>{role.label}</ComboboxChip>
                    ))}
                    <ComboboxChipsInput
                      placeholder={values.length > 0 ? '' : '请选择分配给该用户的角色'}
                    />
                  </ComboboxChips>
                )}
              </ComboboxValue>
              <ComboboxContent anchor={anchorRef}>
                <ComboboxEmpty>暂无匹配角色</ComboboxEmpty>
                <ComboboxList>
                  {(item: RoleOption) => (
                    <ComboboxItem key={item.value} value={item} disabled={item.disabled}>
                      {item.label}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </div>
        )}

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            取消
          </Button>
          <LoadingButton loading={submitting} onClick={handleSubmit}>
            保存授权
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
