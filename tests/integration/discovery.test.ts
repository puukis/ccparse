import test from "node:test";
import assert from "node:assert/strict";

import { discoverSessions } from "../../src/discovery/discover-sessions.js";
import { createMockClaudeRoot } from "../helpers/fixtures.js";

test("discoverSessions enumerates Claude roots and related metadata", async () => {
  const claudeRoot = await createMockClaudeRoot();
  const sessions = await discoverSessions({ roots: [claudeRoot] });

  assert.equal(sessions.length, 5);
  const external = sessions.find((session) => session.sessionId === "session-external");
  const normal = sessions.find((session) => session.sessionId === "session-normal");
  const openTool = sessions.find((session) => session.sessionId === "session-open-tool");
  const running = sessions.find((session) => session.sessionId === "session-running");
  const subagent = sessions.find((session) => session.sessionId === "session-subagent");

  assert(external?.hasToolResults);
  assert(external?.sessionMetadataPath?.endsWith("1002.json"));
  assert.equal(external?.currentState.kind, "completed");
  assert.equal(normal?.currentState.kind, "waiting_for_user");
  assert.equal(openTool?.currentState.kind, "waiting_for_tool_result");
  assert.equal(running?.currentState.kind, "running");
  assert(subagent?.hasSubagents);
  assert.equal(subagent?.hasToolResults, false);
  assert(subagent?.memoryDir?.endsWith("/memory"));
});
