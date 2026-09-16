import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import {
  DataTable,
  useDataTable,
  type ColumnDef,
  type StockFeatures,
} from '@/components/DataTable';

interface TestItem {
  id: string;
  name: string;
  role: string;
  children?: TestItem[];
}

const testColumns: ColumnDef<StockFeatures, TestItem>[] = [
  {
    accessorKey: 'name',
    header: '名称',
    id: 'name',
  },
  {
    accessorKey: 'role',
    header: '角色',
    id: 'role',
  },
  {
    id: 'actions',
    header: '操作',
    cell: () => <button type="button">编辑</button>,
  },
];

const sampleData: TestItem[] = [
  { id: '1', name: '张三', role: '管理员' },
  { id: '2', name: '李四', role: '开发者' },
  { id: '3', name: '王五', role: '访客' },
];

describe('DataTable 数据表格组件', () => {
  it('1. 分页回调收到 1-based page（onPageChange 断言）', () => {
    const onPageChange = vi.fn();
    render(
      <DataTable<TestItem>
        columns={testColumns}
        data={sampleData}
        getRowId={(row) => row.id}
        pagination={{
          pageNum: 1,
          pageSize: 10,
          total: 30,
          onPageChange,
        }}
      />,
    );

    // 点击第 2 页按钮（Base UI Button with nativeButton=false renders role="button"）
    const page2Btn = screen.getByRole('button', { name: '2' });
    fireEvent.click(page2Btn);
    expect(onPageChange).toHaveBeenCalledWith(2, 10);

    // 点击「下一页」
    const nextBtn = screen.getByRole('button', { name: 'Go to next page' });
    fireEvent.click(nextBtn);
    expect(onPageChange).toHaveBeenCalledWith(2, 10);
  });

  it('2. pageSize 切换回调收到 1-based page 与新 size', () => {
    const onPageChange = vi.fn();

    function TestComponent() {
      const table = useDataTable<TestItem>({
        columns: testColumns,
        data: sampleData,
        getRowId: (row) => row.id,
        pagination: {
          pageNum: 3,
          pageSize: 10,
          total: 100,
          onPageChange,
        },
      });

      return (
        <div>
          <button type="button" data-testid="change-size-btn" onClick={() => table.setPageSize(20)}>
            切换为20
          </button>
        </div>
      );
    }

    render(<TestComponent />);

    const changeBtn = screen.getByTestId('change-size-btn');
    fireEvent.click(changeBtn);

    // 在 TanStack Table 驱动下，setPageSize 触发 onPaginationChange，换算为 1-based page
    expect(onPageChange).toHaveBeenCalledTimes(1);
    const [page, size] = onPageChange.mock.calls[0];
    expect(size).toBe(20);
    expect(page).toBeGreaterThanOrEqual(1);
  });

  it('3. 「共 N 条」文案正确渲染', () => {
    render(
      <DataTable<TestItem>
        columns={testColumns}
        data={sampleData}
        getRowId={(row) => row.id}
        pagination={{
          pageNum: 1,
          pageSize: 10,
          total: 42,
          onPageChange: vi.fn(),
        }}
      />,
    );

    expect(screen.getByText('共 42 条')).toBeInTheDocument();
  });

  it('4. 层级行默认展开且能收起与再展开', () => {
    const hierarchicalData: TestItem[] = [
      {
        id: 'p-1',
        name: '父级菜单',
        role: '目录',
        children: [{ id: 'c-1', name: '子级按钮', role: '按钮' }],
      },
    ];

    render(
      <DataTable<TestItem>
        columns={testColumns}
        data={hierarchicalData}
        getRowId={(row) => row.id}
        getSubRows={(row) => row.children}
      />,
    );

    // initialState.expanded = true 默认全展开
    expect(screen.getByText('父级菜单')).toBeInTheDocument();
    expect(screen.getByText('子级按钮')).toBeInTheDocument();

    // 点击收起
    const collapseBtn = screen.getByRole('button', { name: '折叠' });
    fireEvent.click(collapseBtn);
    expect(screen.queryByText('子级按钮')).not.toBeInTheDocument();

    // 点击再次展开
    const expandBtn = screen.getByRole('button', { name: '展开' });
    fireEvent.click(expandBtn);
    expect(screen.getByText('子级按钮')).toBeInTheDocument();
  });

  it('5. 固定列单元格带 sticky end-0 且带实心背景类', () => {
    const { container } = render(
      <DataTable<TestItem>
        columns={testColumns}
        data={sampleData}
        getRowId={(row) => row.id}
        pinnedEndColumnIds={['actions']}
        scrollX={1200}
      />,
    );

    // 固定表头
    const actionHeader = screen.getByText('操作').closest('th');
    expect(actionHeader).toBeInTheDocument();
    expect(actionHeader).toHaveClass('sticky');
    expect(actionHeader).toHaveClass('end-0');
    expect(actionHeader).toHaveClass('bg-background');

    // 固定单元格（至少有一个数据行的操作列）
    const pinnedCells = container.querySelectorAll('td.sticky.end-0.bg-background');
    expect(pinnedCells.length).toBeGreaterThanOrEqual(1);
  });

  it('6. loading 时渲染 skeleton 骨架屏且不渲染真实数据', () => {
    const { container } = render(
      <DataTable<TestItem>
        columns={testColumns}
        data={sampleData}
        getRowId={(row) => row.id}
        loading={true}
      />,
    );

    // 渲染 5 行 skeleton 占位
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(5 * testColumns.length);

    // 数据未呈现
    expect(screen.queryByText('张三')).not.toBeInTheDocument();
  });

  it('7. 无数据时渲染 emptyText（默认与自定义）', () => {
    const { rerender } = render(
      <DataTable<TestItem> columns={testColumns} data={[]} getRowId={(row) => row.id} />,
    );

    // 默认「暂无数据」
    expect(screen.getByText('暂无数据')).toBeInTheDocument();

    // 自定义 emptyText
    rerender(
      <DataTable<TestItem>
        columns={testColumns}
        data={[]}
        getRowId={(row) => row.id}
        emptyText="未查找到任何匹配项"
      />,
    );
    expect(screen.getByText('未查找到任何匹配项')).toBeInTheDocument();
  });
});
