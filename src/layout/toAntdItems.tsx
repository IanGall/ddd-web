import type { MenuProps } from 'antd';
import type { DomainMenuItem } from './menuFilter';
import { MenuGroupLabel } from './MenuGroupLabel';

export function toAntdItems(items: readonly DomainMenuItem[]): MenuProps['items'] {
  return items.map((item) => {
    if (item.children && item.children.length > 0) {
      return {
        key: item.key,
        label: <MenuGroupLabel>{item.label}</MenuGroupLabel>,
        children: toAntdItems(item.children),
      };
    }
    return {
      key: item.key,
      label: item.label,
      icon: item.icon,
    };
  });
}
