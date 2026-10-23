import { HtmlConverter } from "./html.ts";

const encoder = new TextEncoder();

function convert(html: string, extension = "html") {
  return new HtmlConverter().convert(encoder.encode(html), { extension });
}

describe("HtmlConverter", () => {
  it.each(["html", "htm"])("converts .%s files", async (extension) => {
    const result = await convert(
      "<html><head><title>Example</title></head><body><h1>Hello</h1></body></html>",
      extension
    );
    expect(result).toEqual({ title: "Example", markdown: "# Hello" });
  });

  it.each(["txt", "xml", undefined])("ignores %j", async (extension) => {
    const result = await new HtmlConverter().convert(encoder.encode("<p>x</p>"), { extension });
    expect(result).toBeNull();
  });

  it("returns a null title when the document has none", async () => {
    const result = await convert("<html><body><p>No title</p></body></html>");
    expect(result?.title).toBeNull();
  });

  // Regression: body content was dropped when the linkedom document was handed to Turndown.
  it("extracts body content", async () => {
    const result = await convert(`<html>
      <head><title>Doc</title><meta charset="utf-8"></head>
      <body>
        <h1>Heading</h1>
        <p>Some <strong>bold</strong> and <em>italic</em> text.</p>
        <ul><li>one</li><li>two</li></ul>
      </body>
    </html>`);

    expect(result?.markdown).toBe(
      "# Heading\n\nSome **bold** and _italic_ text.\n\n*   one\n\n*   two"
    );
  });

  it("does not leak the title, scripts, or styles into the markdown", async () => {
    const result = await convert(`<html>
      <head><title>Secret Title</title><style>body { color: red }</style></head>
      <body><script>window.secret = 1</script><p>Visible</p></body>
    </html>`);

    expect(result?.markdown).toBe("Visible");
  });

  it("converts tables", async () => {
    const result = await convert(
      "<html><body><table><tr><th>name</th><th>value</th></tr><tr><td>a</td><td>1</td></tr></table></body></html>"
    );
    expect(result?.markdown).toBe("| name | value |\n\n| --- | --- |\n\n| a   | 1   |");
  });

  it("converts links and images", async () => {
    const result = await convert(
      '<html><body><p><a href="https://example.com">Example</a> <img src="/a.png" alt="A"></p></body></html>'
    );
    expect(result?.markdown).toBe(
      '[Example](https://example.com "https://example.com") ![A](/a.png)'
    );
  });
});
