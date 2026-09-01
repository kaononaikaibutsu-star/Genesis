const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { initDatabase, saveNote, getAllNotes, deleteNote, semanticSearch } = require('./database');
const { askVault } = require('./ollama');

let mainWindow;
let activeWin; // Dynamic import for ESM support

const globalConfigPath = path.join(app.getPath('home'), '.genesis', 'config.json');
const localConfigPath = path.join(app.getPath('userData'), 'config.json');
let recentActivities = [];

function loadConfig() {
  try {
    const targetPath = fs.existsSync(globalConfigPath) 
      ? globalConfigPath 
      : (fs.existsSync(localConfigPath) ? localConfigPath : globalConfigPath);

    if (!fs.existsSync(targetPath)) {
      const defaultConfig = { theme: 'dark', auto_start: true };
      const parentDir = path.dirname(targetPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      fs.writeFileSync(targetPath, JSON.stringify(defaultConfig, null, 2), 'utf8');
      return defaultConfig;
    }

    return JSON.parse(fs.readFileSync(targetPath, 'utf8'));
  } catch (err) {
    return { theme: 'dark', auto_start: true };
  }
}

function saveConfig(config) {
  const targetPath = fs.existsSync(globalConfigPath) ? globalConfigPath : localConfigPath;
  fs.writeFileSync(targetPath, JSON.stringify(config, null, 2), 'utf8');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    titleBarStyle: 'hiddenInset'
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });
}

async function captureCurrentWindow() {
  if (!activeWin) return;
  try {
    const windowInfo = await activeWin();
    if (windowInfo && windowInfo.owner && windowInfo.owner.name) {
      const appName = windowInfo.owner.name;
      const windowTitle = windowInfo.title || 'Untitled Window';
      const timestamp = new Date().toLocaleTimeString();
      const logEntry = `App: ${appName} | Title: "${windowTitle}" | Time: ${timestamp}`;

      if (recentActivities.length === 0 || !recentActivities[0].includes(`Title: "${windowTitle}"`)) {
        recentActivities.unshift(logEntry);
        if (recentActivities.length > 10) recentActivities.pop();

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('activity-updated', { appName, title: windowTitle, timestamp });
        }
        await saveNote(`Activity: ${appName}`, `User active in ${appName} - "${windowTitle}" at ${timestamp}`, 'activity-log', null);
      }
    }
  } catch (err) {
    console.error('[Genesis Monitor Error]:', err.message);
  }
}

app.whenReady().then(async () => {
  try {
    const module = await import('active-win');
    activeWin = module.default;
  } catch (e) {
    console.warn('active-win module import skipped:', e.message);
  }

  try {
    initDatabase();
  } catch (e) {
    console.error('Database init error:', e.message);
  }

  createWindow();
  setInterval(captureCurrentWindow, 4000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// --- IPC Handlers ---
ipcMain.handle('get-config', async () => loadConfig());

ipcMain.handle('update-theme', async (event, theme) => {
  const config = loadConfig();
  config.theme = theme;
  saveConfig(config);
  return true;
});

ipcMain.handle('select-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'] });
  return (!result.canceled && result.filePaths.length > 0) ? result.filePaths[0] : null;
});

ipcMain.handle('save-note', async (event, { title, content, tags, filePath }) => saveNote(title, content, tags, filePath));
ipcMain.handle('get-notes', async () => getAllNotes());
ipcMain.handle('delete-note', async (event, id) => { deleteNote(id); return true; });

ipcMain.handle('ask-ai', async (event, query) => {
  await captureCurrentWindow();
  const contextNotes = await semanticSearch(query, 3);
  const liveActivityNote = {
    title: "CURRENT ACTIVE WINDOWS AND APPS LOG",
    content: recentActivities.length > 0 ? recentActivities.join('\n') : "User is currently running Project Genesis application."
  };
  return await askVault(query, [liveActivityNote, ...contextNotes]);
});