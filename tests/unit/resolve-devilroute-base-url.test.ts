import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_DEVILROUTE_BASE_URL,
  resolveDevilRouteBaseUrl,
} from "../../src/shared/utils/resolveDevilRouteBaseUrl.ts";

test("resolveDevilRouteBaseUrl prefers DEVILROUTE_BASE_URL", () => {
  assert.equal(
    resolveDevilRouteBaseUrl({
      DEVILROUTE_BASE_URL: "https://internal.example.com/",
      BASE_URL: "https://base.example.com",
      NEXT_PUBLIC_BASE_URL: "https://public.example.com",
    }),
    "https://internal.example.com"
  );
});

test("resolveDevilRouteBaseUrl falls back to BASE_URL", () => {
  assert.equal(
    resolveDevilRouteBaseUrl({
      BASE_URL: "https://base.example.com/",
      NEXT_PUBLIC_BASE_URL: "https://public.example.com",
    }),
    "https://base.example.com"
  );
});

test("resolveDevilRouteBaseUrl falls back to NEXT_PUBLIC_BASE_URL", () => {
  assert.equal(
    resolveDevilRouteBaseUrl({
      NEXT_PUBLIC_BASE_URL: "https://public.example.com/",
    }),
    "https://public.example.com"
  );
});

test("resolveDevilRouteBaseUrl ignores blank values", () => {
  assert.equal(
    resolveDevilRouteBaseUrl({
      DEVILROUTE_BASE_URL: "   ",
      BASE_URL: "",
      NEXT_PUBLIC_BASE_URL: " https://public.example.com/ ",
    }),
    "https://public.example.com"
  );
});

test("resolveDevilRouteBaseUrl uses the default localhost fallback", () => {
  assert.equal(resolveDevilRouteBaseUrl({}), DEFAULT_DEVILROUTE_BASE_URL);
});
