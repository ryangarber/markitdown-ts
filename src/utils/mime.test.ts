import { zipSync } from "fflate";
import {
  detectExtensions,
  extensionFromBuffer,
  extensionFromMime,
  extensionFromPathname,
  extensionFromText,
  extensionNormalized,
  filenameFromDisposition,
  isTextExtension
} from "./mime.ts";

const encoder = new TextEncoder();
const PDF_MAGIC = encoder.encode("%PDF-1.4\n");

describe("mime", () => {
  describe("extensionFromMime", () => {
    it.each([
      ["text/plain", "txt"],
      ["text/html; charset=utf-8", "html"],
      ["application/pdf", "pdf"],
      ["application/zip", "zip"],
      ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"],
      ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "pptx"],
      ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"]
    ])("maps %s to %s", (contentType, extension) => {
      expect(extensionFromMime(contentType)).toBe(extension);
    });

    it("returns null for missing content types", () => {
      expect(extensionFromMime(null)).toBeNull();
      expect(extensionFromMime(undefined)).toBeNull();
      expect(extensionFromMime("")).toBeNull();
    });

    it("returns an empty string for unknown content types", () => {
      expect(extensionFromMime("application/x-unknown-thing")).toBe("");
    });
  });

  describe("extensionFromBuffer", () => {
    it("sniffs magic numbers", async () => {
      expect(await extensionFromBuffer(PDF_MAGIC)).toBe("pdf");
    });

    it("returns null for undetectable content", async () => {
      expect(await extensionFromBuffer(new TextEncoder().encode("plain text"))).toBeNull();
    });
  });

  describe("extensionFromText", () => {
    it.each([
      ["plain text", "hello\tworld\r\n", "txt"],
      ["markdown", "# Title\n\n- item", "txt"],
      ["ANSI-colored text", "\x1b[31mred\x1b[0m", "txt"],
      ["a BOM", "\uFEFFtext", "txt"],
      ["an HTML doctype", "\n  <!DOCTYPE html><title>x</title>", "html"],
      ["an HTML fragment with a body", "<body><p>x</p></body>", "html"],
      ["an RSS feed", '<?xml version="1.0"?>\n<rss version="2.0"><channel/></rss>', "rss"],
      ["an Atom feed", '<feed xmlns="http://www.w3.org/2005/Atom"></feed>', "atom"],
      ["other XML", '<?xml version="1.0"?><root/>', "xml"],
      ["a notebook", '{"cells": [], "metadata": {}, "nbformat": 4}', "ipynb"],
      ["other JSON", '{"cells": []}', "txt"],
      ["a non-HTML tag", "<p>just a paragraph</p>", "txt"]
    ])("detects %s", (_name, text, extension) => {
      expect(extensionFromText(encoder.encode(text))).toBe(extension);
    });

    it.each([
      ["invalid UTF-8", new Uint8Array([0xff, 0xfe, 0x41])],
      ["NUL bytes", new Uint8Array([0x41, 0x00, 0x42])],
      ["zip data", zipSync({ "a.txt": encoder.encode("a") })]
    ])("rejects %s", (_name, bytes) => {
      expect(extensionFromText(bytes)).toBeNull();
    });
  });

  describe("filenameFromDisposition", () => {
    it.each([
      ['attachment; filename="report.pdf"', "report.pdf"],
      ["attachment; filename=report.pdf", "report.pdf"],
      ["attachment; filename=report.pdf; size=1", "report.pdf"],
      ["attachment; filename*=UTF-8''r%C3%A9sum%C3%A9.docx", "r\u00e9sum\u00e9.docx"],
      ["attachment; filename*=utf-8'en'notes.txt", "notes.txt"],
      ["attachment; filename=\"fallback.txt\"; filename*=UTF-8''preferred.md", "preferred.md"],
      ["attachment; filename*=UTF-8''bad%E0.txt", "bad%E0.txt"]
    ])("reads %s", (disposition, filename) => {
      expect(filenameFromDisposition(disposition)).toBe(filename);
    });

    it.each([null, undefined, "", "inline", 'attachment; filename=""'])(
      "returns null for %j",
      (disposition) => {
        expect(filenameFromDisposition(disposition)).toBeNull();
      }
    );
  });

  describe("detectExtensions", () => {
    it("orders candidates from most to least reliable, without duplicates", async () => {
      const extensions = await detectExtensions(PDF_MAGIC, {
        extension: ".MD",
        filename: "file.csv",
        urls: ["https://example.com/a.htm", null, "https://example.com/b.md"],
        contentType: "application/zip"
      });
      expect(extensions).toEqual(["md", "csv", "htm", "zip", "pdf"]);
    });

    it("falls back to sniffing text content", async () => {
      expect(await detectExtensions(encoder.encode("<!doctype html><p>x</p>"))).toEqual(["html"]);
      expect(await detectExtensions(encoder.encode("just text"))).toEqual(["txt"]);
    });

    it("decodes URL paths and ignores invalid URLs", async () => {
      const extensions = await detectExtensions(new Uint8Array([0]), {
        urls: ["https://example.com/my%20file.docx?download=1", "not a url"]
      });
      expect(extensions).toEqual(["docx"]);
    });

    it("ignores unknown MIME types", async () => {
      expect(
        await detectExtensions(new Uint8Array([0]), { contentType: "application/x-unknown" })
      ).toEqual([]);
    });

    it("returns nothing for unidentifiable binary data", async () => {
      expect(await detectExtensions(new Uint8Array([0, 1, 2, 3]))).toEqual([]);
    });
  });

  describe("extensionFromPathname", () => {
    it.each([
      ["report.pdf", "pdf"],
      ["/files/archive.tar.ZIP", "zip"],
      ["nested/dir/page.html", "html"]
    ])("extracts the extension from %s", (pathname, extension) => {
      expect(extensionFromPathname(pathname)).toBe(extension);
    });

    it.each(["", "/", "README", ".gitignore", "dir.v2/file"])("returns null for %j", (pathname) => {
      expect(extensionFromPathname(pathname)).toBeNull();
    });
  });

  describe("extensionNormalized", () => {
    it("lowercases and strips leading dots", () => {
      expect(extensionNormalized(" .PDF ")).toBe("pdf");
      expect(extensionNormalized("..txt")).toBe("txt");
    });

    it("optionally prefixes a dot", () => {
      expect(extensionNormalized("PDF", true)).toBe(".pdf");
    });

    it("returns an empty string for missing extensions", () => {
      expect(extensionNormalized(null)).toBe("");
      expect(extensionNormalized(undefined)).toBe("");
    });
  });

  describe("isTextExtension", () => {
    it.each(["txt", "md", "csv", "html"])("treats %s as text", (extension) => {
      expect(isTextExtension(extension)).toBe(true);
    });

    it.each(["pdf", "zip", "docx", "png", "xml", "nope"])(
      "does not treat %s as text",
      (extension) => {
        expect(isTextExtension(extension)).toBe(false);
      }
    );
  });
});
