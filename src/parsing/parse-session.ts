import path from "node:path";

import type {
  ParsedJsonRecord,
  ParsedRecord,
  ParsedSession,
  ParsedSessionMetadata,
} from "../types/core.js";
import type { ParseOptions } from "../types/options.js";
import { readTextFile } from "../utils/fs.js";
import { decodeProjectSlug } from "../utils/path.js";
import { createWarningCollector } from "../utils/warnings.js";
import { getObject, getString } from "../utils/json.js";
import { safeParseJsonRecord } from "./safe-json.js";
import { scanJsonLikeRecords } from "./record-scanner.js";

function buildMetadata(filePath: string, records: ParsedRecord[]): ParsedSessionMetadata {
  const recordTypes: Record<string, number> = {};
  let sessionId: string | undefined;
  let startedAt: string | undefined;
  let endedAt: string | undefined;
  let lastTimestamp: string | undefined;
  let messageCount = 0;
  let assistantCount = 0;
  let userCount = 0;

  for (const record of records) {
    if (record.kind !== "record") {
      continue;
    }

    const recordType = getString(record.value, "type") ?? "unknown";
    recordTypes[recordType] = (recordTypes[recordType] ?? 0) + 1;

    sessionId ??= getString(record.value, "sessionId");

    const timestamp = getString(record.value, "timestamp");
    if (timestamp) {
      startedAt ??= timestamp;
      endedAt = timestamp;
      lastTimestamp = timestamp;
    }

    const message = getObject(record.value, "message");
    if (message) {
      messageCount += 1;
      const role = getString(message, "role");
      if (role === "assistant") {
        assistantCount += 1;
      } else if (role === "user") {
        userCount += 1;
      }
    }
  }

  const projectSlug = path.basename(path.dirname(filePath));

  return {
    sessionId,
    projectSlug,
    projectPathHint: undefined,
    startedAt,
    endedAt,
    lastTimestamp,
    recordTypes,
    messageCount,
    assistantCount,
    userCount,
  };
}

export async function parseSession(
  filePath: string,
  options: ParseOptions = {},
): Promise<ParsedSession> {
  const collector = createWarningCollector(options.onWarning);
  const text = await readTextFile(filePath, options.encoding ?? "utf8");
  const scanned = scanJsonLikeRecords(filePath, text);
  const records: ParsedRecord[] = [];
  const repairNewlinesInStrings = options.repairNewlinesInStrings !== false;

  for (const [index, rawRecord] of scanned.entries()) {
    const location = { ...rawRecord.location, recordIndex: index };
    const parsed = safeParseJsonRecord(rawRecord.rawText, location, repairNewlinesInStrings);
    const warnings = [...rawRecord.warnings, ...parsed.warnings];

    if (parsed.value) {
      records.push({
        kind: "record",
        index,
        rawText: rawRecord.rawText,
        location,
        warnings,
        value: parsed.value,
        repaired: parsed.repaired,
      } satisfies ParsedJsonRecord);
    } else {
      records.push({
        kind: "broken",
        index,
        rawText: rawRecord.rawText,
        location,
        warnings,
        error: parsed.error ?? "Unknown JSON parse error.",
      });
    }

    collector.extend(warnings);
  }

  const metadata = buildMetadata(filePath, records);
  metadata.projectPathHint = metadata.projectSlug
    ? await decodeProjectSlug(metadata.projectSlug)
    : undefined;

  return {
    kind: "session",
    filePath,
    rawFormat: "jsonl-object-stream",
    records,
    warnings: collector.list(),
    metadata,
  };
}
