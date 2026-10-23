import type { Converter, ConverterOptions, ConverterResult } from "../types.ts";
import { decodeText, isTextExtension } from "../utils/index.ts";

export class PlainTextConverter implements Converter {
  async convert(source: Uint8Array, options: ConverterOptions = {}): Promise<ConverterResult> {
    if (!isTextExtension(options.extension ?? "")) {
      return null;
    }

    const content = decodeText(source);
    return { title: null, markdown: content };
  }
}
