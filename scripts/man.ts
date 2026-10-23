/**
 * Writes the CLI's man page, which npm installs from package.json's "man"
 *
 *   pnpm man [--out dist/markitdown.1]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { generateManPage } from "@optique/man";
import { program } from "../src/cli.ts";

const { values } = parseArgs({
  options: {
    out: {
      type: "string",
      short: "o",
      default: resolve(import.meta.dirname, "../dist/markitdown.1")
    }
  }
});

const page = generateManPage(program, { section: 1, manual: "User Commands" });

mkdirSync(dirname(values.out), { recursive: true });
writeFileSync(values.out, page);
console.log(`Wrote ${values.out}`);
