import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UserFormModal } from '@/pages/rbac/users/UserFormModal';
import { rbacApi, type RbacUserDTO } from '@/api/rbac';
import { ApiError, ResponseCode } from '@/api/types';

vi.mock('@/api/rbac', () => ({
  rbacApi: {
    createUser: vi.fn(),
    updateUser: vi.fn(),
  },
}));

describe('UserFormModal (RBAC 用户 新增/编辑弹窗)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  const mockExistingUser: RbacUserDTO = {
    id: 'u_10',
    accountId: 'acc_01',
    username: 'alex_dev',
    displayName: 'Alex Developer',
    email: 'alex@example.com',
    mobile: '13812345678',
    status: true,
    createTime: '2026-09-15T10:00:00',
    updateTime: '2026-09-15T10:00:00',
  };

  it('提交成功路径 - 新增用户：填写用户名、密码等完整合法信息后创建成功并触发 onSuccess', async () => {
    const handleSuccess = vi.fn();
    const handleClose = vi.fn();
    vi.mocked(rbacApi.createUser).mockResolvedValueOnce({
      id: 'u_11',
      accountId: 'acc_01',
      username: 'john_doe',
      displayName: 'John Doe',
      email: 'john@example.com',
      mobile: '13900000000',
      status: true,
      createTime: '2026-09-16T10:00:00',
      updateTime: '2026-09-16T10:00:00',
    });

    render(
      <UserFormModal open={true} user={null} onClose={handleClose} onSuccess={handleSuccess} />,
    );

    expect(screen.getByRole('heading', { name: '新增用户' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('用户名'), {
      target: { value: 'john_doe' },
    });
    fireEvent.change(screen.getByLabelText('登录密码'), {
      target: { value: 'Password123' },
    });
    fireEvent.change(screen.getByLabelText('显示名称'), {
      target: { value: 'John Doe' },
    });
    fireEvent.change(screen.getByLabelText('电子邮箱'), {
      target: { value: 'john@example.com' },
    });
    fireEvent.change(screen.getByLabelText('手机号码'), {
      target: { value: '13900000000' },
    });

    const submitBtn = screen.getByRole('button', { name: '创建' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(rbacApi.createUser).toHaveBeenCalledTimes(1);
      expect(rbacApi.createUser).toHaveBeenCalledWith({
        username: 'john_doe',
        password: 'Password123',
        displayName: 'John Doe',
        email: 'john@example.com',
        mobile: '13900000000',
        status: true,
      });
      expect(handleSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it('提交成功路径 - 编辑用户：用户名禁用，密码留空时载荷不包含 password 字段并更新成功', async () => {
    const handleSuccess = vi.fn();
    const handleClose = vi.fn();
    vi.mocked(rbacApi.updateUser).mockResolvedValueOnce({
      ...mockExistingUser,
      displayName: 'Alex Senior Dev',
    });

    render(
      <UserFormModal
        open={true}
        user={mockExistingUser}
        onClose={handleClose}
        onSuccess={handleSuccess}
      />,
    );

    expect(screen.getByRole('heading', { name: /编辑用户 - alex_dev/i })).toBeInTheDocument();

    const usernameInput = screen.getByLabelText('用户名');
    expect(usernameInput).toBeDisabled();
    expect(usernameInput).toHaveValue('alex_dev');

    // 修改显示名称，保持密码为空
    const displayNameInput = screen.getByLabelText('显示名称');
    expect(displayNameInput).toHaveValue('Alex Developer');
    fireEvent.change(displayNameInput, { target: { value: 'Alex Senior Dev' } });

    const submitBtn = screen.getByRole('button', { name: '保存' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(rbacApi.updateUser).toHaveBeenCalledTimes(1);
      const [userId, updatePayload] = vi.mocked(rbacApi.updateUser).mock.calls[0];
      expect(userId).toBe('u_10');
      expect(updatePayload).toEqual({
        displayName: 'Alex Senior Dev',
        email: 'alex@example.com',
        mobile: '13812345678',
        status: true,
      });
      expect(updatePayload).not.toHaveProperty('password');
      expect(handleSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it('提交成功路径 - 编辑用户：输入新密码时载荷包含 password 字段', async () => {
    const handleSuccess = vi.fn();
    vi.mocked(rbacApi.updateUser).mockResolvedValueOnce(mockExistingUser);

    render(
      <UserFormModal
        open={true}
        user={mockExistingUser}
        onClose={vi.fn()}
        onSuccess={handleSuccess}
      />,
    );

    const passwordInput = screen.getByLabelText(/登录密码（留空表示不修改）/i);
    fireEvent.change(passwordInput, { target: { value: 'NewSecretPass888' } });

    const submitBtn = screen.getByRole('button', { name: '保存' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(rbacApi.updateUser).toHaveBeenCalledTimes(1);
      const [, updatePayload] = vi.mocked(rbacApi.updateUser).mock.calls[0];
      expect(updatePayload).toHaveProperty('password', 'NewSecretPass888');
      expect(handleSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it('提交失败路径 - 后端返回 INVALID_ARGUMENT 时在 Alert 中展示错误信息', async () => {
    const handleSuccess = vi.fn();
    vi.mocked(rbacApi.createUser).mockRejectedValueOnce(
      new ApiError({
        code: ResponseCode.INVALID_ARGUMENT,
        info: '用户名已存在，请更换用户名',
      }),
    );

    render(<UserFormModal open={true} user={null} onClose={vi.fn()} onSuccess={handleSuccess} />);

    fireEvent.change(screen.getByLabelText('用户名'), { target: { value: 'dup_user' } });
    fireEvent.change(screen.getByLabelText('登录密码'), { target: { value: 'Password123' } });

    const submitBtn = screen.getByRole('button', { name: '创建' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('用户名已存在，请更换用户名')).toBeInTheDocument();
    });

    expect(handleSuccess).not.toHaveBeenCalled();
    expect(submitBtn).not.toBeDisabled();
  });

  it('提交失败路径 - 后端抛出网络异常时在 Alert 中展示错误信息且 loading 结束', async () => {
    const handleSuccess = vi.fn();
    vi.mocked(rbacApi.createUser).mockRejectedValueOnce(new Error('网络服务不可用'));

    render(<UserFormModal open={true} user={null} onClose={vi.fn()} onSuccess={handleSuccess} />);

    fireEvent.change(screen.getByLabelText('用户名'), { target: { value: 'net_user' } });
    fireEvent.change(screen.getByLabelText('登录密码'), { target: { value: 'Password123' } });

    const submitBtn = screen.getByRole('button', { name: '创建' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('网络服务不可用')).toBeInTheDocument();
    });

    expect(handleSuccess).not.toHaveBeenCalled();
    expect(submitBtn).not.toBeDisabled();
  });

  it('表单校验拦截 - 用户名为空或格式不合法时不发起请求', async () => {
    render(<UserFormModal open={true} user={null} onClose={vi.fn()} onSuccess={vi.fn()} />);

    const submitBtn = screen.getByRole('button', { name: '创建' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('请输入用户名')).toBeInTheDocument();
    });

    // 格式非法：包含空格与特殊符号
    fireEvent.change(screen.getByLabelText('用户名'), { target: { value: 'invalid username!' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText('用户名只能包含字母、数字、下划线、点号和短横线'),
      ).toBeInTheDocument();
    });

    expect(rbacApi.createUser).not.toHaveBeenCalled();
  });

  it('表单校验拦截 - 新增模式下密码必填且长度须在 8~72 位之间', async () => {
    render(<UserFormModal open={true} user={null} onClose={vi.fn()} onSuccess={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('用户名'), { target: { value: 'valid_user' } });

    const submitBtn = screen.getByRole('button', { name: '创建' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('请输入登录密码')).toBeInTheDocument();
    });

    // 少于 8 位
    fireEvent.change(screen.getByLabelText('登录密码'), { target: { value: '1234567' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('密码长度须在 8~72 位之间')).toBeInTheDocument();
    });

    expect(rbacApi.createUser).not.toHaveBeenCalled();
  });

  it('表单校验拦截 - 邮箱格式不合规时拦截请求', async () => {
    render(<UserFormModal open={true} user={null} onClose={vi.fn()} onSuccess={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('用户名'), { target: { value: 'valid_user' } });
    fireEvent.change(screen.getByLabelText('登录密码'), { target: { value: 'Password123' } });
    fireEvent.change(screen.getByLabelText('电子邮箱'), { target: { value: 'not-an-email' } });

    const submitBtn = screen.getByRole('button', { name: '创建' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('请输入合法的邮箱格式')).toBeInTheDocument();
    });

    expect(rbacApi.createUser).not.toHaveBeenCalled();
  });

  it('关闭后重开时状态复位 - 清除错误提示并复位表单项', async () => {
    vi.mocked(rbacApi.createUser).mockRejectedValueOnce(
      new ApiError({
        code: ResponseCode.INVALID_ARGUMENT,
        info: '校验失败提示',
      }),
    );

    const { rerender } = render(
      <UserFormModal open={true} user={null} onClose={vi.fn()} onSuccess={vi.fn()} />,
    );

    fireEvent.change(screen.getByLabelText('用户名'), { target: { value: 'temp_user' } });
    fireEvent.change(screen.getByLabelText('登录密码'), { target: { value: 'Password123' } });
    fireEvent.click(screen.getByRole('button', { name: '创建' }));

    await waitFor(() => {
      expect(screen.getByText('校验失败提示')).toBeInTheDocument();
    });

    // 关闭弹窗
    rerender(<UserFormModal open={false} user={null} onClose={vi.fn()} onSuccess={vi.fn()} />);

    // 重新打开
    rerender(<UserFormModal open={true} user={null} onClose={vi.fn()} onSuccess={vi.fn()} />);

    // 错误被清除，表单字段复位
    expect(screen.queryByText('校验失败提示')).not.toBeInTheDocument();
    expect(screen.getByLabelText('用户名')).toHaveValue('');
    expect(screen.getByLabelText('登录密码')).toHaveValue('');
  });

  it('点击取消按钮调用 onClose 回调', () => {
    const handleClose = vi.fn();
    render(<UserFormModal open={true} user={null} onClose={handleClose} onSuccess={vi.fn()} />);

    const cancelBtn = screen.getByRole('button', { name: '取消' });
    fireEvent.click(cancelBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
