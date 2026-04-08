---
name = "parallel"
description = "Decompose independent work into tmux-backed background Gemini CLI shards and synthesize outputs."
---

## Purpose

Use this skill when a task has multiple independent sub-goals that can be safely
executed concurrently in separate background Gemini CLI sessions managed by tmux.

## Trigger

- User asks to run multiple independent research, analysis, or implementation tasks simultaneously
- A task graph contains ≥2 truly independent sidecar tasks with no overlapping file writes
- Throughput is prioritized and the host machine has tmux available

## Prerequisites

- `tmux` installed (verify with `tmux -V`)
- `gemini` CLI available and authenticated (verify with `gemini --version`)
- Tasks must be independent: no overlapping output file paths, no shared git branch writes

## Workflow

1. **Confirm independence**: Explicitly verify shards share no output targets or git state.
2. **Decompose into shards**: Break the goal into 2–4 self-contained, standalone prompts.
3. **Write prompt files**: Save each prompt to `.omg/state/parallel/<session-id>/shard-<n>.prompt.md`.
4. **Create tmux session**: `tmux new-session -d -s <session-id>`
5. **Launch shards**: Send each shard to a tmux window with a completion marker append on exit.
6. **Monitor**: Use `/omg:parallel status <session-id>` to poll progress.
7. **Collect**: Use `/omg:parallel collect <session-id>` once all shards complete.
8. **Synthesize**: Merge shard outputs into a unified summary at `merged.md`.

## Shard Decomposition Guidelines

- Target 2–4 shards per session; larger batches risk host resource exhaustion.
- Each shard prompt must be fully self-contained and reference no files being written by another shard.
- Read-only access to the same files across shards is safe.
- Use descriptive `summary` strings in the state file for clear `status` output.

## Completion Detection

Each shard appends a `SHARD_DONE_<n>` marker to `done.log` on exit:

```bash
gemini -p "$(cat shard-0.prompt.md)" > shard-0.output.md 2>&1; echo SHARD_DONE_0 >> done.log
```

Count completed shards:

```bash
grep -c SHARD_DONE .omg/state/parallel/<session-id>/done.log 2>/dev/null || echo 0
```

## Safety Rules

- Maximum 4 active parallel sessions at once; block new launches when at capacity.
- Never parallelize operations writing to the same output file or git branch.
- Always write outputs under `.omg/state/parallel/<session-id>/` — never to the workspace root.
- Kill stale sessions with `/omg:parallel kill <session-id>` before launching replacements.
- For tasks with sequential dependencies, use `/omg:loop` instead.

## Output Template

```markdown
## Parallel Session
- session-id: omg-par-<id>
- shards: N
- status: launched | running | collected | killed

## Shard Plan
| Shard | Summary | Status | Output File |
| --- | --- | --- | --- |
| 0 | ... | pending | shard-0.output.md |

## Collection Summary
- ...

## Next Command
- /omg:parallel status <session-id>
```

## Notes

- Run `/omg:workspace audit` before launching implementation shards that share a worktree.
- For purely sequential tasks, prefer `/omg:loop` to avoid unnecessary tmux overhead.
- Deactivate this skill once all sessions reach `collected` or `killed` status.
