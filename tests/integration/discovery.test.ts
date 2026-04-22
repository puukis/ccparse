import test from "node:test";
import assert from "node:assert/strict";

import { discoverSessions } from "../../src/discovery/discover-sessions.js";
import { createMockClaudeRoot } from "../helpers/fixtures.js";

test("discoverSessions enumerates Claude roots and related metadata", async () => {
  const claudeRoot = await createMockClaudeRoot();
  const sessions = await discoverSessions({ roots: [claudeRoot] });

  assert.equal(sessions.length, 3);
  const external = sessions.find((session) => session.sessionId === "session-external");
  const subagent = sessions.find((session) => session.sessionId === "session-subagent");

  assert(external?.hasToolResults);
  assert(external?.sessionMetadataPath?.endsWith("1002.json"));
  assert(subagent?.hasSubagents);
  assert.equal(subagent?.hasToolResults, false);
  assert(subagent?.memoryDir?.endsWith("/memory"));
});
