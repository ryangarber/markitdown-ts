import TurndownPluginGfm from "@truto/turndown-plugin-gfm";
import TurndownService from "turndown";

export class Turndown {
  convertSoup(document: string | Node): string {
    const service = new TurndownService({ headingStyle: "atx" });
    service.use(TurndownPluginGfm);

    service.addRule("anchor tags", {
      filter: ["a"],
      replacement(content, node) {
        if (!content) return "";

        const prefix = content.startsWith(" ") ? " " : "";
        const suffix = content.endsWith(" ") ? " " : "";
        const text = content.trim().replace(/\n\n.*/g, "");
        if (!text) return "";

        const element = node as unknown as Element;
        const href = element.getAttribute("href");
        let title = element.getAttribute("title") ?? "";
        if (!href) return `${prefix}${text}${suffix}`;

        try {
          const url = new URL(href);
          if (url.protocol !== "https:" && url.protocol !== "http:") {
            return `${prefix}${text}${suffix}`;
          }
        } catch {
          if (
            !href.startsWith("/") &&
            !href.startsWith("#") &&
            !href.startsWith("./") &&
            !href.startsWith("../")
          ) {
            return `${prefix}${text}${suffix}`;
          }
        }

        if (text.replace(/\\_/g, "_") === href && !title) {
          return `<${href}>`;
        }
        if (!title) title = href;
        return `${prefix}[${text}](${href}${title ? ` "${title}"` : ""})${suffix}`;
      }
    });

    service.addRule("img tags", {
      filter: ["img"],
      replacement(_content, node) {
        const element = node as unknown as Element;
        const alt = element.getAttribute("alt") ?? "";
        let source = element.getAttribute("src") ?? "";
        const title = element.getAttribute("title");
        if (source.startsWith("data:")) {
          source = `${source.split(",", 1)[0]}...`;
        }
        return `![${alt}](${source}${title ? ` "${title}"` : ""})`;
      }
    });

    return service.turndown(serializeNode(document));
  }
}

/**
 * Turndown and its GFM plugin rely on DOM APIs (e.g. `HTMLTableElement.rows`, `Element.closest`)
 * that linkedom does not implement, which silently drops content such as tables. Serializing
 * lets Turndown re-parse the markup with its own spec-compliant DOM.
 */
function serializeNode(node: string | Node): string {
  if (typeof node === "string") {
    return node;
  }
  if (node.nodeType === node.DOCUMENT_NODE) {
    return (node as Document).documentElement?.outerHTML ?? "";
  }
  if (node.nodeType === node.ELEMENT_NODE) {
    return (node as Element).outerHTML;
  }
  if (node.nodeType === node.TEXT_NODE) {
    return escapeHtml(node.textContent ?? "");
  }
  // Document fragments and other containers.
  return [...node.childNodes].map(serializeNode).join("");
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
