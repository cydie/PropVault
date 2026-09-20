import { apiService } from './apiService';
import { localDbService } from './localDbService';
import { getRuntimeInfo, type RuntimeInfo } from '@/lib/runtime';

export type SyncSummary = {
  queuePending: number;
  queueConflicts: number;
  landPending?: number;
  mode: 'online' | 'offline' | 'web';
  lastRun?: unknown;
};

async function ensureServerReachable(runtime: RuntimeInfo): Promise<void> {
  if (window.propvault?.pingServer) {
    const ping = await window.propvault.pingServer(runtime.serverUrl || undefined);
    if (!ping.online) {
      throw new Error('Cannot reach the server. Check your network connection and try again.');
    }
    return;
  }

  try {
    await apiService.pingHealth();
  } catch {
    throw new Error('Cannot reach the server. Check your network connection and try again.');
  }
}

async function ensureOnlineForSync(runtime: RuntimeInfo): Promise<RuntimeInfo> {
  if (runtime.platform === 'electron' && runtime.connectionMode === 'offline') {
    await syncService.setConnectionMode('online', runtime.serverUrl);
    return getRuntimeInfo();
  }
  return runtime;
}

export const syncService = {
  async getSummary(runtime?: RuntimeInfo): Promise<SyncSummary> {
    const rt = runtime ?? (await getRuntimeInfo());

    if (rt.platform === 'web') {
      try {
        const status = await apiService.getSyncStatus();
        return { ...status, mode: 'web' };
      } catch {
        return { queuePending: 0, queueConflicts: 0, mode: 'web' };
      }
    }

    try {
      const [server, local] = await Promise.all([
        apiService.getSyncStatus().catch(() => ({ queuePending: 0, queueConflicts: 0 })),
        localDbService.getSyncSummary(),
      ]);
      return {
        queuePending: (server.queuePending ?? 0) + (local.queuePending ?? 0),
        queueConflicts: (server.queueConflicts ?? 0) + (local.queueConflicts ?? 0),
        landPending: server.landPending,
        lastRun: server.lastRun,
        mode: rt.connectionMode === 'offline' ? 'offline' : 'online',
      };
    } catch {
      return { queuePending: 0, queueConflicts: 0, mode: 'online' };
    }
  },

  async runSync(runtime?: RuntimeInfo) {
    let rt = runtime ?? (await getRuntimeInfo());
    rt = await ensureOnlineForSync(rt);
    await ensureServerReachable(rt);

    const result = await apiService.runServerSync();
    return {
      message: result.message || 'Data synced successfully',
      synced: result.synced ?? 0,
    };
  },

  async setConnectionMode(mode: 'online' | 'offline', serverUrl?: string) {
    if (window.propvault?.setConnectionMode) {
      await window.propvault.setConnectionMode(mode, serverUrl);
    }
    localStorage.setItem('propvault_connection_mode', mode);
    if (serverUrl) localStorage.setItem('propvault_server_url', serverUrl);
  },
};
