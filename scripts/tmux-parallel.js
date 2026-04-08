#!/usr/bin/env node
/**
 * OmG tmux-parallel helper
 *
 * CLI utility for managing tmux-backed background Gemini CLI parallel sessions.
 * Invoked by the AI via shell when running `/omg:parallel` commands.
 *
 * Usage:
 *   node tmux-parallel.js create  <session-id> <shard-count>
 *   node tmux-parallel.js send    <session-id> <window-idx> <prompt-file> <output-file>
 *   node tmux-parallel.js status  <session-id>
 *   node tmux-parallel.js capture <session-id> <window-idx>
 *   node tmux-parallel.js kill    <session-id>
 *   node tmux-parallel.js list
 */

import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const PARALLEL_STATE_PATH = path.join(".omg", "state", "parallel.json");
const MAX_SESSIONS = 4;

function safeJsonParse(text, fallback = null) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function readState() {
  try {
    const raw = fs.readFileSync(PARALLEL_STATE_PATH, "utf8");
    const parsed = safeJsonParse(raw, null);
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.sessions)) {
      return parsed;
    }
  } catch {
    // File missing or unreadable — return empty state.
  }
  return { sessions: [], source: "omg:parallel" };
}

function writeState(state) {
  const dir = path.dirname(PARALLEL_STATE_PATH);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(PARALLEL_STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function runCommand(cmd, args = [], { allowFail = false } = {}) {
  const result = spawnSync(cmd, args, { encoding: "utf8" });
  if (!allowFail && result.status !== 0) {
    const errMsg = (result.stderr || "").trim() || `${cmd} exited with code ${result.status}`;
    process.stderr.write(`[omg:parallel] error: ${errMsg}\n`);
    process.exit(1);
  }
  return { stdout: (result.stdout || "").trim(), status: result.status };
}

function tmux(...args) {
  return runCommand("tmux", args, { allowFail: false });
}

function tmuxMaybe(...args) {
  return runCommand("tmux", args, { allowFail: true });
}

function sessionExists(sessionId) {
  const result = tmuxMaybe("has-session", "-t", sessionId);
  return result.status === 0;
}

/** create <session-id> <shard-count> */
function cmdCreate(sessionId, shardCountStr) {
  const shardCount = Number.parseInt(shardCountStr, 10);
  if (!sessionId || !Number.isFinite(shardCount) || shardCount < 1) {
    process.stderr.write("usage: create <session-id> <shard-count>\n");
    process.exit(1);
  }
  if (sessionId.length > 50) {
    process.stderr.write(`[omg:parallel] error: session-id exceeds 50-character limit\n`);
    process.exit(1);
  }

  const state = readState();
  const activeCount = state.sessions.filter(
    (s) => s.status === "running"
  ).length;
  if (activeCount >= MAX_SESSIONS) {
    process.stderr.write(
      `[omg:parallel] error: ${MAX_SESSIONS} active sessions already running; kill one before launching\n`
    );
    process.exit(1);
  }

  if (sessionExists(sessionId)) {
    process.stderr.write(`[omg:parallel] error: tmux session "${sessionId}" already exists\n`);
    process.exit(1);
  }

  // Create detached tmux session (window 0 created automatically).
  tmux("new-session", "-d", "-s", sessionId);

  // Create additional windows for shards 1..N-1.
  for (let i = 1; i < shardCount; i++) {
    tmux("new-window", "-t", sessionId);
  }

  const outputDir = path.join(".omg", "state", "parallel", sessionId);
  fs.mkdirSync(outputDir, { recursive: true });

  const now = new Date().toISOString();
  const newSession = {
    id: sessionId,
    tmux_session: sessionId,
    created_at: now,
    objective: "",
    shard_count: shardCount,
    status: "running",
    output_dir: outputDir,
    shards: Array.from({ length: shardCount }, (_, i) => ({
      index: i,
      summary: `shard-${i}`,
      prompt_file: path.join(outputDir, `shard-${i}.prompt.md`),
      output_file: path.join(outputDir, `shard-${i}.output.md`),
      status: "pending",
    })),
  };

  state.sessions.push(newSession);
  writeState(state);

  process.stdout.write(
    JSON.stringify({ ok: true, session_id: sessionId, output_dir: outputDir, shard_count: shardCount }) + "\n"
  );
}

/** send <session-id> <window-idx> <prompt-file> <output-file> */
function cmdSend(sessionId, windowIdxStr, promptFile, outputFile) {
  const windowIdx = Number.parseInt(windowIdxStr, 10);
  if (!sessionId || !Number.isFinite(windowIdx) || !promptFile || !outputFile) {
    process.stderr.write("usage: send <session-id> <window-idx> <prompt-file> <output-file>\n");
    process.exit(1);
  }
  if (!sessionExists(sessionId)) {
    process.stderr.write(`[omg:parallel] error: tmux session "${sessionId}" not found\n`);
    process.exit(1);
  }

  const doneLog = path.join(".omg", "state", "parallel", sessionId, "done.log");
  const cmd = `gemini -p "$(cat '${promptFile}')" > '${outputFile}' 2>&1; echo SHARD_DONE_${windowIdx} >> '${doneLog}'`;
  tmux("send-keys", "-t", `${sessionId}:${windowIdx}`, cmd, "Enter");

  // Update shard status to running.
  const state = readState();
  const session = state.sessions.find((s) => s.id === sessionId);
  if (session) {
    const shard = session.shards.find((sh) => sh.index === windowIdx);
    if (shard) {
      shard.status = "running";
    }
    writeState(state);
  }

  process.stdout.write(JSON.stringify({ ok: true, session_id: sessionId, window: windowIdx }) + "\n");
}

/** status <session-id> */
function cmdStatus(sessionId) {
  if (!sessionId) {
    process.stderr.write("usage: status <session-id>\n");
    process.exit(1);
  }

  const state = readState();
  const session = state.sessions.find((s) => s.id === sessionId);
  if (!session) {
    process.stderr.write(`[omg:parallel] error: session "${sessionId}" not found in state\n`);
    process.exit(1);
  }

  const tmuxAlive = sessionExists(sessionId);
  const doneLog = path.join(session.output_dir, "done.log");
  let doneCount = 0;
  try {
    const logContent = fs.readFileSync(doneLog, "utf8");
    doneCount = (logContent.match(/SHARD_DONE_/g) || []).length;
  } catch {
    doneCount = 0;
  }

  // Refresh shard statuses.
  for (const shard of session.shards) {
    const markerPresent = (() => {
      try {
        const logContent = fs.readFileSync(doneLog, "utf8");
        return logContent.includes(`SHARD_DONE_${shard.index}`);
      } catch {
        return false;
      }
    })();

    if (markerPresent) {
      shard.status = "done";
    } else if (tmuxAlive && shard.status === "running") {
      shard.status = "running";
    }
  }

  if (doneCount >= session.shard_count && session.status === "running") {
    session.status = "done";
  }

  writeState(state);

  process.stdout.write(
    JSON.stringify({
      session_id: sessionId,
      status: session.status,
      tmux_alive: tmuxAlive,
      done_count: doneCount,
      shard_count: session.shard_count,
      shards: session.shards,
    }) + "\n"
  );
}

/** capture <session-id> <window-idx> */
function cmdCapture(sessionId, windowIdxStr) {
  const windowIdx = Number.parseInt(windowIdxStr, 10);
  if (!sessionId || !Number.isFinite(windowIdx)) {
    process.stderr.write("usage: capture <session-id> <window-idx>\n");
    process.exit(1);
  }
  if (!sessionExists(sessionId)) {
    process.stderr.write(`[omg:parallel] error: tmux session "${sessionId}" not found\n`);
    process.exit(1);
  }

  const result = tmuxMaybe("capture-pane", "-p", "-t", `${sessionId}:${windowIdx}`);
  process.stdout.write(result.stdout + "\n");
}

/** kill <session-id> */
function cmdKill(sessionId) {
  if (!sessionId) {
    process.stderr.write("usage: kill <session-id>\n");
    process.exit(1);
  }

  if (sessionExists(sessionId)) {
    tmuxMaybe("kill-session", "-t", sessionId);
  }

  const state = readState();
  const session = state.sessions.find((s) => s.id === sessionId);
  if (session) {
    session.status = "killed";
    writeState(state);
  }

  process.stdout.write(JSON.stringify({ ok: true, session_id: sessionId, status: "killed" }) + "\n");
}

/** list */
function cmdList() {
  const state = readState();
  const rows = state.sessions.map((s) => ({
    id: s.id,
    status: s.status,
    shard_count: s.shard_count,
    created_at: s.created_at,
    tmux_session: s.tmux_session,
  }));
  process.stdout.write(JSON.stringify({ sessions: rows }) + "\n");
}

// Dispatch.
const [, , command, ...rest] = process.argv;

switch (command) {
  case "create":
    cmdCreate(rest[0], rest[1]);
    break;
  case "send":
    cmdSend(rest[0], rest[1], rest[2], rest[3]);
    break;
  case "status":
    cmdStatus(rest[0]);
    break;
  case "capture":
    cmdCapture(rest[0], rest[1]);
    break;
  case "kill":
    cmdKill(rest[0]);
    break;
  case "list":
    cmdList();
    break;
  default:
    process.stderr.write(
      "OmG tmux-parallel helper\n\n" +
        "Commands:\n" +
        "  create  <session-id> <shard-count>\n" +
        "  send    <session-id> <window-idx> <prompt-file> <output-file>\n" +
        "  status  <session-id>\n" +
        "  capture <session-id> <window-idx>\n" +
        "  kill    <session-id>\n" +
        "  list\n"
    );
    process.exit(1);
}
