export type CsvCellValue = string | number | boolean | null | undefined;

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => CsvCellValue;
}

interface PagedRows<T> {
  rows: T[];
  total: number;
}

function protectSpreadsheetFormula(value: CsvCellValue) {
  if (typeof value !== "string") {
    return value;
  }

  return /^\s*[=+\-@]/.test(value) ? `'${value}` : value;
}

function escapeCsvCell(value: CsvCellValue) {
  const safeValue = protectSpreadsheetFormula(value);
  const text = safeValue == null ? "" : String(safeValue);

  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function buildCsv<T>(rows: T[], columns: CsvColumn<T>[]) {
  const header = columns.map((column) => escapeCsvCell(column.header)).join(",");
  const body = rows.map((row) => columns.map((column) => escapeCsvCell(column.value(row))).join(","));

  return `\ufeff${[header, ...body].join("\r\n")}`;
}

export function downloadCsv<T>(filename: string, rows: T[], columns: CsvColumn<T>[]) {
  const blob = new Blob([buildCsv(rows, columns)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function csvNumber(value: number | string | null | undefined): number | "" {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : "";
}

export function csvDateTime(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("en-PK");
}

export function csvFilename(prefix: string, suffix?: string) {
  const date = new Date().toLocaleDateString("en-CA");
  const detail = suffix?.trim().replace(/[^a-zA-Z0-9_-]+/g, "-");

  return `${prefix}${detail ? `-${detail}` : ""}-${date}.csv`;
}

export async function fetchAllRows<T>(
  fetchPage: (page: number) => Promise<PagedRows<T>>,
  pageSize = 50
) {
  const firstPage = await fetchPage(1);
  const total = Math.max(0, Number(firstPage.total) || 0);
  const rows = [...(firstPage.rows || [])];

  for (let page = 2; rows.length < total; page += 1) {
    const nextPage = await fetchPage(page);

    if (!nextPage.rows?.length) {
      break;
    }

    rows.push(...nextPage.rows);

    if (nextPage.rows.length < pageSize) {
      break;
    }
  }

  return rows.slice(0, total);
}
