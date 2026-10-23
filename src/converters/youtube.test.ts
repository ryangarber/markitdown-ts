import { YouTubeConverter } from "./youtube.ts";

const encoder = new TextEncoder();
const URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

function page({ head = "", scripts = "" }: { head?: string; scripts?: string }): string {
  return `<html><head><title>Fallback - YouTube</title>${head}</head><body>${scripts}</body></html>`;
}

function convert(html: string, options: { extension?: string; url?: string } = {}) {
  return new YouTubeConverter().convert(encoder.encode(html), {
    extension: "html",
    url: URL,
    ...options
  });
}

describe("YouTubeConverter", () => {
  it("builds markdown from page metadata", async () => {
    const result = await convert(
      page({
        head: `
          <meta property="og:title" content="OG Title">
          <meta name="title" content="Video Title">
          <meta itemprop="interactionCount" content="12345">
          <meta name="keywords" content="music, video">
          <meta itemprop="duration" content="PT3M33S">
          <meta name="description" content="Meta description">
        `
      })
    );

    expect(result).toEqual({
      title: "Video Title",
      markdown: [
        "# YouTube",
        "## Video Title",
        "### Video Metadata\n\n- **Views:** 12345\n- **Keywords:** music, video\n- **Runtime:** PT3M33S",
        "### Description\n\nMeta description"
      ].join("\n\n")
    });
  });

  it("prefers the full description from ytInitialData", async () => {
    const data = {
      contents: [{ attributedDescriptionBodyText: { content: "Full\ndescription" } }]
    };
    const result = await convert(
      page({
        head: '<meta name="description" content="Truncated">',
        scripts: `<script>var ytInitialData = ${JSON.stringify(data)};</script>`
      })
    );
    expect(result?.markdown).toContain("### Description\n\nFull\ndescription");
  });

  it("keeps the meta description when ytInitialData is malformed", async () => {
    const result = await convert(
      page({
        head: '<meta property="og:description" content="OG description">',
        scripts: "<script>var ytInitialData = {not json};</script>"
      })
    );
    expect(result?.markdown).toContain("### Description\n\nOG description");
  });

  it("falls back to the document title", async () => {
    const result = await convert(page({}));
    expect(result).toEqual({
      title: "Fallback - YouTube",
      markdown: "# YouTube\n\n## Fallback - YouTube"
    });
  });

  it.each([
    "https://youtube.com/watch?v=abc",
    "https://youtu.be/abc",
    "https://www.youtube.com/shorts/abc"
  ])("matches %s", async (url) => {
    expect(await convert(page({}), { url })).not.toBeNull();
  });

  it.each([
    ["non-YouTube URLs", { url: "https://example.com/watch?v=abc" }],
    ["missing URLs", { url: undefined }],
    ["non-HTML extensions", { extension: "txt" }]
  ])("ignores %s", async (_name, options) => {
    expect(await convert(page({}), options)).toBeNull();
  });
});
