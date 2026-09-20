const { ipcMain, app } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const {
  testLocalConnection,
  getLocalLandRecords,
  getLocalSyncSummary,
  getLocalConnectionString,
} = require('./localDb.cjs');

const MODE_FILE = () => path.join(app.getPath('userData'), 'connection-mode.json');
const SERVER_URL_FILE = () => path.join(app.getPath('userData'), 'server-url.json');

function readJson(filePath, fallback) {
  try {
    if (fs.existsSync(filePath)) return { ...fallback, ...JSON.parse(fs.readFileSync(filePath, 'utf8')) };
  } catch {
    /* ignore */
  }
  return fallback;
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function getConnectionMode() {
  return readJson(MODE_FILE(), { mode: 'online', serverUrl: '' });
}

function setConnectionMode(mode, serverUrl) {
  const current = getConnectionMode();
  const next = {
    mode: mode === 'offline' ? 'offline' : 'online',
    serverUrl: serverUrl || current.serverUrl || '',
  };
  writeJson(MODE_FILE(), next);
  return next;
}

async function pingServer(url) {
  const base = (url || process.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '');
  try {
    const res = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(4000) });
    const data = await res.json();
    return { online: res.ok, base, data };
  } catch (err) {
    return { online: false, base, error: err.message };
  }
}

function registerIpcHandlers() {
  ipcMain.handle('propvault:get-runtime', () => ({
    isDesktop: true,
    platform: process.platform,
    connection: getConnectionMode(),
    localDbConfigured: Boolean(getLocalConnectionString()),
  }));

  ipcMain.handle('propvault:set-connection-mode', (_e, { mode, serverUrl }) => {
    return setConnectionMode(mode, serverUrl);
  });

  ipcMain.handle('propvault:ping-server', async (_e, serverUrl) => pingServer(serverUrl));

  ipcMain.handle('propvault:test-local-db', async () => {
    try {
      const row = await testLocalConnection();
      return { ok: true, db: row?.db, time: row?.now };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('propvault:local-get-land', async (_e, params) => getLocalLandRecords(params || {}));

  ipcMain.handle('propvault:local-sync-summary', async () => getLocalSyncSummary());

  ipcMain.handle('propvault:backup-local-db', async () => {
    return new Promise((resolve) => {
      const script = path.join(__dirname, '..', 'server', 'scripts', 'backup-db.js');
      const child = spawn(process.execPath, [script, '--local'], {
        cwd: path.join(__dirname, '..', 'server'),
        env: { ...process.env, LOCAL_DATABASE_URL: getLocalConnectionString(), ELECTRON_RUN_AS_NODE: '1' },
        shell: true,
      });
      let err = '';
      child.stderr?.on('data', (d) => { err += d.toString(); });
      child.on('close', (code) => {
        resolve(code === 0 ? { ok: true, message: 'Local backup completed' } : { ok: false, error: err || 'Backup failed' });
      });
    });
  });

  ipcMain.handle('propvault:backup-main-db', async () => {
    return new Promise((resolve) => {
      const script = path.join(__dirname, '..', 'server', 'scripts', 'backup-db.js');
      const child = spawn(process.execPath, [script], {
        cwd: path.join(__dirname, '..', 'server'),
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
        shell: true,
      });
      child.on('close', (code) => {
        resolve(code === 0 ? { ok: true, message: 'Main database backup completed' } : { ok: false, error: 'Backup failed' });
      });
    });
  });

  ipcMain.handle('propvault:init-local-schema', async () => {
    return new Promise((resolve) => {
      const script = path.join(__dirname, '..', 'server', 'scripts', 'init-local-db.js');
      const child = spawn(process.execPath, [script], {
        cwd: path.join(__dirname, '..', 'server'),
        env: {
          ...process.env,
          LOCAL_DATABASE_URL: getLocalConnectionString(),
          ELECTRON_RUN_AS_NODE: '1',
        },
        stdio: 'inherit',
      });
      child.on('close', (code) => {
        resolve(code === 0 ? { ok: true } : { ok: false, error: 'Schema init failed' });
      });
    });
  });
}

module.exports = { registerIpcHandlers, getConnectionMode, pingServer };
