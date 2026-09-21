import { rm } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();

// Hostinger sometimes leaves Next's compiled config wrapper from a previous
// build. Remove the wrapper and .next cache, but do not delete hashed
// *.next.config.* modules because the wrapper may still need them during the
// current Next config load lifecycle on Hostinger.
await rm(join(root, "next.config.compiled.js"), { force: true });
console.log("[clean-hostinger-build-cache] removed stale next.config.compiled.js if present");

await rm(join(root, ".next"), { recursive: true, force: true });
console.log("[clean-hostinger-build-cache] cleared .next cache");
