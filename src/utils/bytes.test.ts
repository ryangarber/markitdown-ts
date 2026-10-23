import { decodeText, isBlob, toArrayBuffer, toUint8Array } from "./bytes.ts";

const encoder = new TextEncoder();

describe("bytes", () => {
  describe("toUint8Array", () => {
    it("returns Uint8Array sources unchanged", async () => {
      const source = encoder.encode("bytes");
      expect(await toUint8Array(source)).toBe(source);
    });

    it("reads blobs", async () => {
      const result = await toUint8Array(new Blob(["blob"]));
      expect(decodeText(result)).toBe("blob");
    });

    it("reads array buffers", async () => {
      const result = await toUint8Array(encoder.encode("buffer").buffer);
      expect(decodeText(result)).toBe("buffer");
    });

    it("respects the offset and length of views", async () => {
      const bytes = encoder.encode("--view--");
      const view = new DataView(bytes.buffer, 2, 4);
      expect(decodeText(await toUint8Array(view))).toBe("view");
    });

    it("reinterprets non-byte typed arrays as bytes", async () => {
      const result = await toUint8Array(new Uint16Array([0x0201]));
      expect(result.byteLength).toBe(2);
    });
  });

  describe("toArrayBuffer", () => {
    it("copies only the viewed region", () => {
      const bytes = encoder.encode("--slice--").subarray(2, 7);
      const buffer = toArrayBuffer(bytes);
      expect(buffer.byteLength).toBe(5);
      expect(decodeText(new Uint8Array(buffer))).toBe("slice");
    });

    it("does not share memory with the source", () => {
      const bytes = encoder.encode("abc");
      new Uint8Array(toArrayBuffer(bytes))[0] = 0;
      expect(decodeText(bytes)).toBe("abc");
    });
  });

  describe("decodeText", () => {
    it("decodes UTF-8", () => {
      expect(decodeText(encoder.encode("héllo ✓"))).toBe("héllo ✓");
    });
  });

  describe("isBlob", () => {
    it("detects blobs and files", () => {
      expect(isBlob(new Blob([]))).toBe(true);
      expect(isBlob(new File([], "a.txt"))).toBe(true);
    });

    it("rejects non-blobs", () => {
      expect(isBlob(new Uint8Array())).toBe(false);
      expect(isBlob(null)).toBe(false);
      expect(isBlob({ arrayBuffer: () => null })).toBe(false);
    });
  });
});
