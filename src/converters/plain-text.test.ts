import { PlainTextConverter } from "./plain-text.ts";

const encoder = new TextEncoder();

describe("PlainTextConverter", () => {
  const converter = new PlainTextConverter();

  it.each(["txt", "md", "csv"])("converts %s content verbatim", async (extension) => {
    const result = await converter.convert(encoder.encode("a,b\n\n\n1,2"), { extension });
    expect(result).toEqual({ title: null, markdown: "a,b\n\n\n1,2" });
  });

  it("decodes UTF-8", async () => {
    const result = await converter.convert(encoder.encode("héllo ✓"), { extension: "txt" });
    expect(result?.markdown).toBe("héllo ✓");
  });

  it.each(["pdf", "zip", "docx", "", undefined])("ignores %j", async (extension) => {
    expect(await converter.convert(encoder.encode("x"), { extension })).toBeNull();
  });
});
