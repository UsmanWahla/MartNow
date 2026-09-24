import { useMemo, useState, type ReactNode } from "react";
import Pagination from "./Pagination";
import { IconSort, IconSortDown, IconSortUp } from "./icons";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  sortable?: boolean;
  sortValue?: (row: T) => string | number;
  render?: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  rows: T[];
  columns: DataTableColumn<T>[];
  rowKey: (row: T) => string | number;
  emptyMessage: string;
  pageSize?: number;
  filterKey?: string;
  loading?: boolean;
  total?: number;
  page?: number;
  onPageChange?: (page: number) => void;
}

function compareValues(left: string | number, right: string | number) {
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }

  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function DataTable<T>({
  rows = [],
  columns,
  rowKey,
  emptyMessage,
  pageSize = 5,
  filterKey,
  loading = false,
  total,
  page: pageProp,
  onPageChange,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [pageState, setPageState] = useState({ filterKey, page: 1 });
  const serverPaged = typeof total === "number" && typeof onPageChange === "function";
  const page = serverPaged
    ? pageProp ?? 1
    : pageState.filterKey === filterKey
      ? pageState.page
      : 1;

  function setPage(nextPage: number) {
    if (serverPaged) {
      onPageChange(nextPage);
      return;
    }

    setPageState({ filterKey, page: nextPage });
  }

  function toggleSort(column: DataTableColumn<T>) {
    if (!column.sortable) {
      return;
    }

    if (sortKey === column.key) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(column.key);
      setSortDir("asc");
    }

    setPage(1);
  }

  const sortedRows = useMemo(() => {
    if (!sortKey) {
      return rows;
    }

    const column = columns.find((item) => item.key === sortKey);

    if (!column?.sortValue) {
      return rows;
    }

    return [...rows].sort((left, right) => {
      const result = compareValues(column.sortValue!(left), column.sortValue!(right));
      return sortDir === "asc" ? result : -result;
    });
  }, [columns, rows, sortDir, sortKey]);

  const pageCount = Math.max(
    1,
    Math.ceil((serverPaged ? total : sortedRows.length) / pageSize)
  );
  const currentPage = Math.min(page, pageCount);
  const visibleRows = serverPaged
    ? sortedRows
    : sortedRows.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
      );

  if (loading) {
    return (
      <div className="space-y-2" aria-busy="true">
        {Array.from({ length: 5 }, (_, index) => (
          <div
            key={index}
            className="h-12 animate-pulse rounded-xl bg-slate-100"
          />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-(--hairline) bg-[#f8fbfa] px-4 py-8 text-center text-sm text-slate-500">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-(--hairline)">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-(--hairline) bg-[#f4faf8] text-slate-600">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="px-3 py-3 first:pl-4 last:min-w-14 last:pr-4 last:text-right"
                  aria-sort={
                    column.sortable && sortKey === column.key
                      ? sortDir === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  {column.sortable ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 font-semibold text-slate-600 transition-colors duration-150 hover:text-teal-800"
                      onClick={() => toggleSort(column)}
                    >
                      {column.header}
                      {sortKey === column.key ? (
                        sortDir === "asc" ? (
                          <IconSortUp className="h-3.5 w-3.5 text-teal-700" />
                        ) : (
                          <IconSortDown className="h-3.5 w-3.5 text-teal-700" />
                        )
                      ) : (
                        <IconSort className="h-3.5 w-3.5 text-slate-300" />
                      )}
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr
                key={rowKey(row)}
                className="border-b border-slate-100 last:border-b-0 transition-colors duration-150 hover:bg-teal-50/50"
              >
                {columns.map((column) => (
                  <td key={column.key} className="px-3 py-3 first:pl-4 last:min-w-14 last:pr-4 last:text-right">
                    {column.render
                      ? column.render(row)
                      : column.sortValue
                        ? column.sortValue(row)
                        : null}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        page={currentPage}
        pageCount={pageCount}
        onPageChange={setPage}
      />
    </div>
  );
}

export default DataTable;
