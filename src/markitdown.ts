import * as converters from "./converters/index.ts";
import type { Converter, ConverterOptions, ConverterResult, ConverterSource } from "./types.ts";
import { detectExtensions, filenameFromDisposition, isBlob, toUint8Array } from "./utils/index.ts";

export class MarkItDown {
  private readonly converters: Converter[] = [];

  constructor() {
    // Order matters: later registrations take precedence, so generic converters come first.
    const ordered = [
      converters.PlainTextConverter,
      converters.HtmlConverter,
      converters.ZipConverter,
      converters.RSSConverter,
      converters.WikipediaConverter,
      converters.YouTubeConverter,
      converters.BingSerpConverter,
      converters.DocxConverter,
      converters.XlsxConverter,
      converters.PptxConverter,
      converters.PdfConverter,
      converters.IpynbConverter
    ];
    for (const converter of ordered) {
      this.registerConverter(new converter());
    }
  }

  /** Convert a URL, response, blob, array buffer, data view, or typed array. */
  async convert(source: ConverterSource, options: ConverterOptions = {}): Promise<ConverterResult> {
    if (typeof source === "string" || source instanceof URL) {
      return this.convertUrl(source.toString(), options);
    }

    if (isResponse(source)) {
      return this.convertResponse(source, options);
    }

    const bytes = await toUint8Array(source);
    const extensions = await detectExtensions(bytes, {
      extension: options.extension,
      filename: isBlob(source) && "name" in source ? String(source.name) : null,
      urls: [options.url],
      contentType: isBlob(source) ? source.type : null
    });

    return this.convertBytes(bytes, extensions, options);
  }

  private async convertUrl(
    source: string,
    { fetch: fetchImplementation = globalThis.fetch, ...options }: ConverterOptions
  ): Promise<ConverterResult> {
    const url = new URL(source);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error(`Unsupported URL protocol: ${url.protocol}`);
    }
    if (!fetchImplementation) {
      throw new Error("No fetch implementation is available.");
    }

    const response = await fetchImplementation(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${url}, status: ${response.status}`);
    }

    return this.convertResponse(response, { ...options, url: url.toString() });
  }

  private async convertResponse(
    response: Response,
    options: ConverterOptions
  ): Promise<ConverterResult> {
    const bytes = new Uint8Array(await response.arrayBuffer());
    // The requested URL may lack an extension that the redirected one has, or vice versa.
    const extensions = await detectExtensions(bytes, {
      extension: options.extension,
      filename: filenameFromDisposition(response.headers.get("content-disposition")),
      urls: [options.url, response.url],
      contentType: response.headers.get("content-type")
    });

    return this.convertBytes(bytes, extensions, {
      ...options,
      url: options.url || response.url || undefined
    });
  }

  private async convertBytes(
    source: Uint8Array,
    extensions: string[],
    options: ConverterOptions
  ): Promise<ConverterResult> {
    if (extensions.length === 0) {
      throw new Error("Could not determine the file type. Provide `extension` for better results.");
    }

    let lastError: unknown;

    for (const extension of extensions) {
      for (const converter of this.converters) {
        try {
          const result = await converter.convert(source, {
            ...options,
            extension,
            _converters: this.converters
          });
          if (result) {
            result.markdown = result.markdown
              .replace(/\r\n|\r|\n/g, "\n")
              .trim()
              .replace(/\n{3,}/g, "\n\n");
            return result;
          }
        } catch (error) {
          if (options.debug) {
            console.error("Converter threw error:", error);
          }
          lastError = error;
        }
      }
    }

    const formats = extensions.join(", ");

    if (lastError) {
      throw new Error(`Could not convert ${formats} to Markdown: ${String(lastError)}`);
    }

    throw new Error(`Unsupported file type: ${formats}.`);
  }

  private registerConverter(converter: Converter): void {
    this.converters.unshift(converter);
  }
}

function isResponse(value: unknown): value is Response {
  return typeof Response !== "undefined" && value instanceof Response;
}
