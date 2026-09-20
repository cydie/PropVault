const { app, BrowserWindow, ipcMain, Notification } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const { registerIpcHandlers } = require('./ipcHandlers.cjs');
const { closeLocalPool } = require('./localDb.cjs');

const isDev = !app.isPackaged;
let apiProcess = null;
const API_PORT = process.env.PORT || 3001;

function startApiServer() {
  const serverPath = path.join(__dirname, '..', 'server', 'src', 'index.js');
  apiProcess = spawn(process.execPath, [serverPath], {
    cwd: path.join(__dirname, '..', 'server'),
    env: { ...process.env, PORT: String(API_PORT), ELECTRON_RUN_AS_NODE: '1' },
    stdio: 'inherit',
  });
  apiProcess.on('error', (err) => console.error('API failed to start:', err));
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 360,
    minHeight: 600,
    title: 'PropVault — VeriTrack',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

ipcMain.on('propvault:notification', (_event, payload) => {
  if (!payload?.title) return;
  if (Notification.isSupported()) {
    const n = new Notification({
      title: payload.title,
      body: payload.body || '',
      silent: false,
    });
    n.show();
  }
});

registerIpcHandlers();

app.whenReady().then(() => {
  startApiServer();
  setTimeout(createWindow, 1500);
});

app.on('window-all-closed', () => {
  if (apiProcess) apiProcess.kill();
  closeLocalPool().catch(() => {});
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
