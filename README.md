# markitdown-ts

`markitdown-ts` converts various file types to Markdown without filesystem, process, stream, or any other runtime-specific dependencies. It can run in browsers, workers, edge functions, and all other modern JavaScript environments.

## Supported formats

- Plain text, Markdown, CSV, and JSON
- HTML
- XML, RSS, and Atom feeds
- Jupyter notebooks (`.ipynb`)
- Word documents (`.docx`)
- Excel workbooks (`.xlsx`)
- PowerPoint presentations (`.pptx`)
- PDF documents (`.pdf`)
- ZIP archives (`.zip`), with nested files converted recursively
- Wikipedia, YouTube metadata, and Bing result pages supplied as HTML

Audio, image metadata, local-path, and YouTube transcript features from the original project are intentionally left out because their implementations depended on runtime-specific modules, binaries, streams, or filesystem access. They may be added back over time as alternative implementations are found. Want to see one added? Contributions are welcome!

## Installation

```sh
pnpm install @ryangarber/markitdown-ts
```

## Usage

```ts
import { MarkItDown } from "@ryangarber/markitdown-ts";

const bytes: Uint8Array = /* plain bytes */;

const result = await new MarkItDown().convert(bytes);

console.log(result?.markdown);
```

The same `convert` method accepts:
- `Uint8Array`
- `ArrayBuffer` and `SharedArrayBuffer`
- `DataView` or any other typed array
- `Blob` and `File`
- `Response`

The file type is detected from, in order: the `extension` option, a `File`'s name or a Content-Disposition filename, the URL's path (the `url` option and a `Response`'s URL), a `Blob`'s type or a Content-Type header, the content's magic number, and finally the content itself (HTML, XML, RSS, Atom, notebooks, and plain text). Each candidate is tried until one converts, so pass `extension` only when the content is ambiguous.

```ts
const file = new File([docxBytes], "document.docx");
const result = await new MarkItDown().convert(file);
```

### URLs

HTTP and HTTPS URLs are fetched with the global `fetch`. Pass a custom implementation when needed.

```ts
const result = await new MarkItDown().convert("https://example.com/article.html");
```

Browser requests remain subject to the remote server's CORS policy.

### Responses

```ts
const response = await fetch("https://example.com/feed.xml");
const result = await new MarkItDown().convert(response);
```

## API

```ts
type ByteSource = Uint8Array | ArrayBufferLike | ArrayBufferView | Blob;
type ConversionSource = ByteSource | Response | URL | string;

class MarkItDown {
  convert(source: ConversionSource, options?: ConverterOptions): Promise<ConverterResult>;

  /** @deprecated Pass the source directly to convert(). */
  convertBuffer(
    source: ByteSource,
    options: ConverterOptions & { file_extension: string }
  ): Promise<ConverterResult>;
}
```

`convertBuffer` remains as a compatibility alias, but `convert(bytes, options)` is preferred.

## CLI

The `markitdown` command converts a file and prints its Markdown:

```sh
npx @ryangarber/markitdown-ts report.docx
markitdown --extension html page    # when the type can't be detected
markitdown report.pdf --json        # print { title, markdown }
```

To use it without Node, download the standalone build for your system (`markitdown-darwin-arm64`, `markitdown-darwin-x64`, `markitdown-linux-arm64`, `markitdown-linux-x64`, `markitdown-win32-arm64.exe` or `markitdown-win32-x64.exe`) from the [latest release](https://github.com/ryangarber/markitdown-ts/releases/latest), or build it from source with `pnpm build:cli` (needs [Bun](https://bun.sh)).

## Development

```sh
pnpm install
pnpm lint
pnpm typecheck
pnpm test --run
pnpm build        # library, CLI and man page
pnpm build:cli    # standalone binaries (needs Bun)
```

Biome handles both formatting and linting. `tsdown` produces ESM, CommonJS, source maps, and declarations in `dist`. Releases are cut by [rylease](https://github.com/ryangarber/rylease) from conventional commits: pushes to `main` dry-run the release, and dispatching the `release` workflow on `main` publishes to npm and attaches the CLI binaries to the GitHub release.

## License

MIT License © 2026 Ryan Garber\
MIT License © 2024 Vaibhav Raj
