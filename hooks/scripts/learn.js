#!/usr/bin/env node
/**
 * OmG Learn Signal Hook
 *
 * Safety-hardened learn nudger:
 * - skips informational-only sessions
 * - suppresses nudges while deep-interview lock is active
 * - enforces cross-session cooldown to reduce repeat nudges
 * - deduplicates repeated transcript snapshots
 * - sanitizes legacy state before reuse
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const QUIET_HOOKS_ENV = "OMG_HOOKS_QUIET";
const STATE_ROOT_ENV = "OMG_STATE_ROOT";
const DEFAULT_STATE_RELATIVE_PATH = path.join(".omg", "state", "learn-watch.json");
const DEFAULT_DEEP_INTERVIEW_STATE_RELATIVE_PATH = path.join(
  ".omg",
  "state",
  "deep-interview.json",
);

const ACTION_KEYWORDS = [
  "build",
  "implement",
  "fix",
  "refactor",
  "test",
  "write",
  "add",
  "remove",
  "optimize",
  "migrate",
  "debug",
  "ship",
];

const INFORMATIONAL_PREFIXES = [
  "what is",
  "what are",
  "why is",
  "why are",
  "how does",
  "how do",
  "explain",
  "define",
  "difference between",
  "compare",
];

function readStdinText() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => {
      resolve(data);
    });
    process.stdin.on("error", () => {
      resolve("");
    });
  });
}

function safeJsonParse(text, fallback = null) {
  try {
    const normalized =
      typeof text === "string" ? text.replace(/^\uFEFF/, "") : text;
    return JSON.parse(normalized);
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

function resolveStatePath(cwd) {
  const customStateRoot = process.env[STATE_ROOT_ENV];
  if (typeof customStateRoot === "string" && customStateRoot.trim()) {
    const stateRoot = path.isAbsolute(customStateRoot)
      ? customStateRoot.trim()
      : path.join(cwd, customStateRoot.trim());
    return path.join(stateRoot, "learn-watch.json");
  }
  return path.join(cwd, DEFAULT_STATE_RELATIVE_PATH);
}

function resolveDeepInterviewStatePath(cwd) {
  const customStateRoot = process.env[STATE_ROOT_ENV];
  if (typeof customStateRoot === "string" && customStateRoot.trim()) {
    const stateRoot = path.isAbsolute(customStateRoot)
      ? customStateRoot.trim()
      : path.join(cwd, customStateRoot.trim());
    return path.join(stateRoot, "deep-interview.json");
  }
  return path.join(cwd, DEFAULT_DEEP_INTERVIEW_STATE_RELATIVE_PATH);
}

function hashText(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function buildEventKey(sessionId, transcriptPath, transcriptRaw) {
  const sessionPart = typeof sessionId === "string" && sessionId ? sessionId : "unknown";
  if (typeof transcriptRaw === "string") {
    return `${sessionPart}:transcript:${hashText(transcriptRaw)}`;
  }
  const sourcePart = typeof transcriptPath === "string" && transcriptPath ? transcriptPath : "missing";
  return `${sessionPart}:transcript-missing:${sourcePart}`;
}

function normalizeState(state) {
  if (!state || typeof state !== "object") {
    return {};
  }
  return {
    last_session_id: typeof state.last_session_id === "string" ? state.last_session_id : "",
    last_event_key: typeof state.last_event_key === "string" ? state.last_event_key : "",
    last_prompted_session_id:
      typeof state.last_prompted_session_id === "string" ? state.last_prompted_session_id : "",
    last_reason: typeof state.last_reason === "string" ? state.last_reason : "",
    last_prompted_at:
      typeof state.last_prompted_at === "string" ? state.last_prompted_at : "",
    last_user_message_count: Number.isFinite(Number(state.last_user_message_count))
      ? Number(state.last_user_message_count)
      : 0,
    last_actionable_message_count: Number.isFinite(Number(state.last_actionable_message_count))
      ? Number(state.last_actionable_message_count)
      : 0,
  };
}

function readState(statePath) {
  try {
    const raw = fs.readFileSync(statePath, "utf8");
    return normalizeState(safeJsonParse(raw, {}));
  } catch {
    return {};
  }
}

function readDeepInterviewState(statePath) {
  try {
    const raw = fs.readFileSync(statePath, "utf8");
    const parsed = safeJsonParse(raw, null);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function parseTimestamp(value) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isDeepInterviewLockActive(state, nowMs = Date.now()) {
  if (!state || typeof state !== "object") {
    return false;
  }

  if (state.active === false || state.locked === false) {
    return false;
  }

  if (typeof state.released_at === "string" && state.released_at.trim()) {
    return false;
  }

  const expiresAt = parseTimestamp(state.expires_at);
  if (expiresAt !== null && expiresAt <= nowMs) {
    return false;
  }

  if (state.active === true || state.locked === true) {
    return true;
  }

  const status =
    typeof state.status === "string" ? state.status.trim().toLowerCase() : "";
  if (["active", "locked", "in-progress", "running", "interviewing"].includes(status)) {
    return true;
  }
  if (
    [
      "done",
      "completed",
      "released",
      "inactive",
      "idle",
      "stopped",
      "failed",
      "cancelled",
      "canceled",
    ].includes(status)
  ) {
    return false;
  }

  // Backward-compatible fallback: treat recently updated lock snapshots as active
  // even when no explicit boolean/status flag exists.
  const updatedAt = parseTimestamp(state.updated_at);
  if (updatedAt !== null && nowMs - updatedAt <= 2 * 60 * 60 * 1000) {
    return true;
  }

  return false;
}

function writeState(statePath, state) {
  try {
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  } catch {
    // Fail-open: learn hook must never block the parent workflow.
  }
}

function emitHookOutput(systemMessage) {
  const output = {
    decision: "allow",
    systemMessage,
  };
  process.stdout.write(JSON.stringify(output));
}

function asText(value) {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => asText(item)).filter(Boolean).join(" ");
  }
  if (value && typeof value === "object") {
    if (typeof value.text === "string") {
      return value.text;
    }
    if (typeof value.content === "string" || Array.isArray(value.content) || (value.content && typeof value.content === "object")) {
      return asText(value.content);
    }
    if (typeof value.value === "string") {
      return value.value;
    }
  }
  return "";
}

function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function containsAny(text, terms) {
  for (const term of terms) {
    if (text.includes(term)) {
      return true;
    }
  }
  return false;
}

function isInformationalOnlyQuery(text) {
  for (const prefix of INFORMATIONAL_PREFIXES) {
    if (text.startsWith(prefix)) {
      return true;
    }
  }
  return false;
}

function classifySession(userTexts) {
  let nonEmptyCount = 0;
  let actionableCount = 0;
  let informationalCount = 0;

  for (const rawText of userTexts) {
    const text = normalizeText(rawText);
    if (!text) {
      continue;
    }
    nonEmptyCount += 1;

    const hasAction = containsAny(text, ACTION_KEYWORDS);
    if (hasAction) {
      actionableCount += 1;
      continue;
    }

    if (isInformationalOnlyQuery(text)) {
      informationalCount += 1;
    }
  }

  return {
    nonEmptyCount,
    actionableCount,
    informationalOnly:
      nonEmptyCount > 0 && actionableCount === 0 && informationalCount === nonEmptyCount,
  };
}

function loadLearnConfig(cwd) {
  const defaults = {
    minSessionLength: 10,
    learnedSkillsPath: ".omg/rules/learned/",
    promptOncePerSession: true,
    promptCooldownMinutes: 45,
  };
  const configPath = path.join(cwd, ".omg", "rules", "learn.json");
  if (!fs.existsSync(configPath)) {
    return defaults;
  }

  const config = safeJsonParse(fs.readFileSync(configPath, "utf8"), {});
  if (!config || typeof config !== "object") {
    return defaults;
  }

  const minSessionLength =
    Number.isFinite(Number(config.min_session_length)) && Number(config.min_session_length) > 0
      ? Number(config.min_session_length)
      : defaults.minSessionLength;
  const learnedSkillsPath =
    typeof config.learned_skills_path === "string" && config.learned_skills_path.trim()
      ? config.learned_skills_path.trim()
      : defaults.learnedSkillsPath;
  const promptOncePerSession =
    typeof config.prompt_once_per_session === "boolean"
      ? config.prompt_once_per_session
      : defaults.promptOncePerSession;
  const promptCooldownMinutes =
    Number.isFinite(Number(config.prompt_cooldown_minutes)) &&
    Number(config.prompt_cooldown_minutes) >= 0
      ? Number(config.prompt_cooldown_minutes)
      : defaults.promptCooldownMinutes;

  return {
    minSessionLength,
    learnedSkillsPath,
    promptOncePerSession,
    promptCooldownMinutes,
  };
}

function isPromptCooldownActive(state, cooldownMinutes, nowMs = Date.now()) {
  if (!Number.isFinite(cooldownMinutes) || cooldownMinutes <= 0) {
    return false;
  }

  const lastPromptedAt = parseTimestamp(state?.last_prompted_at);
  if (lastPromptedAt === null) {
    return false;
  }

  return nowMs - lastPromptedAt < cooldownMinutes * 60 * 1000;
}

async function main() {
  const rawInput = await readStdinText();
  const hookInput = safeJsonParse(rawInput, {});

  const cwd = typeof hookInput?.cwd === "string" && hookInput.cwd ? hookInput.cwd : process.cwd();
  const sessionId =
    typeof hookInput?.session_id === "string" && hookInput.session_id
      ? hookInput.session_id
      : "unknown";
  const transcriptPath =
    typeof hookInput?.transcript_path === "string" && hookInput.transcript_path
      ? hookInput.transcript_path
      : "";
  const quietHooks = isTruthy(process.env[QUIET_HOOKS_ENV]);
  const statePath = resolveStatePath(cwd);
  const deepInterviewStatePath = resolveDeepInterviewStatePath(cwd);
  const prevState = readState(statePath);
  const config = loadLearnConfig(cwd);
  const deepInterviewState = readDeepInterviewState(deepInterviewStatePath);
  const deepInterviewLockActive = isDeepInterviewLockActive(deepInterviewState);
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  if (!transcriptPath || !fs.existsSync(transcriptPath)) {
    const eventKey = buildEventKey(sessionId, transcriptPath, null);
    const duplicateEvent =
      prevState.last_session_id === sessionId && prevState.last_event_key === eventKey;
    if (duplicateEvent) {
      emitHookOutput("");
      return;
    }
    writeState(statePath, {
      ...prevState,
      last_session_id: sessionId,
      last_event_key: eventKey,
      last_reason: "missing-transcript",
      updated_at: new Date().toISOString(),
    });
    emitHookOutput("");
    return;
  }

  const transcriptRaw = fs.readFileSync(transcriptPath, "utf8");
  const eventKey = buildEventKey(sessionId, transcriptPath, transcriptRaw);
  const duplicateEvent =
    prevState.last_session_id === sessionId && prevState.last_event_key === eventKey;
  if (duplicateEvent) {
    emitHookOutput("");
    return;
  }

  const transcript = safeJsonParse(transcriptRaw, { messages: [] });
  const messages = Array.isArray(transcript.messages) ? transcript.messages : [];
  const userTexts = messages
    .filter((msg) => msg?.type === "user")
    .map((msg) => asText(msg?.content ?? msg?.message ?? msg?.text));

  const messageCount = userTexts.filter((text) => normalizeText(text).length > 0).length;
  const classification = classifySession(userTexts);
  let reason = "";
  let shouldPrompt = false;

  if (messageCount < config.minSessionLength) {
    reason = "short-session";
  } else if (deepInterviewLockActive) {
    reason = "deep-interview-lock-active";
  } else if (
    isPromptCooldownActive(prevState, config.promptCooldownMinutes, nowMs)
  ) {
    reason = "prompt-cooldown-active";
  } else if (classification.informationalOnly) {
    reason = "informational-only";
  } else if (
    config.promptOncePerSession &&
    prevState.last_prompted_session_id === sessionId
  ) {
    reason = "already-prompted-this-session";
  } else {
    shouldPrompt = true;
    reason = "actionable-session-detected";
  }

  const systemMessage =
    shouldPrompt && !quietHooks
      ? `[OMG][Learn] Actionable session signals detected (${classification.actionableCount}/${messageCount}). Run '/omg:learn' to extract reusable patterns into ${config.learnedSkillsPath}.`
      : "";

  writeState(statePath, {
    ...prevState,
    last_session_id: sessionId,
    last_event_key: eventKey,
    last_prompted_session_id: shouldPrompt ? sessionId : prevState.last_prompted_session_id || "",
    last_prompted_at: shouldPrompt ? nowIso : prevState.last_prompted_at || "",
    last_reason: reason,
    last_user_message_count: messageCount,
    last_actionable_message_count: classification.actionableCount,
    deep_interview_lock_active: deepInterviewLockActive,
    deep_interview_lock_source: deepInterviewStatePath,
    updated_at: nowIso,
  });

  emitHookOutput(systemMessage);
}

main().catch((err) => {
  const quietHooks = isTruthy(process.env[QUIET_HOOKS_ENV]);
  const fallback = {
    decision: "allow",
    systemMessage: quietHooks
      ? ""
      : `[OMG][Learn] monitor-hook error: ${err?.message || String(err)}`,
  };
  process.stdout.write(JSON.stringify(fallback));
});
