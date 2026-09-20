import { useCallback, useEffect, useState } from 'react';
import { Database, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { syncService } from '@/services/syncService';
import { localDbService } from '@/services/localDbService';

type Props = {
  compact?: boolean;
  onSyncComplete?: () => void;
};

export function SyncControl({ compact = false, onSyncComplete }: Props) {
  const [syncing, setSyncing] = useState(false);
  const [pending, setPending] = useState(0);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const sum = await syncService.getSummary();
      setPending(sum.queuePending ?? 0);
    } catch {
      setPending(0);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
    const t = setInterval(refreshStatus, 60000);
    return () => clearInterval(t);
  }, [refreshStatus]);

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await syncService.runSync();
      toast.success(res.message || 'Data synced successfully');
      setLastSynced(new Date().toLocaleTimeString(undefined, { timeStyle: 'short' }));
      await refreshStatus();
      onSyncComplete?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleBackupLocal = async () => {
    const res = await localDbService.backupLocal();
    if (res.ok) toast.success(res.message || 'Local backup completed');
    else toast.error(res.error || 'Backup failed');
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleSync}
        disabled={syncing}
        className="relative flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium hover:bg-secondary text-muted-foreground hover:text-foreground transition-all disabled:opacity-60"
        title="Sync latest data with the server"
      >
        <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
        <span className="hidden lg:inline">{syncing ? 'Syncing…' : 'Sync'}</span>
        {pending > 0 && !syncing && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {pending > 9 ? '9+' : pending}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center">
          <Database size={18} className="text-white" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Data Sync</h3>
          <p className="text-xs text-muted-foreground">Pull the latest records from the municipal server</p>
        </div>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Pending changes</span>
          <span className="font-semibold">{pending}</span>
        </div>
        {lastSynced && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Last synced</span>
            <span className="font-medium">{lastSynced}</span>
          </div>
        )}
        <button
          type="button"
          disabled={syncing}
          onClick={handleSync}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
        >
          <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Syncing…' : 'Sync Now'}
        </button>
        {typeof window !== 'undefined' && window.propvault?.isDesktop && (
          <button
            type="button"
            onClick={handleBackupLocal}
            className="w-full px-3 py-2 rounded-lg border border-border text-xs font-medium hover:bg-secondary"
          >
            Backup Local Database (IT)
          </button>
        )}
      </div>
    </div>
  );
}
