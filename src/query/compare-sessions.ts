import type { NormalizedSession, SessionComparison } from "../types/normalized.js";
import { summarizeSession } from "./summarize-session.js";

export function compareSessions(
  left: NormalizedSession,
  right: NormalizedSession,
): SessionComparison {
  const leftSummary = summarizeSession(left);
  const rightSummary = summarizeSession(right);

  const leftTools = new Set(leftSummary.toolNames);
  const rightTools = new Set(rightSummary.toolNames);
  const leftWarnings = new Set(left.warnings.map((warning) => warning.code));
  const rightWarnings = new Set(right.warnings.map((warning) => warning.code));

  return {
    sessionIds: [left.metadata.sessionId, right.metadata.sessionId],
    delta: {
      eventCount: leftSummary.eventCount - rightSummary.eventCount,
      assistantRecords:
        leftSummary.assistantRecordCount - rightSummary.assistantRecordCount,
      toolCalls: leftSummary.toolCallCount - rightSummary.toolCallCount,
      warnings: leftSummary.warningCount - rightSummary.warningCount,
    },
    tools: {
      onlyInA: [...leftTools].filter((tool) => !rightTools.has(tool)),
      onlyInB: [...rightTools].filter((tool) => !leftTools.has(tool)),
      shared: [...leftTools].filter((tool) => rightTools.has(tool)),
    },
    warnings: {
      onlyInA: [...leftWarnings].filter((code) => !rightWarnings.has(code)),
      onlyInB: [...rightWarnings].filter((code) => !leftWarnings.has(code)),
    },
  };
}
