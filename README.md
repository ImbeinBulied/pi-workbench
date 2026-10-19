# Pi Workbench

An OpenCode-style terminal frontend powered by Pi. The expanded interface follows the supplied screenshot and OpenCode 2.0.32. It runs separately from Pi's normal TUI.

## Install on Windows

Install Bun 1.3.14+, Node.js/npm, Git, and Pi first. Configure your provider/model in Pi, then:

```powershell
git clone https://github.com/ImbeinBulied/pi-workbench.git
cd pi-workbench
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
```

The installer restores the locked dependencies and registers a per-user `piw` launcher under `%LOCALAPPDATA%\Programs\PiWorkbench\bin`, adding that directory to your user PATH once. Reopen your terminal after installation. Keep the checkout in place: the launcher points to it. Rerun the installer after moving the checkout. For an offline launcher refresh, use `-SkipDependencies`; `-NoPath -InstallDirectory C:/your/bin` creates a launcher without changing PATH.

```powershell
piw doctor
cd C:/path/to/your/project
piw
```

`piw doctor` checks Bun compatibility and Pi launcher availability without starting Pi or opening the TUI. It checks for optional Pi settings/authentication, OpenCode usage-card configuration, and the DeepSeek tracker by file presence only. It never reads or prints credentials and does not verify model access, provider connectivity, or the contents of those files. Missing optional files do not cause a failure; missing Bun compatibility or Pi does.

Usage cards and DeepSeek pricing reuse your existing local OpenCode/DSH setup. Their configuration, credentials, and external tracker are not bundled. The rest of the UI works without those integrations. On macOS/Linux, restore with `npm ci` and run `bun src/cli.ts` from your project, using an absolute path to the checkout entry point.

## Run

The global shortcut is `piw`. Run it inside a project folder, or pass a folder:

```powershell
piw
piw C:/path/to/your/project
piw --demo
piw --help
```

Open PowerShell in this directory:

```powershell
./start.ps1 -Demo
./start.ps1 -Project C:/path/to/your/project
```

Or run with Bun directly:

```powershell
bun src/cli.ts --demo
bun src/cli.ts C:/path/to/your/project
```

To restore dependencies, run `npm ci`. Use Bun 1.3.14+ to run the app (verified with 1.4.3 on Windows x64). Node 24 can install packages, but cannot run this OpenTUI version.

Live mode launches Pi through its managed wrapper at `~/.pi/agent/bin/pi-launcher.js`, which resolves Pi's current release every time PiW starts or reconnects. Updating Pi therefore needs no PiW rebuild or reinstall. If Pi is updated while PiW is already open, run `/reload` or restart PiW to reconnect with the new release; a running Pi process cannot switch versions in place. On other setups set `PI_CLI_PATH` to Pi's JavaScript CLI entry point or native executable. Unix also supports `pi` on PATH. Configure credentials and your preferred model through Pi itself before using live mode. Your existing Pi tools and extensions run with their normal permissions in the selected project folder.

## Controls

| Key | Action |
| --- | --- |
| Enter | Send |
| Shift+Enter | New line (terminal must report modified Enter) |
| Escape | Cancel generation or extension dialog |
| Ctrl+B | Toggle context sidebar |
| Ctrl+N | Start a new session |
| Ctrl+P | Search commands |
| Ctrl+X, then M | Search and select a model |
| Ctrl+X, then L | Search saved sessions |
| Ctrl+X, then T | Select a terminal theme |
| Ctrl+X, then H | Show commands and shortcuts |
| Ctrl+X, then E | External editor |
| Ctrl+X, then X | Export |
| Ctrl+T | Set thinking level |
| Ctrl+Tab | Next open session tab |
| Ctrl+Enter | Queue the draft as a steering message |
| Up / Down | Prompt history, or picker/completion selection |
| Tab | Complete slash command or @file prefix |
| PgUp / PgDn | Scroll conversation |
| Ctrl+C | Close frontend and Pi subprocess |

`/theme` includes all 33 named built-in themes listed in the current OpenCode v2 docs, alongside Workbench Dark, Light, and Solarized Dark. Hover or arrow through the list to preview themes; Esc restores the previous theme. OpenCode's `system` theme follows terminal-native colors dynamically; Pi Workbench uses fixed palettes, so that option is not included.

The sidebar hides below 90 columns and stays fixed without its own scrollbar. It puts the session name above a compact Pi card with cost, current/total context, token/cache use, tool calls, and messages. A new session takes its name from its first successful prompt. Configured Codex, OpenCode Go, and CommandCode cards still come from `~/.config/opencode/usage-limits.jsonc`; the DeepSeek peak/off-peak line at the bottom reads the same local DSH tracker used by `~/.config/opencode/deepseek-peak.mjs` and refreshes once a minute. A draft typed during generation is preserved; Ctrl+Enter queues it as steering, or use `/followup text` for delivery after the run. Esc clears queued messages, restores their text, and cancels. Extension confirmations and selections use explicit pickers; input/editor dialogs preserve whitespace and restore your prior draft. Long text dialogs scroll.

## Commands

Type `/` for autocomplete, or Ctrl+P for the command palette. All 24 installed Pi built-ins and Workbench commands are listed once, together with dynamically discovered extension commands, skills, and templates. Extensions override same-named Pi built-ins. On this machine the read-only probe found 39 models and 51 dynamic commands; the app reloads the actual list at startup.

`/model` opens a searchable picker grouped by provider; `/model provider/model-id` selects directly. `/sessions` lists saved sessions for this project; `/resume` remains an unlisted compatibility spelling. `/new`, `/clone`, `/fork`, `/name`, `/session`, `/compact`, `/thinking`, `/settings`, `/copy`, `/export`, and `/import` have frontend handlers. Each open session tab owns an independent Pi process, so you can start a run and switch tabs or open another session while it continues. Tabs show `…` for running, `•` for unread output, and `!` for a pending dialog. Each tab retains its draft and scroll position; a background extension question waits for its tab. Cancel a running session before closing its tab. Empty tabs close automatically when you open another session, unless they contain an unsent draft. To resume a known file on launch use `./start.ps1 -Project C:/project -Session C:/path/session.jsonl`.

`/login`, `/logout`, `/trust`, `/share`, `/bug`, `/scoped-models`, `/changelog`, and `/tree` offer native Pi in the same terminal, with the requested command prefilled. Press Enter there to run it; `/quit` returns to Workbench and reloads the session. `/reload` restarts the Pi connection against the current saved session. `/native` opens native Pi directly. Native-only command strings are never sent to a model.

`!command` runs through Pi's shell API and streams output. `@path/to/file` or `@"path with spaces"` attaches UTF-8 text; `/files` browses project files. References stay within the project, reject binary files, and are limited to 1 MB each. Invalid references preserve the draft. `/export out.md` writes Markdown; `.jsonl` copies the persisted session; HTML uses Pi's exporter. Markdown/JSONL exports refuse to overwrite existing files.

See [the parity inventory](docs/feature-inventory.md) for the implementation and backend boundaries.

Streaming text/tool deltas are reduced immediately and redraws are batched at 16 ms. Unchanged message rows and the active Markdown renderer are reused. Already-unread background output does not redraw the active conversation unless its tab status changes. Usage-card polling runs only for the foreground session. Full conversation virtualization is not implemented.

## Verification

`bun test` covers protocol/state, command dispatch, session-operation races, native keyboard/render behavior, dialogs, Markdown, file references/session fixtures, shutdown, and setup/doctor behavior. It does not require an installed Pi or access to your Pi settings locks. The separate `bun run test:integration` starts installed Pi and makes read-only RPC requests, including checking independent session IDs for two concurrent Pi processes; it requires Pi and access to its settings locks and does not send a model prompt.

`npm run check` checks TypeScript. `bun run preview` captures wide and narrow native render frames as SVG and text, using clearly marked sample content.

## Boundaries

This is a substantial frontend expansion, not complete OpenCode product parity. The quota cards are read from the configured OpenCode plugin settings and support Codex, OpenCode Go, and CommandCode; they do not come from Pi RPC. Other plugin providers are not integrated yet. Code blocks and diffs are readable, but do not yet have full language-aware syntax highlighting. Image attachments, embedded terminals, OpenCode's plugin API, and enforced Plan-agent permissions are not implemented. `/undo` and `/redo` explain the backend boundary; they do not reset working-tree files. Native Pi custom terminal components require the native handoff.

Native handoff reloads the original persisted session; changing to a different session inside native Pi does not change which original session Workbench reloads. Unsaved empty sessions have no file to return to. Preferences and open tabs currently last for the running app. External editor variables must name an executable path; shell fragments such as `code --wait` are not parsed.

Live model generation and file-changing tools remain untested. One symlink-escape fixture is skipped on Windows because creating junctions was denied; the implementation checks real paths. No ERP files were changed during development.

The native-Pi handoff was exercised with `/hotkeys` and `/quit`, returning successfully without a model call. OpenTUI emits a raw-mode cleanup warning in Codex's Windows PTY; the app recreates its renderer rather than relying on the failing suspend/resume path, and still returns successfully.
