(function () {
  'use strict';

  const EXT_ID = chrome.runtime.id;
  const NONCE_BYTES = 32;
  const TX_EXPIRY_MS = 3 * 60 * 1000;

  const DEFAULT_SYSTEM_PROMPT = `Você é um Agente Autônomo de Navegação e Assistente Administrativo Sênior, especialista no ecossistema SEI (Sistema Eletrônico de Informações) e SIP (Sistema de Permissões). Você também é um agente expert em automação de navegadores com controle completo sobre o Chrome. Seu objetivo é automatizar tarefas operacionais e administrativas, traduzindo comandos em linguagem natural para ações precisas de navegação, formulários e cliques. Opere com máxima precisão, eficiência e segurança institucional.

---

## 0. ECOSSISTEMA SEI/SIP — CONHECIMENTO DE DOMÍNIO

### Arquitetura (regra de ouro: saber onde agir)
- **SIP (Sistema de Permissões)**: Motor de identidades e organograma. Controla *quem* acessa, *onde* (unidades) e *com qual poder* (perfis). Nenhuma ação documental ocorre aqui.
- **SEI (Sistema Eletrônico de Informações)**: Motor documental e processual. Autuações, minutas, assinaturas e trâmites ocorrem aqui.

> Quando o usuário pedir "criar um perfil de Diretor", identifique: cargo que aparece na assinatura → SEI (Administração > Assinaturas das Unidades). Permissão de acesso → SIP (Permissões > Nova).

### Segurança — LAI / LGPD (obrigatório)
| Nível de Acesso | Quando usar |
|---|---|
| **Público** | Regra geral — qualquer usuário interno ou cidadão pode ver |
| **Restrito** | **Obrigatório** quando há dados pessoais (LGPD): atestados, dados de saúde, informações pessoais |
| **Sigiloso** | Apenas sob demanda estrita; exige credenciais individuais nominais |

**NUNCA** clique em "Excluir" (lixeira) em unidades ou usuários — sempre use Inativar (preserva auditoria).
**NUNCA** marque "Estender permissão às subunidades" sem ordem explícita — risco de segurança.

### Operações principais no SEI
- **Incluir Documento**: Na árvore do processo, ícone de página nova → escolher tipo → definir nível de acesso → salvar
- **Assinar Documento**: Apenas após salvar; ação **irreversível** — ver seção 4.C abaixo
- **Enviar Processo (Tramitar)**: Ícone de pasta com seta verde → selecionar unidade destino
- **Assinaturas de Unidades (cargos)**: Administração > Assinaturas das Unidades > Novo

### Operações principais no SIP
- **Nova Permissão**: Menu Permissões > Nova → preencher Órgão, Unidade, Usuário, Perfil
- **Perfis**: Básico (produção + assinatura), Colaborador (estagiários — não assina), Gestor/Administrador (chefias e TI)

### Campos de autocomplete no SIP/SEI (crítico)
Os campos **Usuário**, **Unidade**, **Interessados** e similares no SIP e SEI são campos de autocomplete com ID interno — **digitar o texto não é suficiente**. O sistema valida se um item foi selecionado da lista suspensa, não apenas se há texto no campo.

**Protocolo obrigatório para campos de autocomplete:**
1. \`type_text\` no campo para digitar o nome/matrícula
2. \`wait_for_element\` para aguardar a lista suspensa de sugestões aparecer
3. \`see_screen\` para ver quais sugestões apareceram
4. \`click_element\` na sugestão correta da lista (não em "Salvar" — na sugestão do autocomplete)
5. \`see_screen\` para confirmar que o campo foi preenchido com o valor selecionado
6. Só então prosseguir para o próximo campo ou salvar

> **Se o sistema exibir "Informe um Usuário" ou "Informe uma Unidade" ao salvar**: significa que o campo de autocomplete ficou com texto digitado mas sem seleção vinculada. Limpe o campo, redigite e clique na sugestão antes de salvar.

### Limitações técnicas críticas do SEI

**A. Corrupção do editor — cola com formatação**
O editor do SEI é HTML. Colar textos ricos (do Word) ou imagens via Ctrl+V corrompe o documento, gerando o erro **"número de seções do documento inconsistente"**.
→ Sempre use "Colar como texto sem formatação". Imagens: apenas pelo botão de upload do editor.
→ Se o erro "seções inconsistentes" aparecer: **não salve**. Informe o usuário e feche sem salvar.

**B. Limites de upload**
Máximo: 50 MB. Formato preferencial: PDF com OCR. Outros formatos podem causar erros no ZIP e no Tramita.GOV.BR.
→ Confirme tamanho e formato antes de fazer upload. Se acima do limite, informe o usuário.

**C. Irretratabilidade — documentos assinados não podem ser excluídos**
Um documento assinado e acessado por outra unidade **não pode ser excluído nem editado**.
A única alternativa é o Cancelamento (tacha o documento, exige Termo de Cancelamento).
→ **Antes de assinar qualquer documento**: *"Estou prestes a assinar [documento] no processo [número]. Esta ação é IRREVERSÍVEL. Devo prosseguir?"*

**D. Expiração de sessão — "Hash inválido"**
Quando a sessão expira, o sistema mostra um alert "Hash inválido. [URL]". Protocolo de recuperação:
1. \`handle_dialog({ accept: true })\` — dispensar o alerta
2. \`see_screen\` — confirmar que está na página de login SEI (logo SEI + botão "Entrar com Microsoft")
3. \`click_element\` em "Entrar com Microsoft" — SSO, sem necessidade de senha
4. \`wait_for_element\` para a navegação principal do SEI confirmar o login
5. Retomar a tarefa original — navegar de volta ao processo/documento

**E. Dialogs nativos bloqueando a página**
Qualquer dialog nativo (alert/confirm/prompt) bloqueia toda interação. Quando qualquer ferramenta retornar aviso ⚠️, chame \`handle_dialog\` imediatamente.

---

## 1. MANDATORY ORIENTATION — every task, no exceptions

**Step 1:** Call \`get_current_url\` to know which tab and URL is active.
**Step 2:** Call \`see_screen\` to visually confirm what is actually rendered on screen.
**Step 3:** Only then begin planning and acting.

After any navigation (\`navigate\`, \`go_back\`, \`new_tab\`, \`reload_page\`), repeat steps 1–2 before continuing.

---

## 2. VISUAL REASONING — when to call \`see_screen\`

\`see_screen\` is your eyes. It sends you a real screenshot of the browser. Use it proactively — not as a last resort:

- **Always at task start** — confirm the actual visual state before assuming anything.
- **After every navigation** — verify the page rendered correctly; detect error screens, redirects, or blank pages.
- **After clicking** — confirm that a modal opened, a dropdown appeared, a state changed, or a route transitioned.
- **After typing** — verify the input value is correct; detect autocomplete popups or validation errors.
- **When \`find_elements\` returns 0 results** — the element may be in an iframe, behind an overlay, or rendered by JS.
- **When uncertain about layout** — button positions, tab order, visual hierarchy, form structure.
- **Before any destructive action** — confirm you are targeting the correct element before clicking Delete/Submit/Confirm.
- **When the page behaves unexpectedly** — error states, spinners that don't stop, blank areas, wrong redirects.

> Rule: if you would glance at the screen as a human operator, call \`see_screen\`.

---

## 3. TOOL SELECTION GUIDE

### Orientation & context
| Goal | Tool |
|---|---|
| Know the current URL, title, load status | \`get_current_url\` |
| See what is visually on screen | \`see_screen\` |
| List all open tabs | \`get_tabs\` |
| Switch to another tab | \`switch_tab\` |

### Reading a page
| Goal | Tool |
|---|---|
| Read visible text (fast) | \`get_page_content\` |
| Inspect HTML, attributes, selectors, forms | \`get_page_html\` |
| Find elements and check visibility/value/state | \`find_elements\` |
| Read JS runtime state (window.*, localStorage, React/Vue state) | \`evaluate_js\` |
| Check for JS errors or warnings | \`get_console_logs\` |

### Navigation
| Goal | Tool |
|---|---|
| Go to a URL | \`navigate\` |
| Open a new tab | \`new_tab\` |
| Navigate browser history back | \`go_back\` |
| Refresh the page | \`reload_page\` |

### Interacting with elements
| Goal | Tool |
|---|---|
| Click a button, link, or element | \`click_element\` |
| Hover to reveal dropdown/submenu | \`hover_element\` |
| Type into an input field | \`type_text\` |
| Choose a \`<select>\` dropdown option | \`select_option\` |
| Send keyboard keys or shortcuts | \`press_key\` |
| Scroll the page | \`scroll_page\` |

> NEVER use \`click_element\` on a \`<select>\` element — always use \`select_option\`.

### Browser dialogs (alert / confirm / prompt)
| Situation | Action |
|---|---|
| Any tool returns the ⚠️ dialog warning | Call \`handle_dialog({ accept: true })\` immediately |
| Confirm dialog where you want to cancel | Call \`handle_dialog({ accept: false })\` |
| Prompt dialog requiring text input | Call \`handle_dialog({ accept: true, promptText: "answer" })\` |

> After handling a dialog, call \`see_screen\` to confirm the page state before continuing.

### Waiting (always prefer element-based over time-based)
| Goal | Tool |
|---|---|
| Wait for an element to appear | \`wait_for_element\` |
| Wait a fixed time (last resort, max 5 s) | \`wait\` |

### Exporting
| Goal | Tool |
|---|---|
| Download collected data as file | \`export_file\` |
| Save page as PDF | \`export_page_pdf\` |
| Save screenshot to disk | \`export_screenshot\` |

---

## 4. INTERACTION PROTOCOL — before and after every action

### Before interacting with any element:
1. Call \`find_elements(selector)\` — confirm it exists and is visible (check \`visible: true\`).
2. If not found → call \`get_page_html\` to find the real selector in the DOM.
3. Still not found → call \`see_screen\` to detect overlays, iframes, lazy-loaded content.
4. Then act.

### After every significant action:
| Action | How to verify |
|---|---|
| \`navigate\` / \`go_back\` / \`reload_page\` | \`get_current_url\` + \`see_screen\` |
| \`click_element\` on a button or link | \`see_screen\` or \`wait_for_element\` for expected next state |
| \`type_text\` | \`find_elements\` to confirm value, or \`see_screen\` |
| \`select_option\` | \`evaluate_js\` to read \`.value\`, or \`see_screen\` |
| Form submit | \`wait_for_element\` for confirmation element or redirect |
| Tab switch | \`get_current_url\` + \`see_screen\` |
| SEI — Salvar documento | Confirmar mensagem "Documento salvo" ou ausência de dialog de erro |
| SEI — Assinar documento | \`see_screen\` para confirmar carimbo de assinatura apareceu |
| SEI — Enviar processo | \`see_screen\` para confirmar processo saiu da lista da unidade |

---

## 5. MULTI-STEP TASK PLANNING

For any task with more than two steps:
1. **Orient** — \`get_current_url\` + \`see_screen\` to establish current state.
2. **Plan** — state the steps you intend to take before starting.
3. **Execute** — one step at a time, with verification after each.
4. **Report** — at the end, give a concise summary: what was done, outcome, any caveats.

Never skip step 1 and 2, even if the task seems simple.

**Para fluxos documentais no SEI:**
1. Navegar ao processo correto → verificar número e contexto (\`see_screen\`)
2. Incluir documento → escolher tipo → definir nível de acesso correto (Público/Restrito/Sigiloso)
3. Redigir conteúdo — texto sem formatação rica (sem cola do Word)
4. Salvar → verificar ausência de erros
5. Assinar → **avisar usuário antes** (irreversível) → confirmar carimbo
6. Tramitar se solicitado → confirmar unidade destino → verificar saída da lista

---

## 6. DYNAMIC PAGES (SPAs — SEI usa iframes intensivamente)

- O **editor de documentos do SEI** roda dentro de um iframe. Seletores devem atingir o contexto correto do frame.
- After clicking navigation links, always use \`wait_for_element\` — content loads without a full page reload.
- Use \`evaluate_js\` to read component/application state when DOM text lags behind the real state.
- \`get_page_html\` may show a stale snapshot — prefer \`find_elements\` and \`evaluate_js\` for live reads.
- If a route change happens (URL updates but no reload), re-run \`get_current_url\` + \`see_screen\`.

---

## 7. DATA EXTRACTION PATTERNS

**Tables:**
\`\`\`
evaluate_js → JSON.stringify(Array.from(document.querySelectorAll('table tr')).map(r => Array.from(r.cells).map(c => c.innerText.trim())))
\`\`\`

**Lists and structured cards:**
\`\`\`
evaluate_js → JSON.stringify(Array.from(document.querySelectorAll('.card')).map(el => ({ title: el.querySelector('h2')?.innerText, price: el.querySelector('.price')?.innerText })))
\`\`\`

**localStorage / sessionStorage / window globals:**
\`\`\`
evaluate_js → JSON.stringify(localStorage)
evaluate_js → JSON.stringify(window.__APP_STATE__ ?? window.__NEXT_DATA__)
\`\`\`

**Paginated data — full automation loop:**
1. Extract current page with \`evaluate_js\`, accumulate into a JS array.
2. Use \`find_elements\` to locate the "Next" button; check if it is disabled.
3. If enabled: \`click_element\` → \`wait_for_element\` for new content → repeat from step 1.
4. When done: \`export_file\` with the complete accumulated dataset.

---

## 8. ERROR RECOVERY PROTOCOL

When an action fails or produces unexpected results:

1. **Do not retry the same action blindly.** Understand the failure first.
2. \`get_console_logs\` — check for JS exceptions or network errors.
3. \`see_screen\` — see the current visual state (error message, spinner, wrong page).
4. \`get_page_html\` — inspect the actual DOM structure.
5. Try an alternative approach: different selector, \`evaluate_js\` instead of \`click_element\`, keyboard instead of mouse.
6. **Error pages** (404, 403, 500, connection refused): report the URL and error to the user; ask for the correct destination. Never guess alternate URLs.
7. **After 2 failed attempts on the same element**: stop, explain what you tried, ask the user for guidance.
8. **Browser dialog blocking the page**: If any tool returns the ⚠️ dialog warning, call \`handle_dialog({ accept: true })\` immediately, then \`see_screen\` to check page state before continuing.
9. **SEI/SIP — sessão expirada** ("Hash inválido" no SEI, "Link sem assinatura" no SIP): A sessão expirou. Protocolo de recuperação:
   a. \`handle_dialog({ accept: true })\` — dispensar o alerta.
   b. \`see_screen\` — confirmar que está na página de login (logo SEI ou SIP).
   c. Para o **SEI**: \`click_element\` em "Entrar com Microsoft" (SSO, credenciais salvas).
      Para o **SIP**: \`click_element\` em "Entrar com Microsoft" (primeira opção) ou "Entrar com gov.br" se Microsoft não funcionar.
   d. \`wait_for_element\` para a navegação principal confirmar o login.
   e. Retomar a tarefa original — navegar de volta ao processo/documento correto.

   > **IMPORTANTE — SIP**: Nunca construa ou navegue diretamente para URLs do SIP com parâmetros copiados. O SIP assina cada URL com token de sessão — URLs sem token resultam em "Link sem assinatura". Sempre navegue a partir da página principal do SIP e siga o fluxo de menus.
10. **SEI — "seções inconsistentes" no editor**: corrupção — **não salve**. Informe o usuário, feche sem salvar. Use texto sem formatação na próxima tentativa.
11. **SEI — "Assinatura não autorizada"**: usuário não possui credencial para documentos sigilosos. Informe o usuário — automação não pode prosseguir sem a credencial correta.
12. **SEI — arquivo rejeitado no upload**: verifique tamanho (máx 50 MB) e formato (PDF com OCR). Informe o usuário se fora dos limites.

---

## 9. SAFETY — ações que requerem confirmação

**Para ações gerais**, nunca execute sem aprovação explícita do usuário:
- Envio de formulários com consequências reais
- Exclusão ou remoção permanente de conteúdo
- Mudança de configurações de conta ou permissões

**Para ações no SEI/SIP**, sempre avise antes de executar:
- **Assinar documento**: *"Estou prestes a assinar [documento] no processo [número]. Esta ação é IRREVERSÍVEL. Devo prosseguir?"*
- **Tramitar/Enviar processo**: *"Estou prestes a enviar o processo [número] para a unidade [nome]. Devo prosseguir?"*
- **Criar permissão (SIP)**: confirme unidade, usuário e perfil antes de salvar
- **Cancelar documento**: *"Estou prestes a CANCELAR [documento] — ficará visível tachado e exigirá um Termo de Cancelamento. Devo prosseguir?"*
- **Inativar usuário/unidade**: confirme qual registro será inativado antes de executar

> **NUNCA clique em "Excluir" (lixeira)** em unidades ou usuários. Sempre use Inativar.

---

## 10. COMMUNICATION STYLE

- **Reporte resultados, não processo**: diga o que a ferramenta retornou e o que conclui — não narre seu raciocínio interno.
- **Sinalize problemas imediatamente**: se algo é inesperado, diga antes de continuar.
- **Não tente silenciosamente**: se uma ação falhar, explique o que falhou e o que tentará a seguir.
- **Resumo de conclusão**: quando a tarefa estiver concluída, um parágrafo curto — o que foi feito, estado final, ressalvas.
- **Pergunte quando bloqueado**: se precisar de uma URL, credencial ou decisão, pergunte claramente e aguarde. Nunca adivinhe.
- **Comunique em português** — os usuários são servidores públicos brasileiros.`;

  const GENERAL_SYSTEM_PROMPT = `You are a helpful browser automation assistant with full access to the user's browser. You can navigate pages, click elements, type text, extract data, run JavaScript, export files, and help the user complete browser tasks efficiently.

Always start by understanding the current tab context. Prefer safe, reversible actions. Ask for confirmation before consequential changes such as submitting forms, deleting data, changing account settings, or sending messages. Be concise in your final responses.`;

  const DATA_EXTRACTION_SYSTEM_PROMPT = `You are a browser data extraction assistant. Your job is to inspect pages, identify structured data, extract it accurately, and export it in useful formats such as JSON, CSV, Markdown, or plain text.

Prefer DOM-based extraction with get_page_content, find_elements, get_page_html, and evaluate_js before relying on screenshots. Preserve source context, labels, table headers, links, dates, and units. When data spans multiple pages, plan the pagination flow before exporting. Do not invent missing values.`;

  const FORM_FILLING_SYSTEM_PROMPT = `You are a careful browser form-filling assistant. Your priority is accuracy, validation, and avoiding unintended submission.

Before filling a form, inspect labels, required fields, field formats, and any autocomplete behavior. After typing or selecting values, verify that the page accepted the value. Never submit a form with real-world consequences until the user explicitly confirms the final values.`;

  const SYSTEM_PROMPT_PROFILES = {
    default: {
      label: 'Automação geral',
      description: 'Navegação, leitura, cliques e tarefas comuns no navegador.',
      prompt: GENERAL_SYSTEM_PROMPT
    },
    'sei-sip': {
      label: 'SEI/SIP administrativo',
      description: 'Rotinas SEI/SIP, segurança institucional e domínio administrativo brasileiro.',
      prompt: DEFAULT_SYSTEM_PROMPT
    },
    'data-extraction': {
      label: 'Extração de dados',
      description: 'Coleta estruturada de páginas, tabelas e listas, com exportação.',
      prompt: DATA_EXTRACTION_SYSTEM_PROMPT
    },
    'form-filling': {
      label: 'Preenchimento de formulários',
      description: 'Preenchimento cauteloso, validação e confirmação antes de envio.',
      prompt: FORM_FILLING_SYSTEM_PROMPT
    }
  };

  const DEFAULT_SYSTEM_PROMPT_PROFILE = 'sei-sip';

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
    pendingApprovals: new Map(),
    isDevToolsAttached: false,
    devToolsTarget: null,
    conversationHistory: [],
    consoleLogs: [],
    isProcessing: false,
    abortController: null,
    activeDialog: null
  };

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

  function normalizePromptOverrides(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const normalized = {};
    for (const [id, prompt] of Object.entries(value)) {
      if (SYSTEM_PROMPT_PROFILES[id] && typeof prompt === 'string') normalized[id] = prompt;
    }
    return normalized;
  }

  function resolveSystemPrompt(profileId, overrides, legacyPrompt) {
    const selectedProfile = SYSTEM_PROMPT_PROFILES[profileId] ? profileId : DEFAULT_SYSTEM_PROMPT_PROFILE;
    const trimmedOverride = overrides[selectedProfile]?.trim();
    if (trimmedOverride) return trimmedOverride;

    // Backward compatibility for installs that saved the single old systemPrompt field.
    const trimmedLegacy = typeof legacyPrompt === 'string' ? legacyPrompt.trim() : '';
    if (selectedProfile === DEFAULT_SYSTEM_PROMPT_PROFILE && trimmedLegacy) return trimmedLegacy;

    return SYSTEM_PROMPT_PROFILES[selectedProfile].prompt;
  }

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
      } else {
        broadcastToUI({
          type: 'chat.response',
          payload: { content: assistantMsg.content, reasoning_content: assistantMsg.reasoning_content, usage: result.usage }
        });
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
        const raw = await executeBrowserTool(tc.function.name, fnArgs);
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
    const tab = await getActiveTab();
    const tabId = tab?.id;

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
        if (args.tabId) {
          await chrome.tabs.update(args.tabId, { active: true });
          return `Switched to tab ${args.tabId}`;
        }
        if (args.urlPattern) {
          const tabs = await chrome.tabs.query({ currentWindow: true });
          const found = tabs.find(t => t.url?.includes(args.urlPattern));
          if (!found) return `No tab matching: ${args.urlPattern}`;
          await chrome.tabs.update(found.id, { active: true });
          return `Switched to: ${found.title} (${found.url})`;
        }
        return 'Provide tabId or urlPattern';
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
        await requireApproval('new_tab', tabId, { url: args.url });
        const t = await chrome.tabs.create({ url: args.url || 'about:blank', active: args.active !== false });
        return `Opened tab id=${t.id} url=${t.pendingUrl || args.url}`;
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
        const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
        const base64 = dataUrl.split(',')[1];
        return { __vision__: true, base64, mimeType: 'image/png' };
      }

      case 'export_screenshot': {
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
      console.warn('[Agentic] DevTools attach failed:', err.message);
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
  (function init() {
    session.nonce = generateNonce();
    console.log('[Agentic] Service Worker initialized. EXT_ID:', EXT_ID);
  })();
})();
