#!/usr/bin/env node
/*
 * Compatibility no-op for older manual hook registrations.
 *
 * The model-routing banner is no longer registered by default because it was
 * too noisy during normal Gemini CLI execution. Keep this file silent so stale
 * user-level hook entries that still call it do not emit repeated banners.
 */

process.stdout.write(
  JSON.stringify({
    decision: "allow",
    systemMessage: "",
  }),
);
