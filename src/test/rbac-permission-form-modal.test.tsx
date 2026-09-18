import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PermissionFormModal } from '@/pages/rbac/permissions/PermissionFormModal';
import { rbacApi, type RbacPermissionDTO } from '@/api/rbac';
import { ApiError, ResponseCode } from '@/api/types';

vi.mock('@/api/rbac', () => ({
  rbacApi: {
    createPermission: vi.fn(),
    updatePermission: vi.fn(),
  },
}));

describe('PermissionFormModal (RBAC 权限项 新增/编辑弹窗)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  const mockAllPermissions: RbacPermissionDTO[] = [
    {
      id: '1',
      permCode: 'sys:manage',
      permName: '系统管理',
      permType: 1,
      parentId: '0',
      path: '/sys',
      method: null,
      status: true,
      systemManaged: true,
      createTime: '2026-09-15T10:00:00',
      updateTime: '2026-09-15T10:00:00',
    },
  ];

  const mockExistingPermission: RbacPermissionDTO = {
    id: '10',
    permCode: 'business:order:view',
    permName: '查看订单',
    permType: 2,
    parentId: '1',
    path: '/orders',
    method: 'GET',
    status: true,
    systemManaged: false,
    createTime: '2026-09-15T10:00:00',
    updateTime: '2026-09-15T10:00:00',
  };

  it('提交成功路径 - 新增权限：填写合法表单数据后提交成功，调用 createPermission 并触发 onSuccess', async () => {
    const handleSuccess = vi.fn();
    const handleClose = vi.fn();
    vi.mocked(rbacApi.createPermission).mockResolvedValueOnce({
      id: '20',
      permCode: 'business:order:export',
      permName: '导出订单报表',
      permType: 2,
      parentId: '0',
      path: null,
      method: null,
      status: true,
      systemManaged: false,
      createTime: '2026-09-16T10:00:00',
      updateTime: '2026-09-16T10:00:00',
    });

    render(
      <PermissionFormModal
        open={true}
        permission={null}
        allPermissions={mockAllPermissions}
        onClose={handleClose}
        onSuccess={handleSuccess}
      />,
    );

    expect(screen.getByRole('heading', { name: '新增权限项' })).toBeInTheDocument();

    const codeInput = screen.getByLabelText(/权限编码/i);
    const nameInput = screen.getByLabelText(/权限名称/i);

    fireEvent.change(codeInput, { target: { value: 'business:order:export' } });
    fireEvent.change(nameInput, { target: { value: '导出订单报表' } });

    const submitBtn = screen.getByRole('button', { name: '创建' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(rbacApi.createPermission).toHaveBeenCalledTimes(1);
      expect(rbacApi.createPermission).toHaveBeenCalledWith({
        permCode: 'business:order:export',
        permName: '导出订单报表',
        permType: 2,
        parentId: '0',
        path: undefined,
        method: undefined,
        status: true,
      });
      expect(handleSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it('提交成功路径 - 编辑权限：回显数据且权限编码禁用，修改名称提交成功，不发送 permCode', async () => {
    const handleSuccess = vi.fn();
    const handleClose = vi.fn();
    vi.mocked(rbacApi.updatePermission).mockResolvedValueOnce({
      ...mockExistingPermission,
      permName: '查看订单详情',
    });

    render(
      <PermissionFormModal
        open={true}
        permission={mockExistingPermission}
        allPermissions={mockAllPermissions}
        onClose={handleClose}
        onSuccess={handleSuccess}
      />,
    );

    expect(screen.getByRole('heading', { name: /编辑权限项 - 查看订单/i })).toBeInTheDocument();

    const codeInput = screen.getByLabelText(/权限编码/i);
    expect(codeInput).toBeDisabled();
    expect(codeInput).toHaveValue('business:order:view');

    const nameInput = screen.getByLabelText(/权限名称/i);
    expect(nameInput).toHaveValue('查看订单');

    fireEvent.change(nameInput, { target: { value: '查看订单详情' } });

    const submitBtn = screen.getByRole('button', { name: '保存' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(rbacApi.updatePermission).toHaveBeenCalledTimes(1);
      // 契约关键硬约束：编辑时更新载荷严禁包含 permCode 属性
      const [updateId, updatePayload] = vi.mocked(rbacApi.updatePermission).mock.calls[0];
      expect(updateId).toBe('10');
      expect(updatePayload).toEqual({
        permName: '查看订单详情',
        permType: 2,
        parentId: '1',
        path: '/orders',
        method: 'GET',
        status: true,
      });
      expect(updatePayload).not.toHaveProperty('permCode');
      expect(handleSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it('提交失败路径 - 后端返回 INVALID_ARGUMENT 时在 Alert 中展示错误信息', async () => {
    const handleSuccess = vi.fn();
    vi.mocked(rbacApi.createPermission).mockRejectedValueOnce(
      new ApiError({
        code: ResponseCode.INVALID_ARGUMENT,
        info: '权限编码已存在，禁止重复创建',
      }),
    );

    render(
      <PermissionFormModal
        open={true}
        permission={null}
        allPermissions={mockAllPermissions}
        onClose={vi.fn()}
        onSuccess={handleSuccess}
      />,
    );

    fireEvent.change(screen.getByLabelText(/权限编码/i), {
      target: { value: 'dup:perm' },
    });
    fireEvent.change(screen.getByLabelText(/权限名称/i), {
      target: { value: '重复权限' },
    });

    const submitBtn = screen.getByRole('button', { name: '创建' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('权限编码已存在，禁止重复创建')).toBeInTheDocument();
    });

    expect(handleSuccess).not.toHaveBeenCalled();
    expect(submitBtn).not.toBeDisabled();
  });

  it('提交失败路径 - 后端抛出通用异常时在 Alert 中展示错误信息且 loading 结束', async () => {
    const handleSuccess = vi.fn();
    vi.mocked(rbacApi.createPermission).mockRejectedValueOnce(new Error('数据库连接失败'));

    render(
      <PermissionFormModal
        open={true}
        permission={null}
        allPermissions={mockAllPermissions}
        onClose={vi.fn()}
        onSuccess={handleSuccess}
      />,
    );

    fireEvent.change(screen.getByLabelText(/权限编码/i), {
      target: { value: 'valid:perm' },
    });
    fireEvent.change(screen.getByLabelText(/权限名称/i), {
      target: { value: '正常权限' },
    });

    const submitBtn = screen.getByRole('button', { name: '创建' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('数据库连接失败')).toBeInTheDocument();
    });

    expect(handleSuccess).not.toHaveBeenCalled();
    expect(submitBtn).not.toBeDisabled();
  });

  it('表单校验拦截 - 新增权限编码以 rbac: 开头时被拦截并提示系统保留前缀', async () => {
    render(
      <PermissionFormModal
        open={true}
        permission={null}
        allPermissions={mockAllPermissions}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText(/权限编码/i), {
      target: { value: 'rbac:custom:operation' },
    });
    fireEvent.change(screen.getByLabelText(/权限名称/i), {
      target: { value: '系统前缀测试' },
    });

    const submitBtn = screen.getByRole('button', { name: '创建' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText("自定义权限码不得以 'rbac:' 开头（系统保留前缀）"),
      ).toBeInTheDocument();
    });

    expect(rbacApi.createPermission).not.toHaveBeenCalled();
  });

  it('表单校验拦截 - 权限编码或权限名称为空时不发起请求', async () => {
    render(
      <PermissionFormModal
        open={true}
        permission={null}
        allPermissions={mockAllPermissions}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    const submitBtn = screen.getByRole('button', { name: '创建' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('请输入权限编码')).toBeInTheDocument();
      expect(screen.getByText('请输入权限名称')).toBeInTheDocument();
    });

    expect(rbacApi.createPermission).not.toHaveBeenCalled();
  });

  it('表单校验拦截 - 权限编码包含非法字符（特殊符号/中文）时被拦截', async () => {
    render(
      <PermissionFormModal
        open={true}
        permission={null}
        allPermissions={mockAllPermissions}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText(/权限编码/i), {
      target: { value: 'order:导出@#$' },
    });
    fireEvent.change(screen.getByLabelText(/权限名称/i), {
      target: { value: '测试编码' },
    });

    const submitBtn = screen.getByRole('button', { name: '创建' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('权限编码格式不正确')).toBeInTheDocument();
    });

    expect(rbacApi.createPermission).not.toHaveBeenCalled();
  });

  it('关闭后重开时状态复位 - 清除错误提示并在重开后复位表单项', async () => {
    vi.mocked(rbacApi.createPermission).mockRejectedValueOnce(
      new ApiError({
        code: ResponseCode.INVALID_ARGUMENT,
        info: '服务端报错',
      }),
    );

    const { rerender } = render(
      <PermissionFormModal
        open={true}
        permission={null}
        allPermissions={mockAllPermissions}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    // 触发错误
    fireEvent.change(screen.getByLabelText(/权限编码/i), { target: { value: 'temp:test' } });
    fireEvent.change(screen.getByLabelText(/权限名称/i), { target: { value: '临时项' } });
    fireEvent.click(screen.getByRole('button', { name: '创建' }));

    await waitFor(() => {
      expect(screen.getByText('服务端报错')).toBeInTheDocument();
    });

    // 关闭弹窗
    rerender(
      <PermissionFormModal
        open={false}
        permission={null}
        allPermissions={mockAllPermissions}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    // 重新打开
    rerender(
      <PermissionFormModal
        open={true}
        permission={null}
        allPermissions={mockAllPermissions}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    // 错误信息被清除，字段重置为空
    expect(screen.queryByText('服务端报错')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/权限编码/i)).toHaveValue('');
    expect(screen.getByLabelText(/权限名称/i)).toHaveValue('');
  });

  it('点击取消按钮调用 onClose 回调', () => {
    const handleClose = vi.fn();
    render(
      <PermissionFormModal
        open={true}
        permission={null}
        allPermissions={mockAllPermissions}
        onClose={handleClose}
        onSuccess={vi.fn()}
      />,
    );

    const cancelBtn = screen.getByRole('button', { name: '取消' });
    fireEvent.click(cancelBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
