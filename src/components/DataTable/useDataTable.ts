import {
  createExpandedRowModel,
  stockFeatures,
  tableFeatures,
  useTable,
  type ColumnDef,
  type RowData,
  type StockFeatures,
} from '@tanstack/react-table';

export const dataTableFeatures = tableFeatures({
  ...stockFeatures,
  expandedRowModel: createExpandedRowModel(),
});

export type DataTableFeatures = typeof dataTableFeatures;

export interface UseDataTableOptions<T extends RowData> {
  columns: ColumnDef<StockFeatures, T>[];
  data: T[];
  getRowId: (row: T) => string;
  getSubRows?: (row: T) => T[] | undefined;
  pinnedEndColumnIds?: string[];
  pagination?:
    | false
    | {
        pageNum: number;
        pageSize: number;
        total: number;
        onPageChange: (page: number, size: number) => void;
        pageSizeOptions?: number[];
        showSizeChanger?: boolean;
      };
}

export function useDataTable<T extends RowData>({
  columns,
  data,
  getRowId,
  getSubRows,
  pinnedEndColumnIds,
  pagination,
}: UseDataTableOptions<T>) {
  const isPaginationEnabled = Boolean(pagination);
  const pageNum = pagination ? pagination.pageNum : 1;
  const pageSize = pagination ? pagination.pageSize : 10;
  const total = pagination ? pagination.total : data.length;
  const pageIndex = Math.max(0, pageNum - 1);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const table = useTable<DataTableFeatures, T>({
    features: dataTableFeatures,
    data,
    columns: columns as unknown as ColumnDef<DataTableFeatures, T>[],
    getRowId,
    getSubRows: getSubRows ? (row) => getSubRows(row) : undefined,
    initialState: {
      expanded: true,
      columnPinning: pinnedEndColumnIds
        ? {
            start: [],
            end: pinnedEndColumnIds,
          }
        : undefined,
      pagination: isPaginationEnabled
        ? {
            pageIndex,
            pageSize,
          }
        : undefined,
    },
    state: isPaginationEnabled
      ? {
          pagination: {
            pageIndex,
            pageSize,
          },
        }
      : undefined,
    onPaginationChange:
      isPaginationEnabled && pagination
        ? (updater) => {
            const current = { pageIndex, pageSize };
            const next = typeof updater === 'function' ? updater(current) : updater;
            pagination.onPageChange(next.pageIndex + 1, next.pageSize);
          }
        : undefined,
    manualPagination: isPaginationEnabled,
    pageCount: isPaginationEnabled ? pageCount : undefined,
    rowCount: isPaginationEnabled ? total : undefined,
    autoResetPageIndex: false,
  });

  return table;
}
