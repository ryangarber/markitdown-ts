import mammoth from "mammoth";
import type { ConverterOptions, ConverterResult } from "../types.ts";
import { toArrayBuffer } from "../utils/index.ts";
import { HtmlConverter } from "./html.ts";

export interface MammothOptions {
  mammoth?: NonNullable<Parameters<typeof mammoth.convertToHtml>[1]>;
}

export class DocxConverter extends HtmlConverter<MammothOptions> {
  override async convert(
    source: Uint8Array,
    options: ConverterOptions<MammothOptions>
  ): Promise<ConverterResult> {
    if (options.extension !== "docx") {
      return null;
    }

    let mammothInput: Parameters<typeof mammoth.convertToHtml>[0] = {
      arrayBuffer: toArrayBuffer(source)
    };

    if (
      typeof process !== "undefined" &&
      process.versions !== null &&
      process.versions.node !== null
    ) {
      mammothInput = { buffer: Buffer.from(source) };
    }

    const mammothOptions: NonNullable<MammothOptions["mammoth"]> = Object.fromEntries(
      Object.entries(options.mammoth ?? {}).flatMap(([key, value]) =>
        value !== undefined ? [[key, value]] : []
      )
    );

    const html = await mammoth.convertToHtml(mammothInput, mammothOptions);

    return this.convertHtml(html.value);
  }
}
