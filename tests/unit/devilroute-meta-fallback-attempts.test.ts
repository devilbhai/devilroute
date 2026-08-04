import test from "node:test";
import assert from "node:assert/strict";
import { DEVILROUTE_RESPONSE_HEADERS } from "../../src/shared/constants/headers.ts";
import { buildDevilRouteResponseMetaHeaders } from "../../src/domain/devilrouteResponseMeta.ts";

test("headers constant exposes the fallback-attempts key", () => {
  assert.equal(
    DEVILROUTE_RESPONSE_HEADERS.fallbackAttempts,
    "X-DevilRoute-Fallback-Attempts"
  );
});

test("buildDevilRouteResponseMetaHeaders emits the fallback-attempts count when > 0", () => {
  const h = buildDevilRouteResponseMetaHeaders({ model: "gpt", provider: "openai", fallbackAttempts: 2 });
  assert.equal(h["X-DevilRoute-Fallback-Attempts"], "2");
});

test("buildDevilRouteResponseMetaHeaders omits the header when 0 / absent", () => {
  const none = buildDevilRouteResponseMetaHeaders({ model: "gpt" });
  assert.equal(none["X-DevilRoute-Fallback-Attempts"], undefined);
  const zero = buildDevilRouteResponseMetaHeaders({ model: "gpt", fallbackAttempts: 0 });
  assert.equal(zero["X-DevilRoute-Fallback-Attempts"], undefined);
});
