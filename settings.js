(function () {
  'use strict';

  const PRESETS = {
    deepseek: {
      endpoint: 'https://api.deepseek.com/v1',
      model: 'deepseek-v4-flash',
      endpointEditable: false,
      keyHint: 'Obtenha em <a href="https://platform.deepseek.com/api_keys" target="_blank">platform.deepseek.com</a>.'
    },
    openai: {
      endpoint: 'https://api.openai.com/v1',
      model: 'gpt-4o',
      endpointEditable: false,
      keyHint: 'Obtenha em <a href="https://platform.openai.com/api-keys" target="_blank">platform.openai.com</a>.'
    },
    local: {
      endpoint: 'http://localhost:1234/v1',
      model: 'local-model',
      endpointEditable: true,
      keyHint: 'Deixe vazio — LM Studio não exige chave de API.'
    }
  };

  const DEFAULT_SYSTEM_PROMPT = 'You are a helpful browser automation assistant with full access to the user\'s browser. You can navigate pages, click elements, type text, extract data, and run JavaScript. Help the user accomplish tasks efficiently. Be concise in your responses.';

  // DOM refs
  const providerGrid    = document.getElementById('providerGrid');
  const endpointField   = document.getElementById('endpointField');
  const endpointEl      = document.getElementById('apiEndpoint');
  const keyEl           = document.getElementById('apiKey');
  const keyHint         = document.getElementById('keyHint');
  const modelEl         = document.getElementById('model');
  const customModelField= document.getElementById('customModelField');
  const customModelEl   = document.getElementById('customModel');
  const freeModeEl      = document.getElementById('freeMode');
  const modeWarning     = document.getElementById('modeWarning');
  const thinkingEl      = document.getElementById('thinkingEnabled');
  const thinkingRow     = document.getElementById('thinkingRow');
  const systemEl        = document.getElementById('systemPrompt');
  const feedback        = document.getElementById('feedback');

  const optDeepSeek = document.getElementById('optDeepSeek');
  const optOpenAI   = document.getElementById('optOpenAI');
  const optLocal    = document.getElementById('optLocal');

  let currentProvider = 'deepseek';

  // ======== Provider switching ================================================
  function setProvider(provider, keepValues = false) {
    currentProvider = provider;
    const preset = PRESETS[provider];

    document.querySelectorAll('.provider-card').forEach(c =>
      c.classList.toggle('active', c.dataset.provider === provider)
    );

    // Endpoint
    endpointField.style.display = (provider === 'local') ? 'block' : 'none';
    if (!keepValues || provider !== 'local') endpointEl.value = preset.endpoint;

    // Key hint
    keyHint.innerHTML = preset.keyHint;

    // Model optgroups
    optDeepSeek.style.display = provider === 'deepseek' ? '' : 'none';
    optOpenAI.style.display   = provider === 'openai'   ? '' : 'none';
    optLocal.style.display    = provider === 'local'    ? '' : 'none';

    // Custom model field (LM Studio)
    customModelField.style.display = (provider === 'local') ? 'block' : 'none';

    if (!keepValues) modelEl.value = preset.model;

    // Thinking row (only relevant for DeepSeek reasoner)
    thinkingRow.style.display = (provider === 'deepseek') ? 'flex' : 'none';
  }

  providerGrid.addEventListener('click', (e) => {
    const card = e.target.closest('.provider-card');
    if (card) setProvider(card.dataset.provider);
  });

  // ======== Free mode warning =================================================
  freeModeEl.addEventListener('change', () => {
    modeWarning.classList.toggle('visible', freeModeEl.checked);
  });

  // ======== Feedback ==========================================================
  function showFeedback(msg, ok) {
    feedback.innerHTML = `<span style="color:${ok ? '#22c55e' : '#ef4444'}">${msg}</span>`;
    setTimeout(() => { feedback.innerHTML = ''; }, 3000);
  }

  // ======== Load settings =====================================================
  async function load() {
    const cfg = await chrome.storage.local.get([
      'provider', 'apiEndpoint', 'apiKey', 'model',
      'thinkingEnabled', 'systemPrompt', 'permissionMode', 'customModel'
    ]);

    const provider = cfg.provider || 'deepseek';
    setProvider(provider, true);

    if (cfg.apiEndpoint) endpointEl.value = cfg.apiEndpoint;
    keyEl.value = cfg.apiKey || '';

    // Set model
    if (provider === 'local') {
      customModelEl.value = cfg.customModel || cfg.model || '';
      modelEl.value = 'local-model';
    } else {
      modelEl.value = cfg.model || PRESETS[provider].model;
    }

    thinkingEl.checked = cfg.thinkingEnabled ?? false;
    systemEl.value     = cfg.systemPrompt || '';

    const isFree = (cfg.permissionMode === 'auto');
    freeModeEl.checked = isFree;
    modeWarning.classList.toggle('visible', isFree);
  }

  // ======== Save ==============================================================
  document.getElementById('saveBtn').addEventListener('click', async () => {
    const preset = PRESETS[currentProvider];
    const apiEndpoint = currentProvider === 'local'
      ? (endpointEl.value.trim() || preset.endpoint)
      : preset.endpoint;

    const model = currentProvider === 'local'
      ? (customModelEl.value.trim() || 'local-model')
      : modelEl.value;

    const payload = {
      provider:        currentProvider,
      apiEndpoint,
      apiKey:          keyEl.value.trim(),
      model,
      customModel:     customModelEl.value.trim(),
      thinkingEnabled: thinkingEl.checked,
      systemPrompt:    systemEl.value.trim(),
      permissionMode:  freeModeEl.checked ? 'auto' : 'ask'
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
    keyEl.value        = '';
    thinkingEl.checked = false;
    freeModeEl.checked = false;
    modeWarning.classList.remove('visible');
    systemEl.value     = '';

    try {
      await chrome.runtime.sendMessage({
        type: 'agentic.config.set',
        payload: {
          provider: 'deepseek',
          apiEndpoint: 'https://api.deepseek.com/v1',
          apiKey: '',
          model: 'deepseek-v4-flash',
          thinkingEnabled: false,
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
