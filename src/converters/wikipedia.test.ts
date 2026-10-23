import { WikipediaConverter } from "./wikipedia.ts";

const encoder = new TextEncoder();
const URL = "https://en.wikipedia.org/wiki/Markdown";

const PAGE = `<html>
  <head><title>Markdown - Wikipedia</title><style>.x{}</style></head>
  <body>
    <nav>Navigation chrome</nav>
    <h1><span class="mw-page-title-main">Markdown</span></h1>
    <div id="mw-content-text">
      <p><b>Markdown</b> is a lightweight markup language.</p>
      <script>tracking()</script>
      <table><tr><th>Ext</th></tr><tr><td>.md</td></tr></table>
    </div>
    <footer>Footer chrome</footer>
  </body>
</html>`;

function convert(html: string, options: { extension?: string; url?: string } = {}) {
  return new WikipediaConverter().convert(encoder.encode(html), {
    extension: "html",
    url: URL,
    ...options
  });
}

describe("WikipediaConverter", () => {
  it("extracts only the main content and the page title", async () => {
    expect(await convert(PAGE)).toEqual({
      title: "Markdown",
      markdown: "**Markdown** is a lightweight markup language.\n\n| Ext |\n\n| --- |\n\n| .md |"
    });
  });

  it.each(["https://de.wikipedia.org/wiki/X", "http://als.wikipedia.org/wiki/X"])(
    "matches %s",
    async (url) => {
      expect(await convert(PAGE, { url })).not.toBeNull();
    }
  );

  it("falls back to the document title and whole document", async () => {
    const result = await convert(
      "<html><head><title>Fallback</title></head><body><p>Whole page</p></body></html>"
    );
    expect(result?.title).toBe("Fallback");
    expect(result?.markdown).toContain("Whole page");
  });

  it.each([
    ["non-Wikipedia URLs", { url: "https://example.com/wiki/Markdown" }],
    ["lookalike hosts", { url: "https://en.wikipedia.org.evil.com/wiki/X" }],
    ["missing URLs", { url: undefined }],
    ["non-HTML extensions", { extension: "txt" }]
  ])("ignores %s", async (_name, options) => {
    expect(await convert(PAGE, options)).toBeNull();
  });
});
