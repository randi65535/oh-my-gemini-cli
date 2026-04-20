#!/usr/bin/env node
/*
 * OmG BeforeModel visibility hook.
 *
 * Prints a compact model-routing banner before Gemini CLI sends a model request
 * so operators can see the expected runtime model policy at a glance.
 */

import fs from "node:fs";
import path from "node:path";

const QUIET_HOOKS_ENV = "OMG_HOOKS_QUIET";
const STATE_ROOT_ENV = "OMG_STATE_ROOT";
const DISABLED_HOOKS_ENV = "OMG_DISABLED_HOOKS";
const MODEL_HOOK_KEYS = new Set([
  "model",
  "model-preview",
  "model-banner",
  "omg-before-model-banner",
]);

function readStdinText() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", () => resolve(""));
  });
}

function safeJsonParse(text, fallback = null) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function isTruthy(value) {
  if (typeof value !== "string") {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseCsvEnv(value) {
  if (typeof value !== "string") {
    return [];
  }
  return value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function isHookDisabled(disabledHooks, candidates) {
  for (const candidate of candidates) {
    if (disabledHooks.includes(candidate)) {
      return true;
    }
  }
  return false;
}

function resolveSessionCwd(hookInput) {
  const rawCwd =
    typeof hookInput?.cwd === "string" && hookInput.cwd.trim()
      ? hookInput.cwd.trim()
      : "";
  if (!rawCwd) {
    return null;
  }

  const resolved = path.resolve(rawCwd);
  try {
    if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
      return resolved;
    }
  } catch {
    return null;
  }
  return null;
}

function resolveStateRoot(cwd) {
  const customStateRoot = process.env[STATE_ROOT_ENV];
  if (typeof customStateRoot === "string" && customStateRoot.trim()) {
    return path.isAbsolute(customStateRoot)
      ? customStateRoot.trim()
      : cwd
        ? path.join(cwd, customStateRoot.trim())
        : null;
  }
  return cwd ? path.join(cwd, ".omg", "state") : null;
}

function readJsonFile(filePath, fallback = {}) {
  if (!filePath) {
    return fallback;
  }
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = safeJsonParse(raw, fallback);
    return isObject(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function resolveRequestedModel(hookInput) {
  const candidates = [
    hookInput?.model,
    hookInput?.modelName,
    hookInput?.requestedModel,
    hookInput?.requested_model,
    hookInput?.currentModel,
    hookInput?.current_model,
    hookInput?.config?.model,
    hookInput?.request?.model,
    hookInput?.metadata?.model,
    hookInput?.metadata?.requestedModel,
    hookInput?.metadata?.requested_model,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return "";
}

function resolvePreviewState(cwd) {
  const workspaceSettings = cwd ? readJsonFile(path.join(cwd, ".gemini", "settings.json"), null) : null;
  if (workspaceSettings && typeof workspaceSettings?.general?.previewFeatures === "boolean") {
    return workspaceSettings.general.previewFeatures ? "on" : "off";
  }
  return "unknown";
}

function buildBanner({ requestedModel, strategy, laneModels, previewState }) {
  const parts = [
    "[OMG][MODEL][NEXT]",
    `preview=${previewState}`,
    `strategy=${strategy}`,
  ];

  if (requestedModel) {
    parts.push(`requested=${requestedModel}`);
  }

  parts.push(
    `plan=${laneModels.planning || "-"}`,
    `exec=${laneModels.execution || "-"}`,
    `quick=${laneModels.quick_edit || "-"}`,
    `review=${laneModels.review_verify || "-"}`,
  );

  return parts.join(" ");
}

function emitHookOutput(systemMessage) {
  process.stdout.write(
    JSON.stringify({
      decision: "allow",
      systemMessage,
    }),
  );
}

async function main() {
  const rawInput = await readStdinText();
  const hookInput = safeJsonParse(rawInput, {});
  const quietHooks = isTruthy(process.env[QUIET_HOOKS_ENV]);
  const disabledHooks = parseCsvEnv(process.env[DISABLED_HOOKS_ENV]);
  if (quietHooks || isHookDisabled(disabledHooks, [...MODEL_HOOK_KEYS])) {
    emitHookOutput("");
    return;
  }

  const cwd = resolveSessionCwd(hookInput);
  const stateRoot = resolveStateRoot(cwd);
  const modelState = readJsonFile(stateRoot ? path.join(stateRoot, "model.json") : "", {});
  const strategy =
    typeof modelState.strategy === "string" && modelState.strategy.trim()
      ? modelState.strategy.trim()
      : "balanced";
  const laneModels = isObject(modelState.lane_models)
    ? modelState.lane_models
    : {
        planning: "pro",
        execution: "flash",
        quick_edit: "flash-lite",
        review_verify: "pro",
      };

  emitHookOutput(
    buildBanner({
      requestedModel: resolveRequestedModel(hookInput),
      strategy,
      laneModels,
      previewState: resolvePreviewState(cwd),
    }),
  );
}

main().catch(() => {
  emitHookOutput("");
});
