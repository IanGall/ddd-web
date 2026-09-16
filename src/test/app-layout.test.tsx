import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from '@/layout/AppLayout';
import { useAuthStore } from '@/store/auth';

// Mock window.matchMedia for Ant Design in jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

vi.mock('@/api/auth', () => ({
  authApi: {
    logout: vi.fn().mockResolvedValue(null),
  },
}));

const allPermissions = [
  'rbac:user:read',
  'rbac:role:read',
  'rbac:permission:read',
  'rbac:channel-credential:read',
];

function renderAppLayout(initialPath = '/dashboard') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route path="dashboard" element={<div>控制台概览内容</div>} />
          <Route path="sessions" element={<div>会话管理内容</div>} />
          <Route path="rbac/users" element={<div>用户列表内容</div>} />
          <Route path="rbac/roles" element={<div>角色列表内容</div>} />
          <Route path="rbac/permissions" element={<div>权限列表内容</div>} />
          <Route path="platform/channel-credentials" element={<div>渠道凭证内容</div>} />
        </Route>
        <Route path="/login" element={<div>登录页</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AppLayout 布局与菜单交互', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().clear();
  });

  it('1. 渲染后侧栏用户卡显示 username 与角色文案（主管理员/子账号）', () => {
    // 验证主管理员
    useAuthStore.setState({
      username: '超级管理员',
      userType: 'ADMIN_PRIMARY',
      permissionCodes: allPermissions,
    });

    const { unmount } = renderAppLayout();
    expect(screen.getByText('超级管理员')).toBeInTheDocument();
    expect(screen.getByText('主管理员')).toBeInTheDocument();
    expect(screen.getByText('Admin Console')).toBeInTheDocument();
    expect(screen.getByText('DDD PLATFORM')).toBeInTheDocument();

    unmount();
    cleanup();

    // 验证子账号
    useAuthStore.setState({
      username: 'operator',
      userType: 'ADMIN_SUB',
      permissionCodes: allPermissions,
    });

    renderAppLayout();
    expect(screen.getByText('operator')).toBeInTheDocument();
    expect(screen.getByText('子账号')).toBeInTheDocument();
  });

  it('2. 有权限时全部菜单项可见（含分组与叶子）', () => {
    useAuthStore.setState({
      username: 'admin',
      userType: 'ADMIN_PRIMARY',
      permissionCodes: allPermissions,
    });

    renderAppLayout();

    // 验证分组标签渲染
    expect(screen.getByText('RBAC 权限管理')).toBeInTheDocument();
    expect(screen.getByText('平台凭证')).toBeInTheDocument();

    // 验证叶子菜单项渲染
    expect(screen.getByText('控制台概览')).toBeInTheDocument();
    expect(screen.getByText('用户管理')).toBeInTheDocument();
    expect(screen.getByText('角色管理')).toBeInTheDocument();
    expect(screen.getByText('权限项管理')).toBeInTheDocument();
    expect(screen.getByText('渠道凭证管理')).toBeInTheDocument();
    expect(screen.getByText('我的会话')).toBeInTheDocument();
  });

  it('3. 搜索「角色管理」后只剩该项（「用户管理」「权限项管理」等消失）', () => {
    useAuthStore.setState({
      username: 'admin',
      userType: 'ADMIN_PRIMARY',
      permissionCodes: allPermissions,
    });

    renderAppLayout();

    const searchInput = screen.getByPlaceholderText('搜索菜单');
    fireEvent.change(searchInput, { target: { value: '角色管理' } });

    // 命中项及其分组保留
    expect(screen.getByText('角色管理')).toBeInTheDocument();
    expect(screen.getByText('RBAC 权限管理')).toBeInTheDocument();

    // 未命中项消失
    expect(screen.queryByText('用户管理')).toBeNull();
    expect(screen.queryByText('权限项管理')).toBeNull();
    expect(screen.queryByText('控制台概览')).toBeNull();
    expect(screen.queryByText('平台凭证')).toBeNull();
    expect(screen.queryByText('渠道凭证管理')).toBeNull();
  });

  it('4. 无 rbac:user:read 权限时，搜索「用户管理」不出现该词（越权不因命中而泄露）', () => {
    // 仅配置角色查看权限，不具备 rbac:user:read 权限
    useAuthStore.setState({
      username: 'admin',
      userType: 'ADMIN_SUB',
      permissionCodes: ['rbac:role:read'],
    });

    renderAppLayout();

    const searchInput = screen.getByPlaceholderText('搜索菜单');
    fireEvent.change(searchInput, { target: { value: '用户管理' } });

    // 用户管理项不可见，其所在分组也因为无匹配子项而隐藏
    expect(screen.queryByText('用户管理')).toBeNull();
    expect(screen.queryByText('RBAC 权限管理')).toBeNull();
  });

  it('5. 清空关键字后菜单恢复（菜单项数量回到初始）', () => {
    useAuthStore.setState({
      username: 'admin',
      userType: 'ADMIN_PRIMARY',
      permissionCodes: allPermissions,
    });

    renderAppLayout();

    const searchInput = screen.getByPlaceholderText('搜索菜单');

    // 先搜索收敛
    fireEvent.change(searchInput, { target: { value: '角色管理' } });
    expect(screen.queryByText('用户管理')).toBeNull();
    expect(screen.queryByText('平台凭证')).toBeNull();

    // 清空关键字恢复
    fireEvent.change(searchInput, { target: { value: '' } });

    expect(screen.getByText('控制台概览')).toBeInTheDocument();
    expect(screen.getByText('RBAC 权限管理')).toBeInTheDocument();
    expect(screen.getByText('用户管理')).toBeInTheDocument();
    expect(screen.getByText('角色管理')).toBeInTheDocument();
    expect(screen.getByText('权限项管理')).toBeInTheDocument();
    expect(screen.getByText('平台凭证')).toBeInTheDocument();
    expect(screen.getByText('渠道凭证管理')).toBeInTheDocument();
  });

  it('6. 关键字的空格与大小写被容忍（例如 "  rbac  " 仍能命中分组）', () => {
    useAuthStore.setState({
      username: 'admin',
      userType: 'ADMIN_PRIMARY',
      permissionCodes: allPermissions,
    });

    renderAppLayout();

    const searchInput = screen.getByPlaceholderText('搜索菜单');
    fireEvent.change(searchInput, { target: { value: '  rbac  ' } });

    // 容忍前后空格及小写，命中 RBAC 权限管理分组及旗下已授权子项
    expect(screen.getByText('RBAC 权限管理')).toBeInTheDocument();
    expect(screen.getByText('用户管理')).toBeInTheDocument();
    expect(screen.getByText('角色管理')).toBeInTheDocument();
    expect(screen.getByText('权限项管理')).toBeInTheDocument();

    // 未命中项不显示
    expect(screen.queryByText('平台凭证')).toBeNull();
    expect(screen.queryByText('渠道凭证管理')).toBeNull();
    expect(screen.queryByText('控制台概览')).toBeNull();
  });
});
