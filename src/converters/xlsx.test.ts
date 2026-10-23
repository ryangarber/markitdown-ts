import { zipSync } from "fflate";
import { XlsxConverter } from "./xlsx.ts";

const encoder = new TextEncoder();

describe("XlsxConverter", () => {
  const converter = new XlsxConverter();

  // Regression: tables were dropped because Turndown's GFM plugin could not read linkedom tables.
  it("converts each sheet to a markdown table", async () => {
    const result = await converter.convert(
      createXlsx({
        First: [
          ["name", "value"],
          ["browser", 1]
        ],
        Second: [["only"]]
      }),
      { extension: "xlsx" }
    );

    expect(result).toEqual({
      title: null,
      markdown:
        "## First\n| name | value |\n\n| --- | --- |\n\n| browser | 1   |\n\n## Second\n| only |\n\n| --- |"
    });
  });

  // Regression (#13): empty sheets broke conversion.
  it("skips empty sheets", async () => {
    const result = await converter.convert(createXlsx({ Empty: [], Data: [["a", "b"]] }), {
      extension: "xlsx"
    });
    expect(result?.markdown).toBe("## Data\n| a   | b   |\n\n| --- | --- |");
  });

  it("pads ragged rows and escapes cell content", async () => {
    const result = await converter.convert(createXlsx({ Sheet: [["a", "b", "c"], ["<b>&</b>"]] }), {
      extension: "xlsx"
    });
    expect(result?.markdown).toBe(
      "## Sheet\n| a   | b   | c   |\n\n| --- | --- | --- |\n\n| <b>&</b> |     |     |"
    );
  });

  it("ignores other extensions", async () => {
    expect(await converter.convert(createXlsx({ Sheet: [] }), { extension: "xls" })).toBeNull();
  });
});

function createXlsx(sheets: Record<string, (string | number)[][]>): Uint8Array {
  const names = Object.keys(sheets);
  const files: Record<string, string> = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  ${names.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("\n  ")}
</Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    ${names.map((name, i) => `<sheet name="${name}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("\n    ")}
  </sheets>
</workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${names.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("\n  ")}
</Relationships>`
  };

  for (const [index, rows] of Object.values(sheets).entries()) {
    const sheetRows = rows.map((row, r) => {
      const cells = row.map((value, c) => {
        const ref = `${String.fromCharCode(65 + c)}${r + 1}`;
        return typeof value === "number"
          ? `<c r="${ref}"><v>${value}</v></c>`
          : `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
      });
      return `<row r="${r + 1}">${cells.join("")}</row>`;
    });
    files[`xl/worksheets/sheet${index + 1}.xml`] =
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${sheetRows.join("")}</sheetData>
</worksheet>`;
  }

  return zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, encoder.encode(v)])));
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
