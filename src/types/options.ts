import type { ParseWarning } from "./core.js";

export interface WarningOptions {
  onWarning?: (warning: ParseWarning) => void;
}

export interface ParseOptions extends WarningOptions {
  encoding?: BufferEncoding;
  repairNewlinesInStrings?: boolean;
}

export interface DiscoverSessionsOptions extends WarningOptions {
  roots?: string[];
  maxResults?: number;
  newestFirst?: boolean;
}

export interface NormalizeOptions {
  includeRaw?: boolean;
}

export type ResolvePayloadMode = "auto" | "json" | "text" | "bytes";

export interface ResolveToolResultsOptions extends WarningOptions {
  baseDir?: string;
  mode?: ResolvePayloadMode;
}
