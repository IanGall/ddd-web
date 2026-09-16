import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from 'cn';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { DomainMenuItem } from './menuFilter';
import { BrandBlock } from './BrandBlock';
import { SideUserCard } from './SideUserCard';
import { MenuGroupLabel } from './MenuGroupLabel';

export interface AppSidebarProps {
  items: readonly DomainMenuItem[];
  openKeys: string[];
  onOpenKeysChange: (keys: string[]) => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({ items, openKeys, onOpenKeysChange }) => {
  const { setOpenMobile } = useSidebar();
  const location = useLocation();
  const pathname = location.pathname;

  const handleGroupToggle = (key: string, open: boolean) => {
    if (open) {
      if (!openKeys.includes(key)) {
        onOpenKeysChange([...openKeys, key]);
      }
    } else {
      onOpenKeysChange(openKeys.filter((k) => k !== key));
    }
  };

  const renderSubItem = (item: DomainMenuItem): React.ReactNode => {
    if (item.children && item.children.length > 0) {
      const isOpen = openKeys.includes(item.key);
      return (
        <Collapsible
          key={item.key}
          open={isOpen}
          onOpenChange={(open) => handleGroupToggle(item.key, open)}
          className="group/collapsible"
        >
          <SidebarMenuSubItem>
            <CollapsibleTrigger
              render={
                <SidebarMenuSubButton className="flex w-full cursor-pointer items-center justify-between" />
              }
            >
              <span className="flex items-center gap-2 truncate">
                {item.icon}
                <span>{item.label}</span>
              </span>
              <ChevronRight
                className={cn(
                  'size-3.5 shrink-0 text-muted-foreground transition-transform duration-200',
                  isOpen && 'rotate-90',
                )}
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub>{item.children.map((child) => renderSubItem(child))}</SidebarMenuSub>
            </CollapsibleContent>
          </SidebarMenuSubItem>
        </Collapsible>
      );
    }

    return (
      <SidebarMenuSubItem key={item.key}>
        <SidebarMenuSubButton
          render={<Link to={item.key} />}
          isActive={pathname === item.key}
          onClick={() => setOpenMobile(false)}
        >
          {item.icon}
          <span>{item.label}</span>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
    );
  };

  const renderMenuItem = (item: DomainMenuItem): React.ReactNode => {
    if (item.children && item.children.length > 0) {
      const isOpen = openKeys.includes(item.key);
      return (
        <Collapsible
          key={item.key}
          open={isOpen}
          onOpenChange={(open) => handleGroupToggle(item.key, open)}
          className="group/collapsible"
        >
          <SidebarMenuItem>
            <CollapsibleTrigger
              render={
                <SidebarMenuButton className="flex w-full cursor-pointer items-center justify-between" />
              }
            >
              <span className="flex items-center gap-2 truncate">
                {item.icon}
                <span>{item.label}</span>
              </span>
              <ChevronRight
                className={cn(
                  'size-3.5 shrink-0 text-muted-foreground transition-transform duration-200',
                  isOpen && 'rotate-90',
                )}
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub>{item.children.map((child) => renderSubItem(child))}</SidebarMenuSub>
            </CollapsibleContent>
          </SidebarMenuItem>
        </Collapsible>
      );
    }

    return (
      <SidebarMenuItem key={item.key}>
        <SidebarMenuButton
          render={<Link to={item.key} />}
          isActive={pathname === item.key}
          onClick={() => setOpenMobile(false)}
        >
          {item.icon}
          <span>{item.label}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="p-0">
        <BrandBlock />
      </SidebarHeader>
      <SidebarContent>
        {items.map((item) => {
          if (item.children && item.children.length > 0) {
            const isOpen = openKeys.includes(item.key);
            return (
              <Collapsible
                key={item.key}
                open={isOpen}
                onOpenChange={(open) => handleGroupToggle(item.key, open)}
                className="group/collapsible"
              >
                <SidebarGroup>
                  <SidebarGroupLabel>
                    <CollapsibleTrigger
                      type="button"
                      className="flex w-full cursor-pointer items-center justify-between outline-none"
                    >
                      <MenuGroupLabel>{item.label}</MenuGroupLabel>
                      <ChevronRight
                        className={cn(
                          'size-3.5 shrink-0 text-muted-foreground transition-transform duration-200',
                          isOpen && 'rotate-90',
                        )}
                      />
                    </CollapsibleTrigger>
                  </SidebarGroupLabel>
                  <CollapsibleContent>
                    <SidebarMenu>{item.children.map((child) => renderMenuItem(child))}</SidebarMenu>
                  </CollapsibleContent>
                </SidebarGroup>
              </Collapsible>
            );
          }

          return (
            <SidebarGroup key={item.key} className="py-1">
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    render={<Link to={item.key} />}
                    isActive={pathname === item.key}
                    onClick={() => setOpenMobile(false)}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
      <SidebarFooter className="p-0">
        <SideUserCard />
      </SidebarFooter>
    </Sidebar>
  );
};
