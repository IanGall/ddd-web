import React, { useCallback, useMemo, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { LayoutDashboard, Monitor } from 'lucide-react';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { usePermission } from '@/hooks/usePermission';
import type { DomainMenuItem } from '@/layout/menuFilter';
import { collectGroupKeys, filterMenuItems } from '@/layout/menuFilter';
import { AppSidebar } from '@/layout/AppSidebar';
import { HeaderBar } from '@/layout/HeaderBar';

interface DomainModule {
  menuItems?: DomainMenuItem[];
}

// 自动收集各域模块菜单定义（如 rbac.tsx, channel.tsx 等），避免硬编码与直接 import 未落盘文件
const domainModuleFiles = import.meta.glob<DomainModule>('../router/modules/*.tsx', {
  eager: true,
});

export const AppLayout: React.FC = () => {
  const { hasPermission } = usePermission();

  // 合并内置菜单项与各域模块收集的 menuItems
  const allMenuItems: DomainMenuItem[] = useMemo(() => {
    const domainMenuItems: DomainMenuItem[] = Object.entries(domainModuleFiles)
      .sort(([pathA], [pathB]) => {
        // RBAC 权限管理优先排在前列，其余按字典序
        if (pathA.includes('rbac')) return -1;
        if (pathB.includes('rbac')) return 1;
        return pathA.localeCompare(pathB);
      })
      .flatMap(([_, mod]) => mod.menuItems || []);

    return [
      {
        key: '/dashboard',
        label: '控制台概览',
        icon: <LayoutDashboard />,
      },
      ...domainMenuItems,
      {
        key: '/sessions',
        label: '我的会话',
        icon: <Monitor />,
      },
    ];
  }, []);

  const [keyword, setKeyword] = useState('');
  const [openKeys, setOpenKeys] = useState<string[]>(() => collectGroupKeys(allMenuItems));

  const filteredItems = useMemo(
    () => filterMenuItems(allMenuItems, keyword, hasPermission),
    [allMenuItems, keyword, hasPermission],
  );

  const effectiveOpenKeys = useMemo(
    () => (keyword.trim() !== '' ? collectGroupKeys(filteredItems) : openKeys),
    [keyword, filteredItems, openKeys],
  );

  const handleOpenKeysChange = useCallback(
    (keys: string[]) => {
      if (keyword.trim() === '') {
        setOpenKeys(keys);
      }
    },
    [keyword],
  );

  return (
    <SidebarProvider
      defaultOpen
      className="h-svh overflow-hidden"
      style={
        {
          '--sidebar-width': '260px',
        } as React.CSSProperties
      }
    >
      <AppSidebar
        items={filteredItems}
        openKeys={effectiveOpenKeys}
        onOpenKeysChange={handleOpenKeysChange}
      />
      <SidebarInset className="h-svh min-h-0 overflow-hidden">
        <HeaderBar keyword={keyword} onKeywordChange={setKeyword} />
        <main className="min-h-0 flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
};
