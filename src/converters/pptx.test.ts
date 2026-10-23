import { zipSync } from "fflate";
import { PptxConverter } from "./pptx.ts";

const encoder = new TextEncoder();

describe("PptxConverter", () => {
  const converter = new PptxConverter();

  it("converts each slide with a slide number marker", async () => {
    const result = await converter.convert(createPptx(["Hello from PPTX", "Second slide"]), {
      extension: "pptx"
    });

    expect(result?.title).toBeNull();
    expect(result?.markdown).toMatch(
      /^<!-- Slide number: 1 -->\n[\s\S]*Hello from PPTX[\s\S]*\n\n<!-- Slide number: 2 -->\n[\s\S]*Second slide/
    );
  });

  it("ignores other extensions", async () => {
    expect(await converter.convert(createPptx(["x"]), { extension: "ppt" })).toBeNull();
  });
});

function createPptx(slides: string[]): Uint8Array {
  const presentationNs = "http://schemas.openxmlformats.org/presentationml/2006/main";
  const drawingNs = "http://schemas.openxmlformats.org/drawingml/2006/main";
  const relNs = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const packageRelNs = "http://schemas.openxmlformats.org/package/2006/relationships";
  const contentTypesNs = "http://schemas.openxmlformats.org/package/2006/content-types";

  const files: Record<string, string> = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="${contentTypesNs}">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  ${slides.map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join("\n  ")}
</Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${packageRelNs}">
  <Relationship Id="rId1" Type="${relNs}/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`,
    "ppt/presentation.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="${drawingNs}" xmlns:r="${relNs}" xmlns:p="${presentationNs}">
  <p:sldMasterIdLst/>
  <p:sldIdLst>
    ${slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 1}"/>`).join("\n    ")}
  </p:sldIdLst>
  <p:sldSz cx="12192000" cy="6858000"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`,
    "ppt/_rels/presentation.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${packageRelNs}">
  ${slides.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${relNs}/slide" Target="slides/slide${i + 1}.xml"/>`).join("\n  ")}
</Relationships>`
  };

  for (const [index, text] of slides.entries()) {
    files[`ppt/slides/_rels/slide${index + 1}.xml.rels`] =
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${packageRelNs}"/>`;
    files[`ppt/slides/slide${index + 1}.xml`] =
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="${drawingNs}" xmlns:r="${relNs}" xmlns:p="${presentationNs}">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm>
      </p:grpSpPr>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="457200" y="457200"/><a:ext cx="10972800" cy="1371600"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/><a:lstStyle/>
          <a:p><a:r><a:t>${escapeXml(text)}</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`;
  }

  return zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, encoder.encode(v)])));
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
