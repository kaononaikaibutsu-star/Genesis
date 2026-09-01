const { ipcRenderer } = require('electron');

document.addEventListener('DOMContentLoaded', () => {
  const settingsModal = document.getElementById('settingsModal');
  const openSettingsBtn = document.getElementById('openSettingsBtn');
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  const themeSelect = document.getElementById('themeSelect');

  const tabNotes = document.getElementById('tabNotes');
  const tabChat = document.getElementById('tabChat');
  const tabActivity = document.getElementById('tabActivity');
  const viewNotes = document.getElementById('viewNotes');
  const viewChat = document.getElementById('viewChat');
  const viewActivity = document.getElementById('viewActivity');

  const titleInput = document.getElementById('titleInput');
  const contentInput = document.getElementById('contentInput');
  const tagsInput = document.getElementById('tagsInput');
  const selectFileBtn = document.getElementById('selectFileBtn');
  const selectedFileLabel = document.getElementById('selectedFileLabel');
  const saveBtn = document.getElementById('saveBtn');

  const searchInput = document.getElementById('searchInput');
  const notesContainer = document.getElementById('notesContainer');

  const companionInput = document.getElementById('companionInput');
  const sendCompanionBtn = document.getElementById('sendCompanionBtn');
  const chatBox = document.getElementById('chatBox');
  const activityFeed = document.getElementById('activityFeed');

  let selectedFilePath = null;
  let allNotes = [];

  async function initApp() {
    try {
      const config = await ipcRenderer.invoke('get-config');
      if (config && config.theme) {
        document.documentElement.setAttribute('data-theme', config.theme);
        themeSelect.value = config.theme;
      }
    } catch (err) {
      console.error('Failed to load config:', err);
    }
    loadNotes();
  }

  initApp();

  // Settings Modal
  openSettingsBtn.addEventListener('click', () => settingsModal.style.display = 'flex');
  closeSettingsBtn.addEventListener('click', () => settingsModal.style.display = 'none');

  themeSelect.addEventListener('change', async (e) => {
    const theme = e.target.value;
    document.documentElement.setAttribute('data-theme', theme);
    await ipcRenderer.invoke('update-theme', theme);
  });

  // Navigation Tabs
  tabNotes.addEventListener('click', () => {
    tabNotes.classList.add('active');
    tabChat.classList.remove('active');
    tabActivity.classList.remove('active');
    viewNotes.style.display = 'block';
    viewChat.style.display = 'none';
    viewActivity.style.display = 'none';
  });

  tabChat.addEventListener('click', () => {
    tabChat.classList.add('active');
    tabNotes.classList.remove('active');
    tabActivity.classList.remove('active');
    viewChat.style.display = 'block';
    viewNotes.style.display = 'none';
    viewActivity.style.display = 'none';
  });

  tabActivity.addEventListener('click', () => {
    tabActivity.classList.add('active');
    tabNotes.classList.remove('active');
    tabChat.classList.remove('active');
    viewActivity.style.display = 'block';
    viewNotes.style.display = 'none';
    viewChat.style.display = 'none';
  });

  // File Selection
  selectFileBtn.addEventListener('click', async () => {
    const filePath = await ipcRenderer.invoke('select-file');
    if (filePath) {
      selectedFilePath = filePath;
      const fileName = filePath.split(/[\\/]/).pop();
      selectedFileLabel.innerText = `Attached: ${fileName}`;
    }
  });

  // Notes Management
  async function loadNotes() {
    allNotes = await ipcRenderer.invoke('get-notes');
    renderNotes(allNotes);
  }

  function renderNotes(notesToRender) {
    notesContainer.innerHTML = '';
    if (!notesToRender || notesToRender.length === 0) {
      notesContainer.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 20px;">No matching memories found.</div>';
      return;
    }

    notesToRender.forEach(note => {
      const card = document.createElement('div');
      card.className = 'note-card';

      const tagArray = note.tags ? note.tags.split(',').map(t => t.trim()).filter(t => t.length > 0) : [];
      const tagsHtml = tagArray.map(tag => `<span class="tag-pill">#${escapeHtml(tag)}</span>`).join(' ');

      let attachmentHtml = '';
      if (note.attachments) {
        const fileName = note.attachments;
        const ext = fileName.split('.').pop().toLowerCase();
        const fileUrl = `../../uploads/${escapeHtml(fileName)}`;

        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
          attachmentHtml = `<img src="${fileUrl}" class="attachment-preview-img" />`;
        } else if (['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(ext)) {
          attachmentHtml = `<audio controls class="attachment-audio"><source src="${fileUrl}"></audio>`;
        } else if (['mp4', 'webm', 'mkv', 'mov'].includes(ext)) {
          attachmentHtml = `<video controls class="attachment-video"><source src="${fileUrl}"></video>`;
        } else {
          let icon = '📄';
          if (['docx', 'doc'].includes(ext)) icon = '📝 Word Doc';
          else if (['pptx', 'ppt'].includes(ext)) icon = '📊 Presentation';
          else if (['xlsx', 'xls'].includes(ext)) icon = '📈 Spreadsheet';
          else if (ext === 'pdf') icon = '📕 PDF File';
          else if (['zip', 'rar', '7z'].includes(ext)) icon = '📦 Archive';

          attachmentHtml = `
            <div class="attachment-doc-card">
              <div>${icon}: <strong>${escapeHtml(fileName)}</strong></div>
            </div>`;
        }
      }

      let formattedContent = escapeHtml(note.content || '');
      formattedContent = formattedContent.replace(/\[\[(.*?)\]\]/g, (match, linkTitle) => {
        return `<span style="color:#ba68c8; cursor:pointer; text-decoration:underline;" class="wiki-link" data-title="${escapeHtml(linkTitle)}">[[${linkTitle}]]</span>`;
      });

      card.innerHTML = `
        <div class="note-header-row">
          <div class="note-title">${escapeHtml(note.title)}</div>
          <button class="delete-btn" data-id="${note.id}">✕</button>
        </div>
        ${note.content ? `<div class="note-content">${formattedContent}</div>` : ''}
        ${attachmentHtml}
        ${tagArray.length > 0 ? `<div class="tags-row">${tagsHtml}</div>` : ''}
        <div style="font-size: 11px; color: var(--text-muted); margin-top: 8px;">${new Date(note.created_at).toLocaleString()}</div>
      `;

      // Attach event listener to delete button
      card.querySelector('.delete-btn').addEventListener('click', async () => {
        await ipcRenderer.invoke('delete-note', note.id);
        loadNotes();
      });

      notesContainer.appendChild(card);
    });

    // Attach wiki-link click handlers
    document.querySelectorAll('.wiki-link').forEach(link => {
      link.addEventListener('click', (e) => {
        const title = e.target.getAttribute('data-title');
        filterBySearch(title);
      });
    });
  }

  saveBtn.addEventListener('click', async () => {
    const title = titleInput.value.trim();
    const content = contentInput.value.trim();
    const tags = tagsInput.value.trim();
    if (!title) return;

    saveBtn.innerText = 'Saving...';
    saveBtn.disabled = true;

    await ipcRenderer.invoke('save-note', { title, content, tags, filePath: selectedFilePath });

    titleInput.value = ''; contentInput.value = ''; tagsInput.value = '';
    selectedFilePath = null; selectedFileLabel.innerText = 'No file attached';
    saveBtn.innerText = 'Save to Vault'; saveBtn.disabled = false;
    loadNotes();
  });

  // Vault AI Queries
  document.getElementById('askAiBtn').addEventListener('click', async () => {
    const query = document.getElementById('aiQueryInput').value.trim();
    const box = document.getElementById('aiResponseBox');
    if (!query) return;

    box.style.display = 'block';
    box.innerText = 'Consulting local memories via Ollama...';
    const response = await ipcRenderer.invoke('ask-ai', query);
    box.innerText = response;
  });

  // Companion Chat
  async function sendCompanionMessage() {
    const text = companionInput.value.trim();
    if (!text) return;

    const userMsg = document.createElement('div');
    userMsg.className = 'chat-msg user';
    userMsg.innerText = text;
    chatBox.appendChild(userMsg);
    companionInput.value = '';

    const aiMsg = document.createElement('div');
    aiMsg.className = 'chat-msg ai';
    aiMsg.innerText = 'Thinking...';
    chatBox.appendChild(aiMsg);
    chatBox.scrollTop = chatBox.scrollHeight;

    const reply = await ipcRenderer.invoke('ask-ai', text);
    aiMsg.innerText = reply;
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  sendCompanionBtn.addEventListener('click', sendCompanionMessage);
  companionInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendCompanionMessage(); });

  // Search & Filtering
  searchInput.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().replace('#', '');
    const filtered = allNotes.filter(n =>
      n.title.toLowerCase().includes(q) ||
      (n.content && n.content.toLowerCase().includes(q)) ||
      (n.tags && n.tags.toLowerCase().includes(q))
    );
    renderNotes(filtered);
  });

  function filterBySearch(title) {
    searchInput.value = title;
    searchInput.dispatchEvent(new Event('input'));
  }

  function escapeHtml(text) {
    return text.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
  }

  // Live Activity Stream Event
  ipcRenderer.on('activity-updated', (event, data) => {
    if (activityFeed.children.length === 1 && activityFeed.children[0].innerText.includes('Tracking active background')) {
      activityFeed.innerHTML = '';
    }

    const item = document.createElement('div');
    item.className = 'activity-item';
    item.innerHTML = `
      <div>
        <strong>${escapeHtml(data.appName)}</strong>: ${escapeHtml(data.title)}
      </div>
      <span style="color:var(--text-muted); font-size:11px;">${data.timestamp}</span>
    `;

    activityFeed.insertBefore(item, activityFeed.firstChild);

    if (activityFeed.children.length > 10) {
      activityFeed.removeChild(activityFeed.lastChild);
    }
  });
});