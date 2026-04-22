export interface ClaudeDataRoot {
  rootPath: string;
  projectsPath: string;
  historyPath: string;
  sessionsPath: string;
}

export interface DiscoveredSession {
  sessionId: string;
  transcriptPath: string;
  rootPath: string;
  projectSlug: string;
  projectPathHint?: string;
  memoryDir?: string;
  sessionMetadataPath?: string;
  startedAt?: string;
  lastTimestamp?: string;
  modifiedAt?: string;
  fileSizeBytes: number;
  recordCount: number;
  /**
   * Warnings emitted while scanning and parsing the raw transcript file.
   */
  parserWarningCount: number;
  /**
   * Additional warnings introduced after parsing during normalization.
   */
  normalizationWarningCount: number;
  /**
   * Total warnings visible to downstream consumers for this session.
   */
  totalWarningCount: number;
  hasToolResults: boolean;
  hasSubagents: boolean;
  relatedPaths: {
    toolResultPaths: string[];
    subagentTranscriptPaths: string[];
  };
}
