import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import * as XLSX from "xlsx";
import { parseWorkbook, sheetToSourceRows } from "@/lib/engine/fileParser";

async function makeXlsx(build: (ws: ExcelJS.Worksheet) => void, name = "Attendance"): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(name);
  build(ws);
  return new Uint8Array((await wb.xlsx.writeBuffer()) as ArrayBuffer);
}

function makeXls(aoa: unknown[][], name = "Sheet1"): Uint8Array {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, name);
  return new Uint8Array(XLSX.write(wb, { bookType: "xls", type: "array" }) as ArrayBuffer);
}

describe("Workbook parsing", () => {
  it("case 30/31: detects the header row beneath instruction rows", async () => {
    const bytes = await makeXlsx((ws) => {
      ws.getRow(1).values = ["Company attendance template — do not edit headers"];
      ws.getRow(2).values = ["Employee ID*", "Date*", "In Time*", "Out Time*"];
      ws.getRow(3).values = ["E001", "14/07/2026", "9:00 AM", "6:00 PM"];
      ws.getRow(4).values = ["E002", "14/07/2026", "9:10 AM", "6:05 PM"];
    });
    const parsed = await parseWorkbook(bytes, "Attendance Bulk Upload.xlsx");
    const sheet = parsed.sheets["Attendance"]!;
    expect(parsed.fileType).toBe("xlsx");
    expect(sheet.detectedHeaderRow).toBe(2);
    expect(sheet.staticRowsAboveHeader.length).toBe(1);
    expect(sheet.columns.map((c) => c.header)).toEqual([
      "Employee ID*",
      "Date*",
      "In Time*",
      "Out Time*",
    ]);
  });

  it("detects required markers and preserves exact headers", async () => {
    const bytes = await makeXlsx((ws) => {
      ws.getRow(1).values = ["Employee ID*", "Note"];
      ws.getRow(2).values = ["E001", "ok"];
    });
    const sheet = (await parseWorkbook(bytes, "t.xlsx")).sheets["Attendance"]!;
    expect(sheet.columns[0]!.required).toBe(true);
    expect(sheet.columns[0]!.displayName).toBe("Employee ID");
    expect(sheet.columns[1]!.required).toBe(false);
  });

  it("keeps the snapshot and converts data rows to keyed objects", async () => {
    const bytes = await makeXlsx((ws) => {
      ws.getRow(1).values = ["UserID", "Date", "On Desc"];
      ws.getRow(2).values = ["E001", "14/07/2026", "Absent"];
      ws.getRow(3).values = ["E002", "15/07/2026", "Not Swipe"];
    });
    const parsed = await parseWorkbook(bytes, "source.xlsx");
    expect(parsed.workbookSnapshot).toBeTruthy();
    const rows = sheetToSourceRows(parsed.sheets["Attendance"]!);
    expect(rows).toHaveLength(2);
    expect(rows[0]!["UserID"]).toBe("E001");
    expect(rows[1]!["On Desc"]).toBe("Not Swipe");
  });

  it("parses CSV as a single sheet", async () => {
    const csv = "Employee ID*,Date*\r\nE001,14/07/2026\r\nE002,15/07/2026\r\n";
    const parsed = await parseWorkbook(csv, "data.csv");
    expect(parsed.fileType).toBe("csv");
    const rows = sheetToSourceRows(parsed.sheets["CSV"]!);
    expect(rows).toHaveLength(2);
  });

  it("parses a legacy .xls workbook (SheetJS), no snapshot", async () => {
    const bytes = makeXls([
      ["Employee ID*", "Date*", "In Time*", "Out Time*"],
      ["E001", "14/07/2026", "9:00 AM", "6:00 PM"],
      ["E002", "15/07/2026", "9:10 AM", "6:05 PM"],
    ]);
    const parsed = await parseWorkbook(bytes, "old.xls");
    expect(parsed.fileType).toBe("xls");
    expect(parsed.workbookSnapshot).toBeUndefined();
    const sheet = parsed.sheets[parsed.suggestedWorksheet]!;
    expect(sheet.columns.map((c) => c.header)).toEqual([
      "Employee ID*",
      "Date*",
      "In Time*",
      "Out Time*",
    ]);
    const rows = sheetToSourceRows(sheet);
    expect(rows).toHaveLength(2);
    expect(rows[0]!["Employee ID*"]).toBe("E001");
    expect(rows[1]!["Out Time*"]).toBe("6:05 PM");
  });

  it("errors with a friendly message when an .xls has no readable data", async () => {
    const empty = makeXls([[""]]);
    await expect(parseWorkbook(empty, "empty.xls")).rejects.toThrow(/\.xlsx/);
  });

  it("reads the date format from the file instead of assuming day-first", async () => {
    const bytes = await makeXlsx((ws) => {
      ws.getRow(1).values = ["Employee ID*", "ISO Date", "Slashed Date"];
      ws.getRow(2).values = ["EMP001", "2023-01-01", "14/07/2026"];
      ws.getRow(3).values = ["EMP002", "2023-01-02", "15/07/2026"];
    });
    const sheet = (await parseWorkbook(bytes, "t.xlsx")).sheets["Attendance"]!;
    const iso = sheet.columns.find((c) => c.header === "ISO Date")!;
    const slashed = sheet.columns.find((c) => c.header === "Slashed Date")!;
    expect(iso.detectedType).toBe("date");
    expect(iso.format?.dateFormat).toBe("YYYY-MM-DD");
    expect(slashed.detectedType).toBe("date");
    expect(slashed.format?.dateFormat).toBe("DD/MM/YYYY");
  });
});
