import type { HistoryEntry, JsonObject, ParsedHistory, ParsedRecord } from "../types/core.js";
import type { ParseOptions } from "../types/options.js";
import { readTextFile } from "../utils/fs.js";
import { getNumber, getObject, getString, isJsonObject } from "../utils/json.js";
import { createWarningCollector } from "../utils/warnings.js";
import { scanJsonLikeRecords } from "./record-scanner.js";
import { safeParseJsonRecord } from "./safe-json.js";

function toHistoryEntry(record: ParsedRecord): HistoryEntry | undefined {
  if (record.kind !== "record") {
    return undefined;
  }

  const raw = record.value;
  const pastedContentsObject = getObject(raw, "pastedContents");
  const pastedContents: Record<string, JsonObject[keyof JsonObject]> = {};

  if (pastedContentsObject) {
    for (const [key, value] of Object.entries(pastedContentsObject)) {
      pastedContents[key] = value;
    }
  }

  return {
    index: record.index,
    raw,
    location: record.location,
    warnings: record.warnings,
    display: getString(raw, "display"),
    project: getString(raw, "project"),
    sessionId: getString(raw, "sessionId"),
    timestamp: getNumber(raw, "timestamp"),
    pastedContents,
  };
}

export async function parseHistory(
  filePath: string,
  options: ParseOptions = {},
): Promise<ParsedHistory> {
  const collector = createWarningCollector(options.onWarning);
  const text = await readTextFile(filePath, options.encoding ?? "utf8");
  const scanned = scanJsonLikeRecords(filePath, text);
  const records: ParsedRecord[] = [];
  const entries: HistoryEntry[] = [];

  for (const [index, rawRecord] of scanned.entries()) {
    const location = { ...rawRecord.location, recordIndex: index };
    const parsed = safeParseJsonRecord(
      rawRecord.rawText,
      location,
      options.repairNewlinesInStrings !== false,
    );
    const warnings = [...rawRecord.warnings, ...parsed.warnings];

    if (parsed.value && isJsonObject(parsed.value)) {
      const record: ParsedRecord = {
        kind: "record",
        index,
        rawText: rawRecord.rawText,
        location,
        warnings,
        value: parsed.value,
        repaired: parsed.repaired,
      };
      records.push(record);
      const entry = toHistoryEntry(record);
      if (entry) {
        entries.push(entry);
      }
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

  const sessionIds = [...new Set(entries.map((entry) => entry.sessionId).filter(Boolean))] as string[];
  const projects = [...new Set(entries.map((entry) => entry.project).filter(Boolean))] as string[];

  return {
    kind: "history",
    filePath,
    rawFormat: "jsonl-object-stream",
    records,
    entries,
    warnings: collector.list(),
    metadata: {
      entryCount: entries.length,
      sessionIds,
      projects,
    },
  };
}
