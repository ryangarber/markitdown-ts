import type { Converter, ConverterOptions, ConverterResult } from "../types.ts";
import { decodeText, parseHtmlDocument } from "../utils/index.ts";

export class HtmlConverter<Options = unknown> implements Converter<Options> {
  async convert(source: Uint8Array, options: ConverterOptions<Options>): Promise<ConverterResult> {
    if (options.extension !== "html" && options.extension !== "htm") {
      return null;
    }

    return this.convertHtml(decodeText(source));
  }

  protected async convertHtml(html: string): Promise<ConverterResult> {
    return parseHtmlDocument(html, (document) => {
      const title = document.title || null;

      document.querySelectorAll("script, style, title").forEach((element) => {
        element.remove();
      });

      return {
        title: { type: "metadata", value: title },
        // TODO
        markdown: { type: "node", value: document }
      };
    });
  }
}
