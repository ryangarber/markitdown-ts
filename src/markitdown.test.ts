import { zipSync } from "fflate";
import { MarkItDown } from "./markitdown.ts";

const encoder = new TextEncoder();
const PDF_MAGIC = encoder.encode("%PDF-1.4\n");
const HEADING = "<h1>Hint</h1>";

function fetchReturning(response: Response) {
  return vi.fn<typeof fetch>(async () => response);
}

describe("MarkItDown", () => {
  describe("byte sources", () => {
    it("treats Uint8Array as a first-class source", async () => {
      const result = await new MarkItDown().convert(encoder.encode("hello"), {
        extension: "txt"
      });
      expect(result).toEqual({ title: null, markdown: "hello" });
    });

    it.each([
      ["ArrayBuffer", () => encoder.encode("array buffer").buffer, "array buffer"],
      [
        "DataView",
        () => {
          const bytes = encoder.encode("--data view--");
          return new DataView(bytes.buffer, 2, 9);
        },
        "data view"
      ],
      ["Uint16Array", () => new Uint16Array(encoder.encode("ab").buffer), "ab"],
      ["Blob", () => new Blob(["blob"], { type: "text/plain" }), "blob"],
      ["File", () => new File(["file"], "file.txt"), "file"]
    ])("normalizes %s sources", async (_name, createSource, expected) => {
      const result = await new MarkItDown().convert(createSource(), { extension: "txt" });
      expect(result?.markdown).toBe(expected);
    });

    it.each(["txt", ".txt", ".TXT", " Txt "])("normalizes the %j extension", async (extension) => {
      const result = await new MarkItDown().convert(encoder.encode("x"), { extension });
      expect(result?.markdown).toBe("x");
    });

    it("detects the format from magic numbers", async () => {
      const zipMagic = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
      await expect(new MarkItDown().convert(zipMagic)).rejects.toThrow(
        "Could not convert zip to Markdown"
      );
      await expect(new MarkItDown().convert(new Blob([PDF_MAGIC]))).rejects.toThrow(
        "Could not convert pdf to Markdown"
      );
    });

    // `<h1>` only becomes a heading when a hint, rather than text sniffing, picks HTML.
    it.each([
      ["Blob types", () => new Blob([HEADING], { type: "text/html" }), {}],
      ["File names", () => new File([HEADING], "page.html"), {}],
      ["the url option", () => encoder.encode(HEADING), { url: "https://example.com/page.html" }]
    ])("infers the format from %s", async (_name, createSource, options) => {
      const result = await new MarkItDown().convert(createSource(), options);
      expect(result?.markdown).toBe("# Hint");
    });

    it("prefers the File name over its type", async () => {
      const file = new File([HEADING], "page.txt", { type: "text/html" });
      expect((await new MarkItDown().convert(file))?.markdown).toBe(HEADING);
    });

    it.each([
      ["HTML", "<!doctype html><html><body><h1>Sniffed</h1></body></html>", "# Sniffed"],
      [
        "notebooks",
        '{"cells": [{"cell_type": "code", "source": ["1"]}], "nbformat": 4}',
        "```python\n1\n```"
      ],
      ["RSS", '<rss version="2.0"><channel><title>Feed</title></channel></rss>', "# Feed"],
      ["plain text", "just text", "just text"]
    ])("sniffs %s without any hints", async (_name, text, expected) => {
      const result = await new MarkItDown().convert(encoder.encode(text));
      expect(result?.markdown).toBe(expected);
    });

    it("throws when the format cannot be determined", async () => {
      await expect(new MarkItDown().convert(new Uint8Array([0, 1, 2, 3]))).rejects.toThrow(
        "Could not determine the file type"
      );
    });
  });

  describe("Response sources", () => {
    it("infers the format from the Content-Type header", async () => {
      const response = new Response(HEADING, {
        headers: { "content-type": "text/html; charset=utf-8" }
      });
      expect((await new MarkItDown().convert(response))?.markdown).toBe("# Hint");
    });

    it.each([
      'attachment; filename="page.html"',
      "attachment; filename=page.html",
      "attachment; filename*=UTF-8''p%C3%A1gina.html"
    ])("infers the format from Content-Disposition: %s", async (disposition) => {
      const response = new Response(encoder.encode(HEADING), {
        headers: { "content-disposition": disposition }
      });
      expect((await new MarkItDown().convert(response))?.markdown).toBe("# Hint");
    });

    it("infers the format from the url option", async () => {
      const result = await new MarkItDown().convert(new Response(encoder.encode(HEADING)), {
        url: "https://example.com/page.html"
      });
      expect(result?.markdown).toBe("# Hint");
    });

    it("infers the format from the response URL", async () => {
      const response = new Response(encoder.encode(HEADING));
      Object.defineProperty(response, "url", { value: "https://example.com/redirected.html" });
      const result = await new MarkItDown().convert(response, {
        url: "https://example.com/download"
      });
      expect(result?.markdown).toBe("# Hint");
    });

    it("sniffs the body without any hints", async () => {
      const response = new Response(encoder.encode("<!doctype html><h1>Body</h1>"));
      expect((await new MarkItDown().convert(response))?.markdown).toBe("# Body");
    });

    it("throws when the format cannot be determined", async () => {
      await expect(new MarkItDown().convert(new Response(new Uint8Array([0])))).rejects.toThrow(
        "Could not determine the file type"
      );
    });
  });

  describe("URL sources", () => {
    it("fetches with an injectable fetch implementation", async () => {
      const fetch = fetchReturning(
        new Response(
          "<html><head><title>Example</title></head><body><h1>Hello</h1></body></html>",
          {
            headers: { "content-type": "text/html" }
          }
        )
      );
      const result = await new MarkItDown().convert("https://example.com/article", { fetch });

      expect(fetch).toHaveBeenCalledWith(new URL("https://example.com/article"));
      expect(result).toEqual({ title: "Example", markdown: "# Hello" });
    });

    it("accepts URL objects", async () => {
      const fetch = fetchReturning(new Response("url object"));
      const result = await new MarkItDown().convert(new URL("https://example.com/a.txt"), {
        fetch
      });
      expect(result?.markdown).toBe("url object");
    });

    it("infers the format from the URL path", async () => {
      const fetch = fetchReturning(new Response("plain"));
      const result = await new MarkItDown().convert("https://example.com/notes.txt", { fetch });
      expect(result?.markdown).toBe("plain");
    });

    it("passes the URL to converters", async () => {
      const fetch = fetchReturning(
        new Response(
          '<html><body><nav>chrome</nav><div id="mw-content-text"><p>Article</p></div></body></html>',
          { headers: { "content-type": "text/html" } }
        )
      );
      const result = await new MarkItDown().convert("https://en.wikipedia.org/wiki/Test", {
        fetch
      });
      expect(result?.markdown).toBe("Article");
    });

    it("throws on unsuccessful responses", async () => {
      const fetch = fetchReturning(new Response("", { status: 404 }));
      await expect(
        new MarkItDown().convert("https://example.com/missing.txt", { fetch })
      ).rejects.toThrow("Failed to fetch URL: https://example.com/missing.txt, status: 404");
    });

    it("rejects local paths and unsupported URL protocols", async () => {
      await expect(new MarkItDown().convert("document.txt")).rejects.toThrow();
      await expect(new MarkItDown().convert("file:///document.txt")).rejects.toThrow(
        "Unsupported URL protocol: file:"
      );
    });
  });

  describe("converter selection", () => {
    // Regression: HTML was claimed by the plain text converter (text/html is a text type)
    // once converters were registered in export order instead of by priority.
    it.each(["html", "htm"])("converts .%s as HTML rather than plain text", async (extension) => {
      const result = await new MarkItDown().convert(
        encoder.encode("<html><head><title>T</title></head><body><h1>Hi</h1></body></html>"),
        { extension }
      );
      expect(result).toEqual({ title: "T", markdown: "# Hi" });
    });

    it("prefers site-specific converters over generic HTML", async () => {
      const html = encoder.encode(
        '<html><body><nav>chrome</nav><div id="mw-content-text"><p>Article</p></div></body></html>'
      );
      const markItDown = new MarkItDown();

      const generic = await markItDown.convert(html, { extension: "html" });
      const wikipedia = await markItDown.convert(html, {
        extension: "html",
        url: "https://en.wikipedia.org/wiki/Test"
      });

      expect(generic?.markdown).toBe("chrome\n\nArticle");
      expect(wikipedia?.markdown).toBe("Article");
    });

    it("provides its converters to container formats", async () => {
      const archive = zipSync({
        "page.html": encoder.encode("<h1>Inside</h1>"),
        "nested.zip": zipSync({ "note.txt": encoder.encode("deep") })
      });
      const result = await new MarkItDown().convert(archive, { extension: "zip" });

      expect(result?.markdown).toContain("## File: page.html\n\n# Inside");
      expect(result?.markdown).toContain("## File: note.txt\n\ndeep");
    });

    it("tries every candidate extension until one converts", async () => {
      const response = new Response("fallback", {
        headers: { "content-type": "application/x-unknown" }
      });
      const result = await new MarkItDown().convert(response, {
        extension: "unknownext",
        url: "https://example.com/file.txt"
      });
      expect(result?.markdown).toBe("fallback");
    });

    it("throws for unsupported formats", async () => {
      await expect(
        new MarkItDown().convert(new Uint8Array([0]), { extension: "unknownext" })
      ).rejects.toThrow("Unsupported file type: unknownext.");
    });

    it("falls back to text when the hinted format fails", async () => {
      const result = await new MarkItDown().convert(encoder.encode("{nope"), {
        extension: "ipynb"
      });
      expect(result?.markdown).toBe("{nope");
    });

    it("wraps converter errors", async () => {
      await expect(
        new MarkItDown().convert(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), { extension: "zip" })
      ).rejects.toThrow(/^Could not convert zip to Markdown: Error: invalid zip data/);
    });

    it("logs converter errors in debug mode", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        await expect(
          new MarkItDown().convert(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), {
            extension: "zip",
            debug: true
          })
        ).rejects.toThrow();
        expect(error).toHaveBeenCalledWith("Converter threw error:", expect.any(Error));
      } finally {
        error.mockRestore();
      }
    });
  });

  describe("output normalization", () => {
    it("normalizes line endings, trims, and collapses blank lines", async () => {
      const result = await new MarkItDown().convert(
        encoder.encode("\r\n  a\r\n\r\n\r\nb\rc\n\n\n\n"),
        { extension: "txt" }
      );
      expect(result?.markdown).toBe("a\n\nb\nc");
    });
  });
});
