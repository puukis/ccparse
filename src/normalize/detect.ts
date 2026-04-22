import type {
  JsonObject,
  JsonValue,
} from "../types/core.js";
import type { ExternalPayloadReference } from "../types/normalized.js";
import { asBoolean, asNumber, asString, deepFindObjects, getString, isJsonObject } from "../utils/json.js";

const PRIMARY_PATH_KEYS = [
  "resultPath",
  "contentPath",
  "payloadPath",
  "artifactPath",
  "outputPath",
] as const;

const SECONDARY_PATH_KEYS = ["filePath", "path"] as const;

function findPathCandidate(object: JsonObject): string | undefined {
  for (const key of PRIMARY_PATH_KEYS) {
    const value = asString(object[key]);
    if (value) {
      return value;
    }
  }

  const type = getString(object, "type")?.toLowerCase();
  const isExternalish =
    asBoolean(object.external) === true ||
    asBoolean(object.externalized) === true ||
    type?.includes("external") === true ||
    type?.includes("file") === true ||
    type?.endsWith("_ref") === true ||
    (!!asString(object.preview) && object.content === undefined) ||
    (!!asNumber(object.sizeBytes) && object.content === undefined);

  if (isExternalish) {
    for (const key of SECONDARY_PATH_KEYS) {
      const value = asString(object[key]);
      if (value) {
        return value;
      }
    }
  }

  const contentRef = object.contentRef;
  if (typeof contentRef === "string") {
    return contentRef;
  }

  if (isJsonObject(contentRef)) {
    return findPathCandidate(contentRef);
  }

  return undefined;
}

function buildReference(object: JsonObject, pathValue: string): ExternalPayloadReference {
  const reference: ExternalPayloadReference = { path: pathValue };

  const sizeBytes = asNumber(object.sizeBytes) ?? asNumber(object.size);
  if (sizeBytes !== undefined) {
    reference.sizeBytes = sizeBytes;
  }

  const contentType = asString(object.contentType) ?? asString(object.mimeType);
  if (contentType) {
    reference.contentType = contentType;
  }

  return reference;
}

export function extractExternalPayloadReference(
  value: JsonValue | undefined,
): ExternalPayloadReference | undefined {
  if (!isJsonObject(value)) {
    return undefined;
  }

  const direct = findPathCandidate(value);
  if (direct) {
    return buildReference(value, direct);
  }

  const nested = deepFindObjects(value, (object) => Boolean(findPathCandidate(object)));
  const first = nested[0];
  if (!first) {
    return undefined;
  }

  const pathValue = findPathCandidate(first);
  return pathValue ? buildReference(first, pathValue) : undefined;
}

export interface SubagentReferenceCandidate {
  name?: string;
  status?: string;
  sessionIdRef?: string;
  transcriptPath?: string;
  details?: JsonValue | string | null;
}

export function extractSubagentReference(
  value: JsonValue | undefined,
  toolName?: string,
): SubagentReferenceCandidate | undefined {
  if (!isJsonObject(value)) {
    return undefined;
  }

  const transcriptPath =
    asString(value.transcriptPath) ??
    asString(value.subagentTranscriptPath) ??
    asString(value.childTranscriptPath);
  const sessionIdRef =
    asString(value.subagentSessionId) ??
    asString(value.childSessionId) ??
    asString(value.sessionId);
  const status = asString(value.status) ?? asString(value.state);
  const name =
    asString(value.subagent) ??
    asString(value.agent) ??
    asString(value.name) ??
    toolName;

  const type = getString(value, "type")?.toLowerCase();
  const hintedByTool = toolName ? /(task|agent|subagent)/i.test(toolName) : false;
  const looksLikeSubagent =
    Boolean(transcriptPath) ||
    hintedByTool ||
    type?.includes("subagent") === true ||
    type?.includes("sidechain") === true ||
    Boolean(asString(value.subagent)) ||
    Boolean(asString(value.agent));

  if (!looksLikeSubagent) {
    return undefined;
  }

  const candidate: SubagentReferenceCandidate = {};
  if (name) {
    candidate.name = name;
  }
  if (status) {
    candidate.status = status;
  }
  if (sessionIdRef) {
    candidate.sessionIdRef = sessionIdRef;
  }
  if (transcriptPath) {
    candidate.transcriptPath = transcriptPath;
  }
  candidate.details = value;
  return candidate;
}
