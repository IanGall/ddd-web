import React, { useEffect, useState } from 'react';
import { Alert, Modal, Select, Spin, Typography } from 'antd';
import { ApiError, ResponseCode } from '@/api/types';
import { rbacApi, type RbacRoleDTO, type RbacUserDTO } from '@/api/rbac';
import { usePermission } from '@/hooks/usePermission';

const { Text } = Typography;

interface UserRoleModalProps {
  open: boolean;
  user: RbacUserDTO | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const UserRoleModal: React.FC<UserRoleModalProps> = ({ open, user, onClose, onSuccess }) => {
  const { refreshPermissions } = usePermission();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [roles, setRoles] = useState<RbacRoleDTO[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [modalError, setModalError] = useState<string | null>(null);

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
    <Modal
      title={`分配角色 - ${user?.username || ''}`}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={submitting}
      destroyOnHidden
      okText="保存授权"
      cancelText="取消"
      width={560}
    >
      {modalError && (
        <Alert
          title={modalError}
          type="error"
          showIcon
          closable
          onClose={() => setModalError(null)}
          style={{ marginBottom: 16 }}
        />
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin description="正在加载角色列表与当前授权..." />
        </div>
      ) : (
        <div>
          <div style={{ marginBottom: 12 }}>
            <Text type="secondary">
              为用户 <Text strong>{user?.username}</Text> 分配所属角色。此操作为
              <Text type="warning">全量覆盖</Text>，清空选择则表示移除该用户的全部角色。
            </Text>
          </div>

          <Select
            mode="multiple"
            allowClear
            style={{ width: '100%' }}
            placeholder="请选择分配给该用户的角色"
            value={selectedRoleIds}
            onChange={(values) => setSelectedRoleIds(values)}
            options={roles.map((role) => ({
              label: `${role.roleName} (${role.roleCode})`,
              value: role.id,
              disabled: !role.status,
            }))}
            filterOption={(input, option) =>
              (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
            }
          />
        </div>
      )}
    </Modal>
  );
};
