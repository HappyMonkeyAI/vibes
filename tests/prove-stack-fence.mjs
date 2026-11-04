/**
 * Live proof: buildMissionTools for a vanilla-three workspace must deny React writes.
 *
 *   node tests/prove-stack-fence.mjs [workspaceRoot]
 */
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const workspace = path.resolve(
  process.argv[2] || "C:/Users/steph/Documents/development/VRGallery",
);

const { buildMissionTools } = await import(
  pathToFileURL(path.join(here, "../dist/mcp/mission-tools.js")).href
);

const tools = await buildMissionTools({ workspaceRoot: workspace, role: "executor" });
const write = tools.find((t) => t.name === "file_write");
assert.ok(write, "file_write tool missing");

const blocked = await write.execute(
  {
    path: "src/FenceProbe.tsx",
    content: "import React from \"react\";\nexport default function FenceProbe(){return null}\n",
  },
  { workspaceRoot: workspace },
);

assert.equal(blocked.success, false, "React .tsx write must fail");
assert.match(String(blocked.error), /Stack fence/, `unexpected error: ${blocked.error}`);

const ok = await write.execute(
  {
    path: "src/.fence-probe-ok.ts",
    content: "export const fenceProbeOk = true;\n",
  },
  { workspaceRoot: workspace },
);
assert.equal(ok.success, true, `vanilla write failed: ${ok.error}`);

console.log(`stack fence OK on ${workspace}`);
console.log(`blocked: ${blocked.error}`);
