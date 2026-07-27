import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { runConfigurableAttendanceTransform } from "@/lib/engine/configurableAttendanceTransform";
import { generateTargetFile } from "@/lib/engine/targetFileGenerator";
import type { TargetWorkbookConfiguration } from "@/lib/engine/types";
import {
  overnightRule,
  regularRule,
  row,
  sourceConfiguration,
  targetConfiguration,
} from "./fixtures";

function build(target?: TargetWorkbookConfiguration) {
  const tc = target ?? targetConfiguration();
  const res = runConfigurableAttendanceTransform({
    sourceRows: [
      row({
        UserID: "00125",
        Date: "14/07/2026",
        "On Desc": "Absent",
        "A M OnDuty": "9:00 AM",
        "P M OffDuty": "6:00 PM",
      }),
      row({
        UserID: "00130",
        Date: "15/07/2026",
        "On Desc": "Absent",
        "A M OnDuty": "8:30 AM",
        "P M OffDuty": "",
      }),
    ],
    targetConfiguration: tc,
    sourceConfiguration: sourceConfiguration(),
    rules: [overnightRule(), regularRule()],
    defaultRule: null,
    uniqueTargetFields: ["emp", "date"],
  });
  return { tc, res };
}

async function readBack(data: Uint8Array) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data as unknown as ExcelJS.Buffer);
  return wb;
}

describe("Target-format downloads", () => {
  it("case 38/41/42/43: XLSX output preserves worksheet name, filename, and writes data below the header", async () => {
    const { tc, res } = build();
    const file = await generateTargetFile({
      targetConfiguration: tc,
      convertedRows: res.rows,
      outputMode: "all",
    });
    expect(file.fileType).toBe("xlsx");
    expect(file.fileName).toBe("Attendance Bulk Upload.xlsx");

    const wb = await readBack(file.data);
    const ws = wb.getWorksheet("Attendance");
    expect(ws).toBeTruthy();

    expect(ws!.getRow(1).getCell(1).value).toBe("Employee ID*");
    expect(ws!.getRow(1).getCell(3).value).toBe("In Time*");

    expect(String(ws!.getRow(2).getCell(1).value)).toBe("00125");
  });

  it("case 44: source-only columns are excluded (only target columns are written)", async () => {
    const { tc, res } = build();
    const file = await generateTargetFile({
      targetConfiguration: tc,
      convertedRows: res.rows,
      outputMode: "all",
    });
    const wb = await readBack(file.data);
    const ws = wb.getWorksheet("Attendance")!;

    expect(ws.getRow(1).cellCount).toBe(4);
    const headers = [1, 2, 3, 4].map((c) => ws.getRow(1).getCell(c).value);
    expect(headers).not.toContain("On Desc");
  });

  it("case 34/leading-zeros: text column keeps leading zeros with @ format", async () => {
    const { tc, res } = build();
    const file = await generateTargetFile({
      targetConfiguration: tc,
      convertedRows: res.rows,
      outputMode: "all",
    });
    const ws = (await readBack(file.data)).getWorksheet("Attendance")!;
    expect(String(ws.getRow(2).getCell(1).value)).toBe("00125");
    expect(ws.getRow(2).getCell(1).numFmt).toBe("@");
  });

  it("case 34/date-format: date column carries the target date number format", async () => {
    const { tc, res } = build();
    const file = await generateTargetFile({
      targetConfiguration: tc,
      convertedRows: res.rows,
      outputMode: "all",
    });
    const ws = (await readBack(file.data)).getWorksheet("Attendance")!;
    expect(ws.getRow(2).getCell(2).numFmt).toBe("dd/mm/yyyy");
  });

  it("case 30/37: static instruction rows above the header are preserved", async () => {
    const target = targetConfiguration({
      headerRowNumber: 2,
      staticRowsAboveHeader: [
        ["Please fill attendance below. Do not edit headers."],
      ],
    });
    const { res } = build(target);
    const file = await generateTargetFile({
      targetConfiguration: target,
      convertedRows: res.rows,
      outputMode: "all",
    });
    const ws = (await readBack(file.data)).getWorksheet("Attendance")!;
    expect(String(ws.getRow(1).getCell(1).value)).toContain(
      "Please fill attendance",
    );
    expect(ws.getRow(2).getCell(1).value).toBe("Employee ID*");
    expect(String(ws.getRow(3).getCell(1).value)).toBe("00125");
  });

  it("case 39: CSV target downloads as CSV with target formatting applied", async () => {
    const target = targetConfiguration({
      originalFileName: "attendance.csv",
      originalFileType: "csv",
    });
    const { res } = build(target);
    const file = await generateTargetFile({
      targetConfiguration: target,
      convertedRows: res.rows,
      outputMode: "all",
    });
    expect(file.fileType).toBe("csv");
    expect(file.fileName).toBe("attendance.csv");
    const text = new TextDecoder().decode(file.data);
    const lines = text.replace(/^﻿/, "").split("\r\n");
    expect(lines[0]).toBe("Employee ID*,Date*,In Time*,Out Time*");
    expect(lines[1]).toContain("00125");
    expect(lines[1]).toContain("14/07/2026");
    expect(lines[1]).toContain("9:00 AM");
  });

  it("case 48/49: valid-only vs incomplete export both use the target format", async () => {
    const { tc, res } = build();
    const validOnly = await generateTargetFile({
      targetConfiguration: tc,
      convertedRows: res.rows,
      outputMode: "valid_only",
    });
    const incomplete = await generateTargetFile({
      targetConfiguration: tc,
      convertedRows: res.rows,
      outputMode: "include_incomplete",
    });
    const wsValid = (await readBack(validOnly.data)).getWorksheet(
      "Attendance",
    )!;
    const wsAll = (await readBack(incomplete.data)).getWorksheet("Attendance")!;

    expect(wsValid.rowCount).toBe(2);
    expect(wsAll.rowCount).toBe(3);
  });

  it("blank Out Time is never emitted with a present In Time (invariant holds on export)", async () => {
    const res = runConfigurableAttendanceTransform({
      sourceRows: [
        row({
          UserID: "E1",
          Date: "01/01/2026",
          "On Desc": "Absent",
          "A M OnDuty": "",
          "P M OffDuty": "6:00 PM",
        }),
      ],
      targetConfiguration: targetConfiguration(),
      sourceConfiguration: sourceConfiguration(),
      rules: [regularRule()],
      defaultRule: null,
      uniqueTargetFields: [],
    });
    const file = await generateTargetFile({
      targetConfiguration: targetConfiguration(),
      convertedRows: res.rows,
      outputMode: "include_incomplete",
    });
    const ws = (await readBack(file.data)).getWorksheet("Attendance")!;
    const inCell = ws.getRow(2).getCell(3).value;
    const outCell = ws.getRow(2).getCell(4).value;
    expect(inCell == null || inCell === "").toBe(true);
    expect(outCell == null || outCell === "").toBe(true);
  });
});

describe("Snapshot round-trip (preserving original formatting)", () => {
  it("case 32/33/36: reloads the original workbook, keeps widths/worksheet, and preserves the template's example rows above the data", async () => {
    const original = new ExcelJS.Workbook();
    const ws = original.addWorksheet("Attendance");
    ws.getRow(1).values = ["Employee ID*", "Date*", "In Time*", "Out Time*"];
    ws.getColumn(1).width = 22;
    ws.getRow(2).values = ["SAMPLE", "01/01/2000", "0:00", "0:00"];
    const originalBytes = new Uint8Array(
      (await original.xlsx.writeBuffer()) as ArrayBuffer,
    );
    const snapshot = Buffer.from(originalBytes).toString("base64");

    const target = targetConfiguration({ workbookSnapshot: snapshot });
    const { res } = build(target);
    const file = await generateTargetFile({
      targetConfiguration: target,
      convertedRows: res.rows,
      outputMode: "all",
    });
    const out = (await readBack(file.data)).getWorksheet("Attendance")!;

    expect(out.getColumn(1).width).toBe(22);
    expect(out.getRow(1).getCell(1).value).toBe("Employee ID*");
    // The template's example row is kept verbatim; data is written below it.
    expect(String(out.getRow(2).getCell(1).value)).toBe("SAMPLE");
    expect(String(out.getRow(3).getCell(1).value)).toBe("00125");
  });

  it("keeps the header + instruction + example rows from the target and writes data below them", async () => {
    const original = new ExcelJS.Workbook();
    const ws = original.addWorksheet("Attendance");
    ws.getRow(1).values = ["Employee ID*", "Date*", "In Time*", "Out Time*"];
    ws.getRow(2).values = ["Unique employee id", "Attendance date", "HH:MM", "HH:MM"]; // instruction
    ws.getRow(3).values = ["EMP001", "2023-01-01", "09:00 AM", "05:00 PM"]; // example 1
    ws.getRow(4).values = ["EMP002", "2023-01-02", "09:15", "17:15"]; // example 2
    ws.getRow(5).values = ["EMP003", "2023-01-03", "09:30 AM", "05:30 PM"]; // example 3
    const originalBytes = new Uint8Array(
      (await original.xlsx.writeBuffer()) as ArrayBuffer,
    );
    const snapshot = Buffer.from(originalBytes).toString("base64");

    const target = targetConfiguration({ workbookSnapshot: snapshot });
    const { res } = build(target);
    const file = await generateTargetFile({
      targetConfiguration: target,
      convertedRows: res.rows,
      outputMode: "all",
    });
    const out = (await readBack(file.data)).getWorksheet("Attendance")!;

    // Header + instruction + all 3 examples preserved verbatim (rows 1-5).
    expect(out.getRow(1).getCell(1).value).toBe("Employee ID*");
    expect(String(out.getRow(2).getCell(1).value)).toBe("Unique employee id");
    expect(String(out.getRow(3).getCell(1).value)).toBe("EMP001");
    expect(String(out.getRow(4).getCell(1).value)).toBe("EMP002");
    expect(String(out.getRow(5).getCell(1).value)).toBe("EMP003");
    // Converted data begins on row 6, right after the 4 preamble rows.
    expect(String(out.getRow(6).getCell(1).value)).toBe("00125");
  });
});
