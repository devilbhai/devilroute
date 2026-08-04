import test from "node:test";
import assert from "node:assert/strict";
import {
  DevilRoutePlugin,
  DEVILROUTE_PROVIDER_KEY,
  DEFAULT_MODEL_CACHE_TTL_MS,
  resolveDevilRoutePluginOptions,
} from "../src/index.js";

test("scaffold: exports public surface", () => {
  assert.equal(
    typeof DevilRoutePlugin,
    "function",
    "DevilRoutePlugin must be a function (Plugin factory)"
  );
  assert.equal(DEVILROUTE_PROVIDER_KEY, "devilroute");
  assert.equal(DEFAULT_MODEL_CACHE_TTL_MS, 300_000);
});

test("scaffold: default export is v1 plugin shape { id, server: DevilRoutePlugin }", async () => {
  const mod = await import("../src/index.js");
  assert.equal(typeof mod.default, "object");
  assert.equal(mod.default.id, "@devilroute/opencode-plugin");
  assert.equal(mod.default.server, mod.DevilRoutePlugin);
});

test("resolveDevilRoutePluginOptions: defaults", () => {
  const r = resolveDevilRoutePluginOptions();
  assert.equal(r.providerId, "opencode-devilroute");
  assert.equal(r.displayName, "DevilRoute");
  assert.equal(r.modelCacheTtl, 300_000);
  assert.equal(r.baseURL, undefined);
});

test("resolveDevilRoutePluginOptions: custom providerId derives displayName", () => {
  const r = resolveDevilRoutePluginOptions({ providerId: "devilroute-preprod" });
  assert.equal(r.providerId, "opencode-devilroute-preprod");
  assert.equal(r.displayName, "DevilRoute (opencode-devilroute-preprod)");
});

test("resolveDevilRoutePluginOptions: explicit displayName wins", () => {
  const r = resolveDevilRoutePluginOptions({
    providerId: "devilroute-x",
    displayName: "Custom Label",
  });
  assert.equal(r.displayName, "Custom Label");
});

test("resolveDevilRoutePluginOptions: invalid TTL falls back to default", () => {
  assert.equal(resolveDevilRoutePluginOptions({ modelCacheTtl: 0 }).modelCacheTtl, 300_000);
  assert.equal(resolveDevilRoutePluginOptions({ modelCacheTtl: -1 }).modelCacheTtl, 300_000);
});

test("resolveDevilRoutePluginOptions: positive TTL respected", () => {
  assert.equal(resolveDevilRoutePluginOptions({ modelCacheTtl: 60_000 }).modelCacheTtl, 60_000);
});

test("DevilRoutePlugin: returns an empty hooks object (scaffold)", async () => {
  const fakeCtx = {} as Parameters<typeof DevilRoutePlugin>[0];
  const hooks = await DevilRoutePlugin(fakeCtx);
  assert.equal(typeof hooks, "object");
  assert.notEqual(hooks, null);
});

test("scaffold: built ESM default export resolves with the v1 plugin shape", async () => {
  // The plugin is ESM-only now — the CJS bundle was dropped to fix the OpenCode
  // loader (#3883), so there is no more ../dist/index.cjs. Validate that the built
  // distributable's default export still carries the OpenCode v1 { id, server } shape.
  const mod = await import("../dist/index.js");
  assert.strictEqual(typeof mod.default, "object");
  assert.strictEqual(mod.default.id, "@devilroute/opencode-plugin");
  assert.strictEqual(typeof mod.default.server, "function");
});
