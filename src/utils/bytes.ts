import type { ByteSource } from "../types.ts";

export async function toUint8Array(source: ByteSource): Promise<Uint8Array> {
  if (source instanceof Uint8Array) {
    return source;
  }

  if (isBlob(source)) {
    return new Uint8Array(await source.arrayBuffer());
  }

  if (ArrayBuffer.isView(source)) {
    return new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
  }

  return new Uint8Array(source);
}

export function toArrayBuffer(source: Uint8Array): ArrayBuffer {
  return source.slice().buffer;
}

export function decodeText(source: Uint8Array): string {
  return new TextDecoder().decode(source);
}

export function isBlob(value: unknown): value is Blob {
  return typeof Blob !== "undefined" && value instanceof Blob;
}
