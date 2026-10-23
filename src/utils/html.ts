import { parseHTML } from "linkedom";
import { Turndown } from "./turndown.ts";

export type DocumentInput<Keys extends string = string> = {
  [key in Keys]:
    | { type: "node"; value: (Node | string)[] | Node | string }
    | { type: "metadata"; value: unknown };
};

export type DocumentOutput<Input extends DocumentInput> = {
  [key in keyof Input]: Input[key] extends { type: "node" }
    ? string
    : Input[key] extends { type: "metadata" }
      ? Input[key]["value"]
      : never;
};

export function parseHtmlDocument<T extends DocumentInput>(
  html: string,
  transform: (document: Document) => T
): DocumentOutput<T> {
  const document = parseHTML(wrapFragment(html)).document as unknown as Document;

  return Object.fromEntries(
    Object.entries(transform(document)).map(([key, value]) => {
      if (value.type === "node") {
        const nodes = Array.isArray(value.value) ? value.value : [value.value];

        const markdown = nodes
          .map((node) =>
            new Turndown()
              .convertSoup(node)
              .split(/\n+/)
              .map((line) => line.trim())
              .filter(Boolean)
              .join("\n\n")
          )
          .join("\n\n");

        return [key, markdown];
      }

      return [key, value.value];
    })
  ) as DocumentOutput<T>;
}

/**
 * linkedom only parses complete documents: given a fragment (e.g. mammoth output or an RSS
 * description), it promotes the first element to `documentElement` and drops its siblings
 * from the tree, so wrap fragments in a full document first.
 */
function wrapFragment(html: string): string {
  if (/<html[\s>]/i.test(html)) {
    return html;
  }
  if (/<(head|body)[\s>]/i.test(html)) {
    return `<html>${html}</html>`;
  }
  return `<html><head></head><body>${html}</body></html>`;
}
