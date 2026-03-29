# OmG Core Context

OmG adds a role-driven workflow layer to Gemini CLI.

## Primary Interface

- Use `/omg:*` commands for operational control.
- Keep always-on context thin; heavy procedure belongs in the invoked command, not here.
- Retained deep-work skills are intentionally limited to:
  - `$plan`
  - `$execute`
  - `$prd`
  - `$ralplan`
  - `$research`
  - `$context-optimize`

## Default Flow

- On non-trivial work: `intent` -> `workspace` -> `team-assemble` -> `interview` (if flags present) -> `team-plan` -> `team-prd` -> `taskboard` -> `team-exec` -> `team-verify` -> `team-fix`.
- Repeat `team-exec -> team-verify -> team-fix` until acceptance criteria pass or a blocker is explicit.
- Use `loop` when unfinished work still has a valid next slice.

## Workflow State: Interviewing

- **Entry**: Triggered via depth flags (`--essential|--standard|--deep`) on `/omg:intent`.
- **Hold**: All automated implementation pipelines are blocked while in this state.
- **Agent**: `interview` is the exclusive agent active during this state.
- **Persistence**: Dialogue state, confirmed facts, and the `ready_to_run_prompt` must be saved to `.omg/state/interview-context.json`.
- **Meta-commands**: Support `$intent-status`, `$intent-restart`, `$intent-help`, `$intent-resume`, and `$intent-done` within the interview loop.
  - **State-Driven**: These commands are operational interfaces for `.omg/state/interview-context.json`. They must derive their output directly from the file.
  - **Status/Resume**: Must `read_file` the JSON and display the current `clarity_score`, `facts`, and `ready_to_run_prompt`.
  - **Restart**: Must physically delete the JSON file to ensure a 100% clean state reset.
- **Exit**: Transition to `ready_to_execute` once the depth-specific Clarity Score is met or `$intent-done` is issued. A final PRD artifact must be generated.

## Intent Pinning Pattern

- **Handoff Accuracy**: Every `/omg:*` command recommendation **MUST** include the `--intent="[Core Objective]"` flag to prevent context drift between agents.
- **North Star**: Receiving agents use the `--intent` flag as their primary directive, overriding background noise.

## Context and State

- Read only files needed for the current step and summarize before handoff.
- Persist state only when the active command needs it under `.omg/state/*`, `MEMORY.md`, `.omg/memory/*`, `.omg/rules/*`, `.omg/hooks/*`, or `.omg/notify/*`.
- **Single Source of Truth**: `.omg/state/interview-context.json` is the **exclusive** reference for the Socratic gateway. 
  - **Smart Synchronization**: Agents should only `read_file` the state at **entry points** (start of a new command session or processing `$intent-*` magic words) to ensure alignment with the physical file. 
  - **In-Loop Efficiency**: During a continuous dialogue loop, the agent may trust its internal conversation history to minimize redundant tool calls, unless an external change or inconsistency is detected.
  - **Implicit Adoption**: When a read occurs, the file's data is immediately adopted as the absolute current state, overriding any stale internal context without unnecessary comparison.
  - **Update Policy**: Only update the file (`write_file`) when a tangible change (new facts, score update, or command shift) is detected.
- Prefer stable task IDs, workspace lane labels, lane-health summaries, and compact evidence pointers over repeating raw diffs in chat.
- Keep successful delegated handoffs terse; expand only when execution stops early, blocks, or crosses lane boundaries.
- `GEMINI.md` is the thin extension entrypoint; `context/omg-core.md` is the imported shared baseline.

## Command Response Contract

- Keep `/omg:*` outputs concise and operator-facing.
- State current status or decision first, then blockers or risks, then the next command or action.
- Use tables only for matrices or comparisons.
- Mention validation evidence and persisted files only when relevant.

## Safety

- Do not start implementation when scope or acceptance criteria are missing.
- Never claim completion without validation evidence.
- Never mark work done when open taskboard items, lane-health blockers, or missing verifier signoff remain.
- Isolate dirty or untrusted worktrees before autonomous review, verification, or script-heavy guidance.
- Re-enter safety checks after blocked agent continuations before resuming quality or optimization hooks.
- Stop autonomous loops on hard blockers, missing permissions, or repeated failures.
- Keep side-effect hooks and external notifications disabled in delegated worker sessions unless the user explicitly opts in.
