import type { Converter, ConverterOptions, ConverterResult } from "../types.ts";
import { decodeText, parseHtmlDocument } from "../utils/index.ts";

const YOUTUBE_URL =
  /^https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|shorts\/)?([a-zA-Z0-9_-]+)/i;

export class YouTubeConverter implements Converter {
  async convert(source: Uint8Array, options: ConverterOptions = {}): Promise<ConverterResult> {
    if (
      (options.extension !== "html" && options.extension !== "htm") ||
      !YOUTUBE_URL.test(options.url ?? "")
    ) {
      return null;
    }

    return parseHtmlDocument(decodeText(source), (document) => {
      const metadata: Record<string, string> = {};

      document.querySelectorAll("meta").forEach((meta) => {
        const content = meta.getAttribute("content");
        const key =
          meta.getAttribute("itemprop") ??
          meta.getAttribute("property") ??
          meta.getAttribute("name");
        if (key && content) {
          metadata[key] = content;
        }
      });

      try {
        for (const script of document.querySelectorAll("script")) {
          const content = script.textContent ?? "";
          if (!content.includes("ytInitialData")) {
            continue;
          }
          const start = content.indexOf("{");
          const end = content.lastIndexOf("}");
          if (start >= 0 && end > start) {
            const description = findKey(
              JSON.parse(content.slice(start, end + 1)),
              "attributedDescriptionBodyText"
            );
            if (isRecord(description) && typeof description.content === "string") {
              metadata.description = description.content;
            }
          }
          break;
        }
      } catch {
        // Meta description remains available when the page implementation changes.
      }

      const title = first(metadata, ["title", "og:title", "name"]) || document.title || null;
      const lines = ["# YouTube"];
      if (title) {
        lines.push(`## ${title}`);
      }

      const stats: string[] = [];
      const views = first(metadata, ["interactionCount"]);
      const keywords = first(metadata, ["keywords"]);
      const runtime = first(metadata, ["duration"]);
      if (views) stats.push(`- **Views:** ${views}`);
      if (keywords) stats.push(`- **Keywords:** ${keywords}`);
      if (runtime) stats.push(`- **Runtime:** ${runtime}`);
      if (stats.length > 0) {
        lines.push(`### Video Metadata\n\n${stats.join("\n")}`);
      }

      const description = first(metadata, ["description", "og:description"]);
      if (description) {
        lines.push(`### Description\n\n${description}`);
      }

      return {
        title: { type: "metadata", value: title },
        markdown: { type: "metadata", value: lines.join("\n\n") }
      };
    });
  }
}

function first(metadata: Record<string, string>, keys: string[]): string | null {
  for (const key of keys) {
    if (metadata[key]) return metadata[key];
  }
  return null;
}

function findKey(value: unknown, key: string): unknown {
  if (Array.isArray(value)) {
    for (const item of value) {
      const match = findKey(item, key);
      if (match !== undefined) return match;
    }
  } else if (isRecord(value)) {
    if (key in value) return value[key];
    for (const item of Object.values(value)) {
      const match = findKey(item, key);
      if (match !== undefined) return match;
    }
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
