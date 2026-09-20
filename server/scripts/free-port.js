/**
 * Free a TCP listen port so `npm run dev` / `dev:all` can start cleanly
 * when a leftover PropVault API process is still bound to it.
 */
import { execSync } from 'child_process';

function listeningPidsWin(p) {
  const out = execSync('netstat -ano', { encoding: 'utf8' });
  const pids = new Set();
  for (const line of out.split(/\r?\n/)) {
    if (!line.includes('LISTENING')) continue;
    // e.g. TCP    0.0.0.0:3001    0.0.0.0:0    LISTENING    19580
    const m = line.match(new RegExp(`:${p}\\s+.+LISTENING\\s+(\\d+)`, 'i'));
    if (m) pids.add(m[1]);
  }
  return [...pids];
}

function listeningPidsUnix(p) {
  try {
    const out = execSync(`lsof -tiTCP:${p} -sTCP:LISTEN`, { encoding: 'utf8' }).trim();
    return out ? out.split(/\s+/).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function freePort(p) {
  const port = Number(p);
  if (!port) return;
  let pids = [];
  try {
    pids = process.platform === 'win32' ? listeningPidsWin(port) : listeningPidsUnix(port);
  } catch {
    return;
  }
  for (const pid of pids) {
    if (!pid || pid === '0' || pid === String(process.pid)) continue;
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
      } else {
        process.kill(Number(pid), 'SIGKILL');
      }
      console.log(`[dev] Freed port ${port} (stopped PID ${pid})`);
    } catch {
      // already gone
    }
  }
}

const isCli = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('scripts/free-port.js');
if (isCli) {
  freePort(process.argv[2] || process.env.PORT || 3001);
}
