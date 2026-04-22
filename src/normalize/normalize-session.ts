import type {
  JsonObject,
  JsonValue,
  ParseWarning,
  ParsedJsonRecord,
  ParsedRecord,
  ParsedSession,
} from "../types/core.js";
import type {
  AssistantTextEvent,
  AssistantThinkingEvent,
  NormalizedEvent,
  NormalizedEventBase,
  NormalizedSession,
  SessionMetadataEvent,
  SubagentRunEvent,
  ToolResultEvent,
  ToolUseEvent,
  UsageSnapshotEvent,
  WarningEvent,
} from "../types/normalized.js";
import type { NormalizeOptions } from "../types/options.js";
import { getArray, getObject, getString, isJsonObject, toJsonValue } from "../utils/json.js";
import { dedupeStrings } from "../utils/path.js";
import { extractExternalPayloadReference, extractSubagentReference } from "./detect.js";

interface RecordContext {
  session: ParsedSession;
  record: ParsedJsonRecord;
  includeRaw: boolean;
}

function buildBaseEvent(
  context: RecordContext,
  kind: NormalizedEvent["kind"],
  suffix: string,
): NormalizedEventBase {
  const { record, includeRaw, session } = context;
  const base: NormalizedEventBase = {
    version: 1,
    id: `${session.metadata.sessionId ?? "session"}:${record.index}:${kind}:${suffix}`,
    kind,
    warnings: [...record.warnings],
    provenance: {
      filePath: record.location.filePath,
      recordIndex: record.index,
      lineStart: record.location.lineStart,
      lineEnd: record.location.lineEnd,
      charStart: record.location.charStart,
      charEnd: record.location.charEnd,
      warningCodes: record.warnings.map((warning) => warning.code),
    },
  };

  if (includeRaw) {
    base.provenance.raw = record.value;
  }

  const timestamp = getString(record.value, "timestamp");
  if (timestamp) {
    base.timestamp = timestamp;
  }

  const sessionId = getString(record.value, "sessionId") ?? session.metadata.sessionId;
  if (sessionId) {
    base.sessionId = sessionId;
  }

  return base;
}

function buildWarningEvent(
  session: ParsedSession,
  record: ParsedRecord,
  warning: ParseWarning,
  includeRaw: boolean,
  suffix: string,
): WarningEvent {
  const event: WarningEvent = {
    version: 1,
    id: `${session.metadata.sessionId ?? "session"}:${record.index}:warning:${suffix}`,
    kind: "warning",
    warnings: [warning],
    warning,
    provenance: {
      filePath: record.location.filePath,
      recordIndex: record.index,
      lineStart: record.location.lineStart,
      lineEnd: record.location.lineEnd,
      charStart: record.location.charStart,
      charEnd: record.location.charEnd,
      warningCodes: [warning.code],
    },
  };

  if (includeRaw) {
    event.provenance.raw = record.kind === "record" ? record.value : record.rawText;
    event.rawText = record.rawText;
  }

  return event;
}

function pushUsageEvent(events: NormalizedEvent[], context: RecordContext): void {
  const message = getObject(context.record.value, "message");
  const usage = getObject(message, "usage");
  if (!usage) {
    return;
  }

  const event: UsageSnapshotEvent = {
    ...buildBaseEvent(context, "usage", "usage"),
    kind: "usage",
    usage,
  };

  const messageId = getString(message, "id");
  const model = getString(message, "model");
  const stopReason = getString(message, "stop_reason");
  if (messageId) {
    event.messageId = messageId;
  }
  if (model) {
    event.model = model;
  }
  if (stopReason) {
    event.stopReason = stopReason;
  }

  events.push(event);
}

function asTextPayload(value: JsonValue | undefined): JsonValue | string | null {
  if (value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  return value;
}

function normalizeUserOrAssistantText(
  context: RecordContext,
  role: string,
  text: string,
  suffix: string,
): AssistantTextEvent | AssistantThinkingEvent | SessionMetadataEvent | NormalizedEvent {
  if (role === "assistant") {
    const event: AssistantTextEvent = {
      ...buildBaseEvent(context, "assistant_text", suffix),
      kind: "assistant_text",
      text,
    };
    const message = getObject(context.record.value, "message");
    const messageId = getString(message, "id");
    const model = getString(message, "model");
    const stopReason = getString(message, "stop_reason");
    const uuid = getString(context.record.value, "uuid");
    if (messageId) {
      event.messageId = messageId;
    }
    if (model) {
      event.model = model;
    }
    if (stopReason) {
      event.stopReason = stopReason;
    }
    if (uuid) {
      event.uuid = uuid;
    }
    return event;
  }

  return {
    ...buildBaseEvent(context, "user_message", suffix),
    kind: "user_message",
    text,
    promptId: getString(context.record.value, "promptId"),
    uuid: getString(context.record.value, "uuid"),
  };
}

function normalizeToolResultEvent(
  context: RecordContext,
  block: JsonObject,
  blockIndex: number,
): { event: ToolResultEvent; subagentEvent?: SubagentRunEvent } {
  const toolUseId = getString(block, "tool_use_id") ?? getString(block, "toolUseId");
  const blockContent = toJsonValue(block.content);
  const toolUseResult = toJsonValue(getObject(context.record.value, "toolUseResult"));
  const combinedValue = isJsonObject(blockContent)
    ? { ...blockContent, ...(isJsonObject(toolUseResult) ? toolUseResult : {}) }
    : toolUseResult ?? blockContent;
  const externalReference = extractExternalPayloadReference(
    (combinedValue ?? blockContent) as JsonValue | undefined,
  );

  const event: ToolResultEvent = {
    ...buildBaseEvent(context, "tool_result", `tool_result_${blockIndex}`),
    kind: "tool_result",
    payload: externalReference
      ? {
          kind: "external",
          reference: externalReference,
          inlineFallback: asTextPayload(blockContent),
          preview: typeof blockContent === "string" ? blockContent : getString(block, "preview"),
        }
      : {
          kind: "inline",
          value: asTextPayload(blockContent),
        },
  };

  if (toolUseId) {
    event.toolUseId = toolUseId;
  }

  const uuid = getString(context.record.value, "uuid");
  const sourceToolAssistantUuid = getString(context.record.value, "sourceToolAssistantUUID");
  if (uuid) {
    event.uuid = uuid;
  }
  if (sourceToolAssistantUuid) {
    event.sourceToolAssistantUuid = sourceToolAssistantUuid;
  }

  if (toolUseResult) {
    event.summary = toolUseResult;
  }

  const subagentCandidate = extractSubagentReference(
    (combinedValue ?? blockContent) as JsonValue | undefined,
  );
  if (!subagentCandidate) {
    return { event };
  }

  const subagentEvent: SubagentRunEvent = {
    ...buildBaseEvent(context, "subagent_run", `subagent_${blockIndex}`),
    kind: "subagent_run",
    details: subagentCandidate.details,
    parentToolUseId: toolUseId,
  };

  if (subagentCandidate.name) {
    subagentEvent.name = subagentCandidate.name;
  }
  if (subagentCandidate.status) {
    subagentEvent.status = subagentCandidate.status;
  }
  if (subagentCandidate.sessionIdRef) {
    subagentEvent.sessionIdRef = subagentCandidate.sessionIdRef;
  }
  if (subagentCandidate.transcriptPath) {
    subagentEvent.transcriptPath = subagentCandidate.transcriptPath;
  }
  subagentEvent.warnings = [
    ...subagentEvent.warnings,
    {
      code: "subagent_reference_detected",
      source: "normalizer",
      severity: "info",
      message: "Detected a nested or subagent transcript reference.",
      location: {
        filePath: context.record.location.filePath,
        recordIndex: context.record.index,
      },
    },
  ];

  return { event, subagentEvent };
}

function normalizeMessageRecord(
  session: ParsedSession,
  record: ParsedJsonRecord,
  includeRaw: boolean,
  sessionWarnings: ParseWarning[],
): NormalizedEvent[] {
  const message = getObject(record.value, "message");
  if (!message) {
    const warning: ParseWarning = {
      code: "unknown_record_shape",
      source: "normalizer",
      severity: "warning",
      message: "Encountered a session record with no message payload.",
      location: {
        filePath: record.location.filePath,
        recordIndex: record.index,
      },
    };
    sessionWarnings.push(warning);
    return [buildWarningEvent(session, record, warning, includeRaw, "missing-message")];
  }

  const context: RecordContext = { session, record, includeRaw };
  const events: NormalizedEvent[] = [];
  const role = getString(message, "role") ?? getString(record.value, "type");
  const content = message.content;

  if (typeof content === "string") {
    events.push(normalizeUserOrAssistantText(context, role ?? "user", content, "text"));
  } else if (Array.isArray(content)) {
    for (const [blockIndex, block] of content.entries()) {
      if (typeof block === "string") {
        events.push(
          normalizeUserOrAssistantText(
            context,
            role ?? "user",
            block,
            `text_${blockIndex}`,
          ),
        );
        continue;
      }

      if (!isJsonObject(block)) {
        continue;
      }

      const blockType = getString(block, "type") ?? "unknown";
      switch (blockType) {
        case "text": {
          const text = getString(block, "text");
          if (text) {
            events.push(
              normalizeUserOrAssistantText(
                context,
                role ?? "user",
                text,
                `text_${blockIndex}`,
              ),
            );
          }
          break;
        }
        case "thinking":
        case "reasoning": {
          const text = getString(block, "thinking") ?? getString(block, "text");
          if (text) {
            const event: AssistantThinkingEvent = {
              ...buildBaseEvent(context, "assistant_thinking", `thinking_${blockIndex}`),
              kind: "assistant_thinking",
              text,
            };
            const signature = getString(block, "signature");
            const messageId = getString(message, "id");
            const model = getString(message, "model");
            const uuid = getString(record.value, "uuid");
            if (signature) {
              event.signature = signature;
            }
            if (messageId) {
              event.messageId = messageId;
            }
            if (model) {
              event.model = model;
            }
            if (uuid) {
              event.uuid = uuid;
            }
            events.push(event);
          }
          break;
        }
        case "tool_use": {
          const event: ToolUseEvent = {
            ...buildBaseEvent(context, "tool_use", `tool_use_${blockIndex}`),
            kind: "tool_use",
            toolUseId: getString(block, "id") ?? `tool-use-${record.index}-${blockIndex}`,
          };
          const messageId = getString(message, "id");
          const uuid = getString(record.value, "uuid");
          const model = getString(message, "model");
          const name = getString(block, "name");
          const input = toJsonValue(block.input);
          if (messageId) {
            event.messageId = messageId;
          }
          if (uuid) {
            event.uuid = uuid;
          }
          if (model) {
            event.model = model;
          }
          if (name) {
            event.name = name;
          }
          if (input) {
            event.input = input;
          }
          events.push(event);
          break;
        }
        case "tool_result": {
          const normalized = normalizeToolResultEvent(context, block, blockIndex);
          events.push(normalized.event);
          if (normalized.subagentEvent) {
            events.push(normalized.subagentEvent);
          }
          break;
        }
        default: {
          const warning: ParseWarning = {
            code: "unknown_message_block",
            source: "normalizer",
            severity: "warning",
            message: `Encountered an unsupported message block of type "${blockType}".`,
            location: {
              filePath: record.location.filePath,
              recordIndex: record.index,
            },
            rawSnippet: JSON.stringify(block).slice(0, 200),
          };
          sessionWarnings.push(warning);
          events.push(buildWarningEvent(session, record, warning, includeRaw, `unknown-${blockIndex}`));
        }
      }
    }
  }

  pushUsageEvent(events, context);
  return events;
}

function normalizeRecord(
  session: ParsedSession,
  record: ParsedRecord,
  includeRaw: boolean,
  sessionWarnings: ParseWarning[],
): NormalizedEvent[] {
  if (record.kind === "broken") {
    return record.warnings.map((warning, index) =>
      buildWarningEvent(session, record, warning, includeRaw, `broken-${index}`),
    );
  }

  const recordType = getString(record.value, "type");
  const message = getObject(record.value, "message");
  if (message) {
    return normalizeMessageRecord(session, record, includeRaw, sessionWarnings);
  }

  const context: RecordContext = { session, record, includeRaw };
  const data = toJsonValue(record.value) ?? null;
  const event: SessionMetadataEvent = {
    ...buildBaseEvent(context, "session_metadata", recordType ?? "metadata"),
    kind: "session_metadata",
    data,
  };
  if (recordType) {
    event.recordType = recordType;
  }
  return [event];
}

function sessionLooksIncomplete(events: readonly NormalizedEvent[], source: ParsedSession): boolean {
  return getIncompleteSessionWarningCode(events, source) !== undefined;
}

function getIncompleteSessionWarningCode(
  events: readonly NormalizedEvent[],
  source: ParsedSession,
): ParseWarning["code"] | undefined {
  if (source.records.at(-1)?.kind === "broken") {
    return "session_may_be_incomplete";
  }

  const pendingToolUseIds = new Set<string>();
  for (const event of events) {
    if (event.kind === "tool_use") {
      pendingToolUseIds.add(event.toolUseId);
      continue;
    }

    if (event.kind === "tool_result" && event.toolUseId) {
      pendingToolUseIds.delete(event.toolUseId);
    }
  }

  if (pendingToolUseIds.size > 0) {
    return "open_tool_call";
  }

  const lastMeaningful = [...events].reverse().find((event) => {
    return (
      event.kind !== "warning" &&
      event.kind !== "session_metadata" &&
      event.kind !== "usage"
    );
  });

  if (lastMeaningful?.kind === "tool_use" || lastMeaningful?.kind === "tool_result") {
    return "session_may_be_incomplete";
  }

  return undefined;
}

export function normalizeSession(
  session: ParsedSession,
  options: NormalizeOptions = {},
): NormalizedSession {
  const includeRaw = options.includeRaw !== false;
  const warnings = [...session.warnings];
  const events = session.records.flatMap((record) =>
    normalizeRecord(session, record, includeRaw, warnings),
  );

  const incompleteWarningCode = getIncompleteSessionWarningCode(events, session);
  if (incompleteWarningCode) {
    const warning: ParseWarning = {
      code: incompleteWarningCode,
      source: "normalizer",
      severity: "warning",
      message:
        incompleteWarningCode === "open_tool_call"
          ? "The session ended with one or more tool calls that never received a matching tool result."
          : "The session appears to end mid-turn or with an unresolved tool interaction.",
      location: {
        filePath: session.filePath,
        recordIndex: session.records.at(-1)?.index,
      },
    };
    warnings.push(warning);
    const lastRecord = session.records.at(-1);
    if (lastRecord) {
      events.push(buildWarningEvent(session, lastRecord, warning, includeRaw, "incomplete"));
    }
  }

  const toolResultPaths = dedupeStrings(
    events
      .filter((event): event is ToolResultEvent => event.kind === "tool_result")
      .flatMap((event) =>
        event.payload.kind === "external" ? [event.payload.reference.path] : [],
      ),
  );
  const subagentTranscriptPaths = dedupeStrings(
    events
      .filter((event): event is SubagentRunEvent => event.kind === "subagent_run")
      .flatMap((event) => (event.transcriptPath ? [event.transcriptPath] : [])),
  );

  return {
    version: 1,
    kind: "session",
    metadata: {
      sessionId: session.metadata.sessionId,
      sourcePath: session.filePath,
      projectSlug: session.metadata.projectSlug,
      projectPathHint: session.metadata.projectPathHint,
      startedAt: session.metadata.startedAt,
      endedAt: session.metadata.endedAt,
      lastTimestamp: session.metadata.lastTimestamp,
      recordCount: session.records.length,
      parserWarningCount: session.warnings.length,
      totalWarningCount: warnings.length,
      hasIncompleteTail: warnings.some(
        (warning) =>
          warning.code === "session_may_be_incomplete" || warning.code === "open_tool_call",
      ),
      relatedPaths: {
        toolResultPaths,
        subagentTranscriptPaths,
      },
    },
    events,
    warnings,
    source: session,
  };
}
