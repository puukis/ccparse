export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export interface JsonObject {
  [key: string]: JsonValue;
}

export interface SourceLocation {
  filePath: string;
  recordIndex: number;
  lineStart: number;
  lineEnd: number;
  charStart: number;
  charEnd: number;
}

export type WarningSource = "discovery" | "parser" | "normalizer" | "resolver";
export type WarningSeverity = "info" | "warning" | "error";

export type ParseWarningCode =
  | "discovery_root_missing"
  | "json_parse_error"
  | "json_record_not_object"
  | "open_tool_call"
  | "orphan_tool_result"
  | "repaired_multiline_string"
  | "skipped_non_json_text"
  | "truncated_record"
  | "unknown_record_shape"
  | "unknown_message_block"
  | "session_may_be_incomplete"
  | "tool_result_reference_missing"
  | "tool_result_reference_unreadable"
  | "tool_result_reference_parse_failed"
  | "subagent_reference_detected";

export interface ParseWarning {
  code: ParseWarningCode;
  source: WarningSource;
  severity: WarningSeverity;
  message: string;
  location?: Partial<SourceLocation>;
  rawSnippet?: string;
  cause?: string;
}

export interface ParsedRecordBase {
  index: number;
  rawText: string;
  location: SourceLocation;
  warnings: ParseWarning[];
}

export interface ParsedJsonRecord extends ParsedRecordBase {
  kind: "record";
  value: JsonObject;
  repaired: boolean;
}

export interface ParsedBrokenRecord extends ParsedRecordBase {
  kind: "broken";
  error: string;
}

export type ParsedRecord = ParsedJsonRecord | ParsedBrokenRecord;

export interface ParsedSessionMetadata {
  sessionId?: string;
  projectSlug?: string;
  projectPathHint?: string;
  startedAt?: string;
  endedAt?: string;
  lastTimestamp?: string;
  recordTypes: Record<string, number>;
  messageCount: number;
  assistantCount: number;
  userCount: number;
}

export interface ParsedSession {
  kind: "session";
  filePath: string;
  rawFormat: "jsonl-object-stream";
  records: ParsedRecord[];
  warnings: ParseWarning[];
  metadata: ParsedSessionMetadata;
}

export interface HistoryEntry {
  index: number;
  raw: JsonObject;
  location: SourceLocation;
  warnings: ParseWarning[];
  display?: string;
  project?: string;
  sessionId?: string;
  timestamp?: number;
  pastedContents: Record<string, JsonValue>;
}

export interface ParsedHistoryMetadata {
  entryCount: number;
  sessionIds: string[];
  projects: string[];
}

export interface ParsedHistory {
  kind: "history";
  filePath: string;
  rawFormat: "jsonl-object-stream";
  records: ParsedRecord[];
  entries: HistoryEntry[];
  warnings: ParseWarning[];
  metadata: ParsedHistoryMetadata;
}

export type ParsedFile = ParsedSession | ParsedHistory;
