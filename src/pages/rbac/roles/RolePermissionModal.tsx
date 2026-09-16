import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Modal, Space, Spin, Tag, Tree, Typography, theme } from 'antd';
import type { DataNode } from 'antd/es/tree';
import { ApiError, ResponseCode } from '@/api/types';
import { rbacApi, type RbacPermissionDTO, type RbacRoleDTO } from '@/api/rbac';
import { usePermission } from '@/hooks/usePermission';
import { ROOT_PARENT_ID } from '@/pages/rbac/permissions/utils';

const { Text } = Typography;

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
  const { token } = theme.useToken();
  const { refreshPermissions } = usePermission();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [permissions, setPermissions] = useState<RbacPermissionDTO[]>([]);
  const [checkedKeys, setCheckedKeys] = useState<React.Key[]>([]);
  const [halfCheckedKeys, setHalfCheckedKeys] = useState<React.Key[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [autoExpandParent, setAutoExpandParent] = useState<boolean>(true);
  const [modalError, setModalError] = useState<string | null>(null);

  // 构建树形数据
  const treeData = useMemo(() => {
    const map = new Map<string, DataNode & { parentId: string }>();
    const roots: DataNode[] = [];

    const formatTitle = (item: RbacPermissionDTO) => {
      let typeTag: React.ReactNode = null;
      switch (item.permType) {
        case 1:
          typeTag = <Tag color="geekblue">目录</Tag>;
          break;
        case 2:
          typeTag = <Tag color="green">菜单</Tag>;
          break;
        case 3:
          typeTag = <Tag color="orange">按钮</Tag>;
          break;
      }

      return (
        <Space size="small">
          <Text strong>{item.permName}</Text>
          <Text type="secondary" className="text-xs">
            ({item.permCode})
          </Text>
          {typeTag}
          {!item.status && <Tag color="error">已停用</Tag>}
        </Space>
      );
    };

    permissions.forEach((perm) => {
      map.set(perm.id, {
        key: perm.id,
        title: formatTitle(perm),
        parentId: perm.parentId,
        children: [],
      });
    });

    permissions.forEach((perm) => {
      const node = map.get(perm.id)!;
      if (perm.parentId && perm.parentId !== ROOT_PARENT_ID && map.has(perm.parentId)) {
        const parent = map.get(perm.parentId)!;
        parent.children!.push(node);
      } else {
        roots.push(node);
      }
    });

    // 清理空 children 属性，避免 UI 渲染叶子节点的加号展开符
    const cleanChildren = (nodes: DataNode[]) => {
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

  // 所有权限 ID 列表（用于全选）
  const allPermissionIds = useMemo(() => permissions.map((p) => p.id), [permissions]);

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
        const initialChecked = rolePermRes.permissionIds || [];
        setCheckedKeys(initialChecked);
        setExpandedKeys(permRes.list.map((p) => p.id));
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

  const onExpand = (newExpandedKeys: React.Key[]) => {
    setExpandedKeys(newExpandedKeys);
    setAutoExpandParent(false);
  };

  const onCheck = (
    checked: React.Key[] | { checked: React.Key[]; halfChecked: React.Key[] },
    info: { halfCheckedKeys?: React.Key[] },
  ) => {
    if (Array.isArray(checked)) {
      setCheckedKeys(checked);
    } else {
      setCheckedKeys(checked.checked);
    }
    setHalfCheckedKeys(info.halfCheckedKeys || []);
  };

  const handleSelectAll = () => {
    setCheckedKeys(allPermissionIds);
    setHalfCheckedKeys([]);
  };

  const handleClearAll = () => {
    setCheckedKeys([]);
    setHalfCheckedKeys([]);
  };

  const handleExpandAll = () => {
    setExpandedKeys(allPermissionIds);
  };

  const handleCollapseAll = () => {
    setExpandedKeys([]);
  };

  const handleSubmit = async () => {
    if (!role) return;

    // 合并全选节点与半选父节点（保证具有层级可见性），去重。
    // 标识全程保持字符串：转成 Number 会让超 2^53 的雪花 ID 丢精度。
    const finalKeySet = new Set<string>();
    checkedKeys.forEach((k) => finalKeySet.add(String(k)));
    halfCheckedKeys.forEach((k) => finalKeySet.add(String(k)));

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
    <Modal
      title={`分配权限 - ${role?.roleName || ''} (${role?.roleCode || ''})`}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={submitting}
      destroyOnHidden
      okText="保存授权"
      cancelText="取消"
      width={640}
    >
      {modalError && (
        <Alert
          title={modalError}
          type="error"
          showIcon
          closable
          onClose={() => setModalError(null)}
          className="mb-4"
        />
      )}

      {loading ? (
        <div className="py-10 text-center">
          <Spin description="正在加载权限树与当前授权..." />
        </div>
      ) : (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <Text type="secondary">
              勾选赋予该角色的权限项。操作为<Text type="warning">全量覆盖</Text>
              ，清空即表示收回该角色全部权限。
            </Text>
            <Space size="small">
              <Button size="small" onClick={handleSelectAll}>
                全选
              </Button>
              <Button size="small" onClick={handleClearAll}>
                清空
              </Button>
              <Button size="small" onClick={handleExpandAll}>
                展开
              </Button>
              <Button size="small" onClick={handleCollapseAll}>
                折叠
              </Button>
            </Space>
          </div>

          <div
            className="max-h-[420px] overflow-y-auto rounded-md border px-4 py-3"
            style={{ borderColor: token.colorSplit, background: token.colorFillQuaternary }}
          >
            {treeData.length > 0 ? (
              <Tree
                checkable
                onExpand={onExpand}
                expandedKeys={expandedKeys}
                autoExpandParent={autoExpandParent}
                onCheck={onCheck}
                checkedKeys={checkedKeys}
                treeData={treeData}
              />
            ) : (
              <div className="py-6 text-center" style={{ color: token.colorTextTertiary }}>
                暂无可选权限项
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
};
