export type PropvaultConnectionMode = 'online' | 'offline';

export type PropvaultRuntime = {
  isDesktop: boolean;
  platform: string;
  connection: {
    mode: PropvaultConnectionMode;
    serverUrl?: string;
  };
  localDbConfigured?: boolean;
};

export type PaginatedLandResult = {
  items: import('@/lib/api').LandRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

declare global {
  interface Window {
    propvault?: {
      isDesktop: boolean;
      platform: string;
      showNotification: (payload: { title: string; body?: string }) => void;
      getRuntime: () => Promise<PropvaultRuntime>;
      setConnectionMode: (mode: PropvaultConnectionMode, serverUrl?: string) => Promise<unknown>;
      pingServer: (serverUrl?: string) => Promise<{ online: boolean; base: string; error?: string }>;
      testLocalDb: () => Promise<{ ok: boolean; db?: string; error?: string }>;
      initLocalSchema: () => Promise<{ ok: boolean; error?: string }>;
      localGetLand: (params?: {
        page?: number;
        limit?: number;
        search?: string;
      }) => Promise<PaginatedLandResult>;
      localSyncSummary: () => Promise<{ queuePending: number; queueConflicts: number }>;
      backupLocalDb: () => Promise<{ ok: boolean; message?: string; error?: string }>;
      backupMainDb: () => Promise<{ ok: boolean; message?: string; error?: string }>;
    };
  }
}

export {};
