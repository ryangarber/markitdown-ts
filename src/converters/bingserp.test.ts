import { BingSerpConverter } from "./bingserp.ts";

const encoder = new TextEncoder();
const URL = "https://www.bing.com/search?q=markitdown+typescript";

function bingRedirect(target: string): string {
  const encoded = btoa(target).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `https://www.bing.com/ck/a?!&amp;u=a1${encoded}&amp;ntb=1`;
}

const PAGE = `<html>
  <head><title>markitdown typescript - Search</title></head>
  <body>
    <header>Bing chrome</header>
    <ol id="b_results">
      <li class="b_algo">
        <h2><a href="${bingRedirect("https://github.com/microsoft/markitdown")}">MarkItDown</a></h2>
        <div class="tptt">GitHub</div><span class="algoSlug_icon">icon</span>
        <p>Python tool for converting files to Markdown.</p>
      </li>
      <li class="b_algo">
        <h2><a href="https://example.com/direct">Direct link</a></h2>
        <p>Second result.</p>
      </li>
      <li class="b_ad">Sponsored result</li>
    </ol>
  </body>
</html>`;

function convert(html: string, options: { extension?: string; url?: string } = {}) {
  return new BingSerpConverter().convert(encoder.encode(html), {
    extension: "html",
    url: URL,
    ...options
  });
}

describe("BingSerpConverter", () => {
  it("extracts organic results with decoded links", async () => {
    const result = await convert(PAGE);

    expect(result?.title).toBe('Search results for "markitdown typescript"');
    expect(result?.markdown).toBe(
      [
        '*   ## [MarkItDown](https://github.com/microsoft/markitdown "https://github.com/microsoft/markitdown")\n\nGitHub\n\nPython tool for converting files to Markdown.',
        '*   ## [Direct link](https://example.com/direct "https://example.com/direct")\n\nSecond result.'
      ].join("\n\n")
    );
  });

  it("does not include ads, icons, or page chrome", async () => {
    const markdown = (await convert(PAGE))?.markdown;
    expect(markdown).not.toContain("Sponsored");
    expect(markdown).not.toContain("icon");
    expect(markdown).not.toContain("Bing chrome");
  });

  it("decodes non-ASCII redirect targets", async () => {
    const target = "https://example.com/café";
    const bytes = new TextEncoder().encode(target);
    const encoded = btoa(String.fromCharCode(...bytes)).replace(/=+$/, "");
    const html = `<html><body><div class="b_algo"><a href="https://www.bing.com/ck/a?u=a1${encoded}">Cafe</a></div></body></html>`;
    expect((await convert(html))?.markdown).toContain(`(${target} `);
  });

  it("returns empty markdown when there are no results", async () => {
    const result = await convert("<html><body><p>No results</p></body></html>");
    expect(result?.markdown).toBe("");
  });

  it.each([
    ["non-search Bing URLs", { url: "https://www.bing.com/images" }],
    ["other search engines", { url: "https://www.google.com/search?q=x" }],
    ["missing URLs", { url: undefined }],
    ["non-HTML extensions", { extension: "txt" }]
  ])("ignores %s", async (_name, options) => {
    expect(await convert(PAGE, options)).toBeNull();
  });
});
