importScripts('utils.js');

(function () {
  'use strict';

  const EXT_ID = chrome.runtime.id;
  const NONCE_BYTES = 32;
  const TX_EXPIRY_MS = 3 * 60 * 1000;


  const PROVIDER_DEFAULTS = {
    deepseek: { endpoint: 'https://api.deepseek.com/v1', model: 'deepseek-v4-flash' },
    openai: { endpoint: 'https://api.openai.com/v1', model: 'gpt-4o' },
    local: { endpoint: 'http://localhost:1234/v1', model: 'local-model' },
    ollama: { endpoint: 'http://localhost:11434/v1', model: 'llama3.1' }
  };

  const BROWSER_TOOLS = [
    // ── Context & Navigation ──────────────────────────────────────────────────
    {
      type: 'function',
      function: {
        name: 'get_current_url',
        description: 'Get the current tab URL, title, and load status. Always call this first to confirm context.',
        parameters: { type: 'object', properties: {}, required: [] }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_tabs',
        description: 'List all open tabs in the current window with their IDs, URLs, and titles.',
        parameters: { type: 'object', properties: {}, required: [] }
      }
    },
    {
      type: 'function',
      function: {
        name: 'switch_tab',
        description: 'Switch focus to another open tab.',
        parameters: {
          type: 'object',
          properties: {
            tabId: { type: 'number', description: 'Tab ID from get_tabs.' },
            urlPattern: { type: 'string', description: 'Partial URL string to match if tabId is unknown.' }
          },
          required: []
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'navigate',
        description: 'Navigate the current tab to a URL.',
        parameters: { type: 'object', properties: { url: { type: 'string', description: 'Full URL to navigate to.' } }, required: ['url'] }
      }
    },
    {
      type: 'function',
      function: {
        name: 'new_tab',
        description: 'Open a new browser tab.',
        parameters: { type: 'object', properties: { url: { type: 'string' }, active: { type: 'boolean', description: 'Make tab active (default true).' } }, required: [] }
      }
    },
    {
      type: 'function',
      function: {
        name: 'go_back',
        description: 'Navigate back in the current tab\'s history.',
        parameters: { type: 'object', properties: {}, required: [] }
      }
    },
    {
      type: 'function',
      function: {
        name: 'reload_page',
        description: 'Reload the current tab.',
        parameters: { type: 'object', properties: {}, required: [] }
      }
    },

    // ── Reading Page ──────────────────────────────────────────────────────────
    {
      type: 'function',
      function: {
        name: 'get_page_content',
        description: 'Get visible text of the page or a specific element. Fast — use for reading content.',
        parameters: { type: 'object', properties: { selector: { type: 'string', description: 'Optional CSS selector.' } }, required: [] }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_page_html',
        description: 'Get raw HTML of the page or element. Use to inspect structure, attributes, selectors, embedded scripts.',
        parameters: { type: 'object', properties: { selector: { type: 'string', description: 'Optional CSS selector.' } }, required: [] }
      }
    },
    {
      type: 'function',
      function: {
        name: 'find_elements',
        description: 'Find all elements matching a CSS selector. Returns tag, id, classes, text, value, href, visibility for each. Use before interacting to confirm selectors exist.',
        parameters: {
          type: 'object',
          properties: {
            selector: { type: 'string', description: 'CSS selector.' },
            limit: { type: 'number', description: 'Max results (default 20).' }
          },
          required: ['selector']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'evaluate_js',
        description: 'Execute JavaScript and return the result. Use for dynamic data, window/localStorage, React state, runtime values.',
        parameters: { type: 'object', properties: { expression: { type: 'string', description: 'JS expression to evaluate.' } }, required: ['expression'] }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_console_logs',
        description: 'Get recent console logs from the page (errors, warnings, info).',
        parameters: { type: 'object', properties: {}, required: [] }
      }
    },

    // ── Interaction ───────────────────────────────────────────────────────────
    {
      type: 'function',
      function: {
        name: 'click_element',
        description: 'Click an element by CSS selector.',
        parameters: { type: 'object', properties: { selector: { type: 'string' } }, required: ['selector'] }
      }
    },
    {
      type: 'function',
      function: {
        name: 'hover_element',
        description: 'Hover over an element to trigger dropdown menus or tooltip states.',
        parameters: { type: 'object', properties: { selector: { type: 'string' } }, required: ['selector'] }
      }
    },
    {
      type: 'function',
      function: {
        name: 'type_text',
        description: 'Type text into an input field.',
        parameters: {
          type: 'object',
          properties: {
            selector: { type: 'string' },
            text: { type: 'string' },
            clear: { type: 'boolean', description: 'Clear existing value first (default true).' },
            submit: { type: 'boolean', description: 'Press Enter after typing.' }
          },
          required: ['selector', 'text']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'select_option',
        description: 'Select an option from a <select> dropdown by value or visible text.',
        parameters: {
          type: 'object',
          properties: {
            selector: { type: 'string', description: 'CSS selector for the <select> element.' },
            value: { type: 'string', description: 'Option value attribute.' },
            text: { type: 'string', description: 'Option visible text (partial match).' }
          },
          required: ['selector']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'press_key',
        description: 'Press a keyboard key on the focused element or a specific element.',
        parameters: {
          type: 'object',
          properties: {
            key: { type: 'string', description: 'Key name: Enter, Tab, Escape, ArrowDown, ArrowUp, Backspace, etc.' },
            selector: { type: 'string', description: 'Target element selector (uses activeElement if omitted).' },
            shift: { type: 'boolean' },
            ctrl: { type: 'boolean' },
            alt: { type: 'boolean' }
          },
          required: ['key']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'scroll_page',
        description: 'Scroll the page.',
        parameters: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number', description: 'Positive = down.' } }, required: [] }
      }
    },

    // ── Export ───────────────────────────────────────────────────────────────
    {
      type: 'function',
      function: {
        name: 'export_file',
        description: 'Download a file to the user\'s computer. Use to export collected data as text, CSV, JSON, HTML or Markdown.',
        parameters: {
          type: 'object',
          properties: {
            filename: { type: 'string', description: 'File name without extension.' },
            content:  { type: 'string', description: 'Full text content of the file.' },
            format:   { type: 'string', enum: ['txt', 'csv', 'json', 'html', 'md'], description: 'File format.' }
          },
          required: ['filename', 'content', 'format']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'export_page_pdf',
        description: 'Save the current page as a PDF downloaded to the user\'s computer.',
        parameters: {
          type: 'object',
          properties: {
            filename: { type: 'string', description: 'File name without extension.' }
          },
          required: []
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'see_screen',
        description: 'Capture a screenshot of the current tab and send it to you as an image so you can visually analyze the page state, UI elements, content, and layout. Use this when text tools are insufficient to understand the current context.',
        parameters: { type: 'object', properties: {}, required: [] }
      }
    },
    {
      type: 'function',
      function: {
        name: 'export_screenshot',
        description: 'Save a screenshot of the visible area of the current tab as a PNG file download.',
        parameters: {
          type: 'object',
          properties: {
            filename: { type: 'string', description: 'File name without extension.' }
          },
          required: []
        }
      }
    },

    // ── Dialog handling ───────────────────────────────────────────────────────
    {
      type: 'function',
      function: {
        name: 'handle_dialog',
        description: 'Accept or dismiss a native browser dialog (alert, confirm, prompt) that is blocking the page. Call immediately when a tool returns a dialog warning.',
        parameters: {
          type: 'object',
          properties: {
            accept: { type: 'boolean', description: 'true to click OK/Accept, false to click Cancel/Dismiss.' },
            promptText: { type: 'string', description: 'Text to enter if the dialog is a prompt (optional).' }
          },
          required: ['accept']
        }
      }
    },

    // ── Waiting ───────────────────────────────────────────────────────────────
    {
      type: 'function',
      function: {
        name: 'wait_for_element',
        description: 'Wait until an element matching the selector appears on the page. Use after actions that trigger page changes.',
        parameters: {
          type: 'object',
          properties: {
            selector: { type: 'string' },
            timeout: { type: 'number', description: 'Max wait in ms (default 8000, max 20000).' }
          },
          required: ['selector']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'wait',
        description: 'Wait a fixed number of milliseconds (max 5000). Prefer wait_for_element when possible.',
        parameters: { type: 'object', properties: { ms: { type: 'number' } }, required: ['ms'] }
      }
    }
  ];

  let session = {
    nonce: null,
    pinnedTabId: null,
    pinnedTabUrl: null,
    pendingApprovals: new Map(),
    isDevToolsAttached: false,
    devToolsTarget: null,
    conversationHistory: [],
    consoleLogs: [],
    isProcessing: false,
    abortController: null,
    activeDialog: null
  };

  // ======== Session Persistence ================================================
  // Persist critical state to chrome.storage.session to survive Service Worker recycling
  async function persistSession() {
    try {
      // Strip base64 vision data from messages to stay within 10 MB quota
      const cleanHistory = session.conversationHistory.map(msg => {
        if (!Array.isArray(msg.content)) return msg;
        const filtered = msg.content.filter(p => p.type !== 'image_url');
        if (filtered.length === 0) return { ...msg, content: '[vision content removed for storage]' };
        return { ...msg, content: filtered };
      });
      await chrome.storage.session.set({
        _session: {
          conversationHistory: cleanHistory.slice(-40),
          pinnedTabId: session.pinnedTabId,
          pinnedTabUrl: session.pinnedTabUrl,
          consoleLogs: session.consoleLogs.slice(-50)
        }
      });
    } catch (err) {
      log.warn('Session', 'Failed to persist session:', err.message);
    }
  }

  async function restoreSession() {
    try {
      const { _session } = await chrome.storage.session.get('_session');
      if (_session) {
        session.conversationHistory = _session.conversationHistory || [];
        session.pinnedTabId = _session.pinnedTabId || null;
        session.pinnedTabUrl = _session.pinnedTabUrl || null;
        session.consoleLogs = _session.consoleLogs || [];
        // Validate pinned tab still exists
        if (session.pinnedTabId) {
          try {
            await chrome.tabs.get(session.pinnedTabId);
          } catch (_) {
            session.pinnedTabId = null;
            session.pinnedTabUrl = null;
          }
        }
        log.info('Session', `Session restored. History: ${session.conversationHistory.length} msgs, pinned tab: ${session.pinnedTabId}`);
      }
    } catch (err) {
      log.warn('Session', 'Failed to restore session:', err.message);
    }
  }

  // ======== Security Utils ====================================================
  function generateNonce() {
    const a = new Uint8Array(NONCE_BYTES);
    crypto.getRandomValues(a);
    return a;
  }

  function arrayBufferToHex(buffer) {
    return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function sha256(input) {
    const data = new TextEncoder().encode(input);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return arrayBufferToHex(buf);
  }

  function isValidSender(sender) {
    try { return sender?.id === EXT_ID; } catch (_) { return false; }
  }

  function generateTxId() {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // ======== Config ============================================================
  function getPromptProfileCatalog() {
    return Object.fromEntries(
      Object.entries(SYSTEM_PROMPT_PROFILES).map(([id, profile]) => [id, {
        label: profile.label,
        description: profile.description,
        prompt: profile.prompt
      }])
    );
  }

  // Helper functions now imported from utils.js

  async function getConfig() {
    const cfg = await chrome.storage.local.get([
      'provider', 'apiEndpoint', 'apiKey', 'model',
      'thinkingEnabled', 'systemPrompt', 'systemPromptProfile',
      'systemPromptProfiles', 'permissionMode'
    ]);
    const systemPromptProfile = SYSTEM_PROMPT_PROFILES[cfg.systemPromptProfile]
      ? cfg.systemPromptProfile
      : DEFAULT_SYSTEM_PROMPT_PROFILE;
    const systemPromptProfiles = normalizePromptOverrides(cfg.systemPromptProfiles);
    const provider = PROVIDER_DEFAULTS[cfg.provider] ? cfg.provider : 'deepseek';
    const providerDefaults = PROVIDER_DEFAULTS[provider];
    return {
      provider,
      apiEndpoint:    cfg.apiEndpoint    || providerDefaults.endpoint,
      apiKey:         cfg.apiKey         || '',
      model:          cfg.model          || providerDefaults.model,
      thinkingEnabled:cfg.thinkingEnabled ?? false,
      systemPrompt:   resolveSystemPrompt(systemPromptProfile, systemPromptProfiles, cfg.systemPrompt),
      systemPromptProfile,
      systemPromptProfiles,
      permissionMode: cfg.permissionMode || 'ask'
    };
  }

  // ======== Vision support ====================================================
  // Prefix-match: gpt-4o covers gpt-4o-mini, gpt-4o-2024-*, etc.
  const VISION_MODELS = ['gpt-4o', 'gpt-4-turbo', 'gpt-4.1', 'gpt-5', 'o1', 'o2', 'o3', 'o4', 'o5'];

  function supportsVision(cfg) {
    if (cfg.provider !== 'openai') return false;
    return VISION_MODELS.some(prefix => cfg.model.startsWith(prefix));
  }

  function sanitizeMessages(messages, cfg) {
    if (supportsVision(cfg)) return messages;
    return messages.map(msg => {
      if (!Array.isArray(msg.content)) return msg;
      const text = msg.content
        .filter(p => p.type === 'text')
        .map(p => p.text)
        .join('\n');
      return { ...msg, content: text || '[vision content removed]' };
    });
  }

  // ======== LLM API Call ======================================================
  async function callLLM(messages) {
    const cfg = await getConfig();

    const headers = { 'Content-Type': 'application/json' };
    if (cfg.apiKey) headers['Authorization'] = `Bearer ${cfg.apiKey}`;

    const base = cfg.apiEndpoint.replace(/\/+$/, '');
    const endpoint = base.endsWith('/chat/completions') ? base : `${base}/chat/completions`;

    const body = { model: cfg.model, messages: sanitizeMessages(messages, cfg), tools: BROWSER_TOOLS, tool_choice: 'auto', stream: false };

    const MAX_RETRIES = 3;
    let lastErr;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      if (session.abortController?.signal.aborted) throw new Error('Parado pelo usuário');

      if (attempt > 0) {
        // Exponential backoff: 1 s, 2 s, 4 s
        await new Promise(r => setTimeout(r, Math.min(1000 * Math.pow(2, attempt - 1), 8000)));
      }

      let response;
      try {
        response = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body), signal: session.abortController?.signal });
      } catch (err) {
        if (err.name === 'AbortError') throw err;
        lastErr = err;
        continue;
      }

      // Retryable: rate-limit or server errors
      if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
        let text = '';
        try { text = await response.text(); } catch (_) {}
        lastErr = new Error(`API ${response.status}: ${text.slice(0, 300)}`);
        continue;
      }

      if (!response.ok) {
        let text = '';
        try { text = await response.text(); } catch (_) {}
        throw new Error(`API ${response.status}: ${text.slice(0, 300)}`);
      }

      return response.json();
    }

    throw lastErr;
  }

  // ======== UI Broadcast ======================================================
  function broadcastToUI(msg) {
    chrome.runtime.sendMessage(msg).catch(() => {});
  }

  // ======== Chat Loop =========================================================
  async function runChatLoop(messages) {
    let current = [...messages];

    while (true) {
      if (session.abortController?.signal.aborted) throw new Error('Parado pelo usuário');
      const result = await callLLM(current);
      const choice = result.choices?.[0];
      if (!choice) throw new Error('Empty response from API');

      const assistantMsg = choice.message;
      current.push(assistantMsg);
      session.conversationHistory.push(assistantMsg);

      if (choice.finish_reason === 'tool_calls' && assistantMsg.tool_calls?.length) {
        broadcastToUI({ type: 'chat.tool_calls', tool_calls: assistantMsg.tool_calls, reasoning_content: assistantMsg.reasoning_content });
        const { results: toolResults, visionImages } = await executeToolCalls(assistantMsg.tool_calls);

        for (const tr of toolResults) {
          const toolMsg = { role: 'tool', tool_call_id: tr.tool_call_id, content: tr.content };
          current.push(toolMsg);
          session.conversationHistory.push(toolMsg);
        }

        // Vision images: inject as user message only for vision-capable providers
        if (visionImages.length > 0) {
          const cfg = await getConfig();
          if (supportsVision(cfg)) {
            const content = [
              { type: 'text', text: 'Here is the screenshot you requested:' },
              ...visionImages.map(img => ({
                type: 'image_url',
                image_url: { url: `data:${img.mimeType};base64,${img.base64}`, detail: 'high' }
              }))
            ];
            const visionMsg = { role: 'user', content };
            current.push(visionMsg);
            session.conversationHistory.push(visionMsg);
          }
          // Non-vision providers: tool result text "Screenshot captured" is sufficient
        }

        broadcastToUI({ type: 'chat.tool_results', results: toolResults });
        persistSession(); // persist after each tool round
      } else {
        broadcastToUI({
          type: 'chat.response',
          payload: { content: assistantMsg.content, reasoning_content: assistantMsg.reasoning_content, usage: result.usage }
        });
        persistSession(); // persist after final response
        break;
      }
    }
  }

  async function startChat(userMessage) {
    if (session.isProcessing) {
      broadcastToUI({ type: 'chat.error', error: 'Já processando. Aguarde.' });
      return;
    }
    session.isProcessing = true;
    session.abortController = new AbortController();

    // Pin tab on first message of the session
    if (!session.pinnedTabId) {
      const tab = await getActiveTab();
      if (tab?.id) {
        session.pinnedTabId = tab.id;
        session.pinnedTabUrl = tab.url;
        broadcastToUI({ type: 'chat.tab_pinned', tabId: tab.id, title: tab.title, url: tab.url });
      }
    }

    broadcastToUI({ type: 'chat.thinking' });

    try {
      const cfg = await getConfig();
      session.conversationHistory.push({ role: 'user', content: userMessage });

      const MAX_HISTORY = 60;
      if (session.conversationHistory.length > MAX_HISTORY) {
        let trimmed = session.conversationHistory.slice(-MAX_HISTORY);
        // Always start at the first user message to avoid orphaned tool results
        // that would break the tool_calls ↔ tool role contract required by the API
        const firstUser = trimmed.findIndex(m => m.role === 'user');
        if (firstUser > 0) trimmed = trimmed.slice(firstUser);
        session.conversationHistory = trimmed;
      }

      const messages = [];
      if (cfg.systemPrompt) messages.push({ role: 'system', content: cfg.systemPrompt });
      messages.push(...session.conversationHistory);

      await runChatLoop(messages);
    } catch (err) {
      if (err.name === 'AbortError' || err.message === 'Parado pelo usuário') {
        broadcastToUI({ type: 'chat.stopped' });
      } else {
        broadcastToUI({ type: 'chat.error', error: err.message || String(err) });
      }
    } finally {
      session.isProcessing = false;
      session.abortController = null;
    }
  }

  // ======== Tool Execution ====================================================
  async function executeToolCalls(toolCalls) {
    const results = [];
    const visionImages = [];

    for (const tc of toolCalls) {
      let fnArgs = {};
      try { fnArgs = JSON.parse(tc.function.arguments); } catch (_) {}
      try {
        const start = performance.now();
        const raw = await executeBrowserTool(tc.function.name, fnArgs);
        const elapsed = Math.round(performance.now() - start);
        log.info('Tools', `Execution of tool "${tc.function.name}" took ${elapsed}ms`);
        broadcastToUI({ type: 'chat.tool_timing', tool: tc.function.name, elapsed });
        if (raw?.__vision__) {
          results.push({ tool_call_id: tc.id, content: 'Screenshot captured successfully.' });
          visionImages.push({ mimeType: raw.mimeType, base64: raw.base64 });
        } else {
          results.push({ tool_call_id: tc.id, content: String(raw) });
        }
      } catch (err) {
        results.push({ tool_call_id: tc.id, content: `Error: ${err.message}` });
      }
    }

    return { results, visionImages };
  }

  async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  function waitForTabLoad(tabId, timeout = 10000) {
    return new Promise(resolve => {
      const done = () => { chrome.tabs.onUpdated.removeListener(listener); clearTimeout(timer); resolve(); };
      const listener = (id, changeInfo) => { if (id === tabId && changeInfo.status === 'complete') done(); };
      const timer = setTimeout(done, timeout);
      chrome.tabs.onUpdated.addListener(listener);
    });
  }

  async function executeBrowserTool(name, args) {
    // Use pinned tab instead of active tab to guarantee isolation
    const tabId = session.pinnedTabId;
    if (!tabId) {
      return 'Erro: nenhuma aba pinada. Envie uma mensagem primeiro para iniciar a sessão.';
    }
    // Validate the pinned tab still exists
    let tab;
    try {
      tab = await chrome.tabs.get(tabId);
    } catch (_) {
      session.pinnedTabId = null;
      session.pinnedTabUrl = null;
      broadcastToUI({ type: 'chat.tab_lost' });
      return 'Erro: a aba da sessão foi fechada. Limpe a conversa e envie uma nova mensagem para reiniciar.';
    }

    // If a native dialog is blocking the page, no other tool can execute
    if (name !== 'handle_dialog' && session.activeDialog) {
      return `⚠️ A browser dialog is blocking the page and must be dismissed first.\nType: ${session.activeDialog.type}\nMessage: "${session.activeDialog.message}"\nCall handle_dialog({ accept: true }) to click OK, or handle_dialog({ accept: false }) to cancel.`;
    }

    switch (name) {

      // ── Context ─────────────────────────────────────────────────────────────
      case 'get_current_url': {
        return JSON.stringify({ url: tab?.url || '', title: tab?.title || '', status: tab?.status || '' });
      }

      case 'get_tabs': {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        return JSON.stringify(tabs.map(t => ({ id: t.id, url: t.url, title: t.title, active: t.active })));
      }

      case 'switch_tab': {
        // Blocked to enforce tab isolation — the agent must operate only on the pinned tab
        return `Bloqueado: switch_tab está desabilitado para manter o isolamento de aba. O agente deve operar apenas na aba da sessão atual (id=${session.pinnedTabId}).`;
      }

      // ── Navigation ──────────────────────────────────────────────────────────
      case 'navigate': {
        await requireApproval('navigate', tabId, { url: args.url });
        await chrome.tabs.update(tabId, { url: args.url });
        await waitForTabLoad(tabId);
        const updated = await chrome.tabs.get(tabId);
        return `Navigated. Current URL: ${updated.url}`;
      }

      case 'new_tab': {
        // new_tab ALWAYS requires approval (even in auto mode) because it escapes tab isolation
        await createApprovalRequest('new_tab', tabId, {
          url: args.url,
          warning: 'Isto abrirá uma nova aba fora do contexto da sessão atual.'
        });
        const t = await chrome.tabs.create({ url: args.url || 'about:blank', active: args.active !== false });
        // Do NOT update pinnedTabId — stay bound to the original tab
        return `Opened tab id=${t.id} url=${t.pendingUrl || args.url}. Nota: a sessão continua amarrada à aba original (id=${session.pinnedTabId}).`;
      }

      case 'go_back': {
        await chrome.tabs.goBack(tabId).catch(() => {});
        await waitForTabLoad(tabId, 8000);
        const updated = await chrome.tabs.get(tabId);
        return `Navigated back. Current URL: ${updated.url}`;
      }

      case 'reload_page': {
        await chrome.tabs.reload(tabId);
        await waitForTabLoad(tabId);
        return 'Page reloaded';
      }

      // ── Reading ─────────────────────────────────────────────────────────────
      case 'get_page_content': {
        const result = await chrome.scripting.executeScript({
          target: { tabId },
          func: (sel) => {
            const el = sel ? document.querySelector(sel) : document.body;
            if (!el) return `Element not found: ${sel}`;
            return (el.innerText || el.textContent || '').trim().slice(0, 30000);
          },
          args: [args.selector || null],
          world: 'MAIN'
        });
        return result?.[0]?.result || 'No content';
      }

      case 'get_page_html': {
        const result = await chrome.scripting.executeScript({
          target: { tabId },
          func: (sel) => {
            const el = sel ? document.querySelector(sel) : document.documentElement;
            if (!el) return `Element not found: ${sel}`;
            return el.outerHTML.slice(0, 60000);
          },
          args: [args.selector || null],
          world: 'MAIN'
        });
        return result?.[0]?.result || 'No content';
      }

      case 'find_elements': {
        const result = await chrome.scripting.executeScript({
          target: { tabId },
          func: (sel, lim) => {
            const els = Array.from(document.querySelectorAll(sel)).slice(0, lim || 20);
            return els.map((el, i) => ({
              index: i,
              tag: el.tagName.toLowerCase(),
              id: el.id || null,
              classes: (el.className && typeof el.className === 'string') ? el.className.trim().split(/\s+/).slice(0, 4).join(' ') : null,
              text: (el.innerText || el.textContent || '').trim().slice(0, 120),
              value: el.value !== undefined ? el.value : null,
              href: el.href || null,
              type: el.type || null,
              placeholder: el.placeholder || null,
              disabled: el.disabled || false,
              visible: el.offsetWidth > 0 && el.offsetHeight > 0 && el.offsetParent !== null
            }));
          },
          args: [args.selector, args.limit || 20],
          world: 'MAIN'
        });
        const found = result?.[0]?.result || [];
        return JSON.stringify({ count: found.length, elements: found });
      }

      case 'evaluate_js': {
        await requireApproval('evaluate_js', tabId, { expression: args.expression });
        // Block JS patterns that could navigate away from the pinned tab
        const dangerousPatterns = ['window.open', 'location.href', 'location.assign', 'location.replace'];
        const lowerExpr = args.expression.toLowerCase();
        for (const pattern of dangerousPatterns) {
          if (lowerExpr.includes(pattern)) {
            return `Bloqueado: expressão contém "${pattern}" que poderia navegar fora da aba. Use a ferramenta "navigate" se precisar mudar de página.`;
          }
        }
        const result = await evaluateOnPage(tabId, args.expression);
        return JSON.stringify(result?.value ?? result);
      }

      case 'get_console_logs': {
        return JSON.stringify(session.consoleLogs.slice(-30));
      }

      // ── Interaction ─────────────────────────────────────────────────────────
      case 'click_element': {
        await requireApproval('click_element', tabId, { selector: args.selector });
        await ensureDevTools(tabId).catch(() => {});
        const result = await chrome.scripting.executeScript({
          target: { tabId },
          func: (sel) => {
            const el = document.querySelector(sel);
            if (!el) return `Element not found: ${sel}`;
            el.scrollIntoView({ block: 'center', behavior: 'smooth' });
            el.click();
            return `Clicked: ${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}`;
          },
          args: [args.selector],
          world: 'MAIN'
        });
        return result?.[0]?.result || 'No result';
      }

      case 'hover_element': {
        const result = await chrome.scripting.executeScript({
          target: { tabId },
          func: (sel) => {
            const el = document.querySelector(sel);
            if (!el) return `Element not found: ${sel}`;
            ['mouseover', 'mouseenter', 'mousemove'].forEach(t =>
              el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true }))
            );
            return `Hovered: ${el.tagName.toLowerCase()}`;
          },
          args: [args.selector],
          world: 'MAIN'
        });
        return result?.[0]?.result || 'No result';
      }

      case 'type_text': {
        await requireApproval('type_text', tabId, { selector: args.selector, text: args.text });
        await ensureDevTools(tabId).catch(() => {});
        const result = await chrome.scripting.executeScript({
          target: { tabId },
          func: (sel, txt, clr, sub) => {
            const el = document.querySelector(sel);
            if (!el) return `Element not found: ${sel}`;
            el.focus();
            if (clr !== false) {
              el.value = '';
              el.dispatchEvent(new Event('input', { bubbles: true }));
            }
            el.value = txt;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            if (sub) {
              ['keydown', 'keypress', 'keyup'].forEach(t =>
                el.dispatchEvent(new KeyboardEvent(t, { key: 'Enter', code: 'Enter', bubbles: true }))
              );
            }
            return 'Typed successfully';
          },
          args: [args.selector, args.text, args.clear !== false, args.submit || false],
          world: 'MAIN'
        });
        return result?.[0]?.result || 'No result';
      }

      case 'select_option': {
        await requireApproval('select_option', tabId, { selector: args.selector, value: args.value, text: args.text });
        await ensureDevTools(tabId).catch(() => {});
        const result = await chrome.scripting.executeScript({
          target: { tabId },
          func: (sel, val, txt) => {
            const el = document.querySelector(sel);
            if (!el) return `Element not found: ${sel}`;
            if (el.tagName !== 'SELECT') return `Not a <select>: ${el.tagName}`;
            const opts = Array.from(el.options);
            let opt;
            if (val !== null && val !== undefined) opt = opts.find(o => o.value === String(val));
            if (!opt && txt) opt = opts.find(o => o.text.trim().toLowerCase().includes(txt.toLowerCase()));
            if (!opt) return `Option not found. Available: ${opts.map(o => o.text).join(', ')}`;
            el.value = opt.value;
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return `Selected: "${opt.text}" (value="${opt.value}")`;
          },
          args: [args.selector, args.value ?? null, args.text ?? null],
          world: 'MAIN'
        });
        return result?.[0]?.result || 'No result';
      }

      case 'press_key': {
        const result = await chrome.scripting.executeScript({
          target: { tabId },
          func: (sel, key, shift, ctrl, alt) => {
            const el = sel ? document.querySelector(sel) : document.activeElement;
            if (sel && !el) return `Element not found: ${sel}`;
            const opts = { key, bubbles: true, cancelable: true, shiftKey: !!shift, ctrlKey: !!ctrl, altKey: !!alt };
            ['keydown', 'keypress', 'keyup'].forEach(t => (el || document.body).dispatchEvent(new KeyboardEvent(t, opts)));
            return `Pressed: ${key}`;
          },
          args: [args.selector || null, args.key, args.shift || false, args.ctrl || false, args.alt || false],
          world: 'MAIN'
        });
        return result?.[0]?.result || 'No result';
      }

      case 'scroll_page': {
        await chrome.scripting.executeScript({
          target: { tabId },
          func: (x, y) => window.scrollBy({ left: x || 0, top: y || 300, behavior: 'smooth' }),
          args: [args.x || 0, args.y || 300],
          world: 'MAIN'
        });
        return `Scrolled (${args.x || 0}, ${args.y || 300})`;
      }

      // ── Export ──────────────────────────────────────────────────────────────
      case 'export_file': {
        const mimes = { txt: 'text/plain', csv: 'text/csv', json: 'application/json', html: 'text/html', md: 'text/markdown' };
        const mime = mimes[args.format] || 'text/plain';
        const base64 = btoa(unescape(encodeURIComponent(args.content)));
        const dataUrl = `data:${mime};base64,${base64}`;
        const id = await chrome.downloads.download({ url: dataUrl, filename: `${args.filename}.${args.format}`, saveAs: false });
        return `File downloaded: ${args.filename}.${args.format} (download id=${id})`;
      }

      case 'export_page_pdf': {
        const ok = await ensureDevTools(tabId);
        if (!ok) throw new Error('DevTools unavailable for PDF export');
        const { data } = await chrome.debugger.sendCommand({ tabId }, 'Page.printToPDF', {
          printBackground: true, paperWidth: 8.27, paperHeight: 11.69
        });
        const fname = (args.filename || 'page').replace(/\.pdf$/i, '');
        const id = await chrome.downloads.download({ url: `data:application/pdf;base64,${data}`, filename: `${fname}.pdf`, saveAs: false });
        return `PDF saved: ${fname}.pdf (download id=${id})`;
      }

      case 'see_screen': {
        const cfg = await getConfig();
        if (!supportsVision(cfg)) {
          return 'Screenshot não disponível: o modelo atual não suporta visão. Use get_page_content ou find_elements para ler o estado da página.';
        }
        // Ensure pinned tab is active before capture (captureVisibleTab captures the visible tab, not a specific one)
        const currentForVision = await getActiveTab();
        if (currentForVision?.id !== session.pinnedTabId) {
          await chrome.tabs.update(session.pinnedTabId, { active: true });
          await new Promise(r => setTimeout(r, 300)); // wait for render
        }
        const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
        const base64 = dataUrl.split(',')[1];
        return { __vision__: true, base64, mimeType: 'image/png' };
      }

      case 'export_screenshot': {
        // Ensure pinned tab is active before capture
        const currentForExport = await getActiveTab();
        if (currentForExport?.id !== session.pinnedTabId) {
          await chrome.tabs.update(session.pinnedTabId, { active: true });
          await new Promise(r => setTimeout(r, 300));
        }
        const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
        const fname = (args.filename || 'screenshot').replace(/\.png$/i, '');
        const id = await chrome.downloads.download({ url: dataUrl, filename: `${fname}.png`, saveAs: false });
        return `Screenshot saved: ${fname}.png (download id=${id})`;
      }

      // ── Waiting ──────────────────────────────────────────────────────────────
      case 'wait_for_element': {
        const timeout = Math.min(args.timeout || 8000, 20000);
        const deadline = Date.now() + timeout;
        while (Date.now() < deadline) {
          const result = await chrome.scripting.executeScript({
            target: { tabId },
            func: (sel) => !!document.querySelector(sel),
            args: [args.selector],
            world: 'MAIN'
          }).catch(() => null);
          if (result?.[0]?.result) return `Element found: ${args.selector}`;
          await new Promise(r => setTimeout(r, 400));
        }
        return `Timeout (${timeout}ms): element not found: ${args.selector}`;
      }

      case 'wait': {
        const ms = Math.min(args.ms || 1000, 5000);
        await new Promise(r => setTimeout(r, ms));
        return `Waited ${ms}ms`;
      }

      case 'handle_dialog': {
        const ok = await ensureDevTools(tabId);
        if (!ok) throw new Error('DevTools unavailable — cannot handle dialog');
        const { type: dType = 'alert', message: dMsg = '' } = session.activeDialog || {};
        await chrome.debugger.sendCommand({ tabId }, 'Page.handleJavaScriptDialog', {
          accept: args.accept !== false,
          promptText: args.promptText || ''
        });
        session.activeDialog = null;
        return `Dialog dismissed: type="${dType}", message="${dMsg}", accepted=${args.accept !== false}`;
      }

      default:
        return `Unknown tool: ${name}`;
    }
  }

  // ======== DevTools ==========================================================
  async function ensureDevTools(tabId) {
    if (!tabId) return false;
    // Never attach DevTools to a tab other than the pinned one
    if (session.pinnedTabId && tabId !== session.pinnedTabId) {
      log.warn('DevTools', `DevTools blocked: tab ${tabId} is not pinned tab ${session.pinnedTabId}`);
      return false;
    }
    try {
      if (!session.isDevToolsAttached || session.devToolsTarget !== tabId) {
        await chrome.debugger.detach({ tabId: session.devToolsTarget }).catch(() => {});
        await chrome.debugger.attach({ tabId }, '1.3');
        session.isDevToolsAttached = true;
        session.devToolsTarget = tabId;
        await chrome.debugger.sendCommand({ tabId }, 'Runtime.enable');
        await chrome.debugger.sendCommand({ tabId }, 'Log.enable');
        await chrome.debugger.sendCommand({ tabId }, 'Page.enable');
      }
      return true;
    } catch (err) {
      log.warn('DevTools', `DevTools attach failed: ${err.message}`);
      return false;
    }
  }

  async function evaluateOnPage(tabId, expression) {
    const ok = await ensureDevTools(tabId);
    if (!ok) {
      const result = await chrome.scripting.executeScript({
        target: { tabId },
        // eslint-disable-next-line no-new-func
        func: (expr) => {
          try {
            // Function avoids leaking wrapper-scope variables; supports expressions
            return JSON.stringify(new Function(`"use strict"; return (${expr})`)());
          } catch (_) {
            try { return JSON.stringify(eval(expr)); } catch (e) { return 'Error: ' + e.message; }
          }
        },
        args: [expression],
        world: 'MAIN'
      });
      return { value: result?.[0]?.result };
    }
    const { result, exceptionDetails } = await chrome.debugger.sendCommand({ tabId }, 'Runtime.evaluate', {
      expression, returnByValue: true, awaitPromise: true
    });
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || 'Runtime exception');
    return result;
  }

  // ======== Approval System ===================================================
  async function requireApproval(action, tabId, detail) {
    const cfg = await getConfig();
    if (cfg.permissionMode === 'auto') return;
    return createApprovalRequest(action, tabId, detail);
  }

  function createApprovalRequest(action, targetTabId, detail) {
    const txId = generateTxId();
    return new Promise((resolve, reject) => {
      session.pendingApprovals.set(txId, { txId, targetTabId, action, detail, resolve, reject, expires: Date.now() + TX_EXPIRY_MS });
      broadcastToUI({ type: 'approval.request', txId, action, detail });
      setTimeout(() => {
        if (session.pendingApprovals.has(txId)) {
          session.pendingApprovals.get(txId).reject(new Error('Approval timed out'));
          session.pendingApprovals.delete(txId);
        }
      }, TX_EXPIRY_MS + 200);
    });
  }

  function approveAction(txId) {
    const entry = session.pendingApprovals.get(txId);
    if (!entry) { broadcastToUI({ type: 'chat.error', error: 'Aprovação expirou — o agente foi reiniciado. Tente novamente.' }); return; }
    session.pendingApprovals.delete(txId);
    entry.resolve(entry);
  }

  function rejectAction(txId) {
    const entry = session.pendingApprovals.get(txId);
    if (!entry) return;
    session.pendingApprovals.delete(txId);
    entry.reject(new Error('Rejected by user'));
  }

  // ======== Message Listener ==================================================
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || typeof msg !== 'object') return;

    const fromSelf = isValidSender(sender);
    const fromUI = sender.url === chrome.runtime.getURL('sidepanel.html') ||
                   sender.url === chrome.runtime.getURL('settings.html');
    if (!fromSelf && !fromUI) { sendResponse({ ok: false, error: 'Untrusted sender' }); return false; }

    const { type, payload } = msg;

    if (type === 'agentic.chat') {
      startChat(payload.message).then(() => sendResponse({ ok: true })).catch(err => sendResponse({ ok: false, error: err?.message }));
      return true;
    }

    if (type === 'agentic.command') {
      if (payload.command === 'clear.history') {
        session.conversationHistory = [];
        session.pinnedTabId = null;
        session.pinnedTabUrl = null;
        session.consoleLogs = [];
        broadcastToUI({ type: 'chat.tab_unpinned' });
        persistSession();
        sendResponse({ ok: true });
        return false;
      }
      sendResponse({ ok: false, error: 'Unknown command' });
      return false;
    }

    if (type === 'agentic.config.get') {
      chrome.storage.local.get([
        'provider', 'apiEndpoint', 'apiKey', 'model', 'customModel',
        'thinkingEnabled', 'systemPrompt', 'systemPromptProfile',
        'systemPromptProfiles', 'permissionMode'
      ])
        .then(async rawCfg => {
          const resolvedCfg = await getConfig();
          sendResponse({
            ok: true,
            config: {
              ...rawCfg,
              systemPromptProfile: resolvedCfg.systemPromptProfile,
              systemPromptProfiles: normalizePromptOverrides(rawCfg.systemPromptProfiles),
              resolvedSystemPrompt: resolvedCfg.systemPrompt
            },
            promptProfiles: getPromptProfileCatalog()
          });
        })
        .catch(err => sendResponse({ ok: false, error: err?.message || String(err) }));
      return true;
    }

    if (type === 'agentic.config.set') {
      chrome.storage.local.set(payload).then(() => sendResponse({ ok: true })).catch(err => sendResponse({ ok: false, error: err?.message }));
      return true;
    }

    if (type === 'agentic.stop') {
      session.abortController?.abort();
      sendResponse({ ok: true });
      return false;
    }

    if (type === 'agentic.reload') {
      sendResponse({ ok: true });
      setTimeout(() => chrome.runtime.reload(), 100);
      return false;
    }

    if (type === 'agentic.approval.approve') { approveAction(payload.txId); sendResponse({ ok: true }); return false; }
    if (type === 'agentic.approval.reject')  { rejectAction(payload.txId);  sendResponse({ ok: true }); return false; }

    if (type === 'agentic.handshake') {
      sha256(arrayBufferToHex(session.nonce) + 'handshake-response').then(hash => sendResponse({ ok: true, hash }));
      return true;
    }

    if (type === 'agentic.status') {
      sendResponse({ ok: true, isProcessing: session.isProcessing, historyLength: session.conversationHistory.length });
      return false;
    }
  });

  // ======== Action Click ======================================================
  chrome.action.onClicked.addListener((tab) => {
    chrome.sidePanel.open({ tabId: tab.id });
  });

  // ======== Console Log Capture ===============================================
  chrome.debugger.onEvent.addListener((source, method, params) => {
    // Only process events from the pinned tab to avoid cross-tab contamination
    if (session.pinnedTabId && source.tabId !== session.pinnedTabId) return;

    if (method === 'Log.entryAdded') {
      session.consoleLogs.push({ level: params.entry?.level, text: params.entry?.text, timestamp: params.entry?.timestamp });
      if (session.consoleLogs.length > 200) session.consoleLogs.shift();
    }
    if (method === 'Page.javascriptDialogOpening') {
      session.activeDialog = { type: params.type || 'alert', message: params.message || '' };
    }
    if (method === 'Page.javascriptDialogClosed') {
      session.activeDialog = null;
    }
  });

  // ======== Tab Cleanup =======================================================
  chrome.tabs.onRemoved.addListener((tabId) => {
    if (session.devToolsTarget === tabId) { session.isDevToolsAttached = false; session.devToolsTarget = null; }
    for (const [k, v] of session.pendingApprovals) {
      if (v.targetTabId === tabId) { v.reject(new Error('Tab closed')); session.pendingApprovals.delete(k); }
    }
  });

  // ======== Init ==============================================================
  (async function init() {
    session.nonce = generateNonce();
    await restoreSession();
    log.info('Init', `Service Worker initialized. EXT_ID: ${EXT_ID}`);
  })();
})();
