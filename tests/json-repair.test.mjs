import assert from 'node:assert/strict';
import test from 'node:test';

import { repairJson, extractJsonContent } from '../dist/agent/json-repair.js';

test('extractJsonContent strips closed think blocks', () => {
  const result = extractJsonContent('<think>some thinking</think>{"title": "Loading"}');
  assert.equal(result, '{"title": "Loading"}');
});

test('extractJsonContent strips unclosed think blocks and returns empty', () => {
  const result = extractJsonContent('<think>some thinking\n{\n  "title": "Example Structure"\n}');
  assert.equal(result, '');
});

test('repairJson handles closed strings and structures', () => {
  const result = repairJson('{"title": "Loading"}');
  assert.equal(result, '{"title": "Loading"}');
});

test('repairJson handles truncated strings', () => {
  const result = repairJson('{"title": "Loading Skeleton');
  assert.equal(result, '{"title": "Loading Skeleton"}');
});

test('repairJson handles truncated keys', () => {
  const result = repairJson('{"tit');
  assert.equal(result, '{"tit": null}');
});

test('repairJson handles trailing colons', () => {
  const result = repairJson('{"title": ');
  assert.equal(result, '{"title": null}');
});

test('repairJson handles truncated elements in arrays', () => {
  const result = repairJson('{"acceptance_criteria": ["criteria 1');
  assert.equal(result, '{"acceptance_criteria": ["criteria 1"]}');
});

test('repairJson handles empty truncated arrays', () => {
  const result = repairJson('{"acceptance_criteria": [');
  assert.equal(result, '{"acceptance_criteria": []}');
});

test('repairJson handles partial keywords', () => {
  const result = repairJson('{"use_reviewer_model": tr');
  assert.equal(result, '{"use_reviewer_model": true}');
});

test('repairJson handles trailing key names', () => {
  const result = repairJson('{"title": "hello", "description"');
  assert.equal(result, '{"title": "hello", "description": null}');
});

test('repairJson handles trailing commas', () => {
  const result = repairJson('{"title": "hello", ');
  assert.equal(result, '{"title": "hello"}');
});

test('repairJson handles trailing backslashes in truncated strings', () => {
  const result = repairJson('{"title": "Loading \\');
  assert.equal(result, '{"title": "Loading "}');
});

test('repairJson handles double trailing backslashes in truncated strings', () => {
  const result = repairJson('{"title": "Loading \\\\');
  assert.equal(result, '{"title": "Loading \\\\"}');
});

test('repairJson handles complex nested truncations', () => {
  const result = repairJson('{"title": "A", "milestones": [ { "title": "M1", "tasks": [ { "title": "T1"');
  assert.equal(result, '{"title": "A", "milestones": [ { "title": "M1", "tasks": [ { "title": "T1"}]}]}');
  const parsed = JSON.parse(result);
  assert.equal(parsed.title, 'A');
  assert.equal(parsed.milestones[0].tasks[0].title, 'T1');
});
