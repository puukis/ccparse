import path from "node:path";
import { readFile } from "node:fs/promises";

import type { DiscoveredSession } from "../types/discovery.js";
import type { ParseWarningCode } from "../types/core.js";
import type {
  NormalizedEvent,
  NormalizedSession,
  SessionState,
} from "../types/normalized.js";
import { readDirectorySafe } from "../utils/fs.js";
import { getOpenToolCalls } from "./tool-links.js";

interface SessionRuntimeInfo {
  pid?: number;
  hasActiveProcess: boolean;
}

const INCOMPLETE_WARNING_CODES = new Set<ParseWarningCode>([
  "json_parse_error",
  "session_may_be_incomplete",
  "truncated_record",
]);

function getWarningKinds(session: NormalizedSession): ParseWarningCode[] {
  return [...new Set(session.warnings.map((warning) => warning.code))];
}

function getLastMeaningfulEvent(session: NormalizedSession): NormalizedEvent | undefined {
  return [...session.events]
    .reverse()
    .find(
      (event) =>
        event.kind !== "session_metadata" &&
        event.kind !== "usage" &&
        event.kind !== "warning",
    );
}

function getRunningReason(lastMeaningfulEvent: NormalizedEvent | undefined): string {
  if (!lastMeaningfulEvent) {
    return "The transcript does not contain enough non-metadata events to infer a stronger state.";
  }

  return `The latest meaningful event is ${lastMeaningfulEvent.kind}, which suggests work is still in progress.`;
}

export function getTranscriptState(session: NormalizedSession): SessionState {
  const openToolCalls = getOpenToolCalls(session);
  const warningKinds = getWarningKinds(session);
  const lastMeaningfulEvent = getLastMeaningfulEvent(session);

  if (openToolCalls.length > 0) {
    return {
      kind: "waiting_for_tool_result",
      reason: `Found ${openToolCalls.length} tool call(s) without matching tool results.`,
      warningKinds,
      openToolCallCount: openToolCalls.length,
      lastMeaningfulEventKind: lastMeaningfulEvent?.kind,
    };
  }

  if (warningKinds.some((warningCode) => INCOMPLETE_WARNING_CODES.has(warningCode))) {
    return {
      kind: "incomplete",
      reason: "The transcript ended with incomplete-session warnings and no stronger wait state.",
      warningKinds,
      openToolCallCount: 0,
      lastMeaningfulEventKind: lastMeaningfulEvent?.kind,
    };
  }

  if (lastMeaningfulEvent?.kind === "assistant_text") {
    return {
      kind: "waiting_for_user",
      reason: "The latest meaningful event is assistant output with no open tool calls.",
      warningKinds,
      openToolCallCount: 0,
      lastMeaningfulEventKind: lastMeaningfulEvent.kind,
    };
  }

  if (
    lastMeaningfulEvent?.kind === "assistant_thinking" ||
    lastMeaningfulEvent?.kind === "tool_result" ||
    lastMeaningfulEvent?.kind === "user_message" ||
    lastMeaningfulEvent?.kind === "subagent_run"
  ) {
    return {
      kind: "running",
      reason: getRunningReason(lastMeaningfulEvent),
      warningKinds,
      openToolCallCount: 0,
      lastMeaningfulEventKind: lastMeaningfulEvent.kind,
    };
  }

  return {
    kind: "unknown",
    reason: "Could not derive a reliable current state from the available transcript signal.",
    warningKinds,
    openToolCallCount: 0,
    lastMeaningfulEventKind: lastMeaningfulEvent?.kind,
  };
}

function withRuntimeInfo(state: SessionState, runtimeInfo: SessionRuntimeInfo): SessionState {
  if (runtimeInfo.hasActiveProcess) {
    if (
      state.kind === "waiting_for_tool_result" ||
      state.kind === "waiting_for_user"
    ) {
      return {
        ...state,
        hasActiveProcess: true,
        reason:
          runtimeInfo.pid === undefined
            ? `${state.reason} An active Claude Code process is associated with this session.`
            : `${state.reason} Claude Code process ${runtimeInfo.pid} is still running.`,
      };
    }

    return {
      ...state,
      kind: "running",
      hasActiveProcess: true,
      reason:
        runtimeInfo.pid === undefined
          ? "A local Claude Code process is still active for this session."
          : `Claude Code process ${runtimeInfo.pid} is still active for this session.`,
    };
  }

  if (state.kind === "waiting_for_user") {
    return {
      ...state,
      kind: "completed",
      hasActiveProcess: false,
      reason: "No active Claude Code process was found and the transcript ends with assistant output.",
    };
  }

  if (state.kind === "waiting_for_tool_result") {
    return {
      ...state,
      kind: "incomplete",
      hasActiveProcess: false,
      reason: "No active Claude Code process was found, but the transcript still has open tool calls.",
    };
  }

  if (state.kind === "running") {
    return {
      ...state,
      kind: "incomplete",
      hasActiveProcess: false,
      reason:
        "The transcript suggests work in progress, but no active Claude Code process was found.",
    };
  }

  return {
    ...state,
    hasActiveProcess: false,
  };
}

export async function loadSessionRuntimeInfo(
  sessionMetadataPath?: string,
): Promise<SessionRuntimeInfo | undefined> {
  if (!sessionMetadataPath) {
    return undefined;
  }

  try {
    const raw = JSON.parse(await readFile(sessionMetadataPath, "utf8")) as { pid?: unknown };
    const pid = typeof raw.pid === "number" ? raw.pid : undefined;
    if (pid === undefined) {
      return {
        hasActiveProcess: false,
      };
    }

    return {
      pid,
      hasActiveProcess: isProcessAlive(pid),
    };
  } catch {
    return undefined;
  }
}

async function findSessionMetadataPath(
  session: NormalizedSession,
): Promise<string | undefined> {
  const sessionId = session.metadata.sessionId;
  if (!sessionId) {
    return undefined;
  }

  let currentPath = path.dirname(session.metadata.sourcePath);
  while (currentPath !== path.dirname(currentPath)) {
    if (path.basename(currentPath) === ".claude") {
      break;
    }
    currentPath = path.dirname(currentPath);
  }

  if (path.basename(currentPath) !== ".claude") {
    return undefined;
  }

  const sessionsPath = path.join(currentPath, "sessions");
  const entries = await readDirectorySafe(sessionsPath);
  for (const entry of entries) {
    if (!entry.isFile() || path.extname(entry.name) !== ".json") {
      continue;
    }

    const filePath = path.join(sessionsPath, entry.name);
    try {
      const raw = JSON.parse(await readFile(filePath, "utf8")) as { sessionId?: unknown };
      if (raw.sessionId === sessionId) {
        return filePath;
      }
    } catch {
      continue;
    }
  }

  return undefined;
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    return nodeError.code === "EPERM";
  }
}

export function getSessionStateFromNormalized(
  session: NormalizedSession,
  runtimeInfo?: SessionRuntimeInfo,
): SessionState {
  const transcriptState = getTranscriptState(session);
  return runtimeInfo === undefined ? transcriptState : withRuntimeInfo(transcriptState, runtimeInfo);
}

export async function getSessionState(
  session: NormalizedSession | DiscoveredSession,
): Promise<SessionState> {
  if ("currentState" in session) {
    return session.currentState;
  }

  const sessionMetadataPath = await findSessionMetadataPath(session);
  const runtimeInfo = await loadSessionRuntimeInfo(sessionMetadataPath);
  return getSessionStateFromNormalized(session, runtimeInfo);
}

export async function getDiscoveredSessionState(
  discovered: DiscoveredSession,
): Promise<SessionState> {
  return getSessionState(discovered);
}
