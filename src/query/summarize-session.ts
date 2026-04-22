import type { NormalizedSession, SessionSummary } from "../types/normalized.js";
import { getAssistantTurns } from "./assistant-turns.js";
import { getSessionState } from "./session-state.js";
import { getSubagentRuns } from "./subagent-runs.js";
import { getToolCalls } from "./tool-calls.js";
import { getOpenToolCalls, getOrphanToolResults } from "./tool-links.js";

export function summarizeSession(session: NormalizedSession): SessionSummary {
  const assistantRecords = getAssistantTurns(session);
  const toolCalls = getToolCalls(session);
  const subagents = getSubagentRuns(session);
  const openToolCalls = getOpenToolCalls(session);
  const orphanToolResults = getOrphanToolResults(session);
  const assistantReplyCount = assistantRecords.filter((turn) => turn.textBlocks.length > 0).length;
  const assistantTextBlockCount = session.events.filter(
    (event) => event.kind === "assistant_text",
  ).length;
  const currentState = getSessionState(session);
  const warningKinds = [...new Set(session.warnings.map((warning) => warning.code))];
  const models = [
    ...new Set(
      session.events.flatMap((event) =>
        "model" in event && typeof event.model === "string" ? [event.model] : [],
      ),
    ),
  ];
  const toolNames = [...new Set(toolCalls.flatMap((call) => (call.name ? [call.name] : [])))];

  return {
    sessionId: session.metadata.sessionId,
    eventCount: session.events.length,
    userMessageCount: session.events.filter((event) => event.kind === "user_message").length,
    assistantRecordCount: assistantRecords.length,
    assistantReplyCount,
    assistantTextBlockCount,
    toolCallCount: toolCalls.length,
    toolResultCount: session.events.filter((event) => event.kind === "tool_result").length,
    openToolCallCount: openToolCalls.length,
    orphanToolResultCount: orphanToolResults.length,
    warningCount: session.warnings.length,
    warningKinds,
    currentState,
    subagentCount: subagents.length,
    startedAt: session.metadata.startedAt,
    endedAt: session.metadata.endedAt,
    models,
    toolNames,
  };
}
