import type { NormalizedSession, ToolUseEvent } from "../types/normalized.js";

export function getToolCalls(session: NormalizedSession): ToolUseEvent[] {
  return session.events.filter((event): event is ToolUseEvent => event.kind === "tool_use");
}
