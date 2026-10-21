(function () {
  'use strict';

  // ==========================================
  // SUA API KEY DO GEMINI
  // ==========================================
  const GEMINI_API_KEY = 'AQ.Ab8RN6J5qZlom0sn-V_intT9KhYlSbvbPBhrTIHj4z5tI4gJFQ'; 

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const escapeHtml = (str) =>
    String(str).replace(/[&<>"']/g, (c) => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));

  const store = {
    get(key, fallback = null) {
      try { const raw = localStorage.getItem(key); return raw === null ? fallback : JSON.parse(raw); }
      catch { return fallback; }
    },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} },
    remove(key) { try { localStorage.removeItem(key); } catch {} }
  };

  const KEYS = {
    DEVICE_ID: 'zunder:deviceId',
    CONVS: 'zunder:conversations'
  };

  /* ==========================================
     LÓGICA DO MODAL ALPHA (APARECE SEMPRE)
     ========================================== */
  const alphaModal = $('#alpha-modal');
  const btnCloseAlpha = $('#btn-close-alpha');
  
  // Como agora só existe o botão X, deixamos apenas ele fechar o modal
  btnCloseAlpha.addEventListener('click', () => {
    alphaModal.style.display = 'none';
  });

  /* ==========================================
     CRIAÇÃO DO PERFIL LOCAL
     ========================================== */
  let myUsername = store.get(KEYS.DEVICE_ID);
  
  if (!myUsername) {
    const randomNum = Math.floor(Math.random() * 99) + 1;
    const formattedNum = randomNum.toString().padStart(2, '0');
    myUsername = `Usuário#${formattedNum}`;
    store.set(KEYS.DEVICE_ID, myUsername);
  }

  $('#user-name').textContent = myUsername;
  $('#menu-user-name').textContent = myUsername;
  $('#user-avatar').textContent = 'U';
  $('#menu-avatar').textContent = 'U';

  /* ==========================================
     ESTADO DO CHAT
     ========================================== */
  const state = {
    activeId: null,
    conversations: store.get(KEYS.CONVS, [])
  };

  function saveConversations() {
    store.set(KEYS.CONVS, state.conversations);
  }

  const sidebar   = $('#sidebar');
  const overlay   = $('#overlay');
  const btnOpen   = $('#sidebar-open');
  const btnClose  = $('#sidebar-close');
  const btnNew    = $('#btn-new');
  const userBtn   = $('#user-btn');
  const userMenu  = $('#user-menu');
  const btnClear  = $('#btn-clear-all');
  const searchInp = $('#search');
  const historyEl = $('#history');

  const titleEl   = $('#chat-title');
  const scrollEl  = $('#scroll');
  const welcomeEl = $('#welcome');
  const msgsEl    = $('#messages');
  const suggEl    = $('#suggestions');

  const form    = $('#form');
  const input   = $('#input');
  const sendBtn = $('#send');

  const isMobile = () => window.matchMedia('(max-width: 820px)').matches;
  function openSidebar() { sidebar.classList.add('is-open'); overlay.hidden = false; }
  function closeSidebar() { sidebar.classList.remove('is-open'); overlay.hidden = true; }

  btnOpen.addEventListener('click', openSidebar);
  btnClose.addEventListener('click', closeSidebar);
  overlay.addEventListener('click', closeSidebar);

  userBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    userMenu.hidden = !userMenu.hidden;
  });

  document.addEventListener('click', (e) => {
    if (!userMenu.contains(e.target) && !userBtn.contains(e.target)) {
      userMenu.hidden = true;
    }
  });

  btnClear.addEventListener('click', () => {
    if (confirm('Tem certeza que deseja apagar todas as conversas deste dispositivo?')) {
      state.conversations = [];
      state.activeId = null;
      saveConversations();
      newChat();
      userMenu.hidden = true;
    }
  });

  /* ==========================================
     HISTÓRICO E MENSAGENS
     ========================================== */
  function formatRelative(ts) {
    const min = Math.floor((Date.now() - ts) / 60000);
    if (min < 1) return 'agora';
    if (min < 60) return `${min} m`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h} h`;
    return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }

  function renderHistory(filter = '') {
    const q = filter.trim().toLowerCase();
    const items = state.conversations
      .filter((c) => !q || c.title.toLowerCase().includes(q))
      .sort((a, b) => b.updatedAt - a.updatedAt);

    if (state.conversations.length === 0) {
      historyEl.innerHTML = `
        <div class="history__empty">
          <p><strong>Sem histórico</strong></p>
          <p>Crie um novo chat.</p>
        </div>`;
      return;
    }

    historyEl.innerHTML = `
      <div class="history__label">Conversas</div>
      ${items.map((c) => `
        <button class="history__item ${state.activeId === c.id ? 'is-active' : ''}" data-id="${c.id}" type="button">
          <svg class="icon icon--sm"><use href="#i-message" /></svg>
          <span class="history__text">${escapeHtml(c.title)}</span>
          <span class="history__time">${formatRelative(c.updatedAt)}</span>
          <span class="history__delete" data-delete="${c.id}" title="Excluir">
            <svg class="icon icon--xs"><use href="#i-trash" /></svg>
          </span>
        </button>
      `).join('')}`;
  }

  historyEl.addEventListener('click', (e) => {
    const del = e.target.closest('[data-delete]');
    if (del) {
      e.stopPropagation();
      deleteConversation(del.dataset.delete);
      return;
    }
    const item = e.target.closest('.history__item');
    if (item) {
      openConversation(item.dataset.id);
      if (isMobile()) closeSidebar();
    }
  });

  searchInp.addEventListener('input', () => renderHistory(searchInp.value));

  function deleteConversation(id) {
    state.conversations = state.conversations.filter((c) => c.id !== id);
    if (state.activeId === id) newChat();
    saveConversations();
    renderHistory(searchInp.value);
  }

  function openConversation(id) {
    const conv = state.conversations.find((c) => c.id === id);
    if (!conv) return;
    state.activeId = id;
    titleEl.textContent = conv.title;
    renderMessages(conv.messages);
    renderHistory(searchInp.value);
  }

  function newChat() {
    state.activeId = null;
    titleEl.textContent = 'Novo chat';
    welcomeEl.hidden = false;
    msgsEl.innerHTML = '';
    renderHistory(searchInp.value);
    input.focus();
  }

  function renderMessages(messages) {
    if (!messages || messages.length === 0) {
      welcomeEl.hidden = false;
      msgsEl.innerHTML = '';
      return;
    }
    welcomeEl.hidden = true;
    msgsEl.innerHTML = messages.map(renderMsg).join('');
    scrollToBottom();
  }

  function renderMsg(m) {
    const isUser = m.role === 'user';
    let avatarHtml = isUser ? 'U' : 'Z';
    let avatarClass = isUser ? 'msg__avatar' : 'msg__avatar msg__avatar--ai';
    
    const formattedText = escapeHtml(m.text).replace(/\n/g, '<br>');

    return `
      <div class="msg msg--${isUser ? 'user' : 'ai'}">
        <div class="${avatarClass}">${avatarHtml}</div>
        <div class="msg__body">
          <div class="msg__bubble">${formattedText}</div>
        </div>
      </div>`;
  }

  function appendMsg(role, text) {
    welcomeEl.hidden = true;
    msgsEl.insertAdjacentHTML('beforeend', renderMsg({ role, text }));
    scrollToBottom(true);
  }

  function showThinking() {
    msgsEl.insertAdjacentHTML('beforeend', `
      <div class="msg msg--ai msg--thinking" id="thinking">
        <div class="msg__avatar msg__avatar--ai">Z</div>
        <div class="msg__body">
          <div class="msg__bubble">
            <span class="thinking"><span></span><span></span><span></span></span>
          </div>
        </div>
      </div>`);
    scrollToBottom(true);
  }

  function hideThinking() {
    const el = $('#thinking');
    if (el) el.remove();
  }

  function scrollToBottom(smooth = false) {
    requestAnimationFrame(() => scrollEl.scrollTo({
      top: scrollEl.scrollHeight, behavior: smooth ? 'smooth' : 'auto'
    }));
  }

  btnNew.addEventListener('click', () => {
    newChat();
    if (isMobile()) closeSidebar();
  });

  function autoResize() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 200) + 'px';
  }

  input.addEventListener('input', () => {
    autoResize();
    sendBtn.disabled = input.value.trim().length === 0;
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    send();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!sendBtn.disabled) send();
    }
  });

  async function send() {
    const text = input.value.trim();
    if (!text) return;

    ensureActiveConversation(text);
    const conv = getActiveConversation();
    if (!conv) return;

    conv.messages.push({ role: 'user', text });
    conv.updatedAt = Date.now();

    if (conv.title === 'Novo chat') {
      conv.title = text.slice(0, 36) + (text.length > 36 ? '…' : '');
      titleEl.textContent = conv.title;
    }

    appendMsg('user', text);
    input.value = '';
    autoResize();
    sendBtn.disabled = true;
    saveConversations();
    renderHistory(searchInp.value);

    showThinking();

    try {
      const aiResponse = await callGeminiAPI(conv.messages);
      hideThinking();
      conv.messages.push({ role: 'ai', text: aiResponse });
      conv.updatedAt = Date.now();
      appendMsg('ai', aiResponse);
      saveConversations();
      renderHistory(searchInp.value);
    } catch (err) {
      hideThinking();
      appendMsg('ai', `⚠️ **Erro na IA:** ${err.message}`);
    }
  }

  function ensureActiveConversation(firstText) {
    if (state.activeId) return;
    const conv = {
      id: 'c_' + Date.now(),
      title: firstText.slice(0, 36) + (firstText.length > 36 ? '…' : ''),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: []
    };
    state.conversations.push(conv);
    state.activeId = conv.id;
    titleEl.textContent = conv.title;
  }

  function getActiveConversation() {
    return state.conversations.find((c) => c.id === state.activeId) || null;
  }

  /* ==========================================
     API GEMINI
     ========================================== */
  async function callGeminiAPI(messages) {
    if (GEMINI_API_KEY === 'SUA_CHAVE_API_AQUI') {
      throw new Error("A API Key não foi configurada no código.");
    }

    const contents = messages.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }]
    }));

    const systemInstruction = {
      parts: [{ 
        text: "Você é a Zunder, uma inteligência artificial útil, amigável e direta. Responda em português do Brasil. Formate com markdown (negrito, listas, códigos) quando necessário." 
      }]
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${GEMINI_API_KEY}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents, systemInstruction })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || 'Falha na requisição com a API.');
    }

    const data = await res.json();
    return data.candidates[0].content.parts[0].text;
  }

  /* ==========================================
     INICIALIZAÇÃO
     ========================================== */
  suggEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.suggestion');
    if (!btn) return;
    input.value = btn.dataset.prompt || '';
    autoResize();
    sendBtn.disabled = false;
    input.focus();
  });

  renderHistory();
  newChat();
})();