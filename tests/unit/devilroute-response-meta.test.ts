import test from "node:test";
import assert from "node:assert/strict";

import {
  attachDevilRouteMetaHeaders,
  buildDevilRouteResponseMetaHeaders,
  buildDevilRouteSseMetadataComment,
  formatDevilRouteCost,
  getDevilRouteTokenCounts,
} from "../../src/domain/devilrouteResponseMeta.ts";
import { APP_CONFIG } from "../../src/shared/constants/appConfig.ts";
import { DEVILROUTE_RESPONSE_HEADERS } from "../../src/shared/constants/headers.ts";

test("getDevilRouteTokenCounts normalizes common usage shapes", () => {
  assert.deepEqual(
    getDevilRouteTokenCounts({
      prompt_tokens: 12,
      completion_tokens: 5,
    }),
    { input: 12, output: 5 }
  );
  assert.deepEqual(
    getDevilRouteTokenCounts({
      input_tokens: "9",
      output_tokens: "4",
    }),
    { input: 9, output: 4 }
  );
});

test("buildDevilRouteResponseMetaHeaders formats provider alias, tokens, latency, and cost", () => {
  const headers = buildDevilRouteResponseMetaHeaders({
    provider: "claude",
    model: "claude-sonnet-4-6",
    cacheHit: true,
    latencyMs: 1234.6,
    usage: {
      prompt_tokens: 11,
      completion_tokens: 7,
    },
    costUsd: 0.00123456789,
  });

  assert.equal(headers["X-DevilRoute-Provider"], "cc");
  assert.equal(headers["X-DevilRoute-Model"], "claude-sonnet-4-6");
  assert.equal(headers["X-DevilRoute-Cache-Hit"], "true");
  assert.equal(headers["X-DevilRoute-Latency-Ms"], "1235");
  assert.equal(headers["X-DevilRoute-Tokens-In"], "11");
  assert.equal(headers["X-DevilRoute-Tokens-Out"], "7");
  assert.equal(headers["X-DevilRoute-Response-Cost"], "0.0012345679");
});

test("buildDevilRouteResponseMetaHeaders keeps ASCII model header values unchanged", () => {
  const headers = buildDevilRouteResponseMetaHeaders({
    provider: "openai",
    model: "gpt-4o-mini",
  });

  assert.equal(headers[DEVILROUTE_RESPONSE_HEADERS.model], "gpt-4o-mini");
});

test("buildDevilRouteResponseMetaHeaders percent-encodes non-ASCII model header values", () => {
  const model = "free-mix/[假流式]gemini-3.5-flash";
  const headers = buildDevilRouteResponseMetaHeaders({
    provider: "openai",
    model,
  });

  assert.equal(headers[DEVILROUTE_RESPONSE_HEADERS.model], encodeURIComponent(model));
  assert.doesNotThrow(() => new Headers(headers));
});

test("buildDevilRouteResponseMetaHeaders strips control characters from string header values", () => {
  const headers = buildDevilRouteResponseMetaHeaders({
    provider: "openai",
    model: "free\r\nX-Injected: yes\u0000-model",
    requestId: "req-1\nreq-2\rreq-3\u0007",
  });

  assert.doesNotMatch(headers[DEVILROUTE_RESPONSE_HEADERS.model], /[\r\n\u0000-\u001f\u007f]/);
  assert.doesNotMatch(headers[DEVILROUTE_RESPONSE_HEADERS.requestId], /[\r\n\u0000-\u001f\u007f]/);
  assert.equal(headers[DEVILROUTE_RESPONSE_HEADERS.model], "freeX-Injected: yes-model");
  assert.equal(headers[DEVILROUTE_RESPONSE_HEADERS.requestId], "req-1req-2req-3");
  assert.doesNotThrow(() => new Headers(headers));
});

test("buildDevilRouteResponseMetaHeaders always emits X-DevilRoute-Version", () => {
  const headers = buildDevilRouteResponseMetaHeaders({ provider: "openai", model: "gpt" });
  assert.equal(headers[DEVILROUTE_RESPONSE_HEADERS.version], APP_CONFIG.version);

  // Even with no provider/model at all, the version is still attached.
  const bare = buildDevilRouteResponseMetaHeaders({});
  assert.equal(bare[DEVILROUTE_RESPONSE_HEADERS.version], APP_CONFIG.version);
});

test("buildDevilRouteResponseMetaHeaders emits X-DevilRoute-Request-Id only when provided", () => {
  const withId = buildDevilRouteResponseMetaHeaders({ model: "gpt", requestId: "req-123" });
  assert.equal(withId[DEVILROUTE_RESPONSE_HEADERS.requestId], "req-123");

  const noId = buildDevilRouteResponseMetaHeaders({ model: "gpt" });
  assert.equal(noId[DEVILROUTE_RESPONSE_HEADERS.requestId], undefined);

  const nullId = buildDevilRouteResponseMetaHeaders({ model: "gpt", requestId: null });
  assert.equal(nullId[DEVILROUTE_RESPONSE_HEADERS.requestId], undefined);

  const blankId = buildDevilRouteResponseMetaHeaders({ model: "gpt", requestId: "   " });
  assert.equal(blankId[DEVILROUTE_RESPONSE_HEADERS.requestId], undefined);
});

test("attachDevilRouteMetaHeaders mutates a Headers instance in place, preserving existing entries", () => {
  const headers = new Headers({ "Content-Type": "application/json" });
  attachDevilRouteMetaHeaders(headers, {
    provider: "openai",
    model: "gpt",
    requestId: "req-abc",
  });

  assert.equal(headers.get("Content-Type"), "application/json");
  assert.equal(headers.get(DEVILROUTE_RESPONSE_HEADERS.version), APP_CONFIG.version);
  assert.equal(headers.get(DEVILROUTE_RESPONSE_HEADERS.requestId), "req-abc");
  assert.equal(headers.get(DEVILROUTE_RESPONSE_HEADERS.model), "gpt");
});

test("attachDevilRouteMetaHeaders mutates a plain record in place, preserving existing entries", () => {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  attachDevilRouteMetaHeaders(headers, {
    provider: "openai",
    model: "gpt",
  });

  assert.equal(headers["Content-Type"], "application/json");
  assert.equal(headers[DEVILROUTE_RESPONSE_HEADERS.version], APP_CONFIG.version);
  assert.equal(headers[DEVILROUTE_RESPONSE_HEADERS.model], "gpt");
  // No requestId provided → header omitted.
  assert.equal(headers[DEVILROUTE_RESPONSE_HEADERS.requestId], undefined);
});

test("buildDevilRouteSseMetadataComment emits comment lines compatible with SSE", () => {
  const comment = buildDevilRouteSseMetadataComment({
    provider: "openai",
    model: "gpt-4o-mini",
    usage: {
      prompt_tokens: 4,
      completion_tokens: 2,
    },
    latencyMs: 50,
    costUsd: formatDevilRouteCost(0),
  });

  assert.match(comment, /^: x-devilroute-cache-hit=false/m);
  assert.match(comment, /^: x-devilroute-provider=openai/m);
  assert.match(comment, /^: x-devilroute-model=gpt-4o-mini/m);
  assert.match(comment, /^: x-devilroute-tokens-in=4/m);
  assert.match(comment, /^: x-devilroute-tokens-out=2/m);
  assert.match(comment, /^: x-devilroute-response-cost=0\.0000000000/m);
});

test("buildDevilRouteResponseMetaHeaders emits X-DevilRoute-Cost-Saved only when costSavedUsd is provided", () => {
  // Cache HIT: the incremental cost of serving the hit is 0, but the cache saved the
  // original (would-have-been) cost — surfaced via the Cost-Saved header for analytics.
  const hit = buildDevilRouteResponseMetaHeaders({
    provider: "openai",
    model: "gpt-4o",
    cacheHit: true,
    costUsd: 0,
    costSavedUsd: 0.0125,
  });
  assert.equal(hit[DEVILROUTE_RESPONSE_HEADERS.responseCost], "0.0000000000");
  assert.equal(hit[DEVILROUTE_RESPONSE_HEADERS.costSaved], "0.0125000000");

  // A normal response (no costSavedUsd) omits the Cost-Saved header entirely.
  const miss = buildDevilRouteResponseMetaHeaders({
    provider: "openai",
    model: "gpt-4o",
    costUsd: 0.0125,
  });
  assert.equal(miss[DEVILROUTE_RESPONSE_HEADERS.costSaved], undefined);

  // A free-model HIT still emits Cost-Saved (= 0) — it explicitly passed costSavedUsd.
  const freeHit = buildDevilRouteResponseMetaHeaders({
    cacheHit: true,
    costUsd: 0,
    costSavedUsd: 0,
  });
  assert.equal(freeHit[DEVILROUTE_RESPONSE_HEADERS.costSaved], "0.0000000000");
});

test("attachDevilRouteMetaHeaders forwards costSavedUsd onto a Headers bag", () => {
  const headers = new Headers({ "Content-Type": "application/json" });
  attachDevilRouteMetaHeaders(headers, {
    provider: "openai",
    model: "gpt-4o",
    cacheHit: true,
    costUsd: 0,
    costSavedUsd: 0.0125,
  });
  assert.equal(headers.get(DEVILROUTE_RESPONSE_HEADERS.responseCost), "0.0000000000");
  assert.equal(headers.get(DEVILROUTE_RESPONSE_HEADERS.costSaved), "0.0125000000");
});
