import assert from "node:assert/strict";
import { test } from "node:test";

import { publicOrigin, safeRedirectPath } from "./auth-redirect.ts";

test("safeRedirectPath keeps same-site paths", () => {
  assert.equal(safeRedirectPath("/medications"), "/medications");
  assert.equal(safeRedirectPath("/profile?tab=google"), "/profile?tab=google");
  assert.equal(safeRedirectPath("/"), "/");
});

test("safeRedirectPath falls back for missing or off-site values", () => {
  for (const bad of [
    null,
    undefined,
    "",
    "@evil.example",
    "evil.example",
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/\t/evil.example",
    "javascript:alert(1)",
  ]) {
    assert.equal(safeRedirectPath(bad), "/dashboard", String(bad));
  }
  assert.equal(safeRedirectPath("@evil.example", "/profile"), "/profile");
});

test("publicOrigin prefers NEXT_PUBLIC_SITE_URL", () => {
  const req = new Request("https://0.0.0.0:3000/auth/callback", {
    headers: { host: "0.0.0.0:3000" },
  });
  assert.equal(publicOrigin(req, "https://rx-tracker-web.dwdrm.com/"), "https://rx-tracker-web.dwdrm.com");
});

test("publicOrigin uses forwarded headers behind a proxy", () => {
  const req = new Request("https://0.0.0.0:3000/auth/callback", {
    headers: {
      host: "0.0.0.0:3000",
      "x-forwarded-host": "rx-tracker-web.dwdrm.com",
      "x-forwarded-proto": "https",
    },
  });
  assert.equal(publicOrigin(req, ""), "https://rx-tracker-web.dwdrm.com");
});

test("publicOrigin falls back to Host, then request.url", () => {
  const withHost = new Request("http://localhost:3000/auth/callback", {
    headers: { host: "localhost:3000" },
  });
  assert.equal(publicOrigin(withHost, ""), "http://localhost:3000");

  const bare = new Request("http://localhost:3000/auth/callback");
  assert.equal(publicOrigin(bare, undefined), "http://localhost:3000");
});

test("publicOrigin ignores an invalid NEXT_PUBLIC_SITE_URL", () => {
  const req = new Request("https://0.0.0.0:3000/auth/callback", {
    headers: { "x-forwarded-host": "rx-tracker-web.dwdrm.com", "x-forwarded-proto": "https" },
  });
  assert.equal(publicOrigin(req, "not a url"), "https://rx-tracker-web.dwdrm.com");
});
