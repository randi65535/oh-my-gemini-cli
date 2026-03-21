# Changelog

All notable changes to oh-my-gemini-cli are documented here.

## Release Timeline

| Version | Date | Theme | Outcome |
| --- | --- | --- | --- |
| `v0.4.2` | 2026-03-21 | Skills/footer compatibility alignment | Added slash-friendly `omg-plan` skill alias and documented Gemini CLI v0.34 skill/footer UX with version-gated guidance |
| `v0.4.1` | 2026-03-20 | Usage monitor runtime knobs | Added quiet-hook output control and state-root override for safer, less noisy long sessions |
| `v0.3.9` | 2026-03-12 | Workspace hygiene and hook symmetry | Added lane-health auditing, hook lifecycle symmetry rules, and quieter delegated handoffs for safer long sessions |
| `v0.3.8` | 2026-03-11 | Workspace and taskboard control | Added extension-native workspace lane mapping and verifier-backed taskboard workflows for lighter long-session orchestration |
| `v0.3.7` | 2026-03-10 | Load surface cleanup | Fixed root context wiring, removed mirrored control-plane skills, and slimmed repeated command boilerplate |
| `v0.3.6` | 2026-03-10 | Notification routing | Added extension-native notification profiles, event routing, and safe external-delivery boundaries for long-running OmG sessions |
| `v0.3.5` | 2026-03-04 | Dynamic Agent Team Assembly | Added approval-gated dynamic team composition with new director/consultant/editor roles and model-aware lane policy |
| `v0.3.4` | 2026-02-28 | Deterministic hook orchestration | Added extension-native hook commands/skill with event-lane policy, safety validation, and dry-run testing |
| `v0.3.3` | 2026-02-28 | Claude-style memory management | Added file-based memory index/topic split and modular rule-pack workflows |
| `v0.3.2` | 2026-02-26 | HUD visibility controls | Added extension-native HUD profile commands/skill and status rendering policy |
| `v0.3.1` | 2026-02-26 | Intent/loop guardrail expansion | Added intake gate, loop enforcement, deep init, and conditional rule injection workflows |
| `v0.3.0` | 2026-02-25 | Workflow and mode expansion | Added stage pipeline commands, autonomous modes, and lifecycle controls |
| `v0.2.0` | 2026-02-24 | Extensions-first rebuild | OmG moved to Gemini CLI's official extension primitives |
| `v0.1.4` | 2026-02-23 | Runtime integration hardening | MCP/server wiring and status observability improved |
| `v0.1.3` | 2026-02-23 | Installation path stabilization | GitHub-based install flow documented as default path |
| `v0.1.2` | 2026-02-22 | Model/branding consistency | `gemini-3.1-*` naming and OmG branding normalized |
| `v0.1.1` | 2026-02-22 | Dashboard redesign | Retro game-style TUI and richer telemetry presentation |
| `v0.1.0` | 2026-02-22 | Initial release | Multi-agent orchestration foundation shipped |

## v0.4.2 - Skills and Footer Compatibility Alignment (2026-03-21)

Aligned OmG docs and skill surface with recent Gemini CLI v0.34-era UX updates around slash skill invocation and footer customization, while keeping stable-channel guidance explicit.

### Added

- New slash-friendly planning alias skill:
  - `skills/omg-plan/SKILL.md`

### Changed

- README, Korean README, and landing page now document:
  - direct skill invocation via `/skill-name`
  - skill refresh flow via `/skills reload`
  - footer customization via `/footer` and `ui.footer.*` configuration keys
- Added explicit version gating:
  - stable baseline: Gemini CLI `v0.33.0+`
  - newer skill/footer UX: Gemini CLI `v0.34.0-preview.0+`
- Added collision guidance for native `/plan` vs OmG planning skill invocation (`/omg-plan` / `$omg-plan`).
- Extension/package version bumped to `0.4.2`.

### Structural Fit Note

- OmG remains extension-native; no runtime daemon or background worker was introduced.
- This release focuses on compatibility clarity and naming-surface safety for newer Gemini CLI UX.

## v0.4.1 - Usage Monitor Runtime Knobs (2026-03-20)

Added lightweight runtime controls to the built-in AfterAgent usage monitor so long sessions can reduce noise and redirect state persistence without changing the core extension flow.

### Added

- New usage-monitor runtime environment controls:
  - `OMG_HOOKS_QUIET=1` to suppress non-essential hook status output
  - `OMG_STATE_ROOT=<dir>` to store `quota-watch.json` outside the default `.omg/state` path

### Changed

- `hooks/scripts/after-agent-usage.js` now resolves state storage via `OMG_STATE_ROOT` when set.
- Usage monitor state writes are now fail-open to avoid blocking parent workflow execution on local I/O failures.
- README, Korean README, and hook engineering guide updated with v0.4.1 runtime knob documentation and examples.
- Extension/package version bumped to `0.4.1`.

### Structural Fit Note

- OmG remains extension-native; no new runtime daemon or background process was introduced.
- Changes are scoped to hook runtime behavior and documentation for safer, quieter operation in long-running sessions.

## v0.3.9 - Workspace Hygiene and Hook Symmetry (2026-03-12)

Adapted OmG's extension-side orchestration to recent upstream Gemini CLI changes around dirty worktree safety, hook lifecycle consistency, and subagent policy/handoff clarity without adding runtime daemons or heavier always-on context.

### Added

- New workspace sub-action:
  - `/omg:workspace audit`
- New workspace/taskboard state conventions:
  - lane cleanliness/trust/handoff notes inside `.omg/state/workspace.json`
  - lane-health notes inside `.omg/state/taskboard.md`
- New hook lifecycle policy conventions:
  - blocked and early-finish derived hook signals
  - before/after symmetry and continuation re-entry rules in `.omg/state/hooks.json`

### Changed

- `workspace`, `taskboard`, `doctor`, `intent`, `launch`, and `status` now treat dirty/untrusted lane state as a first-class operational risk.
- `hooks`, `hooks-init`, `hooks-validate`, and `hooks-test` now validate lifecycle symmetry and blocked-continuation safety-lane re-entry.
- `team-assemble`, `team-plan`, `team-prd`, `team-exec`, `team-verify`, `team`, `stop`, and `cancel` now keep lane/subagent context explicit while collapsing normal-success verbosity.
- README, Korean README, and landing page updated with workspace audit, hook symmetry, and Gemini CLI `v0.33.0+` compatibility guidance.
- Extension/package version bumped to `0.3.9`.

### Structural Fit Note

- OmG remains extension-native: no runtime daemon, background worker, or terminal hook injector was added.
- Changes are intentionally prompt/state-level so long sessions stay compact and performance-safe.

## v0.3.8 - Workspace and Taskboard Control (2026-03-11)

Added a lightweight control layer inspired by recent worktree-aware planning and stricter completion gates in related harnesses, adapted to OmG's extension-native command/state model.

### Added

- New workspace/taskboard commands:
  - `/omg:workspace`
  - `/omg:taskboard`
- New runtime-state conventions:
  - `.omg/state/workspace.json`
  - `.omg/state/taskboard.md`

### Changed

- `team-plan` now emits stable task IDs, workspace lane hints, and taskboard sync guidance.
- `team-prd`, `team-exec`, and `team-verify` now align acceptance criteria, implementation slices, and verifier evidence to shared task IDs.
- `team`, `team-assemble`, `loop`, and `autopilot` now treat verifier-backed taskboard completion as part of done criteria.
- `launch`, `status`, `checkpoint`, `stop`, `cancel`, `cache`, `optimize`, `intent`, and `doctor` now recognize workspace/taskboard state.
- README, Korean README, and landing page updated with workspace/taskboard flows and cache-stability guidance.
- Extension/package version bumped to `0.3.8`.

### Structural Fit Note

- OmG stays extension-native: no new runtime daemon, background worker, or git wrapper was added.
- Workspace/taskboard state is intentionally compact so long sessions can resume from a stable file anchor instead of replaying verbose chat history.

## v0.3.7 - Load Surface Cleanup (2026-03-10)

Fixed the extension manifest/context chain and reduced duplicated discovery surface so OmG loads through a thinner always-on prompt.

### Added

- New root extension context entrypoint:
  - `GEMINI.md`

### Changed

- `GEMINI.md` now imports `context/omg-core.md`, matching the manifest's `contextFileName`.
- `context/omg-core.md` trimmed to stable runtime rules only.
- Mirrored control-plane skills were removed; retained skills are now:
  - `$plan`
  - `$execute`
  - `$prd`
  - `$ralplan`
  - `$research`
  - `$context-optimize`
- High-traffic `/omg:*` commands were shortened by removing repeated output-format boilerplate.
- `doctor` diagnostics now validate the real context import chain and retained skill set.
- Extension/package version bumped to `0.3.7`.

### Structural Fit Note

- OmG is now explicitly slash-command-first for operational control.
- Deep-work skills remain available, but overlapping command/skill mirrors were intentionally removed to shrink startup discovery overhead.

## v0.3.6 - Notification Routing (2026-03-10)

Added an extension-native notification policy layer so OmG can surface approvals, verification failures, blockers, checkpoints, and idle drift without depending on custom CLI flags.

### Added

- New notification command and skill:
  - `/omg:notify`
  - `$notify`
- New runtime-state conventions:
  - `.omg/state/notify.json`
  - `.omg/notify/*.md`

### Changed

- `context/omg-core.md` updated with notification controls, persisted state conventions, and worker-session notification safety rails.
- README, Korean README, and landing page updated with notification profile, channel, and activation guidance.
- Extension/package version bumped to `0.3.6`.

### Structural Fit Note

- OmG notification routing remains extension-native and policy-driven.
- Actual desktop/webhook delivery is intentionally delegated to Gemini host hooks, shell adapters, or project-specific bridges.

## v0.3.5 - Dynamic Agent Team Assembly (2026-03-04)

Added an approval-gated dynamic team composition layer so OmG can assemble fit-for-task rosters before stage execution.

### Added

- New team assembly command and skill:
  - `/omg:team-assemble`
  - `$team-assemble`
- New specialist sub-agents:
  - `omg-director`
  - `omg-consultant`
  - `omg-editor`
- New guide:
  - `docs/guide/agent-team-assembly.md`
- New runtime-state convention:
  - `.omg/state/team-assembly.md`

### Changed

- `team` orchestration now supports optional stage-0 dynamic assembly.
- `intent` routing expanded with `team-assemble` classification path.
- `context/omg-core.md` updated with stage-0 lifecycle and roster state conventions.
- README, installation guide, and landing page expanded with team assembly flows, role taxonomy, and model-allocation policy.
- Extension/package version bumped to `0.3.5`.

### Structural Fit Note

- OmG remains extension-native: assembly is prompt/state orchestrated.
- Team collaboration is modeled through explicit handoffs and verify/fix loops, not hidden runtime daemons.

## v0.3.4 - Deterministic Hook Orchestration (2026-02-28)

Added a hook-oriented orchestration layer inspired by additive hook-extension workflows, adapted for Gemini extension-native command/skill/state primitives.

### Added

- New hook command group:
  - `/omg:hooks`
  - `/omg:hooks-init`
  - `/omg:hooks-validate`
  - `/omg:hooks-test`
- New hook control skill:
  - `$hooks`
- New hook engineering guide:
  - `docs/guide/hook-engineering.md`
- New runtime-state artifacts for hook policy and verification:
  - `.omg/state/hooks.json`
  - `.omg/state/hooks-validation.md`
  - `.omg/state/hooks-last-test.md`
  - `.omg/hooks/*.md`

### Changed

- `context/omg-core.md` updated with hook controls, hook state conventions, and worker-session side-effect safety rail.
- README command/skill/docs map expanded with hook workflows.
- Extension/package version bumped to `0.3.4`.

### Structural Fit Note

- OmG hook workflows remain extension-native (prompt/state-driven), not low-level terminal/runtime hook injection.
- Deterministic lanes and validation/test commands provide predictable behavior before autonomous execution loops.

## v0.3.3 - Claude-Style Memory Management (2026-02-28)

Integrated a Claude-style memory model into OmG using a compact root index, topic-split memory files, and path-aware modular rules.

### Added

- New memory command and skill:
  - `/omg:memory`
  - `$memory`
- New memory MCP tools:
  - `memory_bootstrap`
  - `memory_index_sync`
  - `memory_rules_resolve`
  - `memory_build_context`
- New file-based memory/rules guide:
  - `docs/guide/memory-management.md`
- New reusable memory scaffold assets generated by setup/bootstrap:
  - `MEMORY.md`
  - `.omg/memory/*.md`
  - `.omg/rules/*.md`

### Changed

- `omg setup` now bootstraps project memory index/topic/rule files.
- `context/omg-core.md` updated with memory command and runtime memory artifact conventions.
- README and landing docs updated to expose memory workflow in command/skill/interface maps.

### Structural Fit Note

- The memory workflow is implemented within extension-native assets and MCP tooling.
- Rule activation uses frontmatter (`description`, `globs`, `alwaysApply`) for task-conditional loading without bloating base context.

## v0.3.2 - HUD Visibility Controls (2026-02-26)

Added extension-native visual status controls inspired by statusline/HUD workflows from related harness projects.

### Added

- New HUD profile commands:
  - `/omg:hud`
  - `/omg:hud-on`
  - `/omg:hud-compact`
  - `/omg:hud-off`
- New HUD control skill:
  - `$hud`
- New runtime-state artifact for HUD profile persistence:
  - `.omg/state/hud.json`

### Changed

- `/omg:status` now renders a HUD section with visibility policy (`normal`, `compact`, `hidden`).
- `context/omg-core.md` updated with HUD control conventions.
- Local dashboard HUD now supports density toggle with `h` (`normal -> compact -> hidden`), top summary line, and `.omg/state/hud.json` sync.
- Extension/package version bumped to `0.3.2`.

### Structural Fit Note

- Gemini Extensions currently support prompt/command/skill/state-driven visual summaries.
- Direct terminal statusline hook injection remains runtime-specific and outside extension-only primitives.

## v0.3.1 - Intent and Loop Guardrail Expansion (2026-02-26)

Added extension-native guardrail workflows inspired by cross-harness operational patterns.

### Added

- New intake/routing command and skill:
  - `/omg:intent`
  - `$intent`
- New loop enforcement command and skill:
  - `/omg:loop`
  - `$loop`
- New deep repository bootstrap command and skill:
  - `/omg:deep-init`
  - `$deep-init`
- New conditional rule injection command and skill:
  - `/omg:rules`
  - `$rules`
- New runtime-state artifacts for extension-guided persistence:
  - `.omg/state/intent.md`
  - `.omg/state/rules.md`
  - `.omg/state/deep-init.md`
  - `.omg/state/project-map.md`
  - `.omg/state/validation.md`

### Changed

- `context/omg-core.md` updated with intent-gating, conditional-rule, deep-init, and loop-discipline conventions.
- README command/skill map expanded with the new guardrail workflows.
- Extension/package version bumped to `0.3.1`.

### Structural Fit Note

- Extension-manifest primitives can represent policy-oriented orchestration (`commands/`, `skills/`, `context/`) directly.
- Runtime hook workers, background daemons, and low-level event hooks still require separate runtime code beyond extension-only assets.

## v0.3.0 - Workflow and Mode Expansion (2026-02-25)

Added key orchestration capabilities inspired by production usage patterns from related repositories.

### Added

- Stage commands:
  - `team-plan`
  - `team-prd`
  - `team-exec`
  - `team-verify`
  - `team-fix`
- Mode/lifecycle commands:
  - `autopilot`
  - `ralph`
  - `ultrawork`
  - `consensus`
  - `mode`
  - `launch`
  - `checkpoint`
  - `stop`
- New specialist agents:
  - `omg-product`
  - `omg-verifier`
  - `omg-consensus`
- New workflow skills:
  - `$ralplan`
  - `$prd`
  - `$autopilot`
  - `$ralph`
  - `$ultrawork`
  - `$consensus`
  - `$mode`
  - `$cancel`

### Changed

- `team` orchestration switched to stage-based lifecycle with verify/fix loops.
- `status` report expanded to include mode and pipeline stage.
- Core context updated with mode profiles, lifecycle state conventions, and safety rails.
- Extension/package version bumped to `0.3.0`.

## v0.2.0 - Extensions-First Rebuild (2026-02-24)

Reimplemented OmG around Gemini CLI's official Extensions model.

### Added

- Root extension manifest: `gemini-extension.json`
- Extension-first package metadata and files list in `package.json`
- Sub-agent definitions in `agents/`
- Shared extension context in `context/omg-core.md`
- Namespaced extension commands in `commands/omg/`
- Frontmatter-based skills in `skills/`

### Changed

- Installation flow migrated to `gemini extensions install <repo-url>`
- Documentation rewritten for extension-native usage and command naming
- Runtime entry shifted from setup scripts to manifest-driven loading

### Removed

- Legacy root-level command templates that depended on `!{omg ...}` shell execution

### Migration Summary

| Before | After |
| --- | --- |
| Global package + setup copier | Native extension install via `gemini extensions` |
| Script-first runtime bootstrap | Gemini extension manifest bootstrap |
| Mixed onboarding instructions | Single extension-first install path |

## v0.1.4 - Gemini CLI Runtime Integration Hardening (2026-02-23)

### Added

- MCP stdio entry support via `@modelcontextprotocol/sdk` (`--mcp`)
- `--server <state|memory|context|orchestrator>` server-targeted execution
- Extended `omg status` options (`--agents`, `--tasks`, `--cache`, `--cache-history`, `--context`, `--json`)

### Changed

- `omg setup` updated to register all 4 OmG MCP servers in `~/.gemini/settings.json`
- `omg doctor` updated to validate all required OmG MCP server registrations
- Prompt argument wiring adjusted for Gemini CLI compatibility (`-p` path)
- Config loading unified via shared config module flow

### Impact Matrix

| Area | Effect |
| --- | --- |
| MCP interoperability | Better alignment with Gemini CLI runtime expectations |
| Diagnostics | More reliable setup verification and status visibility |
| Automation | Cleaner path for bot-driven execution workflows |

## v0.1.3 - Installation Path Stabilization (2026-02-23)

### Changed

- GitHub install route promoted as the primary onboarding path
- npm registry route kept as optional path
- Gemini CLI package naming corrected in docs (`@google/gemini-cli`)
- Troubleshooting section expanded for install-time `404` errors

### Tooling

- Added package lifecycle scripts (`prepare`, `prepack`) for build consistency

## v0.1.2 - Model and Branding Consistency (2026-02-22)

### Changed

- Model references standardized to `gemini-3.1-pro` and `gemini-3.1-flash`
- Agent label output updated to display full model names
- Project brand text normalized from `OMG` to `OmG`
- Tagline changed to: `Gemini thinks. OmG orchestrates.`

## v0.1.1 - Retro Dashboard Refresh (2026-02-22)

### Added

- Retro game-style dashboard skin and status labels (`ATK`, `WIN`, `KO`, `ZZZ`, `RDY`)
- Agent-specific sprite/icon representation in dashboard panels
- HP/progress bars and party-style member display
- Quest log and battle log visualization updates

### Changed

- Docs moved under `docs/` and linked from repository root README
- Landing preview updated to match retro dashboard visuals

## v0.1.0 - Initial Release (2026-02-22)

### Added

- Core CLI command surface (`setup`, `doctor`, `team`, `status`, `config`, `bot`, `update`)
- Multi-agent orchestration primitives:
  - Agent pool and worker lifecycle
  - Task routing and priority queue
  - Agent registry for architect/planner/executor/reviewer/debugger/researcher/quick roles
- Context-engineering modules:
  - Cache manager
  - Context layering
  - Compaction and prefix optimization
- MCP server set:
  - `omg_state`
  - `omg_memory`
  - `omg_context`
  - `omg_orchestrator`
- Initial docs set (`README`, guides, landing page)

## Compatibility Notes

| Component | Supported path in this repo |
| --- | --- |
| Gemini installation mode | `gemini extensions install ...` |
| Extension metadata source | `gemini-extension.json` |
| Command namespace | `/omg:*` |
| Skill namespace | `$<skill>` from `skills/*/SKILL.md` (for example: `$plan`, `$team`, `$intent`, `$deep-init`, `$loop`, `$hud`, `$memory`) |

## Notes

- Historical details before `v0.1.0` are not tracked.
- For commit-level details, inspect repository git history.
