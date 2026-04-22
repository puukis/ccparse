import test from "node:test";
import assert from "node:assert/strict";

import { parseSession } from "../../src/parsing/parse-session.js";
import { fixturePath } from "../helpers/fixtures.js";

test("parseSession repairs literal newlines inside strings", async () => {
  const parsed = await parseSession(fixturePath("malformed-newlines.jsonl"));

  assert.equal(parsed.records.length, 3);
  const repairedRecord = parsed.records[1];
  assert.equal(repairedRecord?.kind, "record");
  if (repairedRecord?.kind === "record") {
    assert.equal(repairedRecord.repaired, true);
  }
  assert(parsed.warnings.some((warning) => warning.code === "repaired_multiline_string"));
});

test("parseSession preserves partial trailing records as broken records", async () => {
  const parsed = await parseSession(fixturePath("partial-trailing-line.jsonl"));

  assert.equal(parsed.records.length, 3);
  assert.equal(parsed.records[2]?.kind, "broken");
  assert(parsed.warnings.some((warning) => warning.code === "truncated_record"));
  assert(parsed.warnings.some((warning) => warning.code === "json_parse_error"));
});
