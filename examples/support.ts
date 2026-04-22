import { cp, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const FIXTURES_DIR = fileURLToPath(new URL("../fixtures/", import.meta.url));

export function exampleFixturePath(name: string): string {
  return path.join(FIXTURES_DIR, name);
}

export async function createExampleClaudeRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "ccparse-example-"));
  const claudeRoot = path.join(root, ".claude");
  const projectDir = path.join(claudeRoot, "projects", "-tmp-example-project");

  await mkdir(path.join(projectDir, "memory"), { recursive: true });
  await mkdir(path.join(claudeRoot, "sessions"), { recursive: true });
  await mkdir(path.join(projectDir, "tool-results"), { recursive: true });
  await mkdir(path.join(projectDir, "subagents"), { recursive: true });

  await cp(exampleFixturePath("normal-session.jsonl"), path.join(projectDir, "session-normal.jsonl"));
  await cp(
    exampleFixturePath("external-tool-results.jsonl"),
    path.join(projectDir, "session-external.jsonl"),
  );
  await cp(
    exampleFixturePath("subagent-nested.jsonl"),
    path.join(projectDir, "session-subagent.jsonl"),
  );
  await cp(
    exampleFixturePath("tool-results/external-session"),
    path.join(projectDir, "tool-results", "external-session"),
    { recursive: true },
  );
  await cp(
    exampleFixturePath("subagents/subagent-session-1.jsonl"),
    path.join(projectDir, "subagents", "subagent-session-1.jsonl"),
  );
  await cp(exampleFixturePath("history-file.jsonl"), path.join(claudeRoot, "history.jsonl"));
  await writeFile(
    path.join(claudeRoot, "sessions", "1001.json"),
    JSON.stringify({ sessionId: "session-normal", pid: 1001 }, null, 2),
    "utf8",
  );

  return claudeRoot;
}
