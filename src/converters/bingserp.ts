import type { Converter, ConverterOptions, ConverterResult } from "../types.ts";
import { decodeText, parseHtmlDocument } from "../utils/index.ts";

const BING_SEARCH_URL = /^https:\/\/www\.bing\.com\/search\?q=/i;
const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export class BingSerpConverter implements Converter {
  async convert(source: Uint8Array, options: ConverterOptions = {}): Promise<ConverterResult> {
    if (
      (options.extension !== "html" && options.extension !== "htm") ||
      !BING_SEARCH_URL.test(options.url ?? "")
    ) {
      return null;
    }

    let query = new URL(options.url ?? "").searchParams.get("q") || null;
    if (query) query = `Search results for "${query}"`;

    return parseHtmlDocument(decodeText(source), (document) => {
      document.querySelectorAll(".tptt").forEach((element) => {
        if (element.textContent) {
          element.textContent += " ";
        }
      });

      document.querySelectorAll(".algoSlug_icon").forEach((element) => {
        element.remove();
      });

      return {
        title: {
          type: "metadata",
          value: query || document.title || null
        },
        markdown: {
          type: "node",
          value: [...document.querySelectorAll(".b_algo")].map((result) => {
            result.querySelectorAll("a[href]").forEach((anchor) => {
              const href = anchor.getAttribute("href");
              if (!href) {
                return;
              }

              try {
                const encoded = new URL(href, options.url ?? "").searchParams.get("u");
                if (encoded) {
                  anchor.setAttribute("href", decodeBingUrl(encoded));
                }
              } catch {
                // Preserve malformed links as they appeared in the source document.
              }
            });

            return result;
          })
        }
      };
    });
  }
}

function decodeBingUrl(encoded: string): string {
  const input = encoded.slice(2).replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
  const bytes: number[] = [];
  let bits = 0;
  let bitCount = 0;

  for (const character of input) {
    const value = BASE64_ALPHABET.indexOf(character);
    if (value < 0) {
      return encoded;
    }
    bits = (bits << 6) | value;
    bitCount += 6;
    if (bitCount >= 8) {
      bitCount -= 8;
      bytes.push((bits >> bitCount) & 0xff);
    }
  }

  return new TextDecoder().decode(new Uint8Array(bytes));
}
