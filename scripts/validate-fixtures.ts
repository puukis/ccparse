import path from "node:path";
import { fileURLToPath } from "node:url";

import { normalizeSession, parseHistory, parseSession, summarizeSession } from "../src/index.js";

const fixturesDir = fileURLToPath(new URL("../fixtures/", import.meta.url));
const sessionFixtures = [
  "normal-session.jsonl",
  "external-tool-results.jsonl",
  "malformed-newlines.jsonl",
  "metadata-only-session.jsonl",
  "missing-final-stop-event.jsonl",
  "partial-open-tool-call.jsonl",
  "partial-trailing-line.jsonl",
  "running-session.jsonl",
  "subagent-nested.jsonl",
] as const;

for (const fixture of sessionFixtures) {
  const parsed = await parseSession(path.join(fixturesDir, fixture));
  const normalized = normalizeSession(parsed, { includeRaw: false });
  console.log(
    JSON.stringify(
      {
        fixture,
        summary: summarizeSession(normalized),
        warningCodes: normalized.warnings.map((warning) => warning.code),
      },
      null,
      2,
    ),
  );
}

const history = await parseHistory(path.join(fixturesDir, "history-file.jsonl"));
console.log(
  JSON.stringify(
    {
      fixture: "history-file.jsonl",
      entryCount: history.metadata.entryCount,
      sessionIds: history.metadata.sessionIds,
    },
    null,
    2,
  ),
);
