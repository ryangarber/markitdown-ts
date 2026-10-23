import { defineConfig } from "tsdown";

const base = {
  entry: ["src/index.ts"],
  dts: true,
  sourcemap: true,
  treeshake: true,
  target: "es2020" as const,
  platform: "neutral" as const
};

export default defineConfig([
  {
    ...base,
    format: ["esm"],
    clean: true
  },
  {
    ...base,
    format: ["cjs"],
    clean: false,
    deps: {
      alwaysBundle: ["@jvmr/pptx-to-html"]
    }
  },
  {
    entry: ["src/cli.ts"],
    format: ["esm"],
    dts: false,
    clean: false,
    platform: "node"
  }
]);
