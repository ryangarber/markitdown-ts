/**
 * In-memory inputs supported by the conversion API.
 *
 * `Uint8Array` is the preferred type. Other typed arrays, data views,
 * array buffers, shared array buffers, blobs, and files are normalized to it.
 */
export type ByteSource = Uint8Array | ArrayBufferLike | ArrayBufferView | Blob;

/**
 * All supported input types for the conversion API.
 */
export type ConverterSource = ByteSource | Response | URL | string;

export type ConverterOptions<Options = unknown> = Options & {
  /** Original file extension, with or without a leading dot. */
  extension?: string;
  /** Original URL, used by site-specific HTML converters. */
  url?: string;
  /** Override the global fetch implementation. */
  fetch?: typeof fetch;
  /** Enable debug logging. */
  debug?: boolean;
  /** @internal Parent converters. */
  _converters?: Converter[];
};

export type ConverterResult = {
  title: string | null;
  markdown: string;
} | null;

export interface Converter<Options = unknown> {
  convert(source: Uint8Array, options: ConverterOptions<Options>): Promise<ConverterResult>;
}
