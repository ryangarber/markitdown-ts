import { PdfConverter } from "./pdf.ts";

const encoder = new TextEncoder();

describe("PdfConverter", () => {
  const converter = new PdfConverter();

  it("extracts text and the title", async () => {
    const result = await converter.convert(createPdf("Hello from PDF", "Sample PDF"), {
      extension: "pdf"
    });
    expect(result?.title).toBe("Sample PDF");
    expect(result?.markdown).toContain("Hello from PDF");
  });

  it("returns a null title when the PDF has none", async () => {
    const result = await converter.convert(createPdf("Untitled"), { extension: "pdf" });
    expect(result?.title).toBeNull();
    expect(result?.markdown).toContain("Untitled");
  });

  it("returns a null title for blank titles", async () => {
    const result = await converter.convert(createPdf("Blank", "   "), { extension: "pdf" });
    expect(result?.title).toBeNull();
  });

  it("does not detach the caller's buffer", async () => {
    const source = createPdf("Reusable");
    await converter.convert(source, { extension: "pdf" });
    expect(source.byteLength).toBeGreaterThan(0);
    const again = await converter.convert(source, { extension: "pdf" });
    expect(again?.markdown).toContain("Reusable");
  });

  it("ignores other extensions", async () => {
    expect(await converter.convert(createPdf("x"), { extension: "txt" })).toBeNull();
  });

  it("throws on invalid PDFs", async () => {
    await expect(
      converter.convert(encoder.encode("not a pdf"), { extension: "pdf" })
    ).rejects.toThrow();
  });
});

function createPdf(text: string, title?: string): Uint8Array {
  const stream = `BT /F1 12 Tf 72 720 Td (${escapePdfString(text)}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  ];

  let trailerExtra = "";
  if (title !== undefined) {
    objects.push(`<< /Title (${escapePdfString(title)}) >>`);
    trailerExtra = " /Info 6 0 R";
  }

  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }

  const xrefStart = body.length;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index++) {
    xref += `${String(offsets[index] ?? 0).padStart(10, "0")} 00000 n \n`;
  }

  body += xref;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R${trailerExtra} >>\n`;
  body += `startxref\n${xrefStart}\n%%EOF\n`;
  return encoder.encode(body);
}

function escapePdfString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}
