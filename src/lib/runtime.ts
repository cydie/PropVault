/** Detect Web vs Electron and online vs offline data mode */

export type AppPlatform = 'web' | 'electron';
export type ConnectionMode = 'online' | 'offline';

export type RuntimeInfo = {
  platform: AppPlatform;
  isDesktop: boolean;
  connectionMode: ConnectionMode;
  serverUrl: string;
};

const MODE_STORAGE_KEY = 'propvault_connection_mode';
const SERVER_URL_KEY = 'propvault_server_url';

export function isElectron(): boolean {
  return typeof window !== 'undefined' && Boolean(window.propvault?.isDesktop);
}

export function getStoredConnectionMode(): ConnectionMode {
  try {
    const v = localStorage.getItem(MODE_STORAGE_KEY);
    return v === 'offline' ? 'offline' : 'online';
  } catch {
    return 'online';
  }
}

export function setStoredConnectionMode(mode: ConnectionMode) {
  localStorage.setItem(MODE_STORAGE_KEY, mode);
}

export function getStoredServerUrl(): string {
  return localStorage.getItem(SERVER_URL_KEY) || '';
}

export function setStoredServerUrl(url: string) {
  if (url) localStorage.setItem(SERVER_URL_KEY, url);
  else localStorage.removeItem(SERVER_URL_KEY);
}

export async function getRuntimeInfo(): Promise<RuntimeInfo> {
  if (isElectron() && window.propvault?.getRuntime) {
    const rt = await window.propvault.getRuntime();
    const mode = rt.connection?.mode === 'offline' ? 'offline' : 'online';
    const serverUrl = rt.connection?.serverUrl || getStoredServerUrl();
    setStoredConnectionMode(mode);
    if (serverUrl) setStoredServerUrl(serverUrl);
    return {
      platform: 'electron',
      isDesktop: true,
      connectionMode: mode,
      serverUrl,
    };
  }

  return {
    platform: 'web',
    isDesktop: false,
    connectionMode: 'online',
    serverUrl: getStoredServerUrl(),
  };
}

export function isOfflineMode(info: RuntimeInfo): boolean {
  return info.platform === 'electron' && info.connectionMode === 'offline';
}

export function usesLocalDatabase(info: RuntimeInfo): boolean {
  return isOfflineMode(info);
}

export function usesServerApi(info: RuntimeInfo): boolean {
  return info.platform === 'web' || info.connectionMode === 'online';
}
