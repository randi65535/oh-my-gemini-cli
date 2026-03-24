#!/usr/bin/env node
/*
 * OmG AfterAgent usage monitor hook.
 *
 * This hook reads the active Gemini transcript file and prints a compact
 * token-usage line after each completed agent turn.
 *
 * Repeated hook retries against the same transcript snapshot are treated as
 * already delivered so the usage line stays idempotent.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const DEFAULT_STATE_RELATIVE_PATH = path.join(".omg", "state", "quota-watch.json");
const QUIET_HOOKS_ENV = "OMG_HOOKS_QUIET";
const STATE_ROOT_ENV = "OMG_STATE_ROOT";

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

function resolveStatePath(cwd) {
  const customStateRoot = process.env[STATE_ROOT_ENV];
  if (typeof customStateRoot === "string" && customStateRoot.trim()) {
    const stateRoot = path.isAbsolute(customStateRoot)
      ? customStateRoot.trim()
      : path.join(cwd, customStateRoot.trim());
    return path.join(stateRoot, "quota-watch.json");
  }
  return path.join(cwd, DEFAULT_STATE_RELATIVE_PATH);
}

function asNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function hashText(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(asNumber(value));
}

function readState(statePath) {
  try {
    const raw = fs.readFileSync(statePath, "utf8");
    const parsed = safeJsonParse(raw, {});
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeState(statePath, state) {
  try {
    const dir = path.dirname(statePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  } catch {
    // Fail-open: usage monitor should never block the parent workflow.
  }
}

function buildUsageFromTranscript(transcript) {
  const messages = Array.isArray(transcript?.messages) ? transcript.messages : [];
  const geminiMessages = messages.filter(
    (msg) =>
      msg &&
      msg.type === "gemini" &&
      msg.tokens &&
      typeof msg.tokens === "object"
  );

  if (geminiMessages.length === 0) {
    return null;
  }

  const latest = geminiMessages[geminiMessages.length - 1];
  const totals = {
    input: 0,
    output: 0,
    cached: 0,
    thoughts: 0,
    tool: 0,
    total: 0,
  };
  const byModel = {};

  for (const msg of geminiMessages) {
    const t = msg.tokens || {};
    totals.input += asNumber(t.input);
    totals.output += asNumber(t.output);
    totals.cached += asNumber(t.cached);
    totals.thoughts += asNumber(t.thoughts);
    totals.tool += asNumber(t.tool);
    totals.total += asNumber(t.total);

    const model = typeof msg.model === "string" && msg.model ? msg.model : "unknown";
    if (!byModel[model]) {
      byModel[model] = 0;
    }
    byModel[model] += asNumber(t.total);
  }

  const latestModel =
    typeof latest.model === "string" && latest.model ? latest.model : "unknown";
  const latestTokens = latest.tokens || {};

  return {
    latest: {
      model: latestModel,
      input: asNumber(latestTokens.input),
      output: asNumber(latestTokens.output),
      cached: asNumber(latestTokens.cached),
      total: asNumber(latestTokens.total),
    },
    session: totals,
    byModel,
  };
}

function buildMonitorLine(usage, turnCount) {
  return [
    `[OMG][USAGE][TURN ${turnCount}]`,
    `turn=${formatNumber(usage.latest.total)} tok`,
    `(in ${formatNumber(usage.latest.input)} / out ${formatNumber(usage.latest.output)} / cache ${formatNumber(usage.latest.cached)})`,
    `session=${formatNumber(usage.session.total)} tok`,
    `model=${usage.latest.model} ${formatNumber(usage.byModel[usage.latest.model] || 0)} tok`,
    `remaining=/stats model`,
  ].join(" ");
}

function buildEventKey(sessionId, transcriptPath, transcriptRaw) {
  const sessionPart = typeof sessionId === "string" && sessionId ? sessionId : "unknown";
  if (typeof transcriptRaw === "string") {
    return `${sessionPart}:transcript:${hashText(transcriptRaw)}`;
  }

  const sourcePart =
    typeof transcriptPath === "string" && transcriptPath ? transcriptPath : "missing";
  return `${sessionPart}:transcript-missing:${sourcePart}`;
}

function emitHookOutput(systemMessage) {
  const output = {
    decision: "allow",
    systemMessage,
  };
  process.stdout.write(JSON.stringify(output));
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

  const statePath = resolveStatePath(cwd);
  const quietHooks = isTruthy(process.env[QUIET_HOOKS_ENV]);
  const prevState = readState(statePath);
  let line;
  let nextTurnCount = prevState.last_session_id === sessionId ? asNumber(prevState.turn_count) : 0;
  let eventKey = buildEventKey(sessionId, transcriptPath, null);
  let lastTranscriptHash = null;

  if (transcriptPath && fs.existsSync(transcriptPath)) {
    const transcriptRaw = fs.readFileSync(transcriptPath, "utf8");
    lastTranscriptHash = hashText(transcriptRaw);
    eventKey = buildEventKey(sessionId, transcriptPath, transcriptRaw);

    const duplicateEvent =
      prevState.last_session_id === sessionId && prevState.last_event_key === eventKey;
    if (duplicateEvent) {
      emitHookOutput("");
      return;
    }

    nextTurnCount += 1;

    const transcript = safeJsonParse(transcriptRaw, null);
    const usage = buildUsageFromTranscript(transcript);
    if (usage) {
      line = buildMonitorLine(usage, nextTurnCount);
      writeState(statePath, {
        turn_count: nextTurnCount,
        last_session_id: sessionId,
        last_event_key: eventKey,
        last_transcript_hash: lastTranscriptHash,
        last_model: usage.latest.model,
        last_turn_total_tokens: usage.latest.total,
        last_session_total_tokens: usage.session.total,
        updated_at: new Date().toISOString(),
      });
    }
  } else {
    eventKey = buildEventKey(sessionId, transcriptPath, null);
    const duplicateEvent =
      prevState.last_session_id === sessionId && prevState.last_event_key === eventKey;
    if (duplicateEvent) {
      emitHookOutput("");
      return;
    }

    nextTurnCount += 1;
  }

  if (!line) {
    line = `[OMG][USAGE][TURN ${nextTurnCount}] usage=unavailable remaining=/stats model`;
    writeState(statePath, {
      turn_count: nextTurnCount,
      last_session_id: sessionId,
      last_event_key: eventKey,
      ...(lastTranscriptHash ? { last_transcript_hash: lastTranscriptHash } : {}),
      updated_at: new Date().toISOString(),
    });
  }

  emitHookOutput(quietHooks ? "" : line);
}

main().catch((error) => {
  const quietHooks = isTruthy(process.env[QUIET_HOOKS_ENV]);
  const fallback = {
    decision: "allow",
    systemMessage: quietHooks
      ? ""
      : `[OMG][USAGE] monitor-hook error: ${error?.message || String(error)}`,
  };
  process.stdout.write(JSON.stringify(fallback));
});
