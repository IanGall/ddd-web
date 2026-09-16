import React, { useEffect, useMemo, useState } from 'react';
import { ApiError, ResponseCode } from '@/api/types';
import { rbacApi, type RbacPermissionDTO, type RbacRoleDTO } from '@/api/rbac';
import { usePermission } from '@/hooks/usePermission';
import { ROOT_PARENT_ID } from '@/pages/rbac/permissions/utils';
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
import { Tree, collectAllKeys, deriveTreeStatus, type TreeNode } from '@/components/Tree';

interface RolePermissionModalProps {
  open: boolean;
  role: RbacRoleDTO | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const RolePermissionModal: React.FC<RolePermissionModalProps> = ({
  open,
  role,
  onClose,
  onSuccess,
}) => {
  const { refreshPermissions } = usePermission();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [permissions, setPermissions] = useState<RbacPermissionDTO[]>([]);
  const [checkedKeys, setCheckedKeys] = useState<string[]>([]);
  const [halfCheckedKeys, setHalfCheckedKeys] = useState<string[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [modalError, setModalError] = useState<string | null>(null);

  // 构建树形数据
  const treeData: TreeNode[] = useMemo(() => {
    const map = new Map<string, TreeNode & { parentId: string }>();
    const roots: TreeNode[] = [];

    const formatTitle = (item: RbacPermissionDTO) => {
      let typeBadge: React.ReactNode = null;
      switch (item.permType) {
        case 1:
          typeBadge = <StatusBadge variant="type-dir">目录</StatusBadge>;
          break;
        case 2:
          typeBadge = <StatusBadge variant="type-menu">菜单</StatusBadge>;
          break;
        case 3:
          typeBadge = <StatusBadge variant="type-action">按钮</StatusBadge>;
          break;
      }

      return (
        <div className="flex items-center gap-2">
          <span className="font-semibold">{item.permName}</span>
          <span className="text-xs text-muted-foreground">({item.permCode})</span>
          {typeBadge}
          {item.systemManaged && <StatusBadge variant="builtin">内置</StatusBadge>}
          {!item.status && <StatusBadge variant="destructive">已停用</StatusBadge>}
        </div>
      );
    };

    permissions.forEach((perm) => {
      map.set(perm.id, {
        key: String(perm.id),
        title: formatTitle(perm),
        parentId: String(perm.parentId),
        children: [],
      });
    });

    permissions.forEach((perm) => {
      const node = map.get(perm.id)!;
      if (
        perm.parentId &&
        String(perm.parentId) !== ROOT_PARENT_ID &&
        map.has(String(perm.parentId))
      ) {
        const parent = map.get(String(perm.parentId))!;
        parent.children!.push(node);
      } else {
        roots.push(node);
      }
    });

    // 清理空 children 属性，避免 UI 渲染叶子节点的加号展开符
    const cleanChildren = (nodes: TreeNode[]) => {
      nodes.forEach((n) => {
        if (n.children && n.children.length === 0) {
          delete n.children;
        } else if (n.children) {
          cleanChildren(n.children);
        }
      });
    };
    cleanChildren(roots);

    return roots;
  }, [permissions]);

  // 所有权限 ID 列表（用于全选/展开）
  const allKeys = useMemo(() => collectAllKeys(treeData), [treeData]);

  // 打开目标变化时，在渲染期重置派生状态（React 官方「prop 变化时调整 state」模式），
  // 避免在 effect 同步主体里 setState 造成级联渲染
  const openKey = open && role ? String(role.id) : null;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  if (openKey !== loadedKey) {
    setLoadedKey(openKey);
    if (openKey !== null) {
      setModalError(null);
      setLoading(true);
    }
  }

  useEffect(() => {
    if (!openKey || !role) return;

    Promise.all([
      rbacApi.getPermissions({ pageNum: 1, pageSize: 100 }),
      rbacApi.getRolePermissions(role.id),
    ])
      .then(([permRes, rolePermRes]) => {
        setPermissions(permRes.list);
        const initialChecked = (rolePermRes.permissionIds || []).map((id) => String(id));
        setCheckedKeys(initialChecked);
        setExpandedKeys(permRes.list.map((p) => String(p.id)));
      })
      .catch((err) => {
        if (err instanceof ApiError) {
          setModalError(err.info || '加载权限数据失败');
        } else {
          setModalError('加载权限数据失败');
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [openKey, role]);

  const handleSelectAll = () => {
    setCheckedKeys(allKeys);
    setHalfCheckedKeys([]);
  };

  const handleClearAll = () => {
    setCheckedKeys([]);
    setHalfCheckedKeys([]);
  };

  const handleExpandAll = () => {
    setExpandedKeys(allKeys);
  };

  const handleCollapseAll = () => {
    setExpandedKeys([]);
  };

  const handleSubmit = async () => {
    if (!role) return;

    // 合并全选节点与半选父节点（保证具有层级可见性），去重。
    // 标识全程保持字符串：转成 Number 会让超 2^53 的雪花 ID 丢精度。
    const { allChecked, allHalfChecked } = deriveTreeStatus(treeData, checkedKeys);
    const finalKeySet = new Set<string>();
    checkedKeys.forEach((k) => finalKeySet.add(String(k)));
    halfCheckedKeys.forEach((k) => finalKeySet.add(String(k)));
    allChecked.forEach((k) => finalKeySet.add(String(k)));
    allHalfChecked.forEach((k) => finalKeySet.add(String(k)));

    const permissionIds = Array.from(finalKeySet).filter(
      (id) => id !== '' && id !== ROOT_PARENT_ID,
    );

    if (permissionIds.length > 500) {
      setModalError('分配权限项数量不得超过 500 个');
      return;
    }

    try {
      setSubmitting(true);
      setModalError(null);

      // 全量替换：空数组表示清空权限
      await rbacApi.grantRolePermissions(role.id, permissionIds);

      // 契约硬性要求：授权类写操作成功后刷新当前主体权限码
      await refreshPermissions();

      onSuccess();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === ResponseCode.INVALID_ARGUMENT) {
          setModalError(err.info || '参数验证不通过，请检查所选权限');
          return;
        }
        setModalError(err.info || '权限分配失败');
      } else if (err instanceof Error) {
        setModalError(err.message || '权限分配失败');
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
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>
            分配权限 - {role?.roleName || ''} ({role?.roleCode || ''})
          </DialogTitle>
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
            <AppSpinner description="正在加载权限树与当前授权..." />
          </div>
        ) : (
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm text-muted-foreground">
                勾选赋予该角色的权限项。操作为
                <StatusBadge variant="warning" className="mx-1">
                  全量覆盖
                </StatusBadge>
                ，清空即表示收回该角色全部权限。
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button variant="outline" size="sm" onClick={handleSelectAll}>
                  全选
                </Button>
                <Button variant="outline" size="sm" onClick={handleClearAll}>
                  清空
                </Button>
                <Button variant="outline" size="sm" onClick={handleExpandAll}>
                  展开
                </Button>
                <Button variant="outline" size="sm" onClick={handleCollapseAll}>
                  折叠
                </Button>
              </div>
            </div>

            <div className="max-h-[420px] overflow-y-auto rounded-md border border-border bg-muted/20 px-4 py-3">
              {treeData.length > 0 ? (
                <Tree
                  nodes={treeData}
                  checkedKeys={checkedKeys}
                  onCheckedChange={(checked, halfChecked) => {
                    setCheckedKeys(checked);
                    setHalfCheckedKeys(halfChecked);
                  }}
                  expandedKeys={expandedKeys}
                  onExpandedChange={setExpandedKeys}
                />
              ) : (
                <div className="py-6 text-center text-sm text-muted-foreground">暂无可选权限项</div>
              )}
            </div>
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
