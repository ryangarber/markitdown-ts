import { parseHtmlDocument } from "./html.ts";

describe("html", () => {
  it("should return nodes, metadata", () => {
    const html = "<html><head><title>Title</title></head><body><p>Body</p></body></html>";
    const { title, body } = parseHtmlDocument(html, (document) => {
      return {
        title: { type: "metadata", value: document.title },
        body: { type: "node", value: document.body.innerHTML }
      };
    });
    expect(title).toBe("Title");
    expect(body).toBe("Body");
  });

  it("passes metadata values through untouched", () => {
    const value = { nested: [1, 2] };
    const { meta } = parseHtmlDocument("<p></p>", () => ({
      meta: { type: "metadata", value }
    }));
    expect(meta).toBe(value);
  });

  // Regression: body content of whole documents was dropped by Turndown.
  it("converts the body of a document node", () => {
    const { markdown } = parseHtmlDocument(
      "<html><head><title>T</title></head><body><h1>Heading</h1><p>Paragraph</p></body></html>",
      (document) => {
        document.querySelector("title")?.remove();
        return { markdown: { type: "node", value: document } };
      }
    );
    expect(markdown).toBe("# Heading\n\nParagraph");
  });

  // Regression: linkedom promotes the first element of a fragment to `documentElement` and
  // drops its siblings, which lost everything after the first block (e.g. in DOCX and RSS).
  describe("fragments", () => {
    it.each([
      ["sibling blocks", "<h1>Heading</h1><p>Paragraph</p>", "# Heading\n\nParagraph"],
      ["leading text", "text <b>bold</b>", "text **bold**"],
      ["body without html", "<body><p>a</p><p>b</p></body>", "a\n\nb"],
      ["head without html", "<head><title>T</title></head><body><p>x</p></body>", "x"]
    ])("keeps all content of %s", (_name, html, expected) => {
      const { title, markdown } = parseHtmlDocument(html, (document) => {
        const title = document.title;
        document.querySelector("title")?.remove();
        return {
          title: { type: "metadata", value: title },
          markdown: { type: "node", value: document }
        };
      });
      expect(markdown).toBe(expected);
      expect(title).toBe(html.includes("<title>") ? "T" : "");
    });

    it("exposes fragment content through document.body", () => {
      const { markdown } = parseHtmlDocument("<p>one</p><p>two</p>", (document) => ({
        markdown: { type: "node", value: document.body }
      }));
      expect(markdown).toBe("one\n\ntwo");
    });

    it("keeps all content via documentElement", () => {
      const { markdown } = parseHtmlDocument(
        "<p>one</p><table><tr><td>a</td></tr></table>",
        (document) => ({
          markdown: { type: "node", value: document.documentElement }
        })
      );
      expect(markdown).toBe("one\n\n| a   |\n\n| --- |");
    });
  });

  it("converts tables in element nodes", () => {
    const { markdown } = parseHtmlDocument(
      "<html><body><table><tr><td>a</td><td>b</td></tr></table></body></html>",
      (document) => ({ markdown: { type: "node", value: document.body } })
    );
    expect(markdown).toBe("| a   | b   |\n\n| --- | --- |");
  });

  it("joins arrays of nodes with blank lines", () => {
    const { markdown } = parseHtmlDocument(
      "<html><body><div class='r'><p>one</p></div><div class='r'><p>two</p></div></body></html>",
      (document) => ({
        markdown: { type: "node", value: [...document.querySelectorAll(".r")] }
      })
    );
    expect(markdown).toBe("one\n\ntwo");
  });

  it("trims lines and collapses blank lines within a node", () => {
    const { markdown } = parseHtmlDocument("<p>  a  </p><p></p><p>b</p>", () => ({
      markdown: { type: "node", value: "<p>  a  </p>\n\n\n<p>   </p><p>b</p>" }
    }));
    expect(markdown).toBe("a\n\nb");
  });

  it("returns an empty string for an empty node list", () => {
    const { markdown } = parseHtmlDocument("<p></p>", () => ({
      markdown: { type: "node", value: [] }
    }));
    expect(markdown).toBe("");
  });
});
