import type {
  JsonObject,
  JsonValue,
  ParseWarning,
  ParseWarningCode,
  ParsedSession,
} from "./core.js";

export interface EventProvenance {
  filePath: string;
  recordIndex: number;
  lineStart: number;
  lineEnd: number;
  charStart: number;
  charEnd: number;
  raw?: JsonValue | string;
  warningCodes: ParseWarningCode[];
}

export type NormalizedEventKind =
  | "session_metadata"
  | "user_message"
  | "assistant_text"
  | "assistant_thinking"
  | "tool_use"
  | "tool_result"
  | "usage"
  | "warning"
  | "subagent_run";

export interface NormalizedEventBase {
  version: 1;
  id: string;
  kind: NormalizedEventKind;
  sessionId?: string;
  timestamp?: string;
  warnings: ParseWarning[];
  provenance: EventProvenance;
}

export interface ExternalPayloadReference {
  path: string;
  absolutePath?: string;
  sizeBytes?: number;
  contentType?: string;
  exists?: boolean;
  hydrated?: HydratedExternalPayload;
  error?: string;
}

export type HydratedExternalPayload =
  | { mode: "json"; value: JsonValue }
  | { mode: "text"; value: string }
  | { mode: "bytes"; value: Uint8Array };

export interface SessionMetadataEvent extends NormalizedEventBase {
  kind: "session_metadata";
  recordType?: string;
  data: JsonValue | string | null;
}

export interface UserMessageEvent extends NormalizedEventBase {
  kind: "user_message";
  promptId?: string;
  uuid?: string;
  text: string;
}

export interface AssistantTextEvent extends NormalizedEventBase {
  kind: "assistant_text";
  messageId?: string;
  uuid?: string;
  model?: string;
  stopReason?: string;
  text: string;
}

export interface AssistantThinkingEvent extends NormalizedEventBase {
  kind: "assistant_thinking";
  messageId?: string;
  uuid?: string;
  model?: string;
  signature?: string;
  text: string;
}

export interface ToolUseEvent extends NormalizedEventBase {
  kind: "tool_use";
  messageId?: string;
  uuid?: string;
  model?: string;
  toolUseId: string;
  name?: string;
  input?: JsonValue;
}

export type ToolResultPayload =
  | { kind: "inline"; value: JsonValue | string | null }
  | {
      kind: "external";
      reference: ExternalPayloadReference;
      preview?: string;
      inlineFallback?: JsonValue | string | null;
    };

export interface ToolResultEvent extends NormalizedEventBase {
  kind: "tool_result";
  uuid?: string;
  sourceToolAssistantUuid?: string;
  toolUseId?: string;
  payload: ToolResultPayload;
  summary?: JsonValue | string | null;
}

export interface UsageSnapshotEvent extends NormalizedEventBase {
  kind: "usage";
  messageId?: string;
  model?: string;
  stopReason?: string;
  usage: JsonObject;
}

export interface WarningEvent extends NormalizedEventBase {
  kind: "warning";
  warning: ParseWarning;
  rawText?: string;
}

export interface SubagentRunEvent extends NormalizedEventBase {
  kind: "subagent_run";
  name?: string;
  status?: string;
  sessionIdRef?: string;
  transcriptPath?: string;
  parentToolUseId?: string;
  details?: JsonValue | string | null;
}

export type NormalizedEvent =
  | SessionMetadataEvent
  | UserMessageEvent
  | AssistantTextEvent
  | AssistantThinkingEvent
  | ToolUseEvent
  | ToolResultEvent
  | UsageSnapshotEvent
  | WarningEvent
  | SubagentRunEvent;

export interface NormalizedSessionMetadata {
  sessionId?: string;
  sourcePath: string;
  projectSlug?: string;
  projectPathHint?: string;
  startedAt?: string;
  endedAt?: string;
  lastTimestamp?: string;
  recordCount: number;
  parserWarningCount: number;
  totalWarningCount: number;
  hasIncompleteTail: boolean;
  relatedPaths: {
    memoryDir?: string;
    sessionMetadataPath?: string;
    toolResultPaths: string[];
    subagentTranscriptPaths: string[];
  };
}

export interface NormalizedSession {
  version: 1;
  kind: "session";
  metadata: NormalizedSessionMetadata;
  events: NormalizedEvent[];
  warnings: ParseWarning[];
  source: ParsedSession;
}

export interface AssistantTurn {
  id: string;
  recordIndex: number;
  timestamp?: string;
  model?: string;
  text: string;
  textBlocks: AssistantTextEvent[];
  thinkingBlocks: AssistantThinkingEvent[];
  toolUses: ToolUseEvent[];
  usage?: UsageSnapshotEvent;
  warnings: ParseWarning[];
}

export interface SubagentRun {
  id: string;
  sessionId?: string;
  transcriptPath?: string;
  status?: string;
  name?: string;
  parentToolUseId?: string;
  occurrences: SubagentRunEvent[];
}

export type SessionStateKind =
  | "waiting_for_user"
  | "waiting_for_tool_result"
  | "running"
  | "completed"
  | "incomplete"
  | "unknown";

export interface SessionState {
  kind: SessionStateKind;
  reason: string;
  warningKinds: ParseWarningCode[];
  openToolCallCount: number;
  lastMeaningfulEventKind?: NormalizedEventKind;
  hasActiveProcess?: boolean;
}

export interface SessionSummary {
  sessionId?: string;
  eventCount: number;
  userMessageCount: number;
  /**
   * Count of assistant-origin normalized records represented by `getAssistantTurns()`.
   * This includes text replies, thinking-only records, and tool-use-only records.
   */
  assistantRecordCount: number;
  /**
   * Count of assistant turns that contain user-visible text.
   */
  assistantReplyCount: number;
  /**
   * Count of normalized `assistant_text` events. A single reply can contain multiple text blocks.
   */
  assistantTextBlockCount: number;
  toolCallCount: number;
  toolResultCount: number;
  openToolCallCount: number;
  orphanToolResultCount: number;
  warningCount: number;
  warningKinds: ParseWarningCode[];
  currentState: SessionState;
  subagentCount: number;
  startedAt?: string;
  endedAt?: string;
  models: string[];
  toolNames: string[];
}

export interface SessionComparison {
  sessionIds: [string | undefined, string | undefined];
  delta: {
    eventCount: number;
    assistantRecords: number;
    toolCalls: number;
    warnings: number;
  };
  tools: {
    onlyInA: string[];
    onlyInB: string[];
    shared: string[];
  };
  warnings: {
    onlyInA: string[];
    onlyInB: string[];
  };
}
