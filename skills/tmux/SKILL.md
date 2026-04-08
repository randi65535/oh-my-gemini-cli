---
name = "tmux"
description = "Automatically fan-out independent tasks to parallel background tmux windows and aggregate results."
---

## Purpose

Use this skill when multiple independent shell tasks need to run at the same time without blocking the Gemini CLI session. tmux windows are the execution substrate: each task gets its own window, all start simultaneously in the background, and results are collected once everything finishes.

## Trigger

- User wants to run multiple commands in parallel in the background
- A task list has independent items with no dependency between them
- Long-running processes (build, test, lint, install) should not block the current session
- `team-exec` or `ultrawork` has sidecar-parallelizable tasks that can be offloaded

## Workflow

1. **Verify tmux**: `which tmux` or `tmux -V`. Abort with install instructions if missing.
2. **Parse tasks**: split the input on `;;` to get an ordered list of commands.
3. **Create session**: `tmux new-session -d -s omg-parallel-YYYYMMDD-HHMMSS`
4. **Dispatch in parallel**:
   - Window 0 gets task 0 (rename to `job-0`).
   - For each additional task i, run `tmux new-window -t <session> -n job-<i>` then `tmux send-keys ... Enter`.
   - All windows fire at the same instant — fully parallel, fully background.
5. **Return immediately** after dispatch. Report the session name and a `/omg:tmux status` command to poll.
6. **Poll** (via `status`): inspect `pane_current_command` per window to detect running vs. finished.
7. **Collect** (via `collect`): capture full pane output per window, report ✅/❌ per job.
8. **Clean** (via `clean`): kill the session once all jobs are done.

## Output Template

```markdown
## Dispatch
- session: omg-parallel-20260408-142300
- jobs: 3

| job   | command                        |
|-------|-------------------------------|
| job-0 | npm run test                  |
| job-1 | npm run lint                  |
| job-2 | npm run build                 |

All 3 jobs started in background. Session is detached.

## Poll
`/omg:tmux status omg-parallel-20260408-142300`

## Collect results when done
`/omg:tmux collect omg-parallel-20260408-142300`
```

```markdown
## Results — omg-parallel-20260408-142300

| job   | result | last output                          |
|-------|--------|--------------------------------------|
| job-0 | ✅     | All tests passed (42/42)             |
| job-1 | ✅     | No lint errors found                 |
| job-2 | ❌     | Error: module not found              |

Summary: 2 succeeded / 1 failed
```

## Notes

- Use `;;` as the task separator in `/omg:tmux run`.
- Sessions are scoped under `omg-parallel-*` prefix — user sessions are never touched.
- This skill is the preferred execution backend when `team-plan` marks tasks as `sidecar parallelizable`.
- For sequential tasks with dependencies, keep using `team-exec` with `loop`.
- Use `$execute` for single-task code changes; use `$tmux` when you need to run N independent jobs at once.
