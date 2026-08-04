import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  buildDevilRouteOpenCodeConfig,
  createDevilRouteAgentBlock,
  createDevilRouteComboConfig,
  createDevilRouteMCPEntry,
  createDevilRouteModesBlock,
  createDevilRouteProvider,
  fetchLiveModels,
  listCombos,
  mergeIntoExistingConfig,
  normalizeBaseURL,
  DEVILROUTE_DEFAULT_MODEL_CAPABILITIES,
  DEVILROUTE_DEFAULT_MODEL_CONTEXT_LENGTHS,
  DEVILROUTE_DEFAULT_OPENCODE_MODELS,
  DEVILROUTE_MCP_DEFAULT_SCOPES,
  DEVILROUTE_PROVIDER_NPM,
  OPENCODE_CONFIG_SCHEMA,
} from "../src/index.ts";

test("normalizeBaseURL preserves a bare host:port", () => {
  assert.equal(normalizeBaseURL("http://localhost:20128"), "http://localhost:20128/v1");
});

test("normalizeBaseURL strips trailing slashes", () => {
  assert.equal(normalizeBaseURL("http://localhost:20128////"), "http://localhost:20128/v1");
});

test("normalizeBaseURL deduplicates an existing /v1 suffix", () => {
  assert.equal(normalizeBaseURL("http://localhost:20128/v1"), "http://localhost:20128/v1");
  assert.equal(normalizeBaseURL("http://localhost:20128/v1/"), "http://localhost:20128/v1");
});

test("normalizeBaseURL rejects empty input", () => {
  assert.throws(() => normalizeBaseURL("   "), /baseURL is required/);
});

test("normalizeBaseURL rejects malformed URLs", () => {
  assert.throws(() => normalizeBaseURL("not a url"), /not a valid URL/);
});

test("createDevilRouteProvider validates required fields", () => {
  assert.throws(
    () => createDevilRouteProvider({ baseURL: "", apiKey: "x" } as never),
    /baseURL is required/
  );
  assert.throws(
    () => createDevilRouteProvider({ baseURL: "http://x", apiKey: "" } as never),
    /apiKey is required/
  );
});

test("createDevilRouteProvider produces the OpenCode-compatible shape", () => {
  const provider = createDevilRouteProvider({
    baseURL: "http://localhost:20128",
    apiKey: "sk_devilroute",
  });

  assert.equal(provider.npm, DEVILROUTE_PROVIDER_NPM);
  assert.equal(provider.name, "DevilRoute");
  assert.equal(provider.options.baseURL, "http://localhost:20128/v1");
  assert.equal(provider.options.apiKey, "sk_devilroute");
  assert.equal(typeof provider.models, "object");
});

test("createDevilRouteProvider seeds the default model catalog", () => {
  const provider = createDevilRouteProvider({
    baseURL: "http://localhost:20128",
    apiKey: "sk_devilroute",
  });

  const modelIds = Object.keys(provider.models).sort();
  const defaultIds = [...DEVILROUTE_DEFAULT_OPENCODE_MODELS].sort();
  assert.deepEqual(modelIds, defaultIds);
  for (const id of defaultIds) {
    assert.equal(provider.models[id]?.name, id);
    assert.equal(provider.models[id]?.attachment, true);
  }
});

test("createDevilRouteProvider honours a custom models list and labels", () => {
  const provider = createDevilRouteProvider({
    baseURL: "http://localhost:20128",
    apiKey: "sk_devilroute",
    models: ["auto", "claude-opus-4-7"],
    modelLabels: { auto: "Auto-Combo", "claude-opus-4-7": "Opus 4.7" },
  });

  assert.deepEqual(Object.keys(provider.models), ["auto", "claude-opus-4-7"]);
  assert.equal(provider.models.auto.name, "Auto-Combo");
  assert.equal(provider.models["claude-opus-4-7"].name, "Opus 4.7");
});

test("createDevilRouteProvider deduplicates and trims model ids", () => {
  const provider = createDevilRouteProvider({
    baseURL: "http://localhost:20128",
    apiKey: "sk_devilroute",
    models: ["  auto  ", "auto", "", "claude-opus-4-7"],
  });
  assert.deepEqual(Object.keys(provider.models), ["auto", "claude-opus-4-7"]);
});

test("createDevilRouteProvider honours displayName override", () => {
  const provider = createDevilRouteProvider({
    baseURL: "http://localhost:20128",
    apiKey: "sk_devilroute",
    displayName: "Local DevilRoute",
  });
  assert.equal(provider.name, "Local DevilRoute");
});

test("buildDevilRouteOpenCodeConfig wraps the provider with the OpenCode schema", () => {
  const doc = buildDevilRouteOpenCodeConfig({
    baseURL: "http://localhost:20128/v1",
    apiKey: "sk_devilroute",
  });

  assert.equal(doc.$schema, OPENCODE_CONFIG_SCHEMA);
  assert.equal(typeof doc.provider.devilroute, "object");
  assert.equal(doc.provider.devilroute.options.baseURL, "http://localhost:20128/v1");
});

test("config document is JSON-serialisable", () => {
  const doc = buildDevilRouteOpenCodeConfig({
    baseURL: "http://localhost:20128",
    apiKey: "sk_devilroute",
  });
  const round = JSON.parse(JSON.stringify(doc));
  assert.deepEqual(round, doc);
});

test("buildDevilRouteOpenCodeConfig emits model and small_model prefixed with provider key", () => {
  const doc = buildDevilRouteOpenCodeConfig({
    baseURL: "http://localhost:20128",
    apiKey: "sk_devilroute",
    model: "claude-sonnet-4-5-thinking",
    smallModel: "gemini-3-flash",
  });
  assert.equal(doc.model, "devilroute/claude-sonnet-4-5-thinking");
  assert.equal(doc.small_model, "devilroute/gemini-3-flash");
});

test("buildDevilRouteOpenCodeConfig omits model and small_model when not supplied", () => {
  const doc = buildDevilRouteOpenCodeConfig({
    baseURL: "http://localhost:20128",
    apiKey: "sk_devilroute",
  });
  assert.equal(doc.model, undefined);
  assert.equal(doc.small_model, undefined);
  assert.ok(!("model" in doc));
  assert.ok(!("small_model" in doc));
});

test("buildDevilRouteOpenCodeConfig ignores blank model strings", () => {
  const doc = buildDevilRouteOpenCodeConfig({
    baseURL: "http://localhost:20128",
    apiKey: "sk_devilroute",
    model: "   ",
    smallModel: "",
  });
  assert.ok(!("model" in doc));
  assert.ok(!("small_model" in doc));
});

test("mergeIntoExistingConfig preserves existing provider entries", () => {
  const existing = {
    $schema: OPENCODE_CONFIG_SCHEMA,
    provider: {
      anthropic: { npm: "@ai-sdk/anthropic", name: "Anthropic", options: {}, models: {} },
    },
    keybinds: { submit: "enter" },
  };
  const result = mergeIntoExistingConfig(existing, {
    baseURL: "http://localhost:20128",
    apiKey: "sk_devilroute",
  });
  assert.ok("anthropic" in (result.provider as Record<string, unknown>));
  assert.ok("devilroute" in (result.provider as Record<string, unknown>));
  assert.deepEqual((result as Record<string, unknown>).keybinds, { submit: "enter" });
});

test("mergeIntoExistingConfig overwrites existing devilroute entry", () => {
  const existing = {
    provider: {
      devilroute: {
        npm: "@ai-sdk/openai-compatible",
        name: "OLD",
        options: { baseURL: "http://old/v1", apiKey: "old" },
        models: {},
      },
    },
  };
  const result = mergeIntoExistingConfig(existing, {
    baseURL: "http://new",
    apiKey: "new-key",
    displayName: "NEW",
  });
  const devilroute = (result.provider as Record<string, unknown>).devilroute as { name: string };
  assert.equal(devilroute.name, "NEW");
});

test("mergeIntoExistingConfig writes model and small_model when supplied", () => {
  const result = mergeIntoExistingConfig(
    {},
    {
      baseURL: "http://localhost:20128",
      apiKey: "sk_devilroute",
      model: "claude-sonnet-4-5-thinking",
      smallModel: "gemini-3-flash",
    }
  );
  assert.equal(result.model, "devilroute/claude-sonnet-4-5-thinking");
  assert.equal(result.small_model, "devilroute/gemini-3-flash");
});

test("mergeIntoExistingConfig does not add model keys when not supplied", () => {
  const result = mergeIntoExistingConfig(
    {},
    { baseURL: "http://localhost:20128", apiKey: "sk_devilroute" }
  );
  assert.ok(!("model" in result));
  assert.ok(!("small_model" in result));
});

test("DEVILROUTE_MCP_DEFAULT_SCOPES contains 7 read-only scopes", () => {
  assert.equal(DEVILROUTE_MCP_DEFAULT_SCOPES.length, 7);
  assert.ok(DEVILROUTE_MCP_DEFAULT_SCOPES.every((s) => s.startsWith("read:")));
});

test("createDevilRouteMCPEntry defaults to tsx runtime", () => {
  const entry = createDevilRouteMCPEntry({
    serverPath: "/path/to/server.ts",
    apiKey: "sk_devilroute",
  });
  assert.equal(entry.command, "npx");
  assert.deepEqual(entry.args, ["tsx", "/path/to/server.ts"]);
  assert.equal(entry.env.DEVILROUTE_API_KEY, "sk_devilroute");
  assert.ok(!("DEVILROUTE_MCP_ENFORCE_SCOPES" in entry.env));
  assert.ok(!("DEVILROUTE_MANAGEMENT_API_KEY" in entry.env));
});

test("createDevilRouteMCPEntry uses node runtime when specified", () => {
  const entry = createDevilRouteMCPEntry({
    serverPath: "/path/to/server.js",
    apiKey: "sk_devilroute",
    runtime: "node",
  });
  assert.equal(entry.command, "node");
  assert.deepEqual(entry.args, ["/path/to/server.js"]);
});

test("createDevilRouteMCPEntry sets management key and scopes when supplied", () => {
  const entry = createDevilRouteMCPEntry({
    serverPath: "/path/to/server.ts",
    apiKey: "sk_devilroute",
    managementApiKey: "sk_manage",
    scopes: ["read:health", "read:combos", "execute:completions"],
  });
  assert.equal(entry.env.DEVILROUTE_MANAGEMENT_API_KEY, "sk_manage");
  assert.equal(entry.env.DEVILROUTE_MCP_ENFORCE_SCOPES, "true");
  assert.equal(entry.env.DEVILROUTE_MCP_SCOPES, "read:health,read:combos,execute:completions");
});

test("createDevilRouteMCPEntry rejects missing required fields", () => {
  assert.throws(
    () => createDevilRouteMCPEntry({ serverPath: "", apiKey: "x" }),
    /serverPath is required/
  );
  assert.throws(
    () => createDevilRouteMCPEntry({ serverPath: "/p", apiKey: "" }),
    /apiKey is required/
  );
});

function startMockServer(
  handler: (path: string) => unknown
): Promise<{ url: string; close: () => void }> {
  return new Promise((resolve) => {
    const server: Server = createServer((req, res) => {
      const body = JSON.stringify(handler(req.url ?? ""));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(body);
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as { port: number };
      resolve({ url: `http://127.0.0.1:${addr.port}`, close: () => server.close() });
    });
  });
}

test("fetchLiveModels handles array envelope", async () => {
  const { url, close } = await startMockServer(() => [
    { id: "claude-sonnet", name: "Claude Sonnet" },
    { id: "gemini-flash", displayName: "Gemini Flash" },
  ]);
  try {
    const models = await fetchLiveModels(url, "sk_test");
    assert.equal(models.length, 2);
    assert.equal(models[0].id, "claude-sonnet");
    assert.equal(models[0].name, "Claude Sonnet");
    assert.equal(models[1].id, "gemini-flash");
    assert.equal(models[1].name, "Gemini Flash");
  } finally {
    close();
  }
});

test("fetchLiveModels handles data-envelope and snake_case fields", async () => {
  const { url, close } = await startMockServer(() => ({
    data: [{ model_id: "gpt-4o", display_name: "GPT-4o" }],
  }));
  try {
    const models = await fetchLiveModels(url, "sk_test");
    assert.equal(models.length, 1);
    assert.equal(models[0].id, "gpt-4o");
    assert.equal(models[0].name, "GPT-4o");
  } finally {
    close();
  }
});

test("fetchLiveModels falls back to id as name when no name field", async () => {
  const { url, close } = await startMockServer(() => [{ id: "auto" }]);
  try {
    const models = await fetchLiveModels(url, "sk_test");
    assert.equal(models[0].name, "auto");
  } finally {
    close();
  }
});

test("listCombos normalises compressionOverride", async () => {
  const { url, close } = await startMockServer(() => ({
    combos: [
      {
        id: "c1",
        name: "Primary",
        strategy: "priority",
        active: true,
        compressionOverride: "standard",
      },
      {
        id: "c2",
        name: "Cheap",
        strategy: "weighted",
        active: false,
        compressionOverride: "unknown-value",
      },
      { id: "c3", name: "Off", strategy: "round-robin", active: true, compressionOverride: "" },
    ],
  }));
  try {
    const combos = await listCombos(url, "sk_manage");
    assert.equal(combos.length, 3);
    assert.equal(combos[0].compressionOverride, "standard");
    assert.equal(combos[1].compressionOverride, "");
    assert.equal(combos[2].compressionOverride, "");
  } finally {
    close();
  }
});

test("createDevilRouteComboConfig builds minimal payload", () => {
  const payload = createDevilRouteComboConfig({ name: "my-combo", strategy: "priority" });
  assert.equal(payload.name, "my-combo");
  assert.equal(payload.strategy, "priority");
  assert.equal(payload.active, true);
  assert.ok(!("compressionOverride" in payload));
  assert.ok(!("providers" in payload));
});

test("createDevilRouteComboConfig includes optional fields when supplied", () => {
  const payload = createDevilRouteComboConfig({
    name: "full",
    strategy: "weighted",
    compressionOverride: "aggressive",
    active: false,
    providers: ["provider-a", "provider-b"],
  });
  assert.equal(payload.compressionOverride, "aggressive");
  assert.equal(payload.active, false);
  assert.deepEqual(payload.providers, ["provider-a", "provider-b"]);
});

test("DEVILROUTE_DEFAULT_OPENCODE_MODELS includes cc/ prefixed models", () => {
  const defaults = [...DEVILROUTE_DEFAULT_OPENCODE_MODELS];
  assert.ok(defaults.includes("cc/claude-opus-4-8"));
  assert.ok(
    defaults.some((m) => m.startsWith("cc/")),
    "should have cc/ prefixed models"
  );
  assert.ok(defaults.length >= 7, "should have at least 7 models");
});

test("DEVILROUTE_DEFAULT_MODEL_CONTEXT_LENGTHS covers every default model id", () => {
  for (const id of DEVILROUTE_DEFAULT_OPENCODE_MODELS) {
    const ctx = DEVILROUTE_DEFAULT_MODEL_CONTEXT_LENGTHS[id];
    assert.ok(
      typeof ctx === "number" && ctx > 0,
      `default context_length for ${id} missing — should be a positive number`
    );
    // Sanity: context should be at least 8K, at most 2M tokens
    assert.ok(ctx >= 8_000, `${id} context_length ${ctx} seems too low`);
    assert.ok(ctx <= 2_000_000, `${id} context_length ${ctx} seems too high`);
  }
});

test("createDevilRouteProvider emits limit.context on default model entries", () => {
  const provider = createDevilRouteProvider({
    baseURL: "http://localhost:20128",
    apiKey: "sk_devilroute",
  });
  const entry = provider.models["cc/claude-opus-4-8"];
  assert.ok(entry.limit, "model entry should have a limit field");
  assert.equal(entry.limit!.context, 1_000_000);
  assert.equal(provider.models["cc/claude-opus-4-7"].limit!.context, 1_000_000);
});

test("createDevilRouteProvider omits limit.context for unknown model ids", () => {
  const provider = createDevilRouteProvider({
    baseURL: "http://localhost:20128",
    apiKey: "sk_devilroute",
    models: ["completely-unknown-model"],
  });
  const entry = provider.models["completely-unknown-model"];
  assert.equal(entry.limit, undefined);
});

test("createDevilRouteProvider reads contextLength from a live model entry for ids absent from the static map", () => {
  // #3298 regression guard: the static DEVILROUTE_DEFAULT_MODEL_CONTEXT_LENGTHS
  // map only covers the legacy 8 Claude/Gemini ids. Before this change, any
  // other model got `undefined` context (see the test above, string form) and
  // OpenCode silently fell back to its 128K internal default. A live model
  // entry carrying `contextLength` must now surface as `limit.context`.
  const provider = createDevilRouteProvider({
    baseURL: "http://localhost:20128",
    apiKey: "sk_devilroute",
    models: [{ id: "completely-unknown-model", contextLength: 262_144 }],
  });
  const entry = provider.models["completely-unknown-model"];
  assert.ok(entry.limit, "a live contextLength should produce a limit field even for ids absent from the static map");
  assert.equal(entry.limit!.context, 262_144);
});

test("createDevilRouteProvider: a live model contextLength wins over the static default map", () => {
  // `cc/claude-opus-4-8` has a static default (1_000_000). A live entry carrying
  // a different contextLength must take precedence (live > modelContextLengths >
  // static defaults).
  const provider = createDevilRouteProvider({
    baseURL: "http://localhost:20128",
    apiKey: "sk_devilroute",
    models: [{ id: "cc/claude-opus-4-8", contextLength: 524_288 }],
  });
  assert.equal(provider.models["cc/claude-opus-4-8"].limit!.context, 524_288);
});

test("createDevilRouteProvider serialises limit.context to JSON", () => {
  const provider = createDevilRouteProvider({
    baseURL: "http://localhost:20128",
    apiKey: "sk_devilroute",
  });
  const round = JSON.parse(JSON.stringify(provider));
  for (const id of DEVILROUTE_DEFAULT_OPENCODE_MODELS) {
    const expectedContext = DEVILROUTE_DEFAULT_MODEL_CONTEXT_LENGTHS[id];
    assert.equal(
      round.models[id].limit?.context,
      expectedContext,
      `${id} should serialise limit.context=${expectedContext}`
    );
  }
});

test("fetchLiveModels extracts context_length from snake_case field", async () => {
  const { url, close } = await startMockServer(() => ({
    data: [
      { id: "cc/claude-opus-4-7", name: "Claude Opus 4.7", context_length: 200_000 },
      { id: "gemini-3.1-pro-high", name: "Gemini 3.1 Pro", context_length: 1_000_000 },
      { id: "no-context", name: "No Context" },
    ],
  }));
  try {
    const models = await fetchLiveModels(url, "sk_test");
    const claude = models.find((m) => m.id === "cc/claude-opus-4-7");
    assert.ok(claude, "claude model should be present");
    assert.equal(claude!.contextLength, 200_000);
    const gemini = models.find((m) => m.id === "gemini-3.1-pro-high");
    assert.equal(gemini!.contextLength, 1_000_000);
    const noCtx = models.find((m) => m.id === "no-context");
    assert.equal(noCtx!.contextLength, undefined);
  } finally {
    close();
  }
});

test("DEVILROUTE_DEFAULT_MODEL_CAPABILITIES covers every default model id", () => {
  for (const id of DEVILROUTE_DEFAULT_OPENCODE_MODELS) {
    const caps = DEVILROUTE_DEFAULT_MODEL_CAPABILITIES[id];
    assert.ok(caps, `default capabilities for ${id} missing`);
    assert.equal(caps.attachment, true, `${id} should default to attachment=true`);
    assert.equal(caps.tool_call, true, `${id} should default to tool_call=true`);
  }
});

test("createDevilRouteProvider emits default capability flags inline with the model entry", () => {
  const provider = createDevilRouteProvider({
    baseURL: "http://localhost:20128",
    apiKey: "sk_devilroute",
  });
  const entry = provider.models["cc/claude-opus-4-8"];
  assert.equal(entry.name, "cc/claude-opus-4-8");
  assert.equal(entry.attachment, true);
  assert.equal(entry.reasoning, true);
  assert.equal(entry.temperature, true);
  assert.equal(entry.tool_call, true);
});

test("createDevilRouteProvider modelCapabilities overrides defaults and merges per id", () => {
  const provider = createDevilRouteProvider({
    baseURL: "http://localhost:20128",
    apiKey: "sk_devilroute",
    modelCapabilities: {
      "cc/claude-opus-4-7": { reasoning: false, label: "Opus (no thinking)" },
    },
  });
  const entry = provider.models["cc/claude-opus-4-7"];
  assert.equal(entry.name, "Opus (no thinking)");
  assert.equal(entry.reasoning, false);
  assert.equal(entry.attachment, true);
  assert.equal(entry.tool_call, true);
});

test("createDevilRouteProvider applies capability overrides to non-default model ids", () => {
  const provider = createDevilRouteProvider({
    baseURL: "http://localhost:20128",
    apiKey: "sk_devilroute",
    models: ["custom-model"],
    modelCapabilities: {
      "custom-model": { attachment: false, tool_call: true, label: "Custom" },
    },
  });
  const entry = provider.models["custom-model"];
  assert.equal(entry.name, "Custom");
  assert.equal(entry.attachment, false);
  assert.equal(entry.tool_call, true);
  assert.equal(entry.reasoning, undefined);
  assert.equal(entry.temperature, undefined);
});

test("createDevilRouteProvider modelLabels still works when modelCapabilities omits label", () => {
  const provider = createDevilRouteProvider({
    baseURL: "http://localhost:20128",
    apiKey: "sk_devilroute",
    models: ["claude-opus-4-5-thinking"],
    modelLabels: { "claude-opus-4-5-thinking": "Opus 4.5 (legacy label)" },
  });
  assert.equal(provider.models["claude-opus-4-5-thinking"].name, "Opus 4.5 (legacy label)");
});

test("createDevilRouteAgentBlock builds provider-prefixed entries per role", () => {
  const block = createDevilRouteAgentBlock({
    roles: {
      build: { modelId: "claude-sonnet-4-5-thinking", temperature: 0.2 },
      plan: { modelId: "claude-opus-4-5-thinking", top_p: 0.95 },
      review: { modelId: "gemini-3-flash", temperature: 0.0 },
    },
  });
  assert.equal(block.build.model, "devilroute/claude-sonnet-4-5-thinking");
  assert.equal(block.build.temperature, 0.2);
  assert.equal(block.plan.model, "devilroute/claude-opus-4-5-thinking");
  assert.equal(block.plan.top_p, 0.95);
  assert.equal(block.review.model, "devilroute/gemini-3-flash");
  assert.equal(block.review.temperature, 0.0);
});

test("createDevilRouteAgentBlock omits optional fields when not supplied", () => {
  const block = createDevilRouteAgentBlock({
    roles: { build: { modelId: "claude-sonnet-4-5-thinking" } },
  });
  assert.equal(block.build.model, "devilroute/claude-sonnet-4-5-thinking");
  assert.ok(!("temperature" in block.build));
  assert.ok(!("top_p" in block.build));
  assert.ok(!("tools" in block.build));
  assert.ok(!("prompt" in block.build));
});

test("createDevilRouteAgentBlock skips roles with empty modelId", () => {
  const block = createDevilRouteAgentBlock({
    roles: {
      build: { modelId: "claude-sonnet-4-5-thinking" },
      plan: { modelId: "   " },
      review: { modelId: "" },
    },
  });
  assert.deepEqual(Object.keys(block), ["build"]);
});

test("createDevilRouteAgentBlock emits tools as Record<string, boolean> per OC schema", () => {
  const block = createDevilRouteAgentBlock({
    roles: {
      build: {
        modelId: "claude-sonnet-4-5-thinking",
        tools: { edit: true, bash: true, web: false },
        prompt: "Edit files carefully.",
      },
    },
  });
  assert.deepEqual(block.build.tools, { edit: true, bash: true, web: false });
  assert.equal(block.build.prompt, "Edit files carefully.");
});

test("createDevilRouteAgentBlock filters invalid tool entries and omits empty maps", () => {
  const block = createDevilRouteAgentBlock({
    roles: {
      build: {
        modelId: "claude-sonnet-4-5-thinking",
        // @ts-expect-error — exercising runtime guard against bad input
        tools: { edit: true, bash: "yes", "": true, web: null },
      },
      plan: {
        modelId: "claude-opus-4-5-thinking",
        tools: {},
      },
    },
  });
  assert.deepEqual(block.build.tools, { edit: true });
  assert.ok(!("tools" in block.plan));
});

test("createDevilRouteModesBlock builds provider-prefixed mode entries", () => {
  const block = createDevilRouteModesBlock({
    modes: {
      build: { modelId: "claude-sonnet-4-5-thinking", tools: { edit: true, bash: true } },
      plan: { modelId: "claude-opus-4-5-thinking", prompt: "Plan first, code later." },
      review: { modelId: "gemini-3-flash" },
    },
  });
  assert.equal(block.build.model, "devilroute/claude-sonnet-4-5-thinking");
  assert.deepEqual(block.build.tools, { edit: true, bash: true });
  assert.equal(block.plan.prompt, "Plan first, code later.");
  assert.equal(block.review.model, "devilroute/gemini-3-flash");
});

test("createDevilRouteModesBlock skips modes with empty modelId", () => {
  const block = createDevilRouteModesBlock({
    modes: {
      build: { modelId: "claude-sonnet-4-5-thinking" },
      plan: { modelId: "" },
    },
  });
  assert.deepEqual(Object.keys(block), ["build"]);
});

test("createDevilRouteModesBlock honours numeric overrides limited to OC schema", () => {
  const block = createDevilRouteModesBlock({
    modes: {
      build: {
        modelId: "claude-sonnet-4-5-thinking",
        temperature: 0.7,
        top_p: 0.9,
      },
    },
  });
  assert.equal(block.build.temperature, 0.7);
  assert.equal(block.build.top_p, 0.9);
});

// #3419 — soft-deprecation in favour of @devilroute/opencode-plugin. Guard the
// deprecation notice so it can't be silently dropped while the package is kept
// publishing (it still works; it is just no longer the recommended path).
test("package is marked deprecated in favour of @devilroute/opencode-plugin (#3419)", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const pkg = JSON.parse(readFileSync(join(here, "..", "package.json"), "utf8"));
  assert.match(pkg.description, /DEPRECATED/);
  assert.match(pkg.description, /@devilroute\/opencode-plugin/);

  const readme = readFileSync(join(here, "..", "README.md"), "utf8");
  assert.match(readme, /Deprecated/i);
  assert.match(readme, /@devilroute\/opencode-plugin/);
});
