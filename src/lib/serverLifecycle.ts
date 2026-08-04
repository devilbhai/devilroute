export type ServerLifecyclePhase = "starting" | "ready" | "stopping";

declare global {
  var __devilrouteServerLifecycle: ServerLifecyclePhase | undefined;
}

export function getServerLifecyclePhase(): ServerLifecyclePhase {
  return globalThis.__devilrouteServerLifecycle ?? "starting";
}

export function markServerStarting(): void {
  globalThis.__devilrouteServerLifecycle = "starting";
}

export function markServerReady(): void {
  if (getServerLifecyclePhase() !== "stopping") {
    globalThis.__devilrouteServerLifecycle = "ready";
  }
}

export function markServerStopping(): void {
  globalThis.__devilrouteServerLifecycle = "stopping";
}
