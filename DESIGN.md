# Terminal design

## Authority and layout

Operate mode: the user's supplied screenshot is the primary visual authority; preserve the OpenCode v2 reference and the installed OpenCode 2.0.32 comparison. Use a near-black canvas, darker sidebar and tab/footer surfaces, a slightly lighter rectangular composer, readable light text, muted secondary labels, and restrained cyan accents. The light theme uses the same structure. Avoid decorative cards and gradients.

Session tabs occupy the top. The conversation scrolls independently above the fixed composer, with user prompt panels, assistant Markdown, optional reasoning, interleaved expandable tool output, and available model/duration/token/rate metadata. The footer identifies the project, Git branch when available, demo state, and extension status. Historical response durations are not invented.

The right sidebar grows from 36 to 44 terminal columns so session and provider cards have room for their labels and usage details. The session name sits above a compact Pi card showing cost, current/total context, token/cache usage, tool calls, and messages. Configured Codex, OpenCode Go, and CommandCode quota cards follow, with extension widget text when present; a DeepSeek peak/off-peak tracker sits at the bottom. The sidebar has no scroll area and hides below 90 columns. Show unavailable provider data clearly; never substitute a fabricated limit or balance.

## Interaction

Enter sends; Shift+Enter adds a newline when the terminal reports modified Enter. During generation, ordinary draft text stays in the composer. Ctrl+Enter queues steering; `/followup text` queues a follow-up. Escape cancels an active run and restores cleared queued text, cancels an extension dialog, or closes the active picker/text overlay. Ctrl+C closes the frontend and Pi subprocess.

Ctrl+P opens command search; Ctrl+X then M opens the model picker, L saved sessions, T themes, H shortcuts, E the external editor, and X export. Ctrl+B toggles the sidebar, Ctrl+N starts a new session, Ctrl+T selects thinking level, and Ctrl+Tab advances through open session tabs. Up/Down navigate single-line prompt history or picker/completion choices; Tab completes slash commands and file prefixes. PgUp/PgDn scroll the conversation; long text overlays support scrolling. [README.md](README.md) is the user-facing control reference.

Pickers use searchable lists and explicit selection. Extension confirm/select dialogs require a choice, while input/editor dialogs retain whitespace and restore the prior draft on completion or cancellation. Files are inserted as project-bound text references; invalid references preserve the draft. Native-only commands use an explicit handoff picker, then Pi's TUI with the command prefilled. Returning reconnects the original persisted session, even if the user switched to another session within native Pi.

## Honest backend presentation

Display backend data and unavailable states directly. OpenCode Plan permissions, file undo/redo, quota APIs for providers beyond Codex/OpenCode Go/CommandCode, arbitrary native Pi terminal components, images, embedded terminals, and complete language-aware code/diff highlighting remain outside the implemented frontend. Native Pi supplies UI that RPC cannot represent; no native-only command is sent as a model prompt. Theme preferences and tabs are currently retained only for the running app.
