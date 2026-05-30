# Agentic Automation

A Chrome extension that lets you control your browser through a conversational AI agent. Type a task in the side panel — the agent navigates pages, clicks elements, fills forms, and extracts data autonomously.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue?logo=googlechrome)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-green)
![Vanilla JS](https://img.shields.io/badge/Vanilla-JavaScript-yellow)
![Vitest](https://img.shields.io/badge/Tests-Vitest-green?logo=vitest)

---

## Features

- **Side panel chat UI** — send natural language tasks, see the agent work in real time.
- **Tab Isolation (Pinning)** — the agent is pinned to the tab where the session started. All tool actions execute exclusively inside the pinned tab. `switch_tab` is blocked, and `new_tab` always requires explicit user confirmation.
- **Input Isolation** — synthetic events and DevTools debugger protocol calls are restricted to the pinned tab. CDP listeners ignore other tab activities.
- **Session Persistence** — critical session state (chat history, pinned tab configurations, logs) is saved to `chrome.storage.session` to survive Chrome Service Worker recycling.
- **25 browser automation tools** — navigate, click, type, scroll, extract, screenshot, export PDF/CSV/JSON.
- **Vision support** — the agent can take screenshots and visually reason about the page (enabled for OpenAI vision-capable models).
- **Native dialog handling** — automatically detects and dismisses browser `alert()`, `confirm()`, and `prompt()` dialogs that would block automation.
- **Approval system** — sensitive actions (navigation, JS execution, form submission) can require your confirmation before executing.
- **Free mode** — toggle off approvals for fully autonomous operation.
- **Thinking blocks** — collapsible view of the model's internal reasoning.
- **Multiple AI providers** — DeepSeek, OpenAI, LM Studio, or Ollama.
- **Prompt profiles** — choose and edit task-specific system prompts for general automation, SEI/SIP, data extraction, or form filling.

---

## Installation

### Requirements
- Google Chrome 114+
- An API key from [DeepSeek](https://platform.deepseek.com/api_keys) or [OpenAI](https://platform.openai.com/api-keys)

### Steps

1. **Download** this repository (Code → Download ZIP) or clone it.
2. Open Chrome and go to `chrome://extensions`.
3. Enable **Developer mode** (top right toggle).
4. Click **Load unpacked** and select this directory (or run the `INSTALAR.ps1` script on Windows to copy it to a clean AppData folder and open Chrome automatically).
5. Click the puzzle icon 🧩 in the Chrome toolbar → pin **Agentic Automation**.
6. Click the **A** icon to open the side panel.
7. Click ⚙️ → choose your AI provider → paste your API key → Save.

---

## Architecture

The extension is designed with a service worker core and clean shared utility scripts:

```
utils.js              — Shared utility library: system prompts, markdown/HTML parsers, structured logger
background.js         — Service worker: chat loop, tool execution, CDP, approval system, session persistence
sidepanel.html/js     — Chat UI (side panel panel)
settings.html/js      — Configuration page
manifest.json         — Chrome Extension Manifest V3
```

**Data flow:**
```
User message → sidepanel.js → background.js → LLM API
                                    ↓
                         Chrome tabs / scripting / CDP
                                    ↓
                    Approval gate → response → sidepanel.js
```

**Key Chrome APIs used:** `sidePanel`, `tabs`, `scripting`, `debugger`, `storage`, `downloads`

---

## Available Tools

| Category | Tools |
|---|---|
| Context | `get_current_url`, `get_tabs`, `switch_tab` |
| Navigation | `navigate`, `new_tab`, `go_back`, `reload_page` |
| Reading | `get_page_content`, `get_page_html`, `find_elements`, `evaluate_js`, `get_console_logs` |
| Interaction | `click_element`, `hover_element`, `type_text`, `select_option`, `press_key`, `scroll_page` |
| Dialogs | `handle_dialog` |
| Waiting | `wait_for_element`, `wait` |
| Vision | `see_screen` |
| Export | `export_file`, `export_page_pdf`, `export_screenshot` |

---

## AI Provider Setup

| Provider | Endpoint | Notes |
|---|---|---|
| DeepSeek | `https://api.deepseek.com/v1` | Default. Cost-effective. |
| OpenAI | `https://api.openai.com/v1` | GPT-4o enables vision (screenshots). |
| LM Studio | `http://localhost:1234/v1` | Local OpenAI-compatible server, no API key needed. |
| Ollama | `http://localhost:11434/v1` | Local OpenAI-compatible endpoint, no API key needed; use model names from `ollama list`. |

---

## Testing

The codebase includes an automated unit testing suite powered by Vitest to validate pure utility functions (markdown rendering, HTML escaping, system prompt overrides resolution, configuration mapping).

To run the unit tests locally:

1. **Install Node.js dependencies** (only development dependencies are required):
   ```bash
   npm install
   ```
2. **Execute the test suite**:
   ```bash
   npm run test
   ```

All test source files are located in the `tests/` directory.

---

## Security

- **Tab Pinning & Isolation** — Prevents LLM context leakage and cross-tab hijacking.
- **Input Confines** — Restricts CDP debugging and synthetic mouse/keyboard events to the pinned tab context.
- **Nonce-based Handshake** — SHA-256 handshake between side panel and service worker.
- **Sender Validation** — Verification on all incoming runtime messages.
- **Approval Gate** — 3-minute confirmation expiry on all sensitive operations.
- **HTML Escaping** — Full HTML escaping on all LLM outputs to prevent XSS.

---

## License

MIT
