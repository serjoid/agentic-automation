# Prompt Profiles and Ollama Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add editable system prompt profiles and Ollama support to the extension.

**Architecture:** Keep the existing vanilla JavaScript extension architecture. Add prompt profile constants and resolution logic in `background.js`, provider and profile controls in `settings.html`/`settings.js`, and context documentation in `README.md` and `CLAUDE.md`.

**Tech Stack:** Chrome Extension Manifest V3, vanilla JavaScript, `chrome.storage.local`, OpenAI-compatible chat completions APIs.

---

### Task 1: Background Prompt Resolution

**Files:**
- Modify: `background.js`

- [ ] Add `SYSTEM_PROMPT_PROFILES` beside `DEFAULT_SYSTEM_PROMPT`.
- [ ] Add helpers to merge default prompt profiles with user overrides.
- [ ] Update `getConfig()` to read `systemPromptProfile`, `systemPromptProfiles`, and legacy `systemPrompt`.
- [ ] Ensure `startChat()` sends the resolved prompt as the `system` message.

### Task 2: Settings UI

**Files:**
- Modify: `settings.html`
- Modify: `settings.js`

- [ ] Add Ollama provider card.
- [ ] Add editable prompt profile selector, textarea, and reset-current-profile button.
- [ ] Save `systemPromptProfile` and `systemPromptProfiles`.
- [ ] Preserve compatibility with existing `systemPrompt`.

### Task 3: Documentation

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`

- [ ] Document provider list including Ollama.
- [ ] Document prompt profile storage keys and behavior.
- [ ] Document that vision remains OpenAI-only by default.

### Task 4: Verification

**Files:**
- Check: `background.js`
- Check: `settings.js`
- Check: `sidepanel.js`

- [ ] Run `node --check background.js`.
- [ ] Run `node --check settings.js`.
- [ ] Run `node --check sidepanel.js`.
- [ ] Review `README.md` and `CLAUDE.md` for consistency.
