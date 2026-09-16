import React from 'react';
import { cn } from 'cn';
import {
  flexRender,
  type ColumnDef,
  type RowData,
  type StockFeatures,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronRightIcon } from 'lucide-react';
import { useDataTable } from './useDataTable';

export * from './cells';
export * from './useDataTable';
export type { ColumnDef, StockFeatures, RowData } from '@tanstack/react-table';

export interface DataTableProps<T extends RowData> {
  columns: ColumnDef<StockFeatures, T>[];
  data: T[];
  loading?: boolean;
  getRowId: (row: T) => string; // 行唯一标识，替代原 rowKey
  getSubRows?: (row: T) => T[] | undefined; // permissions 页的层级行
  emptyText?: React.ReactNode;
  scrollX?: number; // channel 页用 1200
  pinnedEndColumnIds?: string[]; // channel 页操作列
  pagination?:
    | false
    | {
        pageNum: number;
        pageSize: number;
        total: number;
        onPageChange: (page: number, size: number) => void; // 收到 1-based page
        pageSizeOptions?: number[];
        showSizeChanger?: boolean;
      };
  className?: string;
}

function getPageItems(
  current: number,
  total: number,
): (number | 'ellipsis-start' | 'ellipsis-end')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 4) {
    return [1, 2, 3, 4, 5, 'ellipsis-end', total];
  }
  if (current >= total - 3) {
    return [1, 'ellipsis-start', total - 4, total - 3, total - 2, total - 1, total];
  }
  return [1, 'ellipsis-start', current - 1, current, current + 1, 'ellipsis-end', total];
}

export function DataTable<T extends RowData>({
  columns,
  data,
  loading = false,
  getRowId,
  getSubRows,
  emptyText = '暂无数据',
  scrollX,
  pinnedEndColumnIds,
  pagination,
  className,
}: DataTableProps<T>) {
  const table = useDataTable<T>({
    columns,
    data,
    getRowId,
    getSubRows,
    pinnedEndColumnIds,
    pagination,
  });

  const pageNum = pagination ? pagination.pageNum : 1;
  const pageSize = pagination ? pagination.pageSize : 10;
  const total = pagination ? pagination.total : data.length;
  const pageSizeOptions =
    pagination && pagination.pageSizeOptions ? pagination.pageSizeOptions : [10, 20, 50, 100];
  const showSizeChanger =
    pagination && pagination.showSizeChanger !== undefined ? pagination.showSizeChanger : true;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageItems = getPageItems(pageNum, totalPages);

  const visibleLeafColumns = table.getVisibleLeafColumns();

  return (
    <div className={cn('w-full space-y-4', className)}>
      <Table style={scrollX ? { minWidth: scrollX } : undefined}>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const isPinnedEnd =
                  header.column.getIsPinned() === 'end' ||
                  Boolean(pinnedEndColumnIds?.includes(header.column.id));
                return (
                  <TableHead
                    key={header.id}
                    className={cn(isPinnedEnd && 'sticky end-0 z-20 bg-background')}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 5 }).map((_, rowIndex) => (
              <TableRow key={`skeleton-row-${rowIndex}`}>
                {visibleLeafColumns.map((col, colIndex) => {
                  const isPinnedEnd =
                    col.getIsPinned() === 'end' || Boolean(pinnedEndColumnIds?.includes(col.id));
                  return (
                    <TableCell
                      key={`skeleton-cell-${colIndex}`}
                      className={cn(isPinnedEnd && 'sticky end-0 bg-background')}
                    >
                      <Skeleton className="h-5 w-full max-w-[120px]" />
                    </TableCell>
                  );
                })}
              </TableRow>
            ))
          ) : table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={visibleLeafColumns.length || columns.length}
                className="h-32 text-center text-muted-foreground"
              >
                {emptyText}
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell, cellIndex) => {
                  const isPinnedEnd =
                    cell.column.getIsPinned() === 'end' ||
                    Boolean(pinnedEndColumnIds?.includes(cell.column.id));
                  const isFirstCell = cellIndex === 0;
                  const canExpand = row.getCanExpand();
                  const isExpanded = row.getIsExpanded();

                  return (
                    <TableCell
                      key={cell.id}
                      className={cn(isPinnedEnd && 'sticky end-0 z-10 bg-background')}
                    >
                      {isFirstCell && getSubRows ? (
                        <div
                          className="flex items-center"
                          style={{ paddingLeft: `${row.depth * 1.5}rem` }}
                        >
                          {canExpand ? (
                            <button
                              type="button"
                              aria-label={isExpanded ? '折叠' : '展开'}
                              onClick={row.getToggleExpandedHandler()}
                              className="mr-1.5 flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted"
                            >
                              <ChevronRightIcon
                                className={cn(
                                  'size-3.5 transition-transform duration-150',
                                  isExpanded && 'rotate-90',
                                )}
                              />
                            </button>
                          ) : (
                            <span
                              className="mr-1.5 inline-block size-5 shrink-0"
                              aria-hidden="true"
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </div>
                        </div>
                      ) : (
                        flexRender(cell.column.columnDef.cell, cell.getContext())
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {pagination && (
        <div className="flex flex-wrap items-center justify-between gap-4 py-4">
          <div className="text-sm text-muted-foreground">共 {pagination.total} 条</div>
          <div className="flex items-center gap-4">
            {showSizeChanger && (
              <div className="flex items-center gap-2">
                <Select
                  value={String(pageSize)}
                  onValueChange={(val) => {
                    if (val) {
                      pagination.onPageChange(1, Number(val));
                    }
                  }}
                >
                  <SelectTrigger size="sm" className="h-8 w-28" aria-label="每页条数">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {pageSizeOptions.map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {size} 条/页
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Pagination className="mx-0 w-auto">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    text="上一页"
                    onClick={(e) => {
                      e.preventDefault();
                      if (pageNum > 1) {
                        pagination.onPageChange(pageNum - 1, pageSize);
                      }
                    }}
                    aria-disabled={pageNum <= 1}
                    className={cn(pageNum <= 1 && 'pointer-events-none opacity-50')}
                  />
                </PaginationItem>
                {pageItems.map((item, idx) => {
                  if (typeof item === 'string') {
                    return (
                      <PaginationItem key={`${item}-${idx}`}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    );
                  }
                  return (
                    <PaginationItem key={item}>
                      <PaginationLink
                        href="#"
                        isActive={item === pageNum}
                        onClick={(e) => {
                          e.preventDefault();
                          if (item !== pageNum) {
                            pagination.onPageChange(item, pageSize);
                          }
                        }}
                      >
                        {item}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    text="下一页"
                    onClick={(e) => {
                      e.preventDefault();
                      if (pageNum < totalPages) {
                        pagination.onPageChange(pageNum + 1, pageSize);
                      }
                    }}
                    aria-disabled={pageNum >= totalPages}
                    className={cn(pageNum >= totalPages && 'pointer-events-none opacity-50')}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </div>
      )}
    </div>
  );
}
