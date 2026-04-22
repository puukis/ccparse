import test from "node:test";
import assert from "node:assert/strict";

import {
  getDiscoveredSessionState,
  getAssistantTurns,
  getSessionState,
  iterateEvents,
  normalizeSession,
  parseHistory,
  parseSession,
  summarizeSession,
} from "../../src/index.js";
import { createMockClaudeRoot, fixturePath } from "../helpers/fixtures.js";
import { discoverSessions } from "../../src/discovery/discover-sessions.js";

test("top-level API parses sessions and history end to end", async () => {
  const parsedSession = await parseSession(fixturePath("normal-session.jsonl"));
  const normalized = normalizeSession(parsedSession);
  const parsedHistory = await parseHistory(fixturePath("history-file.jsonl"));
  const discovered = await discoverSessions({ roots: [await createMockClaudeRoot()] });
  const discoveredNormal = discovered.find((session) => session.sessionId === "session-normal");

  assert.equal(parsedSession.kind, "session");
  assert.equal(parsedHistory.kind, "history");
  assert.equal(parsedHistory.metadata.entryCount, 3);
  assert.equal([...iterateEvents(normalized)].length, normalized.events.length);
  assert.equal(getAssistantTurns(normalized).length, 2);
  assert.equal(summarizeSession(normalized).sessionId, "session-normal");
  assert.equal(summarizeSession(normalized).currentState.kind, "waiting_for_user");
  assert.equal(getSessionState(normalized).kind, "waiting_for_user");
  assert.equal(discoveredNormal?.currentState.kind, "waiting_for_user");
  if (discoveredNormal) {
    assert.equal((await getDiscoveredSessionState(discoveredNormal)).kind, "waiting_for_user");
  }
});
