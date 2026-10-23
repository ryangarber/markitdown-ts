import { pptxToHtml } from "@jvmr/pptx-to-html";
import {
  DOMParser,
  Document as XmlDocument,
  Element as XmlElement,
  Node as XmlNode
} from "@xmldom/xmldom";
import type { ConverterOptions, ConverterResult } from "../types.ts";
import { toArrayBuffer } from "../utils/index.ts";
import { HtmlConverter } from "./html.ts";

export class PptxConverter extends HtmlConverter {
  override async convert(source: Uint8Array, options: ConverterOptions): Promise<ConverterResult> {
    if (options.extension !== "pptx") {
      return null;
    }

    const slides = await pptxToHtml(toArrayBuffer(source), {
      domParserFactory: createPptxDomParser
    });
    const sections: string[] = [];

    for (const [index, html] of slides.entries()) {
      const result = await this.convertHtml(`<html><body>${html}</body></html>`);
      sections.push(`<!-- Slide number: ${index + 1} -->\n${result?.markdown.trim() ?? ""}`);
    }

    const markdown = sections.join("\n\n");
    return {
      title: null,
      markdown
    };
  }
}

function createPptxDomParser(): { parseFromString(xml: string, mime: string): Document } {
  if (typeof globalThis.DOMParser === "function") {
    return new globalThis.DOMParser();
  }

  patchXmlDom();
  return new DOMParser() as unknown as {
    parseFromString(xml: string, mime: string): Document;
  };
}

let xmlDomPatched = false;

function patchXmlDom(): void {
  if (xmlDomPatched) {
    return;
  }
  xmlDomPatched = true;

  defineMethod(XmlElement.prototype, "querySelector", querySelector);
  defineMethod(XmlElement.prototype, "querySelectorAll", querySelectorAll);
  defineMethod(XmlDocument.prototype, "querySelector", querySelector);
  defineMethod(XmlDocument.prototype, "querySelectorAll", querySelectorAll);

  defineGetter(XmlElement.prototype, "children", function (this: XmlElement) {
    return [...this.childNodes].filter((node) => node.nodeType === 1);
  });
  defineGetter(XmlNode.prototype, "parentElement", function (this: XmlNode) {
    const parent = this.parentNode;
    return parent?.nodeType === 1 ? parent : null;
  });
}

function querySelector(this: XmlElement | XmlDocument, selector: string): XmlElement | null {
  for (const group of selector.split(",")) {
    const match = queryByPath(this, group.trim());
    if (match) {
      return match;
    }
  }
  return null;
}

function querySelectorAll(): XmlElement[] {
  return [];
}

function queryByPath(root: XmlElement | XmlDocument, selector: string): XmlElement | null {
  const tokens = selector.split(/\s+/).filter(Boolean);
  let current: Array<XmlElement | XmlDocument> = [root];

  for (const token of tokens) {
    const localName = selectorLocalName(token);
    const next: XmlElement[] = [];
    for (const node of current) {
      next.push(...Array.from(node.getElementsByTagNameNS("*", localName)));
    }
    current = next;
  }

  return (current[0] as XmlElement | undefined) ?? null;
}

function selectorLocalName(token: string): string {
  if (token.includes("|")) {
    return token.slice(token.lastIndexOf("|") + 1);
  }
  return token.replace(/\\:/g, ":").split(":").pop() ?? token;
}

function defineMethod(target: object, name: string, value: (...args: never[]) => unknown): void {
  Object.defineProperty(target, name, { configurable: true, writable: true, value });
}

function defineGetter(target: object, name: string, get: () => unknown): void {
  if (Object.getOwnPropertyDescriptor(target, name)) {
    return;
  }
  Object.defineProperty(target, name, { configurable: true, get });
}
