import { zipSync } from "fflate";
import { DocxConverter } from "./docx.ts";

const encoder = new TextEncoder();

describe("DocxConverter", () => {
  const converter = new DocxConverter();

  it("converts headings, paragraphs, and tables", async () => {
    const result = await converter.convert(
      createDocx(`
        <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Document Title</w:t></w:r></w:p>
        <w:p><w:r><w:t>Hello from DOCX</w:t></w:r></w:p>
        <w:tbl>
          <w:tr><w:tc><w:p><w:r><w:t>name</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>value</w:t></w:r></w:p></w:tc></w:tr>
          <w:tr><w:tc><w:p><w:r><w:t>docx</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>1</w:t></w:r></w:p></w:tc></w:tr>
        </w:tbl>
      `),
      { extension: "docx" }
    );

    expect(result).toEqual({
      title: null,
      markdown:
        "# Document Title\n\nHello from DOCX\n\n| name | value |\n\n| --- | --- |\n\n| docx | 1   |"
    });
  });

  it("forwards mammoth options", async () => {
    const result = await converter.convert(
      createDocx(
        '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Mapped</w:t></w:r></w:p>'
      ),
      { extension: "docx", mammoth: { styleMap: ["p[style-name='heading 1'] => h3:fresh"] } }
    );
    expect(result?.markdown).toBe("### Mapped");
  });

  it("ignores other extensions", async () => {
    expect(await converter.convert(createDocx(""), { extension: "doc" })).toBeNull();
  });

  it("throws on invalid documents", async () => {
    await expect(
      converter.convert(encoder.encode("not a docx"), { extension: "docx" })
    ).rejects.toThrow();
  });
});

function createDocx(body: string): Uint8Array {
  const w = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const files: Record<string, string> = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
    "word/_rels/document.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    "word/styles.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="${w}">
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style>
</w:styles>`,
    "word/document.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${w}"><w:body>${body}</w:body></w:document>`
  };

  return zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, encoder.encode(v)])));
}
