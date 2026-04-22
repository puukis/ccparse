import {
  discoverSessions,
  normalizeSession,
  parseSession,
  resolveToolResults,
  summarizeSession,
} from "../src/index.js";

const sessions = await discoverSessions();
const interestingSessions = sessions.filter(
  (session) => session.hasToolResults || session.hasSubagents,
);

if (interestingSessions.length === 0) {
  console.log(
    JSON.stringify(
      {
        totalSessions: sessions.length,
        interestingSessions: 0,
        message:
          "No local sessions with discovered tool-results or subagent references were found under ~/.claude.",
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

for (const session of interestingSessions) {
  const parsed = await parseSession(session.transcriptPath);
  const normalized = normalizeSession(parsed);
  const resolved = session.hasToolResults
    ? await resolveToolResults(normalized, { mode: "auto" })
    : normalized;

  console.log(
    JSON.stringify(
      {
        sessionId: session.sessionId,
        transcriptPath: session.transcriptPath,
        hasToolResults: session.hasToolResults,
        hasSubagents: session.hasSubagents,
        discovery: {
          parserWarningCount: session.parserWarningCount,
          normalizationWarningCount: session.normalizationWarningCount,
          totalWarningCount: session.totalWarningCount,
          relatedPaths: session.relatedPaths,
        },
        summary: summarizeSession(resolved),
        hydratedToolResults:
          resolved.events.filter(
            (event) =>
              event.kind === "tool_result" &&
              event.payload.kind === "external" &&
              Boolean(event.payload.reference.hydrated),
          ).length,
      },
      null,
      2,
    ),
  );
}
