import readExcelFile, { type SheetData } from "read-excel-file/universal";
import type { ConverterOptions, ConverterResult } from "../types.ts";
import { toArrayBuffer } from "../utils/index.ts";
import { HtmlConverter } from "./html.ts";

export class XlsxConverter extends HtmlConverter {
  override async convert(source: Uint8Array, options: ConverterOptions): Promise<ConverterResult> {
    if (options.extension !== "xlsx") {
      return null;
    }

    const sheets = await readExcelFile(toArrayBuffer(source));
    const sections: string[] = [];

    for (const { sheet, data } of sheets) {
      const html = sheetToHtml(data);
      if (!html) {
        continue;
      }
      const result = await this.convertHtml(html);
      sections.push(`## ${sheet}\n${result?.markdown.trim() ?? ""}`);
    }

    const markdown = sections.join("\n\n");
    return {
      title: null,
      markdown
    };
  }
}

function sheetToHtml(rows: SheetData): string {
  const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
  if (!columnCount || rows.length === 0) {
    return "";
  }

  const htmlRows = rows.map((row) => {
    const cells: string[] = [];
    for (let column = 0; column < columnCount; column++) {
      cells.push(`<td>${escapeHtml(cellText(row[column]))}</td>`);
    }
    return `<tr>${cells.join("")}</tr>`;
  });

  return `<html><body><table>${htmlRows.join("")}</table></body></html>`;
}

function cellText(value: unknown): string {
  if (value == null) {
    return "";
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
