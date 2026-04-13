# OmG Core Context

OmG adds a role-driven workflow layer to Gemini CLI.

## Primary Interface

- Use `/omg:*` commands for operational control.
- Keep always-on context thin; heavy procedure belongs in the invoked command, not here.
- Retained deep-work skills are limited to: `$plan`, `$omg-plan`, `$execute`, `$prd`, `$ralplan`, `$research`, `$deep-dive`, `$context-optimize`.

## Default Flow (Hybrid Routing)

- **Entry**: `intent` -> `workspace` (if dirty lanes or multi-root setup needed) -> `team-assemble` (if role fit is unclear).
- **Clarification**: `interview` (if depth flags detected or scope is ambiguous) -> `team-plan` -> `team-prd`.
- **Execution**: `taskboard` -> `team-exec` -> `team-verify` -> `team-fix`.
- **Loop**: Repeat `exec -> verify -> fix` until acceptance. Use `loop` for subsequent slices.
- **Parallel Rule**: Keep immediate blockers on the active lane; delegate only independent sidecar tasks in parallel.

## System Map: Modes, Controls & Agents

- **Operational Modes**: `balanced`, `speed`, `deep`, `autopilot`, `ralph`, `ultrawork`.
- **Control Plane**: `rules`, `memory`, `workspace`, `taskboard`, `deep-init`, `hud`, `hooks`, `notify`, `reasoning`, `approval`, `doctor`, `cancel`.
- **Agent Role Registry**:
  - **Strategy**: `omg-director`, `omg-architect`, `omg-planner`.
  - **Production**: `omg-product`, `omg-consultant`, `omg-editor`.
  - **Execution**: `omg-executor`, `omg-reviewer`, `omg-verifier`, `omg-debugger`.

## Workflow State: Interviewing

- **Entry**: Triggered via depth keywords (`low|medium|high`) on `/omg:intent`.
- **Hold**: All automated implementation pipelines are blocked while in this state.
- **Agent**: `interview` is the exclusive agent active during this state.
- **Persistence**: Dialogue state, confirmed facts, and `ready_to_run_prompt` must be saved to `.omg/state/interview-context.json`.
- **Meta-commands**: Support `$intent-status`, `$intent-restart`, `$intent-help`, `$intent-resume`, and `$intent-done`.

## Intent Pinning Pattern

- **Handoff Accuracy**: Every `/omg:*` command recommendation **MUST** include the `--intent="[Core Objective]"` flag to prevent context drift between agents.
- **North Star**: Receiving agents use the `--intent` flag as their primary directive, overriding background noise.

## Context and State Management

- **Single Source of Truth (SSoT)**: `.omg/state/interview-context.json` is the **exclusive** reference for the Socratic gateway.
  - **Smart Synchronization**: Agents `read_file` the state ONLY at entry points to ensure alignment.
  - **Implicit Adoption**: On read, the file content overrides any stale internal context immediately.
  - **Update Policy**: Update the file (`write_file`) only when tangible changes (facts, score, prompt) occur.
- **Summarization**: Read only files needed for the current step and summarize before handoff.
- **Persistence**: Use `.omg/state/*`, `MEMORY.md`, `.omg/memory/*`, `.omg/rules/*`, `.omg/hooks/*`, or `.omg/notify/*`.

## Execution Discipline

- **Read Before Modify**: Read target files or state first; avoid blind edits.
- **Minimal Diff**: Prefer editing existing files over creating new files unless scope explicitly requires new files.
- **Critical-Path Focus**: Complete immediate blocking work before adding speculative side tasks.
- **Deterministic Queue**: For task execution order, prefer dependency-ready + lane-safe tasks first, then priority (`p0` -> `p3`), then stable task ID.
- **Baseline Integrity**: Keep each active lane anchored to an explicit baseline branch or HEAD snapshot when known; if the baseline drifts unexpectedly, stop and surface the mismatch before continuing implementation or review.
- **Permission Recovery**: If a tool/action is denied, do not retry unchanged; request approval or switch to a safe fallback plan.
- **Agent Recovery**: If a lane agent is unavailable, reroute once to a mapped fallback lane and record why.
- **Concise Success Path**: Keep normal-success reporting compact and expand only blocker or early-stop branches.

## Command Response Contract

- Keep `/omg:*` outputs concise and operator-facing.
- State status/decision first, then blockers/risks, then the next command.
- Use tables only for matrices or comparisons. Mention evidence/persisted files only when relevant.

## Safety & Integrity

- **Pre-requisites**: Do not start implementation if scope or acceptance criteria are missing.
- **Stage Gate**: Keep `team-exec` blocked until both `team-plan` (task graph) and `team-prd` (acceptance criteria) are confirmed.
- **Validation**: Never claim completion or mark work done without verification evidence.
- **Isolation**: Isolate dirty/untrusted worktrees before autonomous review or verification.
- **Lane Anchor Check**: Treat missing or drifted baseline branch/commit anchors as a workflow risk for multi-lane execution, especially before `team-exec`, `team-verify`, or resume handoff.
- **Denied Actions**: Treat denied permissions/tool calls as a workflow event; re-plan or escalate explicitly.
- **Termination**: Stop autonomous loops on hard blockers, missing permissions, or repeated failures.
