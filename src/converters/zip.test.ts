import { zipSync } from "fflate";
import type { Converter } from "../types.ts";
import { HtmlConverter } from "./html.ts";
import { PlainTextConverter } from "./plain-text.ts";
import { ZipConverter } from "./zip.ts";

const encoder = new TextEncoder();

describe("ZipConverter", () => {
  const converter = new ZipConverter();
  // Mirrors MarkItDown's priority: specific converters before generic ones.
  const converters: Converter[] = [converter, new HtmlConverter(), new PlainTextConverter()];

  it("converts each supported entry with the parent converters", async () => {
    const archive = zipSync({
      "docs/readme.txt": encoder.encode("hello from zip"),
      "page.html": encoder.encode(
        "<html><head><title>Zipped</title></head><body><h1>Inside</h1></body></html>"
      )
    });
    const result = await converter.convert(archive, { extension: "zip", _converters: converters });

    expect(result).toEqual({
      title: null,
      markdown: [
        "Content from the zip file `archive.zip`:",
        "## File: docs/readme.txt\n\nhello from zip",
        "## File: page.html\n\n# Inside"
      ].join("\n\n")
    });
  });

  it("converts nested archives recursively", async () => {
    const archive = zipSync({
      "nested/inner.zip": zipSync({ "note.txt": encoder.encode("inner file") })
    });
    const result = await converter.convert(archive, { extension: "zip", _converters: converters });

    expect(result?.markdown).toContain("## File: nested/inner.zip");
    expect(result?.markdown).toContain("## File: note.txt\n\ninner file");
  });

  it("skips entries without an extension or a matching converter", async () => {
    const archive = zipSync({
      README: encoder.encode("no extension"),
      "binary.bin": new Uint8Array([0, 1, 2, 3]),
      "dir/": new Uint8Array()
    });
    const result = await converter.convert(archive, { extension: "zip", _converters: converters });

    expect(result?.markdown).toBe("Content from the zip file `archive.zip`:");
  });

  it("skips entries that fail to convert", async () => {
    const failing: Converter = {
      convert: async (_source, options) => {
        if (options.extension === "txt") throw new Error("boom");
        return null;
      }
    };
    const archive = zipSync({
      "bad.txt": encoder.encode("bad"),
      "good.html": encoder.encode("<p>good</p>")
    });
    const result = await converter.convert(archive, {
      extension: "zip",
      _converters: [failing, new HtmlConverter()]
    });

    expect(result?.markdown).not.toContain("bad.txt");
    expect(result?.markdown).toContain("## File: good.html\n\ngood");
  });

  it("uses the source URL in the heading, but not for entries", async () => {
    const entryUrls: (string | undefined)[] = [];
    const spy: Converter = {
      convert: async (_source, options) => {
        entryUrls.push(options.url);
        return { title: null, markdown: "spied" };
      }
    };
    const archive = zipSync({ "a.txt": encoder.encode("a") });
    const result = await converter.convert(archive, {
      extension: "zip",
      url: "https://example.com/files/example.zip",
      _converters: [spy]
    });

    expect(result?.markdown).toContain(
      "Content from the zip file `https://example.com/files/example.zip`:"
    );
    expect(entryUrls).toEqual([undefined]);
  });

  it("produces only the heading when no converters are provided", async () => {
    const archive = zipSync({ "a.txt": encoder.encode("a") });
    const result = await converter.convert(archive, { extension: "zip" });
    expect(result?.markdown).toBe("Content from the zip file `archive.zip`:");
  });

  it("ignores other extensions", async () => {
    expect(await converter.convert(zipSync({}), { extension: "gz" })).toBeNull();
  });

  it("throws on invalid archives", async () => {
    await expect(
      converter.convert(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), { extension: "zip" })
    ).rejects.toThrow("invalid zip data");
  });
});
