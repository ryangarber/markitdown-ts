import { parseHTML } from "linkedom";
import { Turndown } from "./turndown.ts";

const TABLE_HTML =
  "<table><tr><td>name</td><td>value</td></tr><tr><td>browser</td><td>1</td></tr></table>";

function parse(html: string): Document {
  return parseHTML(html).document as unknown as Document;
}

function convert(input: string | Node): string {
  return new Turndown().convertSoup(input);
}

describe("Turndown", () => {
  it("uses ATX headings", () => {
    expect(convert("<h1>Title</h1><h2>Sub</h2>")).toBe("# Title\n\n## Sub");
  });

  describe("linkedom input", () => {
    // Regression: the GFM plugin reads `HTMLTableElement.rows`, which linkedom does not
    // implement, so tables passed as linkedom nodes were silently dropped.
    it("converts tables from a linkedom document", () => {
      const document = parse(`<html><body>${TABLE_HTML}<p>after</p></body></html>`);
      const markdown = convert(document);
      expect(markdown).toContain("| name | value |");
      expect(markdown).toContain("| browser | 1   |");
      expect(markdown).toContain("after");
    });

    it("converts tables from a linkedom element", () => {
      const document = parse(`<html><body><div id="root">${TABLE_HTML}</div></body></html>`);
      const markdown = convert(document.querySelector("#root") as Node);
      expect(markdown).toContain("| browser | 1   |");
    });

    it("produces the same output for documents and strings", () => {
      const html = `<html><body><h1>Hello</h1><p>World <a href="https://a.com">link</a></p>${TABLE_HTML}</body></html>`;
      expect(convert(parse(html))).toBe(convert(html));
    });

    it("converts body content of a full document", () => {
      const document = parse(
        "<html><head><meta charset='utf-8'></head><body><h1>Hello</h1><p>Body text</p></body></html>"
      );
      expect(convert(document)).toBe("# Hello\n\nBody text");
    });

    it("converts document fragments", () => {
      const document = parse("<html><body></body></html>");
      const fragment = document.createDocumentFragment();
      const heading = document.createElement("h2");
      heading.textContent = "Fragment";
      fragment.append(heading, document.createTextNode("text & <more>"));
      expect(convert(fragment)).toBe("## Fragment\n\ntext & <more>");
    });
  });

  describe("tables", () => {
    it("adds a header separator to tables without th cells", () => {
      expect(convert(TABLE_HTML)).toBe("| name | value |\n| --- | --- |\n| browser | 1   |");
    });

    it("uses th rows as the header", () => {
      expect(
        convert("<table><tr><th>a</th><th>b</th></tr><tr><td>1</td><td>2</td></tr></table>")
      ).toBe("| a   | b   |\n| --- | --- |\n| 1   | 2   |");
    });
  });

  describe("anchor tags", () => {
    it.each([
      [
        '<a href="https://example.com">Example</a>',
        '[Example](https://example.com "https://example.com")'
      ],
      ['<a href="https://example.com" title="T">Example</a>', '[Example](https://example.com "T")'],
      ['<a href="/relative">Rel</a>', '[Rel](/relative "/relative")'],
      ['<a href="#anchor">Hash</a>', '[Hash](#anchor "#anchor")'],
      ['<a href="https://example.com">https://example.com</a>', "<https://example.com>"],
      ['<a href="javascript:alert(1)">JS</a>', "JS"],
      ['<a href="mailto:a@b.c">Mail</a>', "Mail"],
      ['<a href="relative-no-prefix">Bare</a>', "Bare"],
      ["<a>No href</a>", "No href"],
      ['<a href="https://example.com"></a>', ""]
    ])("converts %s", (html, expected) => {
      expect(convert(`<p>${html}</p>`)).toBe(expected);
    });

    it("preserves surrounding whitespace", () => {
      expect(convert('<p>before<a href="https://a.com"> link </a>after</p>')).toBe(
        'before [link](https://a.com "https://a.com") after'
      );
    });
  });

  describe("img tags", () => {
    it("converts images with alt and title", () => {
      expect(convert('<img src="/a.png" alt="Alt" title="Title">')).toBe('![Alt](/a.png "Title")');
    });

    it("truncates data URIs", () => {
      expect(convert('<img src="data:image/png;base64,AAAA" alt="x">')).toBe(
        "![x](data:image/png;base64...)"
      );
    });

    it("handles missing attributes", () => {
      expect(convert("<img>")).toBe("![]()");
    });
  });

  it("supports GFM strikethrough", () => {
    expect(convert("<p><del>gone</del></p>")).toBe("~~gone~~");
  });
});
