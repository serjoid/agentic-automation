(function () {
  'use strict';

  const PRESETS = {
    deepseek: {
      endpoint: 'https://api.deepseek.com/v1',
      model: 'deepseek-v4-flash',
      endpointEditable: false,
      customModel: false,
      keyHint: 'Obtenha em <a href="https://platform.deepseek.com/api_keys" target="_blank">platform.deepseek.com</a>.'
    },
    openai: {
      endpoint: 'https://api.openai.com/v1',
      model: 'gpt-4o',
      endpointEditable: false,
      customModel: false,
      keyHint: 'Obtenha em <a href="https://platform.openai.com/api-keys" target="_blank">platform.openai.com</a>.'
    },
    local: {
      endpoint: 'http://localhost:1234/v1',
      model: 'local-model',
      endpointEditable: true,
      customModel: true,
      keyHint: 'Deixe vazio — LM Studio não exige chave de API.'
    },
    ollama: {
      endpoint: 'http://localhost:11434/v1',
      model: 'llama3.1',
      endpointEditable: true,
      customModel: true,
      keyHint: 'Deixe vazio — Ollama local não exige chave de API.'
    }
  };

  const FALLBACK_PROMPT_PROFILES = {
    default: {
      label: 'Automação geral',
      description: 'Navegação, leitura, cliques e tarefas comuns no navegador.',
      prompt: 'You are a helpful browser automation assistant with full access to the user browser. Be concise, safe, and efficient.'
    },
    'sei-sip': {
      label: 'SEI/SIP administrativo',
      description: 'Rotinas SEI/SIP, segurança institucional e domínio administrativo brasileiro.',
      prompt: ''
    },
    'data-extraction': {
      label: 'Extração de dados',
      description: 'Coleta estruturada de páginas, tabelas e listas, com exportação.',
      prompt: 'You are a browser data extraction assistant. Extract structured data accurately and export useful formats without inventing missing values.'
    },
    'form-filling': {
      label: 'Preenchimento de formulários',
      description: 'Preenchimento cauteloso, validação e confirmação antes de envio.',
      prompt: 'You are a careful browser form-filling assistant. Verify fields and never submit consequential forms without explicit confirmation.'
    }
  };

  // DOM refs
  const providerGrid       = document.getElementById('providerGrid');
  const endpointField      = document.getElementById('endpointField');
  const endpointEl         = document.getElementById('apiEndpoint');
  const keyEl              = document.getElementById('apiKey');
  const keyHint            = document.getElementById('keyHint');
  const modelEl            = document.getElementById('model');
  const customModelField   = document.getElementById('customModelField');
  const customModelEl      = document.getElementById('customModel');
  const customModelLabel   = document.getElementById('customModelLabel');
  const customModelHint    = document.getElementById('customModelHint');
  const freeModeEl         = document.getElementById('freeMode');
  const modeWarning        = document.getElementById('modeWarning');
  const thinkingEl         = document.getElementById('thinkingEnabled');
  const thinkingRow        = document.getElementById('thinkingRow');
  const promptProfileEl    = document.getElementById('systemPromptProfile');
  const promptProfileHint  = document.getElementById('systemPromptProfileHint');
  const systemEl           = document.getElementById('systemPrompt');
  const resetPromptBtn     = document.getElementById('resetPromptBtn');
  const feedback           = document.getElementById('feedback');

  const optDeepSeek = document.getElementById('optDeepSeek');
  const optOpenAI   = document.getElementById('optOpenAI');
  const optLocal    = document.getElementById('optLocal');
  const optOllama   = document.getElementById('optOllama');

  let currentProvider = 'deepseek';
  let currentPromptProfile = 'sei-sip';
  let promptProfilesCatalog = { ...FALLBACK_PROMPT_PROFILES };
  let systemPromptProfiles = {};
  let isLoadingPrompts = false;

  // ======== Provider switching ================================================
  function setProvider(provider, keepValues = false) {
    currentProvider = PRESETS[provider] ? provider : 'deepseek';
    const preset = PRESETS[currentProvider];

    document.querySelectorAll('.provider-card').forEach(c =>
      c.classList.toggle('active', c.dataset.provider === currentProvider)
    );

    endpointField.style.display = preset.endpointEditable ? 'block' : 'none';
    if (!keepValues || !preset.endpointEditable) endpointEl.value = preset.endpoint;

    keyHint.innerHTML = preset.keyHint;

    optDeepSeek.style.display = currentProvider === 'deepseek' ? '' : 'none';
    optOpenAI.style.display   = currentProvider === 'openai'   ? '' : 'none';
    optLocal.style.display    = currentProvider === 'local'    ? '' : 'none';
    optOllama.style.display   = currentProvider === 'ollama'   ? '' : 'none';

    customModelField.style.display = preset.customModel ? 'block' : 'none';
    if (preset.customModel) {
      customModelLabel.textContent = currentProvider === 'ollama' ? 'Nome do modelo (Ollama)' : 'Nome do modelo (LM Studio)';
      customModelHint.textContent = currentProvider === 'ollama'
        ? 'Use o nome exibido por ollama list, por exemplo llama3.1 ou qwen2.5.'
        : 'Exato nome conforme carregado no LM Studio.';
    }

    if (!keepValues) {
      modelEl.value = preset.model;
      customModelEl.value = preset.customModel ? preset.model : '';
    }

    thinkingRow.style.display = currentProvider === 'deepseek' ? 'flex' : 'none';
  }

  providerGrid.addEventListener('click', (e) => {
    const card = e.target.closest('.provider-card');
    if (card) setProvider(card.dataset.provider);
  });

  // ======== Prompt profiles ===================================================
  function getProfilePrompt(profileId) {
    const custom = systemPromptProfiles[profileId];
    if (typeof custom === 'string' && custom.trim()) return custom;
    return promptProfilesCatalog[profileId]?.prompt || '';
  }

  function captureCurrentPrompt() {
    if (isLoadingPrompts || !currentPromptProfile) return;
    systemPromptProfiles[currentPromptProfile] = systemEl.value.trim();
  }

  function renderPromptProfiles() {
    promptProfileEl.innerHTML = '';
    for (const [id, profile] of Object.entries(promptProfilesCatalog)) {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = profile.label;
      promptProfileEl.appendChild(opt);
    }
  }

  function setPromptProfile(profileId, capture = true) {
    if (capture) captureCurrentPrompt();
    currentPromptProfile = promptProfilesCatalog[profileId] ? profileId : 'sei-sip';
    promptProfileEl.value = currentPromptProfile;
    systemEl.value = getProfilePrompt(currentPromptProfile);
    promptProfileHint.textContent = promptProfilesCatalog[currentPromptProfile]?.description || '';
  }

  promptProfileEl.addEventListener('change', () => {
    setPromptProfile(promptProfileEl.value);
  });

  resetPromptBtn.addEventListener('click', () => {
    systemPromptProfiles[currentPromptProfile] = promptProfilesCatalog[currentPromptProfile]?.prompt || '';
    systemEl.value = systemPromptProfiles[currentPromptProfile];
    showFeedback('Prompt do perfil restaurado.', true);
  });

  // ======== Free mode warning =================================================
  freeModeEl.addEventListener('change', () => {
    modeWarning.classList.toggle('visible', freeModeEl.checked);
  });

  // ======== Feedback ==========================================================
  function showFeedback(msg, ok) {
    const span = document.createElement('span');
    span.style.color = ok ? '#22c55e' : '#ef4444';
    span.textContent = msg;
    feedback.replaceChildren(span);
    setTimeout(() => { feedback.replaceChildren(); }, 3000);
  }

  async function loadConfigFromBackground() {
    try {
      const res = await chrome.runtime.sendMessage({ type: 'agentic.config.get' });
      if (res?.ok) return res;
    } catch (_) {}

    const cfg = await chrome.storage.local.get([
      'provider', 'apiEndpoint', 'apiKey', 'model', 'customModel',
      'thinkingEnabled', 'systemPrompt', 'systemPromptProfile',
      'systemPromptProfiles', 'permissionMode'
    ]);
    return { ok: true, config: cfg, promptProfiles: FALLBACK_PROMPT_PROFILES };
  }

  // ======== Load settings =====================================================
  async function load() {
    isLoadingPrompts = true;
    const res = await loadConfigFromBackground();
    const cfg = res.config || {};

    promptProfilesCatalog = res.promptProfiles || FALLBACK_PROMPT_PROFILES;
    systemPromptProfiles = { ...(cfg.systemPromptProfiles || {}) };

    // Backward compatibility for installs that saved only the old single prompt.
    if (cfg.systemPrompt && !systemPromptProfiles['sei-sip']) {
      systemPromptProfiles['sei-sip'] = cfg.systemPrompt;
    }

    renderPromptProfiles();

    const provider = cfg.provider || 'deepseek';
    setProvider(provider, true);

    if (cfg.apiEndpoint) endpointEl.value = cfg.apiEndpoint;
    keyEl.value = cfg.apiKey || '';

    if (PRESETS[provider]?.customModel) {
      modelEl.value = PRESETS[provider].model;
      customModelEl.value = cfg.customModel || cfg.model || PRESETS[provider].model;
    } else {
      modelEl.value = cfg.model || PRESETS[provider]?.model || PRESETS.deepseek.model;
      customModelEl.value = cfg.customModel || '';
    }

    thinkingEl.checked = cfg.thinkingEnabled ?? false;
    setPromptProfile(cfg.systemPromptProfile || 'sei-sip', false);

    const isFree = cfg.permissionMode === 'auto';
    freeModeEl.checked = isFree;
    modeWarning.classList.toggle('visible', isFree);
    isLoadingPrompts = false;
  }

  // ======== Save ==============================================================
  document.getElementById('saveBtn').addEventListener('click', async () => {
    captureCurrentPrompt();

    const preset = PRESETS[currentProvider];
    const apiEndpoint = preset.endpointEditable
      ? (endpointEl.value.trim() || preset.endpoint)
      : preset.endpoint;

    const model = preset.customModel
      ? (customModelEl.value.trim() || preset.model)
      : modelEl.value;

    const payload = {
      provider: currentProvider,
      apiEndpoint,
      apiKey: keyEl.value.trim(),
      model,
      customModel: preset.customModel ? model : customModelEl.value.trim(),
      thinkingEnabled: thinkingEl.checked,
      systemPromptProfile: currentPromptProfile,
      systemPromptProfiles,
      // Keep the legacy key populated for older background versions.
      systemPrompt: systemPromptProfiles[currentPromptProfile] || '',
      permissionMode: freeModeEl.checked ? 'auto' : 'ask'
    };

    try {
      const res = await chrome.runtime.sendMessage({ type: 'agentic.config.set', payload });
      if (res?.ok) showFeedback('Configurações salvas.', true);
      else showFeedback('Falha ao salvar.', false);
    } catch (err) {
      showFeedback('Erro: ' + (err?.message || String(err)), false);
    }
  });

  // ======== Reset =============================================================
  document.getElementById('resetBtn').addEventListener('click', async () => {
    setProvider('deepseek');
    keyEl.value = '';
    customModelEl.value = '';
    thinkingEl.checked = false;
    freeModeEl.checked = false;
    modeWarning.classList.remove('visible');
    systemPromptProfiles = {};
    setPromptProfile('sei-sip', false);

    try {
      await chrome.runtime.sendMessage({
        type: 'agentic.config.set',
        payload: {
          provider: 'deepseek',
          apiEndpoint: 'https://api.deepseek.com/v1',
          apiKey: '',
          model: 'deepseek-v4-flash',
          customModel: '',
          thinkingEnabled: false,
          systemPromptProfile: 'sei-sip',
          systemPromptProfiles: {},
          systemPrompt: '',
          permissionMode: 'ask'
        }
      });
      showFeedback('Configurações restauradas.', true);
    } catch (err) {
      showFeedback('Erro ao restaurar.', false);
    }
  });

  load();
})();
