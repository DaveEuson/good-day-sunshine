import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyModel } from "../ai.js";

test("model filter: keeps chat models, hides code/OCR/vision-only/tiny, with a reason", () => {
  const keep = [["qwen3.5:9b", "9.7B", ["completion", "vision", "tools", "thinking"]], ["llama3.2:3b", "3.2B", ["completion", "tools"]], ["gemma3:4b", "4.3B", ["completion", "vision"]], ["falcon:7b", "7B", ["completion"]]];
  for (const [name, params, caps] of keep) assert.equal(classifyModel({ name, params, caps }), null, name);
  assert.equal(classifyModel({ name: "starcoder2:15b", params: "16B", caps: ["completion", "insert"] }), "code completion model");
  assert.equal(classifyModel({ name: "deepseek-ocr:3b", family: "deepseekocr", params: "3.3B", caps: ["completion", "vision"] }), "OCR model");
  assert.equal(classifyModel({ name: "bakllava:latest", params: "7B", caps: ["completion", "vision"] }), "image description model");
  assert.equal(classifyModel({ name: "functiongemma:270m", params: "268.10M", caps: ["completion", "tools"] }), "too small (268.10M)");
  assert.equal(classifyModel({ name: "nomic-embed-text", params: "137M", caps: ["embedding"] }), "embedding model");
});
