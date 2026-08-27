import { defineConfig } from "tsup";

export default defineConfig({
  entry:     ["src/index.ts"],
  format:    ["esm"],
  target:    "es2022",
  clean:     true,
  shims:     true,
  dts:       false,
  sourcemap: false, // never ship source maps
  banner:    { js: "#!/usr/bin/env node" },
});
