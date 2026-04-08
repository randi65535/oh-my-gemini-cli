---
name = "tmux"
description = "Connect to, manage, and automate tmux terminal sessions from within Gemini CLI."
---

## Purpose

Use this skill when the user needs to work with tmux sessions: listing, attaching, creating, killing, or sending commands to terminal sessions.

## Trigger

- User asks to connect to a tmux session or terminal
- User wants to list or manage running tmux sessions
- User wants to run a long-lived background process in an isolated terminal
- User wants to send commands to or inspect a running terminal pane

## Workflow

1. Detect whether tmux is installed (`which tmux` or `tmux -V`).
2. List existing sessions (`tmux ls`) and report the current state.
3. Parse the user's intent:
   - **Connect / attach**: identify the target session by name or index and run `tmux attach-session -t <target>`.
   - **Create new session**: run `tmux new-session -d -s <name>` (detached) so it persists after Gemini CLI exits.
   - **Kill session**: confirm the target, then run `tmux kill-session -t <target>`.
   - **Send command**: run `tmux send-keys -t <target> "<command>" Enter`, then capture output with `tmux capture-pane -p -t <target>`.
   - **Inspect panes/windows**: use `tmux list-windows -t <target>` and `tmux list-panes -t <target>`.
4. Confirm each destructive action with the user before proceeding.
5. After the operation, list sessions again to show updated state.

## Output Template

```markdown
## tmux State
- installed: yes/no
- server running: yes/no
- sessions: <count>

## Sessions
| # | Name | Windows | Attached |
|---|------|---------|----------|
| 0 | main | 3 | yes |

## Action Taken
- command: `tmux attach-session -t main`
- result: ...

## Next Steps
- ...
```

## Notes

- Gemini CLI runs inside a non-interactive pseudo-terminal, so `tmux attach-session` transfers control to the tmux session's TTY. Warn the user that this will leave the Gemini CLI session.
- Use `tmux new-session -d` (detached mode) when creating sessions so the background process persists.
- To run a multi-step shell workflow inside a session, prefer `tmux send-keys` in sequence over a single compound command.
- Escalate to `/omg:tmux status` to show full session and pane details.
- Use `$execute` for coding tasks that need to be run inside a specific tmux session.
