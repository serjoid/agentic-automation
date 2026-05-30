# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome Extension (Manifest V3) that enables AI-powered browser automation via a side panel chat interface. The AI agent can navigate pages, click elements, type text, execute JavaScript, and interact with the DOM. The LLM API (DeepSeek, OpenAI, LM Studio, or Ollama) is called **directly from the Service Worker via `fetch`** — there is no Native Messaging Host.

## Development

No build step is required. This is vanilla JavaScript loaded directly into Chrome.

**To run/test:** Open `chrome://extensions`, enable Developer Mode, click "Load unpacked", and select this directory. After code changes, click the refresh icon on the extension card.

**Minimum Chrome:** 114

## Architecture

The extension has three runtime components that communicate via `chrome.runtime.sendMessage`:

### `background.js` — Service Worker (core)
The heart of the extension. Manages:
- **LLM API calls** via `fetch` directly from the Service Worker (no external host)
- **Chat loop**: sends messages → receives tool calls → executes tools → feeds results back
- **25 browser automation tools** defined in `BROWSER_TOOLS` (navigation, DOM reading, interaction, export, screenshot, dialog handling, waits)
- **Tab isolation (pinning)**: the agent is pinned to the tab where the first message is sent. All tool executions target the pinned tab, not the currently active one. `switch_tab` is blocked, `new_tab` always requires approval (even in auto mode), `captureVisibleTab` validates the pinned tab is active first, and `evaluate_js` blocks navigation-escape patterns (`window.open`, `location.href`, etc.)
- **Input isolation**: CDP event listeners only process events from the pinned tab. `ensureDevTools` refuses to attach to non-pinned tabs.
- **Session persistence**: critical state (`conversationHistory`, `pinnedTabId`, `consoleLogs`) is persisted to `chrome.storage.session` to survive Service Worker recycling. Vision base64 data is stripped before storage.
- **System prompt profiles**: `SYSTEM_PROMPT_PROFILES` defines built-in profiles (`default`, `sei-sip`, `data-extraction`, `form-filling`). `getConfig()` resolves the active prompt from profile defaults, user overrides, and the legacy `systemPrompt` key.
- **Vision support**: screenshot images are forwarded to the LLM only for vision-capable OpenAI models (`gpt-4o`, `gpt-4.1`, `o1`–`o5`, etc.); non-vision models receive a text fallback
- **Chrome DevTools Protocol (CDP)** via the `debugger` API for JS evaluation and console capture
- **Approval system**: sensitive actions (`navigate`, `click_element`, `type_text`, `evaluate_js`, `select_option`) require user confirmation with a 3-minute expiry window; skip in `auto` mode
- **Retry/backoff**: `callLLM` retries up to 3× on HTTP 429 or 5xx with exponential backoff (1 s → 2 s → 4 s)
- **Session state**: nonce, pinned tab, pending approvals, DevTools attachment status, conversation history (capped at 60 msgs; trim always starts at a `user` message to avoid orphaned `tool` roles)

Message types it handles: `agentic.chat`, `agentic.command`, `agentic.config.*`, `agentic.approval.*`, `agentic.handshake`, `agentic.stop`, `agentic.reload`, `agentic.status`

### `sidepanel.js` / `sidepanel.html` — Chat UI
Renders the conversation, sends user messages to the background, displays approval prompts, and shows connection status. Uses a nonce-based SHA-256 handshake with the background worker for sender verification. Includes a lightweight Markdown renderer.

### `settings.js` / `settings.html` — Configuration UI
Persists to `chrome.storage.local`: `provider`, `apiEndpoint`, `apiKey`, `model`, `customModel`, `thinkingEnabled`, `systemPromptProfile`, `systemPromptProfiles`, legacy `systemPrompt`, and `permissionMode`. Provider presets: DeepSeek (default), OpenAI (`gpt-4o` default), LM Studio (`http://localhost:1234/v1`), and Ollama (`http://localhost:11434/v1`).

Prompt profile behavior:
- `systemPromptProfile` stores the active profile id.
- `systemPromptProfiles` stores user-edited prompt text by profile id.
- `systemPrompt` is kept for backward compatibility with older installs and older background versions.
- The default active profile is `sei-sip`, preserving the original administrative SEI/SIP behavior.
- `settings.js` asks `agentic.config.get` for the prompt profile catalog so it does not need to duplicate the long SEI/SIP prompt.

Ollama behavior:
- Uses the OpenAI-compatible endpoint `http://localhost:11434/v1/chat/completions`.
- Does not require an API key.
- Uses a free-text model field; users should enter names from `ollama list`.
- Vision is disabled by default for Ollama. `see_screen` returns a text fallback unless the active provider is OpenAI and `supportsVision()` recognizes the model.

### Data Flow
```
User → sidepanel.js → background.js ──fetch──► LLM API
                              │
                    Chrome Tabs / CDP / scripting API
                              │
               Approval system → back to sidepanel.js
```

## Key Permissions (manifest.json)

`debugger`, `downloads`, `scripting`, `tabs`, `tabGroups`, `sidePanel`, `storage`, `unlimitedStorage`, `<all_urls>` (host permission)

> **Note:** `nativeMessaging` is NOT used — the extension calls the LLM directly.

## Security Model

- Nonce + SHA-256 handshake between sidepanel and background worker
- Sender validation checks extension ID on all messages
- Approval/rejection gate on sensitive actions (3-minute expiry, tracked by `transactionId`)
- HTML escaping in sidepanel to prevent XSS from LLM output
- `evaluate_js` fallback uses `Function` constructor before `eval` to limit local scope leakage

## Project Skills

Skills are instruction sets that Claude loads to improve performance on specialized tasks. This project bundles two skills under `.claude/skills/` so any agent working in this directory can use them automatically.

### Installed skills

| Skill | Directory | When to use |
|-------|-----------|-------------|
| **webapp-testing** | `.claude/skills/webapp-testing/` | Testing `sidepanel.html` and `settings.html` with Playwright (UI verification, screenshot diff, element discovery). Uses `file://` URLs — no server required for static HTML pages. |
| **frontend-design** | `.claude/skills/frontend-design/` | Redesigning or improving the extension UI. Provides opinionated guidelines for typography, color, motion, and layout to avoid generic aesthetics. |

> **Note:** The `claude-api` skill (LLM API integration patterns) is available globally via the Claude Code plugin system and does not need to be bundled here. Install it with `/plugin install claude-api@anthropic-agent-skills` if not already present.

### Installing additional skills from anthropics/skills

To install more skills from the upstream Anthropic repository:

```
# Register the marketplace (one-time)
/plugin marketplace add anthropics/skills

# Install skill bundles
/plugin install example-skills@anthropic-agent-skills   # webapp-testing, frontend-design, mcp-builder, etc.
/plugin install document-skills@anthropic-agent-skills  # xlsx, docx, pptx, pdf
/plugin install claude-api@anthropic-agent-skills       # Claude/Anthropic SDK patterns
```

Skills installed via `/plugin` are global to Claude Code. The ones in `.claude/skills/` are project-scoped and committed to the repo so all agents and contributors get them automatically.

### Adding a new project skill

1. Create `.claude/skills/<skill-name>/SKILL.md` with YAML frontmatter (`name`, `description` fields required).
2. Add any supporting scripts to `.claude/skills/<skill-name>/scripts/`.
3. Document it in the table above.

---

## Changelog (improvements applied 2026-05-27)

| # | File | Change |
|---|------|--------|
| 1 | `background.js` | `VISION_MODELS` expanded: added `gpt-4.1`, `o2`, `o5` |
| 2 | `background.js` | `callLLM` now retries 3× with exponential backoff on 429/5xx |
| 3 | `background.js` | `see_screen` returns a text error for non-vision models instead of capturing a base64 screenshot that would be discarded |
| 4 | `background.js` | `evaluateOnPage` fallback: tries `Function` constructor first; falls back to `eval` only for statement-style expressions |
| 5 | `background.js` | History trim now finds the first `user` message after slicing to avoid orphaned `tool` role messages that break the API contract |
| 6 | `settings.js` | OpenAI preset model corrected from non-existent `gpt-5.4-nano` to `gpt-4o` |
| 7 | `CLAUDE.md` | Removed outdated Native Messaging Host references; corrected permissions list; documented all improvements |
| 8 | `background.js`, `settings.js`, `settings.html` | Added editable system prompt profiles (`default`, `sei-sip`, `data-extraction`, `form-filling`) with legacy `systemPrompt` compatibility |
| 9 | `settings.js`, `settings.html` | Added Ollama provider preset using `http://localhost:11434/v1` and free-text local model names |
| 10 | `README.md`, `CLAUDE.md`, `docs/superpowers/` | Documented prompt profile and Ollama architecture for future agents |

## Changelog (improvements applied 2026-05-30)

| # | File | Change |
|---|------|--------|
| 11 | `background.js` | **Tab isolation**: agent is pinned to the tab where the first message is sent; all tools execute on pinned tab, not active tab |
| 12 | `background.js` | **switch_tab blocked**: returns error message to enforce isolation |
| 13 | `background.js` | **new_tab forced approval**: always requires user approval even in auto mode |
| 14 | `background.js` | **Screenshot safety**: `see_screen` and `export_screenshot` validate pinned tab is active before `captureVisibleTab` |
| 15 | `background.js` | **evaluate_js guard**: blocks `window.open`, `location.href`, `location.assign`, `location.replace` patterns |
| 16 | `background.js` | **CDP isolation**: `debugger.onEvent` filtered to pinned tab; `ensureDevTools` refuses non-pinned tabs |
| 17 | `background.js` | **Session persistence**: `persistSession()`/`restoreSession()` via `chrome.storage.session` to survive SW recycling |
| 18 | `background.js` | **Tab lifecycle**: `chat.tab_pinned`, `chat.tab_unpinned`, `chat.tab_lost` events for UI |
| 19 | `sidepanel.html`, `sidepanel.js` | **Pinned tab badge**: visual indicator in header showing which tab the agent is operating on |
| 20 | `sidepanel.js` | **Onboarding**: welcome message shown when chat area is empty |
| 21 | `settings.html` | **OpenAI models fixed**: replaced fictional GPT-5.4 with real models (gpt-4o, gpt-4o-mini, o3, o3-mini) |
| 22 | `icons/` | **Real icons**: generated 16/32/48/128px icons with Agentic branding |
| 23 | `INSTALAR.ps1` | **Fixed**: script now uses script directory as extension source, validates manifest.json |
| 24 | `CLAUDE.md` | Documented tab isolation, input isolation, and session persistence architecture |
| 25 | `utils.js` | Created shared utility library containing system prompts, profiles catalog, HTML/Markdown parsers, and a structured logger |
| 26 | `background.js`, `sidepanel.html`, `sidepanel.js` | Modularized to load and reuse shared functions from `utils.js`, removing duplicate configurations/functions |
| 27 | `background.js` | Integrated tool execution timing metrics (elapsed ms) broadcasted to the UI |
| 28 | `package.json`, `vitest.config.js` | Configured Vitest test suite for isolated, automated testing |
| 29 | `tests/utils.test.js` | Implemented 17 automated unit tests for markdown rendering, HTML escaping, config resolution, and system prompts overrides |
| 30 | `INSTALAR.ps1`, `.gitignore` | Optimized installer script and gitignore to exclude `node_modules`, `tests`, and dev configs when copying to the final extension folder |
