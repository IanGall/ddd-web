import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RoleFormModal } from '@/pages/rbac/roles/RoleFormModal';
import { rbacApi, type RbacRoleDTO } from '@/api/rbac';
import { ApiError, ResponseCode } from '@/api/types';

vi.mock('@/api/rbac', () => ({
  rbacApi: {
    createRole: vi.fn(),
    updateRole: vi.fn(),
  },
}));

describe('RoleFormModal (RBAC 角色 新增/编辑弹窗)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  const mockExistingRole: RbacRoleDTO = {
    id: '101',
    roleCode: 'finance_auditor',
    roleName: '财务对账专员',
    roleDesc: '负责每日财务流水核验',
    status: true,
    createTime: '2026-09-15T10:00:00',
    updateTime: '2026-09-15T10:00:00',
  };

  it('提交成功路径 - 新增角色：填写合法字段后提交成功，调用 createRole 并触发 onSuccess', async () => {
    const handleSuccess = vi.fn();
    const handleClose = vi.fn();
    vi.mocked(rbacApi.createRole).mockResolvedValueOnce({
      id: '102',
      roleCode: 'channel_manager',
      roleName: '渠道管理专员',
      roleDesc: '负责各支付渠道配置维护',
      status: true,
      createTime: '2026-09-16T10:00:00',
      updateTime: '2026-09-16T10:00:00',
    });

    render(
      <RoleFormModal open={true} role={null} onClose={handleClose} onSuccess={handleSuccess} />,
    );

    expect(screen.getByRole('heading', { name: '新增角色' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/角色编码/i), {
      target: { value: 'channel_manager' },
    });
    fireEvent.change(screen.getByLabelText(/角色名称/i), {
      target: { value: '渠道管理专员' },
    });
    fireEvent.change(screen.getByLabelText(/角色描述/i), {
      target: { value: '负责各支付渠道配置维护' },
    });

    const submitBtn = screen.getByRole('button', { name: '创建' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(rbacApi.createRole).toHaveBeenCalledTimes(1);
      expect(rbacApi.createRole).toHaveBeenCalledWith({
        roleCode: 'channel_manager',
        roleName: '渠道管理专员',
        roleDesc: '负责各支付渠道配置维护',
        status: true,
      });
      expect(handleSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it('提交成功路径 - 编辑角色：回显原始信息，修改角色名称与描述后提交成功，调用 updateRole', async () => {
    const handleSuccess = vi.fn();
    const handleClose = vi.fn();
    vi.mocked(rbacApi.updateRole).mockResolvedValueOnce({
      ...mockExistingRole,
      roleName: '高级财务对账专员',
      roleDesc: '负责每日财务流水核验及跨月调账',
    });

    render(
      <RoleFormModal
        open={true}
        role={mockExistingRole}
        onClose={handleClose}
        onSuccess={handleSuccess}
      />,
    );

    expect(screen.getByRole('heading', { name: /编辑角色 - 财务对账专员/i })).toBeInTheDocument();

    const codeInput = screen.getByLabelText(/角色编码/i);
    const nameInput = screen.getByLabelText(/角色名称/i);
    const descInput = screen.getByLabelText(/角色描述/i);

    expect(codeInput).toHaveValue('finance_auditor');
    expect(nameInput).toHaveValue('财务对账专员');
    expect(descInput).toHaveValue('负责每日财务流水核验');

    fireEvent.change(nameInput, { target: { value: '高级财务对账专员' } });
    fireEvent.change(descInput, { target: { value: '负责每日财务流水核验及跨月调账' } });

    const submitBtn = screen.getByRole('button', { name: '保存' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(rbacApi.updateRole).toHaveBeenCalledTimes(1);
      expect(rbacApi.updateRole).toHaveBeenCalledWith('101', {
        roleCode: 'finance_auditor',
        roleName: '高级财务对账专员',
        roleDesc: '负责每日财务流水核验及跨月调账',
        status: true,
      });
      expect(handleSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it('提交失败路径 - 后端返回 INVALID_ARGUMENT 时在 Alert 中展示错误信息', async () => {
    const handleSuccess = vi.fn();
    vi.mocked(rbacApi.createRole).mockRejectedValueOnce(
      new ApiError({
        code: ResponseCode.INVALID_ARGUMENT,
        info: '角色编码已存在，请勿重复使用',
      }),
    );

    render(<RoleFormModal open={true} role={null} onClose={vi.fn()} onSuccess={handleSuccess} />);

    fireEvent.change(screen.getByLabelText(/角色编码/i), {
      target: { value: 'dup_role' },
    });
    fireEvent.change(screen.getByLabelText(/角色名称/i), {
      target: { value: '重复角色' },
    });

    const submitBtn = screen.getByRole('button', { name: '创建' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('角色编码已存在，请勿重复使用')).toBeInTheDocument();
    });

    expect(handleSuccess).not.toHaveBeenCalled();
    expect(submitBtn).not.toBeDisabled();
  });

  it('提交失败路径 - 后端抛出通用异常时在 Alert 中展示错误信息且 loading 结束', async () => {
    const handleSuccess = vi.fn();
    vi.mocked(rbacApi.createRole).mockRejectedValueOnce(new Error('RPC 调用超时'));

    render(<RoleFormModal open={true} role={null} onClose={vi.fn()} onSuccess={handleSuccess} />);

    fireEvent.change(screen.getByLabelText(/角色编码/i), {
      target: { value: 'timeout_role' },
    });
    fireEvent.change(screen.getByLabelText(/角色名称/i), {
      target: { value: '超时角色' },
    });

    const submitBtn = screen.getByRole('button', { name: '创建' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('RPC 调用超时')).toBeInTheDocument();
    });

    expect(handleSuccess).not.toHaveBeenCalled();
    expect(submitBtn).not.toBeDisabled();
  });

  it('表单校验拦截 - 角色编码或角色名称为空时不发起请求', async () => {
    render(<RoleFormModal open={true} role={null} onClose={vi.fn()} onSuccess={vi.fn()} />);

    const submitBtn = screen.getByRole('button', { name: '创建' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('请输入角色编码')).toBeInTheDocument();
      expect(screen.getByText('请输入角色名称')).toBeInTheDocument();
    });

    expect(rbacApi.createRole).not.toHaveBeenCalled();
  });

  it('表单校验拦截 - 角色描述超过 255 字符时被拦截', async () => {
    render(<RoleFormModal open={true} role={null} onClose={vi.fn()} onSuccess={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/角色编码/i), {
      target: { value: 'long_desc_role' },
    });
    fireEvent.change(screen.getByLabelText(/角色名称/i), {
      target: { value: '超长描述测试' },
    });
    fireEvent.change(screen.getByLabelText(/角色描述/i), {
      target: { value: 'x'.repeat(256) },
    });

    const submitBtn = screen.getByRole('button', { name: '创建' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('角色描述长度不能超过 255 个字符')).toBeInTheDocument();
    });

    expect(rbacApi.createRole).not.toHaveBeenCalled();
  });

  it('关闭后重开时状态复位 - 清除错误提示并复位表单输入', async () => {
    vi.mocked(rbacApi.createRole).mockRejectedValueOnce(
      new ApiError({
        code: ResponseCode.INVALID_ARGUMENT,
        info: '临时服务端报错',
      }),
    );

    const { rerender } = render(
      <RoleFormModal open={true} role={null} onClose={vi.fn()} onSuccess={vi.fn()} />,
    );

    // 触发错误
    fireEvent.change(screen.getByLabelText(/角色编码/i), { target: { value: 'temp_code' } });
    fireEvent.change(screen.getByLabelText(/角色名称/i), { target: { value: '临时角色' } });
    fireEvent.click(screen.getByRole('button', { name: '创建' }));

    await waitFor(() => {
      expect(screen.getByText('临时服务端报错')).toBeInTheDocument();
    });

    // 关闭弹窗
    rerender(<RoleFormModal open={false} role={null} onClose={vi.fn()} onSuccess={vi.fn()} />);

    // 重新打开弹窗
    rerender(<RoleFormModal open={true} role={null} onClose={vi.fn()} onSuccess={vi.fn()} />);

    // 验证错误横幅消失，输入框回到空值
    expect(screen.queryByText('临时服务端报错')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/角色编码/i)).toHaveValue('');
    expect(screen.getByLabelText(/角色名称/i)).toHaveValue('');
  });

  it('点击取消按钮调用 onClose 回调', () => {
    const handleClose = vi.fn();
    render(<RoleFormModal open={true} role={null} onClose={handleClose} onSuccess={vi.fn()} />);

    const cancelBtn = screen.getByRole('button', { name: '取消' });
    fireEvent.click(cancelBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
