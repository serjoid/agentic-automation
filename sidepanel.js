(function () {
  'use strict';

  const chatArea   = document.getElementById('chatArea');
  const input      = document.getElementById('input');
  const sendBtn    = document.getElementById('sendBtn');
  const stopBtn    = document.getElementById('stopBtn');
  const reloadBtn  = document.getElementById('reloadBtn');
  const clearBtn   = document.getElementById('clearBtn');
  const settingsBtn= document.getElementById('settingsBtn');
  const modeToggle = document.getElementById('modeToggle');
  const modeIcon   = document.getElementById('modeIcon');
  const modeLabel  = document.getElementById('modeLabel');
  const statusDot  = document.getElementById('statusDot');
  const pinnedTabEl    = document.getElementById('pinnedTab');
  const pinnedTabLabel = document.getElementById('pinnedTabLabel');

  let isProcessing = false;
  let permissionMode = 'ask'; // 'ask' | 'auto'

  // ======== Markdown renderer and escapeHtml are now imported from utils.js =====

  // ======== DOM helpers ========================================================
  function scrollToBottom() {
    chatArea.scrollTo({ top: chatArea.scrollHeight, behavior: 'smooth' });
  }

  function appendElement(el) {
    chatArea.appendChild(el);
    scrollToBottom();
    return el;
  }

  function addMessage(role, htmlContent) {
    const wrapper = document.createElement('div');
    wrapper.className = `msg ${role}`;
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.innerHTML = htmlContent;
    wrapper.appendChild(bubble);
    return appendElement(wrapper);
  }

  function addError(text) {
    const el = document.createElement('div');
    el.className = 'msg-error';
    el.textContent = text;
    return appendElement(el);
  }

  function addThinkingBlock(reasoning) {
    const el = document.createElement('details');
    el.className = 'thinking-block';
    const summary = document.createElement('summary');
    summary.textContent = 'Raciocínio interno';
    const pre = document.createElement('pre');
    pre.textContent = reasoning;
    el.appendChild(summary);
    el.appendChild(pre);
    return appendElement(el);
  }

  let thinkingEl = null;
  function showThinking() {
    if (thinkingEl) return;
    thinkingEl = document.createElement('div');
    thinkingEl.className = 'thinking';
    thinkingEl.innerHTML = `
      <div class="thinking-dots">
        <span></span><span></span><span></span>
      </div>
      <span>Pensando...</span>`;
    appendElement(thinkingEl);
  }

  function hideThinking() {
    if (thinkingEl) { thinkingEl.remove(); thinkingEl = null; }
  }

  function updateThinkingLabel(text) {
    if (thinkingEl) {
      const span = thinkingEl.querySelector('span');
      if (span) span.textContent = text;
    }
  }

  function addApproval({ txId, action, detail }) {
    const id = `approval-${txId}`;
    if (document.getElementById(id)) return;
    const el = document.createElement('div');
    el.className = 'approval-card';
    el.id = id;
    el.innerHTML = `
      <div class="approval-title">⚠️ Aprovação necessária: ${escapeHtml(String(action))}</div>
      <div class="approval-detail">${escapeHtml(JSON.stringify(detail, null, 2))}</div>
      <div class="approval-actions">
        <button class="btn-approve" data-txid="${txId}">✓ Aprovar</button>
        <button class="btn-reject"  data-txid="${txId}">✕ Rejeitar</button>
      </div>`;
    el.querySelector('.btn-approve').addEventListener('click', () => { approve(txId); el.remove(); });
    el.querySelector('.btn-reject').addEventListener('click', () => { reject(txId); el.remove(); });
    appendElement(el);
  }

  // ======== Mode toggle ========================================================
  async function loadMode() {
    const cfg = await chrome.storage.local.get('permissionMode');
    setMode(cfg.permissionMode || 'ask', false);
  }

  function setMode(mode, save = true) {
    permissionMode = mode;
    if (mode === 'auto') {
      modeToggle.className = 'mode-toggle free';
      modeIcon.textContent = '⚡';
      modeLabel.textContent = 'Modo livre';
    } else {
      modeToggle.className = 'mode-toggle';
      modeIcon.textContent = '🔒';
      modeLabel.textContent = 'Pedir aprovação';
    }
    if (save) chrome.storage.local.set({ permissionMode: mode });
  }

  modeToggle.addEventListener('click', () => {
    setMode(permissionMode === 'ask' ? 'auto' : 'ask');
  });

  // ======== Send message =======================================================
  function setProcessing(val) {
    isProcessing = val;
    sendBtn.disabled = val;
    input.disabled = val;
    stopBtn.classList.toggle('visible', val);
  }

  async function sendChat() {
    const text = input.value.trim();
    if (!text || isProcessing) return;

    addMessage('user', escapeHtml(text));
    input.value = '';
    autoResize();
    setProcessing(true);
    showThinking();

    try {
      await chrome.runtime.sendMessage({ type: 'agentic.chat', payload: { message: text } });
    } catch (err) {
      hideThinking();
      addError('Erro ao enviar: ' + (err?.message || String(err)));
      setProcessing(false);
    }
  }

  // ======== Approval actions ===================================================
  function approve(txId) {
    chrome.runtime.sendMessage({ type: 'agentic.approval.approve', payload: { txId } }).catch(() => {});
  }
  function reject(txId) {
    chrome.runtime.sendMessage({ type: 'agentic.approval.reject', payload: { txId } }).catch(() => {});
  }

  // ======== Background messages ================================================
  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg) return;

    if (msg.type === 'chat.thinking') {
      showThinking();
    }

    if (msg.type === 'chat.tool_calls') {
      const names = (msg.tool_calls || []).map(tc => tc.function.name).join(', ');
      showThinking();
      updateThinkingLabel(`${names}…`);
    }

    if (msg.type === 'chat.tool_results') {
      updateThinkingLabel('Pensando…');
    }

    if (msg.type === 'chat.response') {
      hideThinking();
      setProcessing(false);
      const p = msg.payload;
      if (p?.reasoning_content) addThinkingBlock(p.reasoning_content);
      const content = p?.content || '';
      addMessage('assistant', renderMarkdown(content));
    }

    if (msg.type === 'chat.stopped') {
      hideThinking();
      setProcessing(false);
      const el = document.createElement('div');
      el.className = 'msg-error';
      el.style.borderColor = 'rgba(100,116,139,0.4)';
      el.style.color = '#94a3b8';
      el.textContent = '⏹ Agente parado.';
      chatArea.appendChild(el);
      chatArea.scrollTo({ top: chatArea.scrollHeight, behavior: 'smooth' });
    }

    if (msg.type === 'chat.error') {
      hideThinking();
      setProcessing(false);
      addError(msg.error || 'Erro desconhecido');
    }

    if (msg.type === 'approval.request') {
      hideThinking();
      addApproval({ txId: msg.txId, action: msg.action, detail: msg.detail });
    }

    // Tab isolation events
    if (msg.type === 'chat.tab_pinned') {
      setPinnedTab(msg.title || msg.url || `Tab ${msg.tabId}`);
    }
    if (msg.type === 'chat.tab_unpinned') {
      clearPinnedTab();
    }
    if (msg.type === 'chat.tab_lost') {
      clearPinnedTab();
      addError('A aba da sessão foi fechada. Limpe a conversa para reiniciar.');
    }
  });

  // ======== UI events ==========================================================
  stopBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'agentic.stop' }).catch(() => {});
  });

  sendBtn.addEventListener('click', sendChat);

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChat();
    }
  });

  input.addEventListener('input', autoResize);

  function autoResize() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 140) + 'px';
  }

  reloadBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'agentic.reload' }).catch(() => {});
  });

  clearBtn.addEventListener('click', async () => {
    chatArea.innerHTML = '';
    clearPinnedTab();
    showWelcome();
    await chrome.runtime.sendMessage({ type: 'agentic.command', payload: { command: 'clear.history' } }).catch(() => {});
  });

  settingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage?.();
  });

  // ======== Pinned tab badge ===================================================
  function setPinnedTab(label) {
    pinnedTabLabel.textContent = label;
    pinnedTabEl.classList.add('visible');
  }

  function clearPinnedTab() {
    pinnedTabLabel.textContent = '--';
    pinnedTabEl.classList.remove('visible');
  }

  // ======== Onboarding =========================================================
  function showWelcome() {
    if (chatArea.children.length > 0) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'msg assistant';
    wrapper.id = 'welcomeMsg';
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.innerHTML = `
      <p><strong>👋 Olá!</strong> Sou o Agentic, seu assistente de automação.</p>
      <p>Digite uma tarefa em linguagem natural — eu navego, clico, preencho formulários e extraío dados na aba atual.</p>
      <p>Exemplos: <em>"Extraia os dados da tabela"</em>, <em>"Preencha o formulário com..."</em></p>`;
    wrapper.appendChild(bubble);
    chatArea.appendChild(wrapper);
  }

  // ======== Init ===============================================================
  loadMode();
  showWelcome();

  chrome.runtime.sendMessage({ type: 'agentic.handshake' }).then(() => {
    statusDot.classList.add('ok');
  }).catch(() => {
    statusDot.classList.remove('ok');
  });
})();
