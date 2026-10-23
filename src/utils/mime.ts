import { fileTypeFromBuffer } from "file-type";
import { Mime } from "mime";
import otherTypes from "mime/types/other.js";
import standardTypes from "mime/types/standard.js";

const mime = new Mime(standardTypes, otherTypes);

export function extensionFromMime(contentType: string | null | undefined): string | null {
  if (!contentType) return null;
  return extensionNormalized(mime.getExtension(contentType));
}

export async function extensionFromBuffer(buffer: Uint8Array): Promise<string | null> {
  const type = await fileTypeFromBuffer(buffer);
  if (!type) return null;
  return extensionNormalized(type.ext);
}

/**
 * Sniffs text formats that have no magic number. Returns null for binary content, and `txt`
 * for text that is not recognized as anything more specific.
 */
export function extensionFromText(buffer: Uint8Array): string | null {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return null;
  }
  if (hasBinaryControlCharacters(text)) {
    return null;
  }

  const start = text.trimStart().slice(0, 1024).toLowerCase();
  if (start.startsWith("<")) {
    if (/<rss[\s>]/.test(start)) return "rss";
    if (/<feed[\s>]/.test(start)) return "atom";
    if (/^<!doctype html|<(html|head|body)[\s>]/.test(start)) return "html";
    if (start.startsWith("<?xml")) return "xml";
  }
  if (start.startsWith("{") && /"nbformat"\s*:/.test(text) && /"cells"\s*:/.test(text)) {
    return "ipynb";
  }
  return "txt";
}

function hasBinaryControlCharacters(text: string): boolean {
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    // Whitespace (tab through carriage return) and escape (ANSI colors) still appear in text.
    if (code < 0x20 && (code < 0x09 || code > 0x0d) && code !== 0x1b) {
      return true;
    }
  }
  return false;
}

export function extensionFromPathname(pathname: string): string | null {
  const filename = pathname.split("/").pop() ?? "";
  const dot = filename.lastIndexOf(".");
  return dot > 0 ? extensionNormalized(filename.slice(dot)) : null;
}

/** Reads the filename from a Content-Disposition header, preferring the RFC 5987 form. */
export function filenameFromDisposition(disposition: string | null | undefined): string | null {
  if (!disposition) return null;

  const extended = disposition.match(/filename\*\s*=\s*[\w-]*'[^']*'([^;]+)/i)?.[1]?.trim();
  if (extended) {
    try {
      return decodeURIComponent(extended);
    } catch {
      return extended;
    }
  }

  const plain = disposition.match(/filename\s*=\s*(?:"([^"]*)"|([^;]+))/i);
  return (plain?.[1] ?? plain?.[2])?.trim() || null;
}

export type FileTypeHints = {
  /** Explicit extension, with or without a leading dot. */
  extension?: string | null;
  /** Filename, e.g. from a `File` or a Content-Disposition header. */
  filename?: string | null;
  /** URLs the content was loaded from, e.g. the requested and redirected URLs. */
  urls?: (string | null | undefined)[];
  /** MIME type, e.g. from a `Blob` or a Content-Type header. */
  contentType?: string | null;
};

/**
 * Lists candidate extensions for the content, most reliable first: explicit extensions, then
 * names, then declared MIME types, then the content itself.
 */
export async function detectExtensions(
  buffer: Uint8Array,
  { extension, filename, urls = [], contentType }: FileTypeHints = {}
): Promise<string[]> {
  const candidates = [
    extensionNormalized(extension),
    filename ? extensionFromPathname(filename) : null,
    ...urls.map((url) => (url ? extensionFromUrl(url) : null)),
    extensionFromMime(contentType),
    // Content with a magic number is not sniffed as text, so a damaged binary isn't dumped as text.
    (await extensionFromBuffer(buffer)) ?? extensionFromText(buffer)
  ];
  return [...new Set(candidates.filter((candidate): candidate is string => !!candidate))];
}

function extensionFromUrl(url: string): string | null {
  try {
    return extensionFromPathname(decodeURIComponent(new URL(url).pathname));
  } catch {
    return null;
  }
}

export function extensionNormalized(extension: string | null | undefined, withDot = false): string {
  if (!extension) {
    return "";
  }

  const normalized = extension
    .trim()
    .toLowerCase()
    .replace(/^[.-]+/, "");
  return withDot ? `.${normalized}` : normalized;
}

export function isTextExtension(extension: string): boolean {
  const type = mime.getType(extension);
  if (!type) return false;
  return type.startsWith("text/");
}
