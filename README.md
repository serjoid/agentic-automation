# Agentic Automation

A Chrome extension that lets you control your browser through a conversational AI agent. Type a task in the side panel — the agent navigates pages, clicks elements, fills forms, and extracts data autonomously.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue?logo=googlechrome)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-green)
![Vanilla JS](https://img.shields.io/badge/Vanilla-JavaScript-yellow)

---

## Features

- **Side panel chat UI** — send natural language tasks, see the agent work in real time
- **25 browser automation tools** — navigate, click, type, scroll, extract, screenshot, export PDF/CSV/JSON
- **Vision support** — the agent can take screenshots and visually reason about the page
- **Native dialog handling** — automatically detects and dismisses browser `alert()`, `confirm()`, and `prompt()` dialogs that would block automation
- **Approval system** — sensitive actions (navigation, JS execution, form submission) can require your confirmation before executing
- **Free mode** — toggle off approvals for fully autonomous operation
- **Thinking blocks** — collapsible view of the model's internal reasoning (for models that support it)
- **Multiple AI providers** — DeepSeek, OpenAI, LM Studio, or Ollama
- **Prompt profiles** — choose and edit task-specific system prompts for general automation, SEI/SIP, data extraction, or form filling

---

## Installation

### Requirements
- Google Chrome 114+
- An API key from [DeepSeek](https://platform.deepseek.com/api_keys) or [OpenAI](https://platform.openai.com/api-keys)

### Steps

1. **Download** this repository (Code → Download ZIP) or clone it
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked** and select the folder containing `manifest.json`
5. Click the puzzle icon 🧩 in the Chrome toolbar → pin **Agentic Automation**
6. Click the **A** icon to open the side panel
7. Click ⚙️ → choose your AI provider → paste your API key → Save

---

## Architecture

```
sidepanel.html/js     — Chat UI (side panel)
settings.html/js      — Configuration page
background.js         — Service worker: chat loop, tool execution, CDP, approval system
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
| OpenAI | `https://api.openai.com/v1` | GPT-4o enables vision (screenshots) |
| LM Studio | `http://localhost:1234/v1` | Local OpenAI-compatible server, no API key needed |
| Ollama | `http://localhost:11434/v1` | Local OpenAI-compatible endpoint, no API key needed; use model names from `ollama list` |

Vision (`see_screen`) is enabled only for OpenAI models recognized as vision-capable. Local providers such as LM Studio and Ollama currently receive a text fallback.

---

## System Prompt Profiles

The settings page includes editable prompt profiles:

| Profile | Use case |
|---|---|
| Automação geral | General browser automation |
| SEI/SIP administrativo | Brazilian public-sector SEI/SIP workflows and safety rules |
| Extração de dados | Structured extraction, pagination, and exports |
| Preenchimento de formulários | Careful form completion and validation before submission |

Settings are stored in `chrome.storage.local`:

| Key | Purpose |
|---|---|
| `systemPromptProfile` | Active profile id |
| `systemPromptProfiles` | User-edited prompt text keyed by profile id |
| `systemPrompt` | Legacy single-prompt key kept for compatibility |

---

## Security

- Nonce + SHA-256 handshake between side panel and service worker
- Sender validation on all internal messages
- Approval gate on sensitive actions (3-minute expiry)
- HTML escaping on all LLM output to prevent XSS

---

## License

MIT
