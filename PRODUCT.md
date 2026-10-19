# Pi Workbench

## Platform and purpose

A separate OpenCode-style terminal frontend for the existing Pi coding agent, verified locally on Windows with Bun. TypeScript and OpenTUI provide the interface; Pi's JSONL subprocess protocol supplies the engine. The installed Pi configuration, credentials, tools, extensions, and selected project remain authoritative. Secrets are not copied into this project.

## Current scope

The expanded interface implements streaming Markdown conversation, user prompt panels, interleaved expandable tools and output, reasoning visibility, response metadata, session tabs, and a project/branch footer. Searchable pickers cover commands, models, saved sessions, files, thinking levels, settings, themes, and conversation forks. Session actions use real Pi persistence: new, resume, import, clone, fork, rename, compact, and tab switching.

The multiline composer supports history, slash and file completion, UTF-8 project-file references, preserved drafts during generation, explicit steering, and follow-up commands. Cancellation clears queued messages and restores their text. Extension confirmations/selections use explicit pickers; input/editor dialogs preserve whitespace and the prior draft. The context sidebar shows backend session/context/token/cache/cost data and extension widgets. Dark/light themes, external editing, clipboard copy, shell output, and HTML/Markdown/JSONL export are available. A clearly labeled local demo needs no model request.

All 24 installed Pi built-ins are represented through frontend handlers or native Pi handoff. Dynamic extension commands, skills, and templates come from Pi at startup; unknown slash commands are rejected locally. A read-only probe found 39 models and 51 dynamic commands on this machine; these are observed installation counts, not fixed product limits.

## Visual authority

The user's supplied screenshot is the primary layout authority, with OpenCode v2 and installed OpenCode 2.0.32 as the reference. Follow its terminal composition: conversation at left, compact context at right, session tabs above, rectangular composer below, and project/status footer. Keyboard operation is primary. See [DESIGN.md](DESIGN.md) and [the feature inventory](docs/feature-inventory.md).

## Engine boundaries

This is a frontend expansion, not full OpenCode product parity. The sidebar reads configured Codex, OpenCode Go, and CommandCode quota data from the installed OpenCode Usage Limits plugin settings; other provider adapters remain unsupported. Images, embedded terminals, OpenCode's server/plugin API, enforced Plan-agent permissions, and working-tree undo/redo are not implemented. Code and diffs are readable without full language-aware highlighting. Pi custom terminal components require native handoff.

Native-only commands are prefilled in Pi's own TUI for the user to execute. On return, Workbench reconnects to the original persisted session; switching sessions inside native Pi does not replace that return target. An unsaved empty session has no persisted return file. Preferences and open tabs last for the running app. External-editor environment variables name an executable, not a shell command with flags.

## Verification limits

Protocol/state, command/session behavior, native render and keyboard behavior, dialogs, Markdown, workspace/session fixtures, shutdown, and read-only Pi discovery have verification coverage. Live model generation and file-changing ERP tools remain untested. No ERP files were changed during development. One symlink-escape fixture is skipped on Windows because junction creation was denied; file-reference handling checks real paths. See [README.md](README.md) for commands and verification details.
