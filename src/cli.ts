#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import {
  argument,
  commandLine,
  flag,
  message,
  object,
  option,
  optional,
  string,
  withDefault
} from "@optique/core";
import { url } from "@optique/core/message";
import { defineProgram } from "@optique/core/program";
import { path, runSync } from "@optique/run";
import packageJson from "../package.json" with { type: "json" };
import { MarkItDown } from "./markitdown.ts";

const parser = object({
  file: argument(path({ mustExist: true, type: "file", metavar: "FILE" }), {
    description: message`File to convert.`
  }),
  extension: optional(
    option("-x", "--extension", string({ metavar: "EXT" }), {
      description: message`File type to convert from, when it can't be detected from the file.`
    })
  ),
  json: withDefault(
    flag("--json", {
      description: message`Print the title and Markdown as JSON instead of only the Markdown.`
    }),
    false
  )
});

export const program = defineProgram({
  parser,
  metadata: {
    name: "markitdown",
    version: packageJson.version,
    brief: message`Convert files to Markdown`,
    description: message`Converts PDF, Word, Excel, PowerPoint, HTML, notebooks, feeds, zip archives and text files to Markdown. The file type is detected from the file's name and contents.`,
    examples: message`Convert a document:

  ${commandLine("markitdown report.docx")}

Convert a file without an extension as HTML:

  ${commandLine("markitdown --extension html page")}`,
    author: message`${packageJson.author}`,
    bugs: message`Report bugs at ${url(packageJson.bugs.url)}.`
  }
});

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const parsed = runSync(program, {
    args: argv.length ? argv : ["--help"],
    aboveError: "none",
    help: "both",
    version: { value: packageJson.version, option: true },
    completion: "both"
  });

  try {
    const bytes = await readFile(parsed.file);
    const result = await new MarkItDown().convert(
      new File([bytes], basename(parsed.file)),
      parsed.extension ? { extension: parsed.extension } : {}
    );
    console.log(parsed.json ? JSON.stringify(result, null, 2) : result?.markdown);
  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    process.exitCode = 1;
  }
}
