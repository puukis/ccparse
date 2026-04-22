import type {
  NormalizedSession,
  ToolResultEvent,
  ToolUseEvent,
} from "../types/normalized.js";

export function getOpenToolCalls(session: NormalizedSession): ToolUseEvent[] {
  const pendingToolUses = new Map<string, ToolUseEvent>();

  for (const event of session.events) {
    if (event.kind === "tool_use") {
      pendingToolUses.set(event.toolUseId, event);
      continue;
    }

    if (event.kind === "tool_result" && event.toolUseId) {
      pendingToolUses.delete(event.toolUseId);
    }
  }

  return [...pendingToolUses.values()];
}

export function getOrphanToolResults(session: NormalizedSession): ToolResultEvent[] {
  const seenToolUseIds = new Set<string>();
  const orphanedResults: ToolResultEvent[] = [];

  for (const event of session.events) {
    if (event.kind === "tool_use") {
      seenToolUseIds.add(event.toolUseId);
      continue;
    }

    if (event.kind === "tool_result") {
      if (!event.toolUseId || !seenToolUseIds.has(event.toolUseId)) {
        orphanedResults.push(event);
        continue;
      }

      seenToolUseIds.delete(event.toolUseId);
    }
  }

  return orphanedResults;
}
