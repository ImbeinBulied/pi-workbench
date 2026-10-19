# OpenCode-style Pi workbench expansion

Reference: user screenshot and locally installed OpenCode 2.0.32; current upstream `packages/tui/src/routes/session/index.tsx` and official TUI documentation checked 2026-10-18. Theme names also follow [current OpenCode v2 theme docs](https://dev.opencode.ai/v2/docs/themes/), checked 2026-10-19. Implement original code using the existing OpenTUI dependency, retain Pi backend and project data.

## Work
1. Expand state: interleaved tools, thinking, usage/context/cost, elapsed time, model metadata, notifications/widgets, session metadata.
2. Rebuild terminal surface: horizontal session tabs, Markdown conversation, user prompt panels, per-response metadata, tool details/diffs, rectangular composer, context sidebar, real usage, bottom project/status bar; searchable model/session/command/settings/theme dialogs; slash autocomplete, prompt history, navigation shortcuts.
3. Route all installed Pi slash commands explicitly. RPC-supported built-ins use RPC; extensions/skills/templates use discovered `get_commands`. Native-only Pi commands offer a real native-Pi handoff rather than being sent to the model. Implement shell commands, file references, export/copy, sessions/tree/fork/clone and settings.
4. Test native rendering and keyboard interactions, command dispatch, state, session discovery, live read-only Pi connection. Do not send model prompts or modify ERP files during verification.

## Backend boundaries
OpenCode Git undo/redo, remote sharing, provider billing/quota integrations, native Pi extension components, provider login and trust management are not equivalent Pi RPC capabilities. Expose clear native handoff or explicit explanation; never fabricate quota values or claim file undo from a conversation fork. Plan mode cannot be emulated by a cosmetic label. Inventory all commands and document each outcome.

## Shared interfaces
`State` keeps existing fields plus:
- messages: `{role:'user'|'assistant';text:string;thinking?:string;model?:string;provider?:string;durationMs?:number;outputTokens?:number}[]`
- tools: existing fields plus `messageIndex?:number;output?:string;diff?:string`
- stats: `{input:number;output:number;cacheRead:number;cacheWrite:number;cost:number;contextTokens:number|null;contextWindow:number;contextPercent:number|null}`
- commands: `{name:string;description:string;source:string}[]`
- tabs: `{id:string;name:string;path:string}[]`
- sessionId, sessionFile, workspaceBranch strings; widgets `Record<string,string[]>`; showThinking boolean; showDetails boolean; theme includes all 33 named OpenCode v2 built-ins and Workbench Dark/Light/Solarized Dark; pendingCount number.
New fields initialized by initialState. Metadata on existing messages/tools stays optional.

`mount(renderer,state,actions)` keeps current API, actions.action accepts string. Returns current editor/update/openDialog/closeDialog plus `choose(title:string, items:{name:string;description:string;value:string}[], onPick:(value:string)=>void):void`, `showText(title:string,text:string):void`, `toggle(name:'sidebar'|'details'|'thinking'):void`. Picker owns focus until dismissed and searches names/descriptions. Slash completion reads state.commands, invokes actions.submit with selected full slash command, keeps arguments intact. Session tab click invokes actions.action('tab:'+path); Ctrl+Tab cycles tabs. Regular ctrl+p opens command palette; model picker via /model or Ctrl+X M; Ctrl+B sidebar retained.

`commands.ts`: exports `builtinCommands` list of `{name,description,source}` and `parseInput(text:string,discovered:Command[]): {kind:'builtin';name:string;args:string}|{kind:'extension';text:string}|{kind:'shell';command:string}|{kind:'prompt';text:string}|{kind:'unknown';name:string}`. Aliases normalized. No execution or state dependency. Every Pi built-in appears, native-only still builtin. Extension name conflicts: discovered extensions take precedence over builtin names (Pi's own behavior).

`workspace.ts`: exports async `listSessions(cwd:string):Promise<{id:string;name:string;path:string}[]>`, `listFiles(cwd:string):Promise<string[]>`, `expandReferences(text:string,cwd:string):Promise<string>` (only explicit @file, max 1MB/file; binary rejected; never expand email addresses). All paths explicit and escaped, no shell interpolation.

Execution continues under user's instruction; tasks have separate file ownership. Root owns main.ts, pi.ts, docs and integration. Each module author runs failing tests before implementation and verifies changes. No commits or changes to ERP.
