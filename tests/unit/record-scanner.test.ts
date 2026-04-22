import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { scanJsonLikeRecords } from "../../src/parsing/record-scanner.js";
import { fixturePath } from "../helpers/fixtures.js";

test("scanJsonLikeRecords keeps multiline malformed records together", async () => {
  const filePath = fixturePath("malformed-newlines.jsonl");
  const text = await readFile(filePath, "utf8");
  const records = scanJsonLikeRecords(filePath, text);

  assert.equal(records.length, 3);
  assert.equal(records[1]?.location.lineStart, 2);
  assert.equal(records[1]?.location.lineEnd, 3);
  assert.match(records[1]?.rawText ?? "", /literal\nnewline/);
});

test("scanJsonLikeRecords preserves truncated trailing records", async () => {
  const filePath = fixturePath("partial-trailing-line.jsonl");
  const text = await readFile(filePath, "utf8");
  const records = scanJsonLikeRecords(filePath, text);

  assert.equal(records.length, 3);
  assert.equal(records[2]?.warnings[0]?.code, "truncated_record");
});
