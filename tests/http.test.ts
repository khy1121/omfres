import { test } from "node:test";
import assert from "node:assert/strict";
import { isSameOrigin } from "../src/lib/http";

const req = (headers: Record<string, string>) => new Request("http://internal/api", { method: "POST", headers });

test("same-origin requests pass, cross-site and missing origin fail", () => {
  assert.equal(isSameOrigin(req({ origin: "https://app.example", host: "app.example" })), true);
  assert.equal(isSameOrigin(req({ origin: "https://evil.example", host: "app.example" })), false);
  assert.equal(isSameOrigin(req({ host: "app.example" })), false, "no Origin header");
  assert.equal(isSameOrigin(req({ origin: "not a url", host: "app.example" })), false);
});

test("x-forwarded-host takes precedence and only its first value counts", () => {
  assert.equal(isSameOrigin(req({ origin: "https://app.example", host: "internal:3000", "x-forwarded-host": "app.example" })), true);
  assert.equal(isSameOrigin(req({ origin: "https://app.example", host: "internal:3000", "x-forwarded-host": "app.example, proxy.internal" })), true);
  assert.equal(isSameOrigin(req({ origin: "https://proxy.internal", host: "internal:3000", "x-forwarded-host": "app.example, proxy.internal" })), false);
});

test("host comparison ignores letter case and keeps ports significant", () => {
  assert.equal(isSameOrigin(req({ origin: "https://App.Example", host: "app.example" })), true);
  assert.equal(isSameOrigin(req({ origin: "http://localhost:3948", host: "localhost:3948" })), true);
  assert.equal(isSameOrigin(req({ origin: "http://localhost:3000", host: "localhost:3948" })), false);
});
