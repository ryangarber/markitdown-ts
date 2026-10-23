import { IpynbConverter } from "./ipynb.ts";

const encoder = new TextEncoder();

function convert(notebook: unknown, extension = "ipynb") {
  return new IpynbConverter().convert(encoder.encode(JSON.stringify(notebook)), { extension });
}

describe("IpynbConverter", () => {
  it("converts markdown, code, and raw cells", async () => {
    const result = await convert({
      cells: [
        { cell_type: "markdown", source: ["# Intro\n", "Some text"] },
        { cell_type: "code", source: ["x = 1\n", "print(x)"] },
        { cell_type: "raw", source: ["raw text"] },
        { cell_type: "unknown", source: ["skipped"] }
      ]
    });

    expect(result?.markdown).toBe(
      "# Intro\nSome text\n\n```python\nx = 1\nprint(x)\n```\n\n```\nraw text\n```"
    );
  });

  it("prefers the metadata title", async () => {
    const result = await convert({
      metadata: { title: "Notebook" },
      cells: [{ cell_type: "markdown", source: ["# Heading"] }]
    });
    expect(result?.title).toBe("Notebook");
  });

  it("falls back to the first markdown heading for the title", async () => {
    const result = await convert({
      cells: [
        { cell_type: "code", source: ["# not a heading"] },
        { cell_type: "markdown", source: ["## Sub\n", "# First Heading \n"] },
        { cell_type: "markdown", source: ["# Second Heading"] }
      ]
    });
    expect(result?.title).toBe("First Heading");
  });

  it("returns a null title when none is found", async () => {
    const result = await convert({ cells: [{ cell_type: "markdown", source: ["text"] }] });
    expect(result?.title).toBeNull();
  });

  it("handles notebooks without cells", async () => {
    expect(await convert({})).toEqual({ title: null, markdown: "" });
  });

  it("ignores other extensions", async () => {
    expect(await convert({ cells: [] }, "json")).toBeNull();
  });

  it("throws on invalid JSON", async () => {
    await expect(
      new IpynbConverter().convert(encoder.encode("{nope"), { extension: "ipynb" })
    ).rejects.toThrow(SyntaxError);
  });
});
