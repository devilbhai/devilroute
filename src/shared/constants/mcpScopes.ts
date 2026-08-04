/**
 * MCP Authorization Scopes — Defines permission scopes for each MCP tool.
 *
 * Each tool requires specific scopes to execute. API keys can be configured
 * with a subset of scopes to limit tool access (least-privilege).
 */

// ============ Scope Definitions ============

/** All available MCP scopes */
export const MCP_SCOPE_LIST = [
  "read:health",
  "read:combos",
  "write:combos",
  "read:quota",
  "read:usage",
  "read:models",
  "execute:completions",
  "execute:search",
  "write:budget",
  "write:resilience",
  "pricing:write",
  "read:cache",
  "write:cache",
  "read:compression",
  "write:compression",
  "read:proxies",
] as const;

export type McpScope = (typeof MCP_SCOPE_LIST)[number];

// ============ Tool → Scope Mapping ============

/** Maps each MCP tool to its required scopes */
export const MCP_TOOL_SCOPES: Record<string, readonly McpScope[]> = {
  // Phase 1: Essential Tools
  devilroute_get_health: ["read:health"],
  devilroute_list_combos: ["read:combos"],
  devilroute_get_combo_metrics: ["read:combos"],
  devilroute_switch_combo: ["write:combos"],
  devilroute_check_quota: ["read:quota"],
  devilroute_route_request: ["execute:completions"],
  devilroute_web_search: ["execute:search"],
  devilroute_web_fetch: ["execute:search"],
  devilroute_cost_report: ["read:usage"],
  devilroute_list_models_catalog: ["read:models"],

  // Phase 2: Advanced Tools
  devilroute_simulate_route: ["read:health", "read:combos"],
  devilroute_set_budget_guard: ["write:budget"],
  devilroute_set_resilience_profile: ["write:resilience"],
  devilroute_test_combo: ["execute:completions", "read:combos"],
  devilroute_get_provider_metrics: ["read:health"],
  devilroute_best_combo_for_task: ["read:combos", "read:health"],
  devilroute_explain_route: ["read:health", "read:usage"],
  devilroute_get_session_snapshot: ["read:usage"],
  devilroute_db_health_check: ["read:health", "write:resilience"],
  devilroute_sync_pricing: ["pricing:write"],
  devilroute_cache_stats: ["read:cache"],
  devilroute_cache_flush: ["write:cache"],
  devilroute_compression_status: ["read:compression"],
  devilroute_compression_configure: ["write:compression"],
  devilroute_set_compression_engine: ["write:compression"],
  devilroute_list_compression_combos: ["read:compression"],
  devilroute_compression_combo_stats: ["read:compression"],
  devilroute_ccr_store: ["write:compression"],
  devilroute_ccr_retrieve: ["read:compression"],
  devilroute_ccr_inspect: ["read:compression"],
  devilroute_ccr_list: ["read:compression"],
  devilroute_ccr_delete: ["write:compression"],
  devilroute_ccr_stats: ["read:compression"],
  devilroute_oneproxy_fetch: ["read:proxies"],
  devilroute_oneproxy_rotate: ["read:proxies"],
  devilroute_oneproxy_stats: ["read:proxies"],

  // Web-session pool observability (read) + lifecycle (write)
  devilroute_pool_status: ["read:health"],
  devilroute_pool_sessions: ["read:health"],
  devilroute_pool_health: ["read:health"],
  devilroute_pool_reset: ["write:resilience"],
  devilroute_pool_warm: ["write:resilience"],
  // Stealth browser pool observability (#3368 PR7)
  devilroute_browser_pool_status: ["read:health"],
} as const;
