/**
 * ==========================================================================
 * APP.JS - LOGIKA UTAMA ASISTEN AI FUTURISTIK (GOOGLE GEMINI)
 * Vanilla JavaScript murni tanpa build step.
 * ==========================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- KONFIGURASI STATE & LOCAL STORAGE ---
  const STORAGE_KEY = 'asisten_ai_sessions_v1';
  const SETTINGS_KEY = 'asisten_ai_settings_v1';

  let sessions = loadSessions();
  let currentSessionId = sessions.length > 0 ? sessions[0].id : createNewSession().id;
  let stagedAttachments = []; // Array berkas { name, mimeType, base64 }
  let isStreaming = false;
  let activeAbortController = null;
  let recognition = null;
  let isRecordingVoice = false;

  // Pengaturan default
  let appSettings = loadSettings();

  // --- ELEMEN DOM ---
  const sidebar = document.getElementById('sidebar');
  const sidebarBackdrop = document.getElementById('sidebar-backdrop');
  const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
  const sidebarCloseBtn = document.getElementById('sidebar-close-btn');
  const btnNewChat = document.getElementById('btn-new-chat');
  const chatSearchInput = document.getElementById('chat-search-input');
  const chatHistoryList = document.getElementById('chat-history-list');

  const currentChatTitle = document.getElementById('current-chat-title');
  const currentModelBadge = document.getElementById('current-model-badge');
  const personaSelect = document.getElementById('persona-select');
  const modelSelect = document.getElementById('model-select');
  const toggleSearchBtn = document.getElementById('toggle-search-btn');
  const exportMenuBtn = document.getElementById('export-menu-btn');
  const exportDropdown = document.getElementById('export-dropdown');
  const exportMarkdownBtn = document.getElementById('export-markdown-btn');
  const exportPdfBtn = document.getElementById('export-pdf-btn');

  const messagesContainer = document.getElementById('chat-messages-container');
  const welcomeHero = document.getElementById('welcome-hero');
  const messageList = document.getElementById('message-list');
  const thinkingIndicator = document.getElementById('thinking-indicator');

  const attachmentsPreviewBar = document.getElementById('attachments-preview-bar');
  const streamingControlBar = document.getElementById('streaming-control-bar');
  const btnStopStream = document.getElementById('btn-stop-stream');
  const chatForm = document.getElementById('chat-form');
  const messageTextarea = document.getElementById('message-textarea');
  const fileInput = document.getElementById('file-input');
  const btnAttach = document.getElementById('btn-attach');
  const btnVoiceInput = document.getElementById('btn-voice-input');
  const btnSend = document.getElementById('btn-send');

  const commandPaletteDialog = document.getElementById('command-palette-dialog');
  const paletteSearchInput = document.getElementById('palette-search-input');
  const paletteResultsList = document.getElementById('palette-results-list');

  const settingsDialog = document.getElementById('settings-dialog');
  const btnOpenSettings = document.getElementById('btn-open-settings');
  const settingsCloseBtn = document.getElementById('settings-close-btn');
  const temperatureSlider = document.getElementById('temperature-slider');
  const temperatureValLabel = document.getElementById('temperature-val-label');
  const ttsAutoToggle = document.getElementById('tts-auto-toggle');
  const btnClearAllHistory = document.getElementById('btn-clear-all-history');

  const healthStatusDot = document.querySelector('#health-status-badge .status-dot');
  const healthStatusText = document.getElementById('health-status-text');

  // --- INISIALISASI MARKED & HIGHLIGHT.JS ---
  if (window.marked) {
    marked.setOptions({
      breaks: true,
      gfm: true
    });
  }

  // --- INISIALISASI APLIKASI ---
  initSpeechRecognition();
  initPWA();
  checkApiHealth();
  syncSettingsUI();
  renderHistoryList();
  renderCurrentChat();

  // ==========================================================================
  // MANAJEMEN SESI & LOCAL STORAGE
  // ==========================================================================

  function loadSessions() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Gagal memuat sesi:', e);
      return [];
    }
  }

  function saveSessions() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    } catch (e) {
      console.error('Gagal menyimpan sesi:', e);
    }
  }

  function loadSettings() {
    try {
      const data = localStorage.getItem(SETTINGS_KEY);
      return data
        ? JSON.parse(data)
        : { temperature: 0.7, ttsAuto: false, persona: 'umum', modelSpeed: 'cepat', enableSearch: false };
    } catch (e) {
      return { temperature: 0.7, ttsAuto: false, persona: 'umum', modelSpeed: 'cepat', enableSearch: false };
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(appSettings));
    } catch (e) {}
  }

  function syncSettingsUI() {
    temperatureSlider.value = appSettings.temperature;
    temperatureValLabel.textContent = appSettings.temperature;
    ttsAutoToggle.checked = appSettings.ttsAuto;
    personaSelect.value = appSettings.persona || 'umum';
    modelSelect.value = appSettings.modelSpeed || 'cepat';
    toggleSearchBtn.setAttribute('aria-pressed', appSettings.enableSearch ? 'true' : 'false');
    updateModelBadge();
  }

  function createNewSession() {
    const newSession = {
      id: 'session_' + Date.now(),
      title: 'Obrolan Baru',
      createdAt: new Date().toISOString(),
      messages: []
    };
    sessions.unshift(newSession);
    saveSessions();
    return newSession;
  }

  function getCurrentSession() {
    return sessions.find((s) => s.id === currentSessionId) || sessions[0];
  }

  function switchSession(sessionId) {
    if (isStreaming) stopStreaming();
    currentSessionId = sessionId;
    renderHistoryList();
    renderCurrentChat();
    closeSidebar();
  }

  function renameSession(sessionId) {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;
    const newTitle = prompt('Ganti nama obrolan:', session.title);
    if (newTitle && newTitle.trim()) {
      session.title = newTitle.trim();
      saveSessions();
      renderHistoryList();
      if (sessionId === currentSessionId) {
        currentChatTitle.textContent = session.title;
      }
    }
  }

  function deleteSession(sessionId, event) {
    if (event) event.stopPropagation();
    if (confirm('Hapus sesi obrolan ini?')) {
      sessions = sessions.filter((s) => s.id !== sessionId);
      if (sessions.length === 0) {
        createNewSession();
        currentSessionId = sessions[0].id;
      } else if (currentSessionId === sessionId) {
        currentSessionId = sessions[0].id;
      }
      saveSessions();
      renderHistoryList();
      renderCurrentChat();
    }
  }

  // ==========================================================================
  // RENDERING UI CHAT & RIWAYAT
  // ==========================================================================

  function renderHistoryList(filterQuery = '') {
    chatHistoryList.innerHTML = '';
    const filtered = sessions.filter((s) =>
      s.title.toLowerCase().includes(filterQuery.toLowerCase())
    );

    if (filtered.length === 0) {
      chatHistoryList.innerHTML = `<li style="padding:10px; color:var(--text-dim); font-size:0.8rem; text-align:center;">Tidak ada percakapan</li>`;
      return;
    }

    filtered.forEach((session) => {
      const li = document.createElement('li');
      li.className = `chat-history-item ${session.id === currentSessionId ? 'active' : ''}`;
      li.setAttribute('data-id', session.id);

      const dateStr = new Date(session.createdAt).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short'
      });

      li.innerHTML = `
        <div class="item-content">
          <span class="item-title">${escapeHtml(session.title)}</span>
          <span class="item-date">${dateStr}</span>
        </div>
        <div class="item-actions">
          <button class="item-btn btn-rename" title="Ganti Nama">✏️</button>
          <button class="item-btn btn-delete" title="Hapus">🗑️</button>
        </div>
      `;

      li.addEventListener('click', () => switchSession(session.id));
      li.querySelector('.btn-rename').addEventListener('click', (e) => {
        e.stopPropagation();
        renameSession(session.id);
      });
      li.querySelector('.btn-delete').addEventListener('click', (e) => {
        deleteSession(session.id, e);
      });

      chatHistoryList.appendChild(li);
    });
  }

  function renderCurrentChat() {
    const session = getCurrentSession();
    if (!session) return;

    currentChatTitle.textContent = session.title;
    messageList.innerHTML = '';

    if (session.messages.length === 0) {
      welcomeHero.style.display = 'flex';
      messageList.style.display = 'none';
    } else {
      welcomeHero.style.display = 'none';
      messageList.style.display = 'flex';

      session.messages.forEach((msg, index) => {
        appendMessageToDOM(msg, index);
      });
    }

    scrollToBottom();
  }

  function appendMessageToDOM(msg, index) {
    const isUser = msg.role === 'user';
    const msgEl = document.createElement('div');
    msgEl.className = `message-item ${isUser ? 'user' : 'assistant'}`;
    msgEl.id = `msg-${index}`;

    const timeStr = msg.timestamp
      ? new Date(msg.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      : '';

    // Lampiran berkas (jika pengguna mengunggah gambar/PDF)
    let attachmentsHtml = '';
    if (msg.attachments && msg.attachments.length > 0) {
      attachmentsHtml = `<div class="msg-attachments-preview">`;
      msg.attachments.forEach((att) => {
        if (att.mimeType.startsWith('image/')) {
          attachmentsHtml += `<img src="data:${att.mimeType};base64,${att.base64}" alt="Lampiran" class="msg-attachment-thumb">`;
        } else {
          attachmentsHtml += `<div class="msg-attachment-pdf">📄 ${escapeHtml(att.name || 'Dokumen PDF')}</div>`;
        }
      });
      attachmentsHtml += `</div>`;
    }

    // Render isi pesan: Markdown untuk AI, teks dengan baris baru untuk pengguna
    let contentHtml = '';
    if (isUser) {
      contentHtml = `<p>${escapeHtml(msg.text).replace(/\n/g, '<br>')}</p>`;
    } else {
      contentHtml = renderMarkdown(msg.text);
    }

    // Google Search Grounding Chips jika ada
    let groundingHtml = '';
    if (msg.sources && msg.sources.length > 0) {
      groundingHtml = `
        <div class="grounding-box">
          <div class="grounding-title">🌐 SUMBER RUJUKAN GOOGLE SEARCH:</div>
          <div class="grounding-chips">
            ${msg.sources
              .map(
                (src) =>
                  `<a href="${src.uri}" target="_blank" rel="noopener noreferrer" class="grounding-chip">🔗 ${escapeHtml(
                    src.title || src.uri
                  )}</a>`
              )
              .join('')}
          </div>
        </div>
      `;
    }

    // Bar Tombol Aksi untuk Balasan AI
    let actionsHtml = '';
    if (!isUser) {
      actionsHtml = `
        <div class="message-actions-bar">
          <button class="action-chip-btn btn-copy-msg" data-index="${index}" title="Salin Pesan">
            📋 Salin
          </button>
          <button class="action-chip-btn btn-speak-msg" data-index="${index}" title="Bacakan Suara">
            🔊 Bicara
          </button>
          ${
            index === getCurrentSession().messages.length - 1
              ? `<button class="action-chip-btn btn-regen-msg" title="Buat Ulang Jawaban">🔄 Buat Ulang</button>`
              : ''
          }
        </div>
      `;
    }

    msgEl.innerHTML = `
      <div class="message-avatar ${isUser ? 'user-avatar' : 'ai-avatar'}">
        ${isUser ? 'ANDA' : 'AI'}
      </div>
      <div class="message-body">
        <div class="message-bubble">
          ${attachmentsHtml}
          <div class="bubble-text">${contentHtml}</div>
          ${groundingHtml}
        </div>
        ${actionsHtml}
        <span class="message-time">${timeStr}</span>
      </div>
    `;

    messageList.appendChild(msgEl);
    attachCodeCopyButtons(msgEl);
    attachMessageActionEvents(msgEl, msg);
  }

  function renderMarkdown(rawText) {
    if (!rawText) return '';
    try {
      if (window.marked) {
        return marked.parse(rawText);
      }
      return escapeHtml(rawText);
    } catch (e) {
      return escapeHtml(rawText);
    }
  }

  function attachCodeCopyButtons(container) {
    // Sisipkan tombol "Salin Kode" pada setiap tag pre/code
    const preBlocks = container.querySelectorAll('pre');
    preBlocks.forEach((pre) => {
      if (pre.parentNode.classList.contains('code-container')) return;

      const wrapper = document.createElement('div');
      wrapper.className = 'code-container';

      const codeTag = pre.querySelector('code');
      const lang = codeTag?.className?.replace('language-', '') || 'KODE';

      const header = document.createElement('div');
      header.className = 'code-header';
      header.innerHTML = `
        <span>${escapeHtml(lang.toUpperCase())}</span>
        <button class="btn-copy-code">Salin Kode</button>
      `;

      header.querySelector('.btn-copy-code').addEventListener('click', (e) => {
        const textToCopy = codeTag ? codeTag.innerText : pre.innerText;
        navigator.clipboard.writeText(textToCopy).then(() => {
          e.target.textContent = 'Tersalin! ✓';
          setTimeout(() => (e.target.textContent = 'Salin Kode'), 2000);
        });
      });

      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(header);
      wrapper.appendChild(pre);

      if (window.hljs && codeTag) {
        hljs.highlightElement(codeTag);
      }
    });
  }

  function attachMessageActionEvents(msgEl, msg) {
    const btnCopy = msgEl.querySelector('.btn-copy-msg');
    if (btnCopy) {
      btnCopy.addEventListener('click', () => {
        navigator.clipboard.writeText(msg.text).then(() => {
          btnCopy.textContent = 'Tersalin! ✓';
          setTimeout(() => (btnCopy.textContent = '📋 Salin'), 2000);
        });
      });
    }

    const btnSpeak = msgEl.querySelector('.btn-speak-msg');
    if (btnSpeak) {
      btnSpeak.addEventListener('click', () => {
        speakText(msg.text);
      });
    }

    const btnRegen = msgEl.querySelector('.btn-regen-msg');
    if (btnRegen) {
      btnRegen.addEventListener('click', () => {
        regenerateLastResponse();
      });
    }
  }

  function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // ==========================================================================
  // PENGIRIMAN PESAN & SSE STREAMING
  // ==========================================================================

  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    sendMessage();
  });

  messageTextarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Auto-resize tinggi textarea
  messageTextarea.addEventListener('input', () => {
    messageTextarea.style.height = 'auto';
    messageTextarea.style.height = Math.min(messageTextarea.scrollHeight, 180) + 'px';
  });

  async function sendMessage(overrideText = null) {
    if (isStreaming) return;

    const text = overrideText !== null ? overrideText : messageTextarea.value.trim();
    if (!text && stagedAttachments.length === 0) return;

    const session = getCurrentSession();

    // Buat judul otomatis dari pesan pertama jika obrolan masih baru
    if (session.messages.length === 0 && text) {
      session.title = text.slice(0, 32) + (text.length > 32 ? '...' : '');
      currentChatTitle.textContent = session.title;
    }

    // Catat pesan pengguna
    const userMessage = {
      role: 'user',
      text: text,
      timestamp: new Date().toISOString(),
      attachments: [...stagedAttachments]
    };

    session.messages.push(userMessage);
    saveSessions();

    // Reset input form
    messageTextarea.value = '';
    messageTextarea.style.height = 'auto';
    const sentAttachments = [...stagedAttachments];
    stagedAttachments = [];
    renderAttachmentsPreview();

    welcomeHero.style.display = 'none';
    messageList.style.display = 'flex';
    appendMessageToDOM(userMessage, session.messages.length - 1);
    scrollToBottom();

    // Mulai streaming jawaban AI
    await fetchAiResponse(text, sentAttachments);
  }

  async function fetchAiResponse(promptText, attachmentsList) {
    const session = getCurrentSession();
    isStreaming = true;
    streamingControlBar.style.display = 'flex';
    thinkingIndicator.style.display = 'flex';
    scrollToBottom();

    activeAbortController = new AbortController();

    // Siapkan placeholder pesan balasan di DOM
    const assistantMessage = {
      role: 'assistant',
      text: '',
      timestamp: new Date().toISOString(),
      sources: []
    };
    session.messages.push(assistantMessage);
    const msgIndex = session.messages.length - 1;

    // Elemen DOM untuk streaming real-time
    const msgEl = document.createElement('div');
    msgEl.className = 'message-item assistant';
    msgEl.id = `msg-${msgIndex}`;
    msgEl.innerHTML = `
      <div class="message-avatar ai-avatar">AI</div>
      <div class="message-body">
        <div class="message-bubble">
          <div class="bubble-text"></div>
          <div class="grounding-container"></div>
        </div>
        <div class="message-actions-bar" style="display:none;"></div>
        <span class="message-time">Menulis...</span>
      </div>
    `;
    messageList.appendChild(msgEl);
    const bubbleTextEl = msgEl.querySelector('.bubble-text');
    const groundingContainer = msgEl.querySelector('.grounding-container');

    // Riwayat percakapan untuk konteks memori
    const historyPayload = session.messages.slice(0, -1).map((m) => ({
      role: m.role,
      text: m.text
    }));

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          history: historyPayload,
          persona: appSettings.persona,
          modelSpeed: appSettings.modelSpeed,
          temperature: appSettings.temperature,
          enableSearch: appSettings.enableSearch,
          attachments: attachmentsList
        }),
        signal: activeAbortController.signal
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({ error: 'Gagal terhubung.' }));
        throw new Error(errJson.error || `HTTP ${response.status}`);
      }

      thinkingIndicator.style.display = 'none';

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed.startsWith('event: error')) {
            // Error dari SSE
          } else if (trimmed.startsWith('data:')) {
            const dataStr = trimmed.replace(/^data:\s*/, '');
            try {
              const data = JSON.parse(dataStr);
              if (data.error) {
                assistantMessage.text += `\n\n> ⚠️ **Peringatan Sistem:** ${data.error}`;
              } else if (data.text) {
                assistantMessage.text += data.text;
                bubbleTextEl.innerHTML = renderMarkdown(assistantMessage.text);
                scrollToBottom();
              } else if (data.groundingChunks || data.webSearchQueries) {
                // Sumber Grounding Google Search
                if (data.groundingChunks) {
                  data.groundingChunks.forEach((chunk) => {
                    if (chunk.web?.uri) {
                      assistantMessage.sources.push({
                        title: chunk.web.title || chunk.web.uri,
                        uri: chunk.web.uri
                      });
                    }
                  });
                  renderGroundingSources(groundingContainer, assistantMessage.sources);
                }
              }
            } catch (e) {}
          }
        }
      }
    } catch (err) {
      thinkingIndicator.style.display = 'none';
      if (err.name === 'AbortError') {
        assistantMessage.text += '\n\n*(Pembuatan jawaban dihentikan oleh pengguna)*';
      } else {
        assistantMessage.text += `\n\n> ❌ **Gagal mendapatkan respons:** ${err.message}`;
      }
      bubbleTextEl.innerHTML = renderMarkdown(assistantMessage.text);
    } finally {
      isStreaming = false;
      streamingControlBar.style.display = 'none';
      thinkingIndicator.style.display = 'none';
      saveSessions();

      // Finalisasi format kode & tombol aksi
      attachCodeCopyButtons(msgEl);
      msgEl.querySelector('.message-time').textContent = new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit'
      });
      renderMessageActions(msgEl, assistantMessage, msgIndex);

      // Auto-TTS jika diaktifkan di pengaturan
      if (appSettings.ttsAuto && assistantMessage.text) {
        speakText(assistantMessage.text);
      }
    }
  }

  function renderGroundingSources(container, sources) {
    if (!sources || sources.length === 0) return;
    container.innerHTML = `
      <div class="grounding-box">
        <div class="grounding-title">🌐 SUMBER RUJUKAN GOOGLE SEARCH:</div>
        <div class="grounding-chips">
          ${sources
            .map(
              (s) =>
                `<a href="${s.uri}" target="_blank" rel="noopener noreferrer" class="grounding-chip">🔗 ${escapeHtml(
                  s.title
                )}</a>`
            )
            .join('')}
        </div>
      </div>
    `;
  }

  function renderMessageActions(msgEl, msg, index) {
    const actionsBar = msgEl.querySelector('.message-actions-bar');
    if (!actionsBar) return;
    actionsBar.style.display = 'flex';
    actionsBar.innerHTML = `
      <button class="action-chip-btn btn-copy-msg" data-index="${index}" title="Salin Pesan">📋 Salin</button>
      <button class="action-chip-btn btn-speak-msg" data-index="${index}" title="Bacakan Suara">🔊 Bicara</button>
      <button class="action-chip-btn btn-regen-msg" title="Buat Ulang Jawaban">🔄 Buat Ulang</button>
    `;
    attachMessageActionEvents(msgEl, msg);
  }

  function stopStreaming() {
    if (activeAbortController) {
      activeAbortController.abort();
      activeAbortController = null;
    }
    isStreaming = false;
    streamingControlBar.style.display = 'none';
    thinkingIndicator.style.display = 'none';
  }

  btnStopStream.addEventListener('click', stopStreaming);

  function regenerateLastResponse() {
    const session = getCurrentSession();
    if (session.messages.length < 2) return;

    // Hapus pesan AI terakhir
    session.messages.pop();

    // Ambil pesan pengguna sebelumnya
    const lastUserMessage = session.messages[session.messages.length - 1];
    if (!lastUserMessage) return;

    saveSessions();
    renderCurrentChat();

    fetchAiResponse(lastUserMessage.text, lastUserMessage.attachments || []);
  }

  // ==========================================================================
  // LAMPIRAN MULTIMODAL (GAMBAR & DOKUMEN PDF)
  // ==========================================================================

  btnAttach.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    if (!files || files.length === 0) return;

    files.forEach((file) => {
      // Batasi ukuran maksimal berkas per file: 15MB
      if (file.size > 15 * 1024 * 1024) {
        alert(`Berkas "${file.name}" melebihi batas 15MB.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const base64Data = reader.result.split(',')[1];
        stagedAttachments.push({
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          base64: base64Data
        });
        renderAttachmentsPreview();
      };
      reader.readAsDataURL(file);
    });

    fileInput.value = '';
  });

  function renderAttachmentsPreview() {
    attachmentsPreviewBar.innerHTML = '';
    if (stagedAttachments.length === 0) {
      attachmentsPreviewBar.style.display = 'none';
      return;
    }

    attachmentsPreviewBar.style.display = 'flex';
    stagedAttachments.forEach((att, idx) => {
      const chip = document.createElement('div');
      chip.className = 'attachment-chip';

      if (att.mimeType.startsWith('image/')) {
        chip.innerHTML = `
          <img src="data:${att.mimeType};base64,${att.base64}" alt="Thumb">
          <span>${escapeHtml(att.name)}</span>
          <button type="button" class="chip-remove-btn" data-index="${idx}">✕</button>
        `;
      } else {
        chip.innerHTML = `
          <span>📄 ${escapeHtml(att.name)}</span>
          <button type="button" class="chip-remove-btn" data-index="${idx}">✕</button>
        `;
      }

      chip.querySelector('.chip-remove-btn').addEventListener('click', () => {
        stagedAttachments.splice(idx, 1);
        renderAttachmentsPreview();
      });

      attachmentsPreviewBar.appendChild(chip);
    });
  }

  // ==========================================================================
  // FITUR SUARA: SPEECH-TO-TEXT & TEXT-TO-SPEECH
  // ==========================================================================

  function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      btnVoiceInput.title = 'Pengenalan suara tidak didukung oleh browser ini.';
      btnVoiceInput.style.opacity = '0.5';
      return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = 'id-ID';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      isRecordingVoice = true;
      btnVoiceInput.classList.add('recording');
      btnVoiceInput.title = 'Mendengarkan... Bicara sekarang';
    };

    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      messageTextarea.value = transcript;
      messageTextarea.dispatchEvent(new Event('input'));
    };

    recognition.onerror = (event) => {
      console.warn('Speech recognition error:', event.error);
      stopVoiceRecording();
    };

    recognition.onend = () => {
      stopVoiceRecording();
    };

    btnVoiceInput.addEventListener('click', () => {
      if (!isRecordingVoice) {
        try {
          recognition.start();
        } catch (e) {
          stopVoiceRecording();
        }
      } else {
        recognition.stop();
      }
    });
  }

  function stopVoiceRecording() {
    isRecordingVoice = false;
    btnVoiceInput.classList.remove('recording');
    btnVoiceInput.title = 'Bicara (Input Suara Bahasa Indonesia)';
  }

  function speakText(rawText) {
    if (!window.speechSynthesis) {
      alert('Text-to-speech tidak didukung di peramban ini.');
      return;
    }

    // Bersihkan format Markdown sebelum dibacakan
    const cleanText = rawText
      .replace(/```[\s\S]*?```/g, 'blok kode program dilewati.')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/[#*_~>]/g, '')
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');

    window.speechSynthesis.cancel(); // Hentikan suara yang sedang berjalan

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'id-ID';
    utterance.rate = 1.0;

    // Pilih suara berbahasa Indonesia jika tersedia
    const voices = window.speechSynthesis.getVoices();
    const idVoice = voices.find((v) => v.lang.includes('id') || v.lang.includes('ID'));
    if (idVoice) {
      utterance.voice = idVoice;
    }

    window.speechSynthesis.speak(utterance);
  }

  // ==========================================================================
  // SUGGESTION CHIPS (SARAN PERTANYAAN)
  // ==========================================================================

  document.querySelectorAll('.suggestion-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const promptText = chip.getAttribute('data-prompt');
      if (promptText) {
        sendMessage(promptText);
      }
    });
  });

  // ==========================================================================
  // SIDEBAR & KONTROL NAVIGASI
  // ==========================================================================

  function openSidebar() {
    sidebar.classList.add('open');
    sidebarBackdrop.classList.add('show');
  }

  function closeSidebar() {
    sidebar.classList.remove('open');
    sidebarBackdrop.classList.remove('show');
  }

  sidebarToggleBtn.addEventListener('click', openSidebar);
  sidebarCloseBtn.addEventListener('click', closeSidebar);
  sidebarBackdrop.addEventListener('click', closeSidebar);

  btnNewChat.addEventListener('click', () => {
    const newSession = createNewSession();
    currentSessionId = newSession.id;
    renderHistoryList();
    renderCurrentChat();
    closeSidebar();
    messageTextarea.focus();
  });

  chatSearchInput.addEventListener('input', (e) => {
    renderHistoryList(e.target.value);
  });

  // Pemilih Persona & Model
  personaSelect.addEventListener('change', (e) => {
    appSettings.persona = e.target.value;
    saveSettings();
  });

  modelSelect.addEventListener('change', (e) => {
    appSettings.modelSpeed = e.target.value;
    saveSettings();
    updateModelBadge();
  });

  function updateModelBadge() {
    currentModelBadge.textContent =
      appSettings.modelSpeed === 'pintar' ? 'Gemini 3.1 Pro' : 'Gemini 2.5 Flash';
  }

  // Toggle Search Grounding
  toggleSearchBtn.addEventListener('click', () => {
    appSettings.enableSearch = !appSettings.enableSearch;
    toggleSearchBtn.setAttribute('aria-pressed', appSettings.enableSearch ? 'true' : 'false');
    saveSettings();
  });

  // Menu Ekspor
  exportMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    exportDropdown.classList.toggle('show');
  });

  document.addEventListener('click', (e) => {
    if (!exportDropdown.contains(e.target) && e.target !== exportMenuBtn) {
      exportDropdown.classList.remove('show');
    }
  });

  exportMarkdownBtn.addEventListener('click', () => {
    exportDropdown.classList.remove('show');
    exportChatAsMarkdown();
  });

  exportPdfBtn.addEventListener('click', () => {
    exportDropdown.classList.remove('show');
    window.print();
  });

  function exportChatAsMarkdown() {
    const session = getCurrentSession();
    if (!session || session.messages.length === 0) {
      alert('Tidak ada pesan untuk diekspor.');
      return;
    }

    let mdContent = `# ${session.title}\n`;
    mdContent += `*Dibuat pada: ${new Date(session.createdAt).toLocaleString('id-ID')}*\n\n---\n\n`;

    session.messages.forEach((msg) => {
      const sender = msg.role === 'user' ? '👤 Pengguna' : '🤖 Asisten AI';
      mdContent += `### ${sender}\n\n${msg.text}\n\n`;
      if (msg.sources && msg.sources.length > 0) {
        mdContent += `**Sumber:**\n`;
        msg.sources.forEach((s) => {
          mdContent += `- [${s.title}](${s.uri})\n`;
        });
        mdContent += `\n`;
      }
    });

    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${session.title.replace(/[^\w\s-]/g, '').trim() || 'obrolan'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ==========================================================================
  // PALET PERINTAH (COMMAND PALETTE - CTRL+K)
  // ==========================================================================

  const COMMANDS = [
    { label: 'Obrolan Baru', icon: '＋', action: () => btnNewChat.click() },
    { label: 'Ganti Model: Cepat (Gemini 2.5 Flash)', icon: '⚡', action: () => { modelSelect.value = 'cepat'; modelSelect.dispatchEvent(new Event('change')); } },
    { label: 'Ganti Model: Pintar (Gemini 3.1 Pro)', icon: '🧠', action: () => { modelSelect.value = 'pintar'; modelSelect.dispatchEvent(new Event('change')); } },
    { label: 'Persona: Programmer (Koding & Sistem)', icon: '💻', action: () => { personaSelect.value = 'programmer'; personaSelect.dispatchEvent(new Event('change')); } },
    { label: 'Persona: Penulis (Kreatif & Narasi)', icon: '✍️', action: () => { personaSelect.value = 'penulis'; personaSelect.dispatchEvent(new Event('change')); } },
    { label: 'Persona: Guru (Edukasi & Analogi)', icon: '🎓', action: () => { personaSelect.value = 'guru'; personaSelect.dispatchEvent(new Event('change')); } },
    { label: 'Persona: Analis Bisnis (SWOT & Data)', icon: '📊', action: () => { personaSelect.value = 'analis'; personaSelect.dispatchEvent(new Event('change')); } },
    { label: 'Persona: Penerjemah Multibahasa', icon: '🌐', action: () => { personaSelect.value = 'penerjemah'; personaSelect.dispatchEvent(new Event('change')); } },
    { label: 'Toggle Google Search Grounding', icon: '🔍', action: () => toggleSearchBtn.click() },
    { label: 'Ekspor Percakapan ke Markdown', icon: '📄', action: () => exportChatAsMarkdown() },
    { label: 'Cetak / Simpan PDF', icon: '🖨️', action: () => window.print() },
    { label: 'Buka Pengaturan', icon: '⚙️', action: () => btnOpenSettings.click() }
  ];

  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openCommandPalette();
    }
  });

  function openCommandPalette() {
    paletteSearchInput.value = '';
    renderPaletteResults();
    commandPaletteDialog.showModal();
    paletteSearchInput.focus();
  }

  function renderPaletteResults(filter = '') {
    paletteResultsList.innerHTML = '';
    const filtered = COMMANDS.filter((cmd) =>
      cmd.label.toLowerCase().includes(filter.toLowerCase())
    );

    if (filtered.length === 0) {
      paletteResultsList.innerHTML = `<li style="padding:12px; color:var(--text-dim); text-align:center;">Tidak ada perintah ditemukan</li>`;
      return;
    }

    filtered.forEach((cmd) => {
      const li = document.createElement('li');
      li.className = 'palette-item';
      li.innerHTML = `
        <span style="display:flex; align-items:center; gap:8px;">
          <span>${cmd.icon}</span>
          <span>${escapeHtml(cmd.label)}</span>
        </span>
        <kbd>↵</kbd>
      `;
      li.addEventListener('click', () => {
        commandPaletteDialog.close();
        cmd.action();
      });
      paletteResultsList.appendChild(li);
    });
  }

  paletteSearchInput.addEventListener('input', (e) => {
    renderPaletteResults(e.target.value);
  });

  commandPaletteDialog.addEventListener('click', (e) => {
    const rect = commandPaletteDialog.querySelector('.dialog-content').getBoundingClientRect();
    if (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    ) {
      commandPaletteDialog.close();
    }
  });

  // ==========================================================================
  // MODAL PENGATURAN
  // ==========================================================================

  btnOpenSettings.addEventListener('click', () => {
    settingsDialog.showModal();
    closeSidebar();
  });

  settingsCloseBtn.addEventListener('click', () => settingsDialog.close());

  settingsDialog.addEventListener('click', (e) => {
    const rect = settingsDialog.querySelector('.dialog-content').getBoundingClientRect();
    if (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    ) {
      settingsDialog.close();
    }
  });

  temperatureSlider.addEventListener('input', (e) => {
    appSettings.temperature = parseFloat(e.target.value);
    temperatureValLabel.textContent = appSettings.temperature;
    saveSettings();
  });

  ttsAutoToggle.addEventListener('change', (e) => {
    appSettings.ttsAuto = e.target.checked;
    saveSettings();
  });

  btnClearAllHistory.addEventListener('click', () => {
    if (confirm('Yakin ingin menghapus SELURUH riwayat obrolan? Tindakan ini tidak dapat dibatalkan.')) {
      sessions = [];
      createNewSession();
      currentSessionId = sessions[0].id;
      saveSessions();
      renderHistoryList();
      renderCurrentChat();
      settingsDialog.close();
    }
  });

  // ==========================================================================
  // MONITORING KESEHATAN API & PWA SERVICE WORKER
  // ==========================================================================

  async function checkApiHealth() {
    try {
      const res = await fetch('/health');
      if (res.ok) {
        const data = await res.json();
        if (data.apiKeyConfigured) {
          healthStatusDot.className = 'status-dot online';
          healthStatusText.textContent = 'Gemini API Siap';
        } else {
          healthStatusDot.className = 'status-dot warning';
          healthStatusText.textContent = 'API Key Belum Diisi';
        }
      } else {
        throw new Error();
      }
    } catch (e) {
      healthStatusDot.className = 'status-dot';
      healthStatusText.textContent = 'Server Offline';
    }
  }

  function initPWA() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch((err) => {
          console.warn('PWA SW registration notice:', err);
        });
      });
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
});
