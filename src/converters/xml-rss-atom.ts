import type { Document, Element } from "@xmldom/xmldom";
import { DOMParser } from "@xmldom/xmldom";
import type { Converter, ConverterOptions, ConverterResult } from "../types.ts";
import { decodeText, parseHtmlDocument } from "../utils/index.ts";

export class RSSConverter implements Converter {
  async convert(source: Uint8Array, options: ConverterOptions = {}): Promise<ConverterResult> {
    if (
      options.extension !== "xml" &&
      options.extension !== "rss" &&
      options.extension !== "atom"
    ) {
      return null;
    }

    const document = new DOMParser().parseFromString(decodeText(source), "text/xml");
    if (document.getElementsByTagName("rss").length > 0) {
      return parseRss(document);
    }
    if (document.getElementsByTagName("feed")[0]?.getElementsByTagName("entry").length) {
      return parseAtom(document);
    }
    return null;
  }
}

function parseAtom(document: Document): ConverterResult {
  const root = document.getElementsByTagName("feed")[0];
  if (!root) return null;

  const title = getText(root, "title");
  const subtitle = getText(root, "subtitle");
  const sections = [`# ${title ?? "Feed"}`];
  if (subtitle) sections.push(subtitle);

  for (const entry of [...root.getElementsByTagName("entry")]) {
    const entryTitle = getText(entry, "title");
    const updated = getText(entry, "updated");
    const summary = getText(entry, "summary");
    const content = getText(entry, "content");
    const lines: string[] = [];
    if (entryTitle) lines.push(`## ${entryTitle}`);
    if (updated) lines.push(`Updated on: ${updated}`);
    const node = summary || content;
    if (node) {
      lines.push(
        parseHtmlDocument(node, (document) => ({
          markdown: { type: "node", value: document.documentElement }
        })).markdown
      );
    }
    sections.push(lines.join("\n\n"));
  }

  const markdown = sections.join("\n\n");
  return { title, markdown };
}

function parseRss(document: Document): ConverterResult {
  const channel = document.getElementsByTagName("rss")[0]?.getElementsByTagName("channel")[0];
  if (!channel) return null;

  const title = getText(channel, "title");
  const description = getText(channel, "description");
  const sections: string[] = title ? [`# ${title}`] : [];
  if (description) sections.push(description);

  for (const item of [...channel.getElementsByTagName("item")]) {
    const itemTitle = getText(item, "title");
    const published = getText(item, "pubDate");
    const itemDescription = getText(item, "description");
    const content = getText(item, "content:encoded");
    const lines: string[] = [];
    if (itemTitle) lines.push(`## ${itemTitle}`);
    if (published) lines.push(`Published on: ${published}`);
    const node = itemDescription || content;
    if (node) {
      lines.push(
        parseHtmlDocument(node, (document) => ({
          markdown: { type: "node", value: document.documentElement }
        })).markdown
      );
    }
    sections.push(lines.join("\n\n"));
  }

  const markdown = sections.join("\n\n");
  return { title, markdown };
}

function getText(element: Element, tagName: string): string | null {
  const node = element.getElementsByTagName(tagName)[0];
  return node?.textContent?.trim() || null;
}
