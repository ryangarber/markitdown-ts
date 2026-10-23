import { RSSConverter } from "./xml-rss-atom.ts";

const encoder = new TextEncoder();

function convert(xml: string, extension = "xml") {
  return new RSSConverter().convert(encoder.encode(xml), { extension });
}

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Example Feed</title>
    <description>Feed description</description>
    <item>
      <title>First Post</title>
      <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
      <description><![CDATA[<p>Hello <strong>RSS</strong></p><table><tr><td>a</td><td>b</td></tr></table>]]></description>
    </item>
    <item>
      <title>Second Post</title>
      <content:encoded><![CDATA[<h2>Encoded</h2>]]></content:encoded>
    </item>
  </channel>
</rss>`;

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Feed</title>
  <subtitle>Atom subtitle</subtitle>
  <entry>
    <title>Atom Entry</title>
    <updated>2024-01-01T00:00:00Z</updated>
    <summary type="html">&lt;p&gt;Atom &lt;em&gt;summary&lt;/em&gt;&lt;/p&gt;</summary>
  </entry>
  <entry>
    <title>Content Entry</title>
    <content type="html">&lt;p&gt;Atom content&lt;/p&gt;</content>
  </entry>
</feed>`;

describe("RSSConverter", () => {
  it.each(["xml", "rss"])("converts RSS feeds from .%s", async (extension) => {
    const result = await convert(RSS, extension);

    expect(result).toEqual({
      title: "Example Feed",
      markdown: [
        "# Example Feed",
        "Feed description",
        "## First Post\n\nPublished on: Mon, 01 Jan 2024 00:00:00 GMT\n\nHello **RSS**\n\n| a   | b   |\n\n| --- | --- |",
        "## Second Post\n\n## Encoded"
      ].join("\n\n")
    });
  });

  it.each(["xml", "atom"])("converts Atom feeds from .%s", async (extension) => {
    const result = await convert(ATOM, extension);

    expect(result).toEqual({
      title: "Atom Feed",
      markdown: [
        "# Atom Feed",
        "Atom subtitle",
        "## Atom Entry\n\nUpdated on: 2024-01-01T00:00:00Z\n\nAtom _summary_",
        "## Content Entry\n\nAtom content"
      ].join("\n\n")
    });
  });

  it("returns null for XML that is not a feed", async () => {
    expect(await convert("<root><child/></root>")).toBeNull();
  });

  it("returns null for Atom feeds without entries", async () => {
    expect(
      await convert('<feed xmlns="http://www.w3.org/2005/Atom"><title>x</title></feed>')
    ).toBeNull();
  });

  it("returns null for RSS without a channel", async () => {
    expect(await convert('<rss version="2.0"></rss>')).toBeNull();
  });

  it("ignores other extensions", async () => {
    expect(await convert(RSS, "html")).toBeNull();
  });
});
