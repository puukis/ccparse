import type { ParseWarning, SourceLocation } from "../types/core.js";

export interface ScannedRecord {
  rawText: string;
  location: SourceLocation;
  warnings: ParseWarning[];
}

interface ActiveRecord {
  rawText: string;
  lineStart: number;
  charStart: number;
  depth: number;
  inString: boolean;
  escaped: boolean;
}

function createLocation(
  filePath: string,
  recordIndex: number,
  lineStart: number,
  lineEnd: number,
  charStart: number,
  charEnd: number,
): SourceLocation {
  return {
    filePath,
    recordIndex,
    lineStart,
    lineEnd,
    charStart,
    charEnd,
  };
}

export function scanJsonLikeRecords(filePath: string, text: string): ScannedRecord[] {
  const records: ScannedRecord[] = [];
  let active: ActiveRecord | undefined;
  let recordIndex = 0;
  let line = 1;
  let junk = "";
  let junkLineStart = 1;
  let junkCharStart = 0;

  const emitJunk = (lineEnd: number, charEnd: number): void => {
    if (!junk.trim()) {
      junk = "";
      return;
    }

    records.push({
      rawText: junk,
      location: createLocation(
        filePath,
        recordIndex++,
        junkLineStart,
        lineEnd,
        junkCharStart,
        charEnd,
      ),
      warnings: [
        {
          code: "skipped_non_json_text",
          source: "parser",
          severity: "warning",
          message: "Skipped non-JSON text while scanning the transcript stream.",
          rawSnippet: junk.slice(0, 200),
        },
      ],
    });
    junk = "";
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!;
    const currentLine = line;

    if (!active) {
      if (char === "{" || char === "[") {
        emitJunk(currentLine, index);
        active = {
          rawText: char,
          lineStart: currentLine,
          charStart: index,
          depth: 1,
          inString: false,
          escaped: false,
        };
      } else {
        if (!junk) {
          junkLineStart = currentLine;
          junkCharStart = index;
        }
        junk += char;
      }

      if (char === "\n") {
        line += 1;
      }

      continue;
    }

    if (index !== active.charStart) {
      active.rawText += char;
    }

    if (active.escaped) {
      active.escaped = false;
    } else if (active.inString) {
      if (char === "\\") {
        active.escaped = true;
      } else if (char === "\"") {
        active.inString = false;
      }
    } else if (char === "\"") {
      active.inString = true;
    } else if (char === "{" || char === "[") {
      active.depth += 1;
    } else if (char === "}" || char === "]") {
      active.depth -= 1;
    }

    if (char === "\n") {
      line += 1;
    }

    if (active.depth === 0 && !active.inString) {
      records.push({
        rawText: active.rawText,
        location: createLocation(
          filePath,
          recordIndex++,
          active.lineStart,
          currentLine,
          active.charStart,
          index + 1,
        ),
        warnings: [],
      });
      active = undefined;
    }
  }

  if (active) {
    records.push({
      rawText: active.rawText,
      location: createLocation(
        filePath,
        recordIndex++,
        active.lineStart,
        line,
        active.charStart,
        text.length,
      ),
      warnings: [
        {
          code: "truncated_record",
          source: "parser",
          severity: "warning",
          message: "Encountered a truncated trailing record and preserved it as raw text.",
          rawSnippet: active.rawText.slice(0, 200),
        },
      ],
    });
  } else {
    emitJunk(line, text.length);
  }

  return records;
}
