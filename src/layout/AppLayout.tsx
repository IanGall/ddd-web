import React, { useMemo, useState } from 'react';
import { Layout } from 'antd';
import { DashboardOutlined, DesktopOutlined } from '@ant-design/icons';
import { Outlet } from 'react-router-dom';
import { usePermission } from '@/hooks/usePermission';
import type { DomainMenuItem } from '@/layout/menuFilter';
import { collectGroupKeys, filterMenuItems } from '@/layout/menuFilter';
import { toAntdItems } from '@/layout/toAntdItems';
import { SideNav } from '@/layout/SideNav';
import { HeaderBar } from '@/layout/HeaderBar';

const { Content } = Layout;

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
        icon: <DashboardOutlined />,
      },
      ...domainMenuItems,
      {
        key: '/sessions',
        label: '我的会话',
        icon: <DesktopOutlined />,
      },
    ];
  }, []);

  const [keyword, setKeyword] = useState('');
  const [openKeys, setOpenKeys] = useState<string[]>(() => collectGroupKeys(allMenuItems));

  const filteredItems = useMemo(
    () => filterMenuItems(allMenuItems, keyword, hasPermission),
    [allMenuItems, keyword, hasPermission],
  );

  const antdItems = useMemo(() => toAntdItems(filteredItems), [filteredItems]);

  return (
    <Layout className="min-h-screen">
      <SideNav
        items={antdItems}
        filteredItems={filteredItems}
        keyword={keyword}
        openKeys={openKeys}
        onOpenKeysChange={setOpenKeys}
      />
      <Layout>
        <HeaderBar keyword={keyword} onKeywordChange={setKeyword} />
        <Content className="p-6">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};
