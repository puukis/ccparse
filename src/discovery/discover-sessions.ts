import path from "node:path";
import { readFile } from "node:fs/promises";

import type { DiscoveredSession } from "../types/discovery.js";
import type { DiscoverSessionsOptions } from "../types/options.js";
import { normalizeSession } from "../normalize/normalize-session.js";
import { parseSession } from "../parsing/parse-session.js";
import {
  getSessionStateFromNormalized,
  loadSessionRuntimeInfo,
} from "../query/session-state.js";
import { pathExists, readDirectorySafe, statSafe } from "../utils/fs.js";
import {
  dedupeStrings,
  resolveClaudeRoot,
  sortPathsNewestFirst,
} from "../utils/path.js";
import { createWarningCollector } from "../utils/warnings.js";

async function buildSessionMetadataIndex(rootPath: string): Promise<Map<string, string>> {
  const sessionsPath = path.join(rootPath, "sessions");
  const entries = await readDirectorySafe(sessionsPath);
  const index = new Map<string, string>();

  for (const entry of entries) {
    if (!entry.isFile() || path.extname(entry.name) !== ".json") {
      continue;
    }

    const filePath = path.join(sessionsPath, entry.name);
    try {
      const raw = JSON.parse(await readFile(filePath, "utf8")) as { sessionId?: unknown };
      if (typeof raw.sessionId === "string") {
        index.set(raw.sessionId, filePath);
      }
    } catch {
      continue;
    }
  }

  return index;
}

export async function discoverSessions(
  options: DiscoverSessionsOptions = {},
): Promise<DiscoveredSession[]> {
  const collector = createWarningCollector(options.onWarning);
  const roots = dedupeStrings(
    await Promise.all((options.roots?.length ? options.roots : [undefined]).map(resolveClaudeRoot)),
  );
  const results: DiscoveredSession[] = [];

  for (const rootPath of roots) {
    const projectsPath = path.join(rootPath, "projects");
    if (!(await pathExists(projectsPath))) {
      collector.add({
        code: "discovery_root_missing",
        source: "discovery",
        severity: "warning",
        message: `Claude projects root does not exist at ${projectsPath}.`,
      });
      continue;
    }

    const metadataIndex = await buildSessionMetadataIndex(rootPath);
    const projectEntries = await readDirectorySafe(projectsPath);

    for (const projectEntry of projectEntries) {
      if (!projectEntry.isDirectory()) {
        continue;
      }

      const projectDir = path.join(projectsPath, projectEntry.name);
      const memoryDir = path.join(projectDir, "memory");
      const transcriptEntries = await readDirectorySafe(projectDir);

      for (const transcriptEntry of transcriptEntries) {
        if (!transcriptEntry.isFile() || path.extname(transcriptEntry.name) !== ".jsonl") {
          continue;
        }

        const transcriptPath = path.join(projectDir, transcriptEntry.name);
        const parsed = await parseSession(transcriptPath, { onWarning: options.onWarning });
        const normalized = normalizeSession(parsed, { includeRaw: false });
        const parserWarningCount = parsed.warnings.length;
        const totalWarningCount = normalized.warnings.length;
        const stats = await statSafe(transcriptPath);
        const sessionId = parsed.metadata.sessionId ?? path.basename(transcriptEntry.name, ".jsonl");
        const sessionMetadataPath = metadataIndex.get(sessionId);
        const currentState = getSessionStateFromNormalized(
          normalized,
          await loadSessionRuntimeInfo(sessionMetadataPath),
        );
        const discovered: DiscoveredSession = {
          sessionId,
          transcriptPath,
          rootPath,
          projectSlug: parsed.metadata.projectSlug ?? projectEntry.name,
          fileSizeBytes: stats?.size ?? 0,
          recordCount: parsed.records.length,
          parserWarningCount,
          normalizationWarningCount: Math.max(0, totalWarningCount - parserWarningCount),
          totalWarningCount,
          hasToolResults: normalized.metadata.relatedPaths.toolResultPaths.length > 0,
          hasSubagents: normalized.metadata.relatedPaths.subagentTranscriptPaths.length > 0,
          currentState,
          relatedPaths: {
            toolResultPaths: normalized.metadata.relatedPaths.toolResultPaths,
            subagentTranscriptPaths: normalized.metadata.relatedPaths.subagentTranscriptPaths,
          },
        };

        if (parsed.metadata.projectPathHint) {
          discovered.projectPathHint = parsed.metadata.projectPathHint;
        }
        if (await pathExists(memoryDir)) {
          discovered.memoryDir = memoryDir;
        }
        if (sessionMetadataPath) {
          discovered.sessionMetadataPath = sessionMetadataPath;
        }
        if (parsed.metadata.startedAt) {
          discovered.startedAt = parsed.metadata.startedAt;
        }
        if (parsed.metadata.lastTimestamp) {
          discovered.lastTimestamp = parsed.metadata.lastTimestamp;
        }
        if (stats) {
          discovered.modifiedAt = stats.mtime.toISOString();
        }

        results.push(discovered);
      }
    }
  }

  const sorted = options.newestFirst === false ? results : sortPathsNewestFirst(results);
  return options.maxResults ? sorted.slice(0, options.maxResults) : sorted;
}
