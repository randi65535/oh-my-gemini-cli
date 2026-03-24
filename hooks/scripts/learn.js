#!/usr/bin/env node
/**
 * OmG Learn - Session Evaluator Hook
 * Runs on SessionEnd to extract reusable patterns from OmG sessions.
 */

import fs from "node:fs";
import path from "node:path";

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

async function main() {
  const rawInput = await readStdinText();
  const hookInput = safeJsonParse(rawInput, {});

  const cwd = typeof hookInput?.cwd === "string" && hookInput.cwd ? hookInput.cwd : process.cwd();
  const transcriptPath = typeof hookInput?.transcript_path === "string" && hookInput.transcript_path ? hookInput.transcript_path : "";

  if (!transcriptPath || !fs.existsSync(transcriptPath)) {
    return;
  }

  // Load config
  const configPath = path.join(cwd, ".omg", "rules", "learn.json");
  let minSessionLength = 10;
  let learnedSkillsPath = ".omg/rules/learned/";

  if (fs.existsSync(configPath)) {
    const config = safeJsonParse(fs.readFileSync(configPath, "utf8"), {});
    if (config.min_session_length) minSessionLength = config.min_session_length;
    if (config.learned_skills_path) learnedSkillsPath = config.learned_skills_path;
  }

  const transcriptRaw = fs.readFileSync(transcriptPath, "utf8");
  const transcript = safeJsonParse(transcriptRaw, { messages: [] });
  const messages = Array.isArray(transcript.messages) ? transcript.messages : [];
  const messageCount = messages.filter(m => m.type === "user").length;

  if (messageCount < minSessionLength) {
    if (process.env.OMG_HOOKS_QUIET !== "true") {
      process.stderr.write(`[Learn] Session too short (${messageCount} messages), skipping\n`);
    }
    return;
  }

  process.stderr.write(`[Learn] Session has ${messageCount} messages - evaluate for extractable patterns\n`);
  process.stderr.write(`[Learn] Learned skills path: ${learnedSkillsPath}\n`);

  // Emit hook output
  const output = {
    decision: "allow",
    systemMessage: `[OMG][Learn] Session length: ${messageCount}. Please run '/omg:learn' if you want to extract patterns before closing.`
  };
  process.stdout.write(JSON.stringify(output));
}

main().catch(err => {
  process.stderr.write(`[Learn] Hook error: ${err.message}\n`);
});
