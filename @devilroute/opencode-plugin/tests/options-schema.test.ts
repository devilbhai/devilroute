/**
 * T-08 options-schema tests.
 *
 * Covers `parseDevilRoutePluginOptions(opts)` — the strict Zod gate that
 * validates the second-arg `PluginOptions` bag from opencode.json before
 * any hook is wired. Anti-pattern checklist mirrored here:
 *
 *  - `null` / `undefined` must collapse to `{}` (defaults apply downstream).
 *  - Unknown keys must THROW (`.strict()` catches opencode.json typos).
 *  - Validation runs at parse time, not import time (module loads cleanly).
 */

import test from "node:test";
import assert from "node:assert/strict";
import { parseDevilRoutePluginOptions } from "../src/index.js";

test("parseDevilRoutePluginOptions: undefined → {}", () => {
  assert.deepEqual(parseDevilRoutePluginOptions(undefined), {});
});

test("parseDevilRoutePluginOptions: null → {}", () => {
  assert.deepEqual(parseDevilRoutePluginOptions(null), {});
});

test("parseDevilRoutePluginOptions: empty object → {}", () => {
  assert.deepEqual(parseDevilRoutePluginOptions({}), {});
});

test("parseDevilRoutePluginOptions: valid providerId → returns it", () => {
  const r = parseDevilRoutePluginOptions({ providerId: "devilroute-preprod" });
  assert.equal(r.providerId, "devilroute-preprod");
});

test("parseDevilRoutePluginOptions: invalid providerId (special chars) → throws", () => {
  assert.throws(
    () => parseDevilRoutePluginOptions({ providerId: "devilroute prod!" }),
    /providerId.*slug/i
  );
});

test("parseDevilRoutePluginOptions: empty providerId → throws", () => {
  assert.throws(() => parseDevilRoutePluginOptions({ providerId: "" }), /providerId/i);
});

test("parseDevilRoutePluginOptions: valid modelCacheTtl → returns it", () => {
  const r = parseDevilRoutePluginOptions({ modelCacheTtl: 60_000 });
  assert.equal(r.modelCacheTtl, 60_000);
});

test("parseDevilRoutePluginOptions: negative modelCacheTtl → throws", () => {
  assert.throws(() => parseDevilRoutePluginOptions({ modelCacheTtl: -1 }), /modelCacheTtl/i);
});

test("parseDevilRoutePluginOptions: zero modelCacheTtl → throws (positive required)", () => {
  assert.throws(() => parseDevilRoutePluginOptions({ modelCacheTtl: 0 }), /modelCacheTtl/i);
});

test("parseDevilRoutePluginOptions: invalid baseURL (not a URL) → throws", () => {
  assert.throws(() => parseDevilRoutePluginOptions({ baseURL: "not-a-url" }), /baseURL/i);
});

test("parseDevilRoutePluginOptions: unknown key → throws (strict mode catches typos)", () => {
  assert.throws(
    () =>
      parseDevilRoutePluginOptions({
        providerId: "devilroute",
        provider_id: "typo-here",
      }),
    /provider_id|unrecognized/i
  );
});

test("parseDevilRoutePluginOptions: all four fields populated correctly → returns them", () => {
  const opts = {
    providerId: "devilroute-prod",
    displayName: "DevilRoute Production",
    modelCacheTtl: 120_000,
    baseURL: "https://or.example.com/v1",
  };
  const r = parseDevilRoutePluginOptions(opts);
  assert.deepEqual(r, opts);
});

test("parseDevilRoutePluginOptions: error message lists every issue path", () => {
  // Two bad fields at once → error string should mention BOTH.
  try {
    parseDevilRoutePluginOptions({
      providerId: "",
      baseURL: "garbage",
    });
    assert.fail("expected throw");
  } catch (err) {
    const msg = (err as Error).message;
    assert.match(msg, /providerId/);
    assert.match(msg, /baseURL/);
  }
});

test("parseDevilRoutePluginOptions: module import alone does NOT throw", async () => {
  // Re-importing the entry must not trigger validation; validation only fires
  // on explicit parseDevilRoutePluginOptions / DevilRoutePlugin invocation.
  const mod = await import("../src/index.js");
  assert.equal(typeof mod.parseDevilRoutePluginOptions, "function");
});
