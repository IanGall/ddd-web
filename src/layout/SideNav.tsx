import React from 'react';
import { ConfigProvider, Layout, Menu, theme } from 'antd';
import type { MenuProps } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { SIDE_MENU_TOKENS } from '@/theme';
import type { DomainMenuItem } from './menuFilter';
import { collectGroupKeys } from './menuFilter';
import { BrandBlock } from './BrandBlock';
import { SideUserCard } from './SideUserCard';

export interface SideNavProps {
  items: MenuProps['items'];
  filteredItems: readonly DomainMenuItem[];
  keyword: string;
  openKeys: string[];
  onOpenKeysChange: (keys: string[]) => void;
}

export const SideNav: React.FC<SideNavProps> = ({
  items,
  filteredItems,
  keyword,
  openKeys,
  onOpenKeysChange,
}) => {
  const { token } = theme.useToken();
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <Layout.Sider
      width={260}
      theme="light"
      className="border-r"
      style={{ borderColor: token.colorBorderSecondary }}
    >
      <div className="flex h-full flex-col">
        <BrandBlock />
        <div className="flex-1 overflow-y-auto py-2">
          <ConfigProvider theme={{ components: { Menu: SIDE_MENU_TOKENS } }}>
            <Menu
              mode="inline"
              items={items}
              selectedKeys={[location.pathname]}
              openKeys={keyword.trim() !== '' ? collectGroupKeys(filteredItems) : openKeys}
              onOpenChange={(keys) => {
                if (keyword.trim() === '') {
                  onOpenKeysChange(keys as string[]);
                }
              }}
              inlineIndent={20}
              style={{ borderRight: 0 }}
              onClick={({ key }) => {
                if (String(key).startsWith('/')) {
                  navigate(String(key));
                }
              }}
            />
          </ConfigProvider>
        </div>
        <SideUserCard />
      </div>
    </Layout.Sider>
  );
};
