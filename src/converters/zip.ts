import { unzipSync } from "fflate";
import type { Converter, ConverterOptions, ConverterResult } from "../types.ts";
import { extensionFromPathname } from "../utils/index.ts";

export class ZipConverter implements Converter {
  async convert(source: Uint8Array, options: ConverterOptions = {}): Promise<ConverterResult> {
    if (options.extension !== "zip") {
      return null;
    }

    const files = unzipSync(source, { filter: (file) => !file.name.endsWith("/") });
    const converters = options._converters ?? [];
    const zipName = options.url ?? "archive.zip";
    const sections = [`Content from the zip file \`${zipName}\`:`];

    for (const [name, bytes] of Object.entries(files)) {
      const result = await convertEntry(bytes, name, converters, options);
      if (result) {
        sections.push(`## File: ${name}\n\n${result.markdown}`);
      }
    }

    const markdown = sections.join("\n\n");
    return { title: null, markdown };
  }
}

async function convertEntry(
  source: Uint8Array,
  name: string,
  converters: Converter[],
  options: ConverterOptions
): Promise<ConverterResult> {
  const extension = extensionFromPathname(name);
  if (!extension) {
    return null;
  }

  const entryOptions: ConverterOptions = {
    ...options,
    extension,
    url: undefined,
    _converters: converters
  };

  for (const converter of converters) {
    try {
      const result = await converter.convert(source, entryOptions);
      if (result) {
        return result;
      }
    } catch {
      // Match the original ZipConverter: skip entries that fail conversion.
    }
  }

  return null;
}
