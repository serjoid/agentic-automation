# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome Extension (Manifest V3) that enables AI-powered browser automation via a side panel chat interface. The AI agent can navigate pages, click elements, type text, execute JavaScript, and interact with the DOM — all coordinated through a Native Messaging Host that proxies requests to an LLM API (DeepSeek, OpenAI, or a local model).

## Development

No build step is required. This is vanilla JavaScript loaded directly into Chrome.

**To run/test:** Open `chrome://extensions`, enable Developer Mode, click "Load unpacked", and select this directory. After code changes, click the refresh icon on the extension card.

**Minimum Chrome:** 114

## Architecture

The extension has three runtime components that communicate via `chrome.runtime.sendMessage`:

### `background.js` — Service Worker (core)
The heart of the extension. Manages:
- **Native Messaging** connection to the external host (`com.agentic.automation`), which proxies to the LLM API
- **Chat loop**: sends messages → receives tool calls → executes tools → feeds results back
- **8 browser automation tools** defined in `BROWSER_TOOLS`: `navigate`, `new_tab`, `evaluate_js`, `get_page_content`, `click_element`, `type_text`, `scroll_page`, `get_console_errors`
- **Chrome DevTools Protocol (CDP)** via the `debugger` API for DOM inspection and JS evaluation
- **Approval system**: sensitive actions require user confirmation with a 3-minute expiry window
- **Session state**: nonce, port, pending approvals, DevTools attachment status, conversation history

Message types it handles: `agentic.chat`, `agentic.command`, `agentic.config.*`, `agentic.approval.*`, `agentic.handshake`

### `sidepanel.js` / `sidepanel.html` — Chat UI
Renders the conversation, sends user messages to the background, displays approval prompts, and shows connection status (connected/disconnected to the Native Messaging Host). Uses a nonce-based HTML handshake with the background worker for sender verification.

### `settings.js` / `settings.html` — Configuration UI
Persists to `chrome.storage.local`: `provider`, `apiEndpoint`, `apiKey`, `model`, `reasoningEffort`, `thinkingEnabled`, `systemPrompt`. Three provider presets: DeepSeek, OpenAI, LM Studio (local).

### Data Flow
```
User → sidepanel.js → background.js → Native Messaging Host → LLM API
                              ↓
                    Chrome Tabs / CDP / scripting API
                              ↓
               Approval system → back to sidepanel.js
```

## Key Permissions

`nativeMessaging`, `debugger`, `scripting`, `tabs`, `tabGroups`, `sidePanel`, `storage`, `<all_urls>`

## Security Model

- Nonce + SHA-256 handshake between sidepanel and background worker
- Sender validation checks extension ID on all messages
- Approval/rejection gate on sensitive actions (3-minute expiry, tracked by `transactionId`)
- HTML escaping in sidepanel to prevent XSS from LLM output
