import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getDeployBasePath,
  normalizeBasePath,
  withBasePath,
} from "../../../src/shared/utils/basePath";

describe("normalizeBasePath", () => {
  it("normalizes leading/trailing slashes", () => {
    assert.equal(normalizeBasePath("devilroute"), "/devilroute");
    assert.equal(normalizeBasePath("/devilroute/"), "/devilroute");
    assert.equal(normalizeBasePath("/devilroute"), "/devilroute");
    assert.equal(normalizeBasePath(""), "");
    assert.equal(normalizeBasePath("/"), "");
    assert.equal(normalizeBasePath(null), "");
  });
});

describe("getDeployBasePath", () => {
  it("reads NEXT_PUBLIC_DEVILROUTE_BASE_PATH first", () => {
    assert.equal(
      getDeployBasePath({
        NEXT_PUBLIC_DEVILROUTE_BASE_PATH: "/devilroute",
        DEVILROUTE_BASE_PATH: "/other",
      } as NodeJS.ProcessEnv),
      "/devilroute"
    );
  });

  it("falls back to DEVILROUTE_BASE_PATH", () => {
    assert.equal(
      getDeployBasePath({
        DEVILROUTE_BASE_PATH: "/devilroute",
      } as NodeJS.ProcessEnv),
      "/devilroute"
    );
  });
});

describe("withBasePath", () => {
  const base = "/devilroute";

  it("is a no-op when basePath is empty", () => {
    assert.equal(withBasePath("/api/health/ping", ""), "/api/health/ping");
  });

  it("prefixes absolute app paths", () => {
    assert.equal(withBasePath("/api/health/ping", base), "/devilroute/api/health/ping");
    assert.equal(withBasePath("/v1/models", base), "/devilroute/v1/models");
  });

  it("does not double-prefix", () => {
    assert.equal(withBasePath("/devilroute/api/health/ping", base), "/devilroute/api/health/ping");
    assert.equal(withBasePath("/devilroute", base), "/devilroute");
  });

  it("rewrites same-origin absolute URLs", () => {
    assert.equal(
      withBasePath("https://host.example/api/x", base, "https://host.example"),
      "https://host.example/devilroute/api/x"
    );
  });

  it("leaves external absolute URLs alone", () => {
    assert.equal(
      withBasePath("https://other.example/api/x", base, "https://host.example"),
      "https://other.example/api/x"
    );
  });

  it("leaves protocol-relative URLs alone", () => {
    assert.equal(withBasePath("//cdn.example/app.js", base), "//cdn.example/app.js");
  });
});
