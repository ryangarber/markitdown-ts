import * as entry from "./index.ts";

describe("package entry", () => {
  // Regression: MarkItDown was exported with `export type`, so it was erased at runtime.
  it("exports a constructible MarkItDown", async () => {
    expect(typeof entry.MarkItDown).toBe("function");
    const result = await new entry.MarkItDown().convert(new TextEncoder().encode("ok"), {
      extension: "txt"
    });
    expect(result?.markdown).toBe("ok");
  });

  it("exports nothing else at runtime", () => {
    expect(Object.keys(entry)).toEqual(["MarkItDown"]);
  });
});
