import { test } from "node:test";
import assert from "node:assert/strict";
import { createPrivateKey, generateKeyPairSync } from "node:crypto";
import { normalizePrivateKey } from "../src/lib/firebase/private-key";

// 테스트용으로 즉석에서 만든 키 (실제 서비스 계정 키 아님)
const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const escaped = pem.trimEnd().split("\n").join("\\n") + "\\n";

const parses = (value: string | null) => {
  assert.ok(value);
  assert.doesNotThrow(() => createPrivateKey(value));
};

test("accepts real newlines, escaped newlines and CRLF", () => {
  parses(normalizePrivateKey(pem));
  parses(normalizePrivateKey(escaped));
  parses(normalizePrivateKey(pem.replace(/\n/g, "\r\n")));
  parses(normalizePrivateKey(pem.trimEnd()));
});

test("strips quotes pasted from a .env file", () => {
  parses(normalizePrivateKey(`"${escaped}"`));
  parses(normalizePrivateKey(`'${escaped}'`));
  parses(normalizePrivateKey(`  "${escaped}"\n`));
  parses(normalizePrivateKey(`""${escaped}""`));
});

test("accepts a whole service account JSON", () => {
  parses(normalizePrivateKey(JSON.stringify({ type: "service_account", private_key: pem, client_email: "x@y" })));
});

test("missing values stay missing", () => {
  assert.equal(normalizePrivateKey(undefined), null);
  assert.equal(normalizePrivateKey(""), null);
});

test("the previous implementation failed on quoted values (regression guard)", () => {
  const old = `"${escaped}"`.replace(/\\n/g, "\n");
  assert.throws(() => createPrivateKey(old));
});
