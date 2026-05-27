# Prompt Profiles and Ollama Design

## Goal

Add editable system prompt profiles and Ollama provider support to the Agentic Automation extension.

## Prompt Profiles

The settings page will expose a hybrid prompt system: users choose from built-in profiles and can edit each profile's text. The built-in profiles are:

- `default`: general browser automation.
- `sei-sip`: Brazilian public-sector SEI/SIP automation.
- `data-extraction`: page reading, structured extraction, and export.
- `form-filling`: careful form completion and validation.

The active profile is stored as `systemPromptProfile`. User-edited profile text is stored in `systemPromptProfiles`, keyed by profile id. The legacy `systemPrompt` key remains supported as a migration fallback so existing installs keep their customized prompt.

## Ollama Provider

The settings page will add Ollama as a provider next to DeepSeek, OpenAI, and LM Studio. Its default endpoint is `http://localhost:11434/v1`, it does not require an API key, and it uses a free-text model field because local Ollama model names depend on what the user has pulled.

The existing OpenAI-compatible `/chat/completions` flow remains the API integration path. Ollama vision support is disabled by default; screenshot reasoning continues to be available only for configured OpenAI vision-capable models.

## Documentation

`README.md` and `CLAUDE.md` must describe the provider, storage keys, prompt profile behavior, and migration compatibility so future agents can work on the project without rediscovering the design.

## Validation

Run JavaScript syntax checks after implementation:

```powershell
node --check background.js
node --check settings.js
node --check sidepanel.js
```
