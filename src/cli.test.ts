import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);
const CLI = join(import.meta.dirname, "cli.ts");

async function run(...args: string[]) {
  try {
    const { stdout, stderr } = await exec(process.execPath, [CLI, ...args]);
    return { code: 0, stdout, stderr };
  } catch (error) {
    const { code, stdout, stderr } = error as { code: number; stdout: string; stderr: string };
    return { code, stdout, stderr };
  }
}

describe("cli", () => {
  let directory: string;

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), "markitdown-cli-"));
  });

  afterAll(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it("shows help without arguments", async () => {
    const { code, stdout } = await run();
    expect(code).toBe(0);
    expect(stdout).toContain("Usage: markitdown");
    expect(stdout).toContain("--extension EXT");
  });

  it("prints the version", async () => {
    const { version } = (await import("../package.json", { with: { type: "json" } })).default;
    expect((await run("--version")).stdout.trim()).toBe(version);
  });

  it("prints the Markdown for the given file", async () => {
    const file = join(directory, "page.html");
    await writeFile(file, "<html><head><title>T</title></head><body><h1>CLI</h1></body></html>");

    const { code, stdout } = await run(file);

    expect(code).toBe(0);
    expect(stdout).toBe("# CLI\n");
  });

  it("prints the title and Markdown as JSON", async () => {
    const file = join(directory, "titled.html");
    await writeFile(file, "<html><head><title>T</title></head><body><h1>CLI</h1></body></html>");

    const { stdout } = await run(file, "--json");

    expect(JSON.parse(stdout)).toEqual({ title: "T", markdown: "# CLI" });
  });

  it("detects the type of files without an extension", async () => {
    const file = join(directory, "README");
    await writeFile(file, "no extension");

    const { code, stdout } = await run(file);

    expect(code).toBe(0);
    expect(stdout).toBe("no extension\n");
  });

  it("accepts an explicit extension", async () => {
    const file = join(directory, "fragment");
    await writeFile(file, "<h1>Fragment</h1>");

    expect((await run(file)).stdout).toBe("<h1>Fragment</h1>\n");
    expect((await run("--extension", ".html", file)).stdout).toBe("# Fragment\n");
  });

  it("rejects missing files", async () => {
    const { code, stderr } = await run(join(directory, "missing.txt"));
    expect(code).toBe(1);
    expect(stderr).toContain("does not exist");
  });

  it("reports conversion errors", async () => {
    const file = join(directory, "broken.zip");
    await writeFile(file, new Uint8Array([0x50, 0x4b, 0x03, 0x04]));

    const { code, stderr } = await run(file);

    expect(code).toBe(1);
    expect(stderr).toContain("Error: Could not convert zip to Markdown");
  });
});
