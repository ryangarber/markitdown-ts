import { extractText, getDocumentProxy, getMeta } from "unpdf";
import type { Converter, ConverterOptions, ConverterResult } from "../types.ts";

export class PdfConverter implements Converter {
  async convert(source: Uint8Array, options: ConverterOptions): Promise<ConverterResult> {
    if (options.extension !== "pdf") {
      return null;
    }

    const pdf = await getDocumentProxy(source.slice());
    try {
      const [{ text }, { info }] = await Promise.all([
        extractText(pdf, { mergePages: true }),
        getMeta(pdf)
      ]);
      const title = typeof info.Title === "string" && info.Title.trim() ? info.Title : null;

      return { title, markdown: text };
    } finally {
      await pdf.loadingTask.destroy();
    }
  }
}
