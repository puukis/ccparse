import { cp, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const FIXTURES_DIR = fileURLToPath(new URL("../../fixtures/", import.meta.url));

export function fixturePath(name: string): string {
  return path.join(FIXTURES_DIR, name);
}

export async function createMockClaudeRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "ccparse-"));
  const claudeRoot = path.join(root, ".claude");
  const projectDir = path.join(claudeRoot, "projects", "-tmp-example-project");
  const memoryDir = path.join(projectDir, "memory");
  const sessionsDir = path.join(claudeRoot, "sessions");

  await mkdir(memoryDir, { recursive: true });
  await mkdir(sessionsDir, { recursive: true });

  await cp(fixturePath("normal-session.jsonl"), path.join(projectDir, "session-normal.jsonl"));
  await cp(
    fixturePath("external-tool-results.jsonl"),
    path.join(projectDir, "session-external.jsonl"),
  );
  await cp(
    fixturePath("subagent-nested.jsonl"),
    path.join(projectDir, "session-subagent.jsonl"),
  );
  await mkdir(path.join(projectDir, "tool-results"), { recursive: true });
  await mkdir(path.join(projectDir, "subagents"), { recursive: true });
  await cp(
    fixturePath("tool-results/external-session"),
    path.join(projectDir, "tool-results", "external-session"),
    { recursive: true },
  );
  await cp(
    fixturePath("subagents/subagent-session-1.jsonl"),
    path.join(projectDir, "subagents", "subagent-session-1.jsonl"),
  );
  await cp(fixturePath("history-file.jsonl"), path.join(claudeRoot, "history.jsonl"));
  await writeFile(
    path.join(sessionsDir, "1001.json"),
    JSON.stringify({ sessionId: "session-normal", pid: 1001 }, null, 2),
    "utf8",
  );
  await writeFile(
    path.join(sessionsDir, "1002.json"),
    JSON.stringify({ sessionId: "session-external", pid: 1002 }, null, 2),
    "utf8",
  );
  await writeFile(
    path.join(sessionsDir, "1003.json"),
    JSON.stringify({ sessionId: "session-subagent", pid: 1003 }, null, 2),
    "utf8",
  );

  return claudeRoot;
}
