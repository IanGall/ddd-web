import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UserRoleModal } from '@/pages/rbac/users/UserRoleModal';
import { rbacApi } from '@/api/rbac';
import { ApiError } from '@/api/types';

vi.mock('@/api/rbac', () => ({
  rbacApi: {
    getRoles: vi.fn(),
    getUserRoles: vi.fn(),
  },
}));

const targetUser = { id: '1', username: 'u1' } as never;

function Wrapper({ open }: { open: boolean }) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <UserRoleModal open={open} user={targetUser} onClose={() => {}} onSuccess={() => {}} />
    </QueryClientProvider>
  );
}

describe('重新打开同一目标时的状态重置', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (rbacApi.getRoles as never as ReturnType<typeof vi.fn>).mockResolvedValue({ list: [] });
  });

  it('关闭后重新打开同一用户，上一次的错误横幅必须被清掉', async () => {
    (rbacApi.getUserRoles as never as ReturnType<typeof vi.fn>).mockRejectedValue(
      new ApiError({ code: 'X', info: '加载角色数据失败' }),
    );

    const { rerender } = render(<Wrapper open={false} />);
    rerender(<Wrapper open={true} />);
    await screen.findByText('加载角色数据失败');

    rerender(<Wrapper open={false} />);

    (rbacApi.getUserRoles as never as ReturnType<typeof vi.fn>).mockResolvedValue({ roleIds: [] });
    rerender(<Wrapper open={true} />);
    await waitFor(() =>
      expect((rbacApi.getUserRoles as never as ReturnType<typeof vi.fn>).mock.calls.length).toBe(2),
    );

    expect(screen.queryByText('加载角色数据失败')).toBeNull();
  });
});
