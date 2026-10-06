import type { ReportRange, ReportVariantStock } from "../types";
import { formatQuantity } from "../productUnits";

export function reportDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function currentMonthRange(): ReportRange {
  const now = new Date();
  return {
    from: reportDateValue(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: reportDateValue(now),
  };
}

export function formatReportDate(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function reportRangeSuffix(range: ReportRange) {
  return range.from || range.to
    ? `${range.from || "start"}_to_${range.to || "today"}`
    : "all-time";
}

export function matchesReportSearch(query: string, values: unknown[]) {
  const normalized = query.trim().toLocaleLowerCase();

  return (
    !normalized ||
    values.some((value) => String(value ?? "").toLocaleLowerCase().includes(normalized))
  );
}

export function variantStockSummary(variants: ReportVariantStock[]) {
  return variants
    .filter((variant) => variant.color || variant.size)
    .map((variant) => {
      const label = [variant.color, variant.size].filter(Boolean).join(" / ");
      return `${label}: ${formatQuantity(variant.stock)}`;
    })
    .join("; ");
}
