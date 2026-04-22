import test from "node:test";
import assert from "node:assert/strict";

import {
  compareSessions,
  getAssistantTurns,
  getDiscoveredSessionState,
  getOpenToolCalls,
  getOrphanToolResults,
  getSubagentRuns,
  getSessionState,
  getToolCalls,
  getWarnings,
  summarizeSession,
} from "../../src/index.js";
import { normalizeSession } from "../../src/normalize/normalize-session.js";
import { parseSession } from "../../src/parsing/parse-session.js";
import { createMockClaudeRoot, fixturePath } from "../helpers/fixtures.js";
import { discoverSessions } from "../../src/discovery/discover-sessions.js";

test("query helpers expose assistant turns, tool calls, and summaries", async () => {
  const normalized = normalizeSession(await parseSession(fixturePath("normal-session.jsonl")));

  const assistantTurns = getAssistantTurns(normalized);
  const toolCalls = getToolCalls(normalized);
  const summary = summarizeSession(normalized);

  assert.equal(assistantTurns.length, 2);
  assert.equal(assistantTurns[1]?.text, "The package is named ccparse.\n\nThe current version is 0.1.0.");
  assert.equal(toolCalls.length, 1);
  assert.equal(summary.toolCallCount, 1);
  assert.equal(summary.openToolCallCount, 0);
  assert.equal(summary.orphanToolResultCount, 0);
  assert.equal(summary.assistantRecordCount, 2);
  assert.equal(summary.assistantReplyCount, 1);
  assert.equal(summary.assistantTextBlockCount, 2);
  assert.deepEqual(summary.warningKinds, []);
  assert.equal(summary.currentState.kind, "waiting_for_user");
  assert.equal(getSessionState(normalized).kind, "waiting_for_user");
  assert.deepEqual(getWarnings(normalized), []);
});

test("compareSessions and getSubagentRuns produce high-level comparisons", async () => {
  const normal = normalizeSession(await parseSession(fixturePath("normal-session.jsonl")));
  const subagent = normalizeSession(await parseSession(fixturePath("subagent-nested.jsonl")));

  const comparison = compareSessions(normal, subagent);
  const subagentRuns = getSubagentRuns(subagent);

  assert.equal(subagentRuns.length, 1);
  assert.equal(subagentRuns[0]?.sessionId, "subagent-session-1");
  assert(comparison.tools.onlyInB.includes("Task"));
});

test("summary and warning helper expose concrete warning reasons", async () => {
  const normalized = normalizeSession(await parseSession(fixturePath("partial-open-tool-call.jsonl")));
  const summary = summarizeSession(normalized);
  const openToolCalls = getOpenToolCalls(normalized);
  const orphanToolResults = getOrphanToolResults(normalized);

  assert.equal(summary.warningCount, 1);
  assert.deepEqual(summary.warningKinds, ["open_tool_call"]);
  assert.deepEqual(getWarnings(normalized).map((warning) => warning.code), ["open_tool_call"]);
  assert.equal(openToolCalls.length, 1);
  assert.equal(openToolCalls[0]?.name, "Bash");
  assert.deepEqual(orphanToolResults, []);
});

test("getDiscoveredSessionState returns the enriched state from discoverSessions", async () => {
  const claudeRoot = await createMockClaudeRoot();
  const sessions = await discoverSessions({ roots: [claudeRoot] });
  const running = sessions.find((session) => session.sessionId === "session-running");

  assert(running);
  assert.equal(running.currentState.kind, "running");
  assert.equal((await getDiscoveredSessionState(running)).kind, "running");
});
