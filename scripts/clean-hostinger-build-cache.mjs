import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();

const staleConfigPattern = /^[0-9a-f]+\.next\.config\.(?:js|mjs|cjs|ts|mts|cts)$/i;

for (const entry of await readdir(root, { withFileTypes: true })) {
  if (entry.isFile() && staleConfigPattern.test(entry.name)) {
    const target = join(root, entry.name);
    await rm(target, { force: true });
    console.log(`[clean-hostinger-build-cache] removed stale Next config ${entry.name}`);
  }
}

await rm(join(root, "next.config.compiled.js"), { force: true });
console.log("[clean-hostinger-build-cache] removed stale next.config.compiled.js if present");

await rm(join(root, ".next"), { recursive: true, force: true });
console.log("[clean-hostinger-build-cache] cleared .next cache");
