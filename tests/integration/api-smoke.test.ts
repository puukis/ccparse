import test from "node:test";
import assert from "node:assert/strict";

import {
  getAssistantTurns,
  iterateEvents,
  normalizeSession,
  parseHistory,
  parseSession,
  summarizeSession,
} from "../../src/index.js";
import { fixturePath } from "../helpers/fixtures.js";

test("top-level API parses sessions and history end to end", async () => {
  const parsedSession = await parseSession(fixturePath("normal-session.jsonl"));
  const normalized = normalizeSession(parsedSession);
  const parsedHistory = await parseHistory(fixturePath("history-file.jsonl"));

  assert.equal(parsedSession.kind, "session");
  assert.equal(parsedHistory.kind, "history");
  assert.equal(parsedHistory.metadata.entryCount, 3);
  assert.equal([...iterateEvents(normalized)].length, normalized.events.length);
  assert.equal(getAssistantTurns(normalized).length, 2);
  assert.equal(summarizeSession(normalized).sessionId, "session-normal");
});
