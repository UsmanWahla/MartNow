import { describe, expect, it } from "vitest";
import { buildCsv, fetchAllRows } from "./csvExport";

describe("CSV export", () => {
  it("escapes commas, quotes, and line breaks", () => {
    const csv = buildCsv(
      [{ name: 'Mango, "Fresh"', note: "First\nsecond" }],
      [
        { header: "Name", value: (row) => row.name },
        { header: "Note", value: (row) => row.note },
      ]
    );

    expect(csv).toBe('\ufeffName,Note\r\n"Mango, ""Fresh""","First\nsecond"');
  });

  it("prevents string cells from being interpreted as spreadsheet formulas", () => {
    const csv = buildCsv(
      [{ name: "=SUM(A1:A2)", amount: -25 }],
      [
        { header: "Name", value: (row) => row.name },
        { header: "Amount", value: (row) => row.amount },
      ]
    );

    expect(csv).toBe("\ufeffName,Amount\r\n'=SUM(A1:A2),-25");
  });

  it("loads every page so exports are not capped by a list response", async () => {
    const rows = await fetchAllRows(
      async (page) => ({
        total: 5,
        rows: page === 1 ? [1, 2] : page === 2 ? [3, 4] : [5],
      }),
      2
    );

    expect(rows).toEqual([1, 2, 3, 4, 5]);
  });
});
