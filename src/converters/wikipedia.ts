import type { Converter, ConverterOptions, ConverterResult } from "../types.ts";
import { decodeText, parseHtmlDocument } from "../utils/index.ts";

const WIKIPEDIA_URL = /^https?:\/\/[a-z]{2,3}\.wikipedia\.org\//i;

export class WikipediaConverter implements Converter {
  async convert(source: Uint8Array, options: ConverterOptions = {}): Promise<ConverterResult> {
    if (
      (options.extension !== "html" && options.extension !== "htm") ||
      !WIKIPEDIA_URL.test(options.url ?? "")
    ) {
      return null;
    }

    return parseHtmlDocument(decodeText(source), (document) => {
      document.querySelectorAll("script, style").forEach((element) => {
        element.remove();
      });

      const body = document.querySelector("div#mw-content-text");
      const pageTitle = document.querySelector("span.mw-page-title-main")?.textContent?.trim();

      const title = pageTitle || document.title || null;
      const node = body || document;

      return {
        title: { type: "metadata", value: title },
        markdown: { type: "node", value: node }
      };
    });
  }
}
