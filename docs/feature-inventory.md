# UI and command inventory

Compared against installed OpenCode **2.0.32**, the supplied screenshot, [current upstream session UI](https://github.com/anomalyco/opencode/blob/dev/packages/tui/src/routes/session/index.tsx), and [official TUI commands](https://opencode.ai/docs/tui/), checked 2026-10-18.

## Interface

| Surface | Result |
| --- | --- |
| Session tabs and project/branch footer | Implemented; independent per-tab Pi processes, concurrent runs, mouse/keyboard switching, busy/unread/dialog indicators, retained drafts and scroll positions |
| User prompt panels and assistant transcript | Implemented; rendered Markdown, links, lists, code, reasoning visibility; batched streaming redraws and retained message/Markdown nodes |
| Response model/duration/tokens/rate | Implemented from backend metadata and local monotonic timing; no invented historical duration |
| Tool activity/output/diffs | Interleaved by message, expandable; full language-aware diff highlighting remains absent |
| Composer | Multiline, history, draft preservation, file/slash completion, steering queue |
| Searchable pickers | Commands, models, sessions, files, thinking levels, settings, theme, fork |
| Sidebar | Session name and compact Pi cost/context/token/tool/message card, quota cards, extension widgets, DeepSeek peak tracker; responsive with no sidebar scrollbar |
| Usage-limit cards from screenshot | Pi has no equivalent quota API. No balances/percentages fabricated; extensions can supply widgets |
| Extension interactions | Confirm/select/input/editor, notify/status/widgets/title; explicit cancellation/timeouts |
| Themes | All 33 named OpenCode v2 built-ins plus Workbench Dark, Light, and Solarized Dark; hover/keyboard preview with cancel restore. OpenCode's terminal-adaptive `system` theme is not supported by this fixed-palette renderer. |
| External editor, clipboard, HTML/Markdown/JSONL export | Implemented |
| Full OpenCode server/plugin/agent UI | Not implemented; this frontend uses Pi's engine and protocol |
| Native Pi custom TUI components | Native Pi handoff; RPC cannot render arbitrary Pi terminal components |
| OpenCode Git undo/redo and enforced Plan mode | Explained explicitly; no unsafe imitation or automatic working-tree reset |
| Images and embedded terminals | Not implemented |

## Every installed Pi built-in

| Command | Execution |
| --- | --- |
| `/settings` | Workbench settings; native option for full Pi settings |
| `/model` | Searchable models; `set_model` |
| `/tree` | Native Pi tree navigation |
| `/thinking` | Actual available levels; `set_thinking_level` |
| `/scoped-models` | Native Pi |
| `/export` | Pi HTML or local Markdown/JSONL |
| `/import` | Load JSONL with `switch_session` |
| `/share` | Native Pi; no automatic publication |
| `/bug` | Native Pi; no automatic report |
| `/copy` | Host clipboard with terminal fallback |
| `/name` | `set_session_name` |
| `/session` | Actual session stats |
| `/changelog` | Native Pi |
| `/hotkeys` | Workbench shortcuts and available commands |
| `/fork` | Actual user-message picker and Pi `fork` |
| `/clone` | Pi `clone` |
| `/trust` | Native Pi |
| `/login` | Native Pi |
| `/logout` | Native Pi |
| `/new` | Pi `new_session`; cancellation respected |
| `/compact` | Pi `compact` |
| `/sessions` | Discover project sessions and Pi `switch_session` (`/resume` is an unlisted compatibility spelling) |
| `/reload` | Reconnect with current session; rediscover resources |
| `/quit` | Shut down Pi and renderer |

Workbench-only commands: `/theme`, `/details`, `/sidebar`, `/editor`, `/native`, `/files`, `/queue`, `/followup`, `/abort`, `/build`, `/plan`, `/undo`, and `/redo`. Each slash action appears once under its canonical name; duplicate spelling aliases are omitted. `/build`, `/plan`, `/undo`, and `/redo` explain the engine boundary rather than claiming OpenCode permissions or file-history features.

Dynamic commands from extensions, skills, and templates are loaded from Pi `get_commands`, including extension overrides. Unknown slash commands are rejected locally rather than becoming a model prompt.
