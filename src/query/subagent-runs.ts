import type { NormalizedSession, SubagentRun, SubagentRunEvent } from "../types/normalized.js";

export function getSubagentRuns(session: NormalizedSession): SubagentRun[] {
  const grouped = new Map<string, SubagentRun>();

  for (const event of session.events) {
    if (event.kind !== "subagent_run") {
      continue;
    }

    const key =
      event.transcriptPath ??
      event.sessionIdRef ??
      event.parentToolUseId ??
      `${event.provenance.recordIndex}`;
    let run = grouped.get(key);
    if (!run) {
      run = {
        id: key,
        occurrences: [],
      };
      grouped.set(key, run);
    }

    const typed = event as SubagentRunEvent;
    run.occurrences.push(typed);
    run.name ??= typed.name;
    run.status ??= typed.status;
    run.sessionId ??= typed.sessionIdRef;
    run.transcriptPath ??= typed.transcriptPath;
    run.parentToolUseId ??= typed.parentToolUseId;
  }

  return [...grouped.values()];
}
