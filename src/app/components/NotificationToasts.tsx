import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, CheckCircle, AlertCircle, XCircle, X } from 'lucide-react';
import type { NotifRecord } from '@/lib/api';
import { useData } from '@/context/DataContext';
import rizalLogo from '@/imports/Rizal_Logo.png';

const TOAST_DURATION_MS = 10_000;
const POLL_INTERVAL_MS = 20_000;

const typeIcon = {
  success: CheckCircle,
  warning: AlertCircle,
  error: XCircle,
  info: Bell,
} as const;

const typeColor = {
  success: 'text-emerald-600',
  warning: 'text-amber-600',
  error: 'text-red-600',
  info: 'text-blue-600',
} as const;

type Props = {
  panelOpen: boolean;
  onOpenPanel: () => void;
};

function ToastCard({
  n,
  onDismiss,
  onOpenPanel,
}: {
  n: NotifRecord;
  onDismiss: (id: number, markRead: boolean) => void;
  onOpenPanel: () => void;
}) {
  const Icon = typeIcon[n.type as keyof typeof typeIcon] ?? Bell;
  const color = typeColor[n.type as keyof typeof typeColor] ?? 'text-blue-600';

  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(n.id, false), TOAST_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [n.id, onDismiss]);

  return (
    <div
      className="pointer-events-auto bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-right-4 fade-in duration-300"
      role="alert"
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/60 bg-muted/30">
        <img src={rizalLogo} alt="" className="w-5 h-5 rounded object-contain" />
        <span className="text-xs font-semibold text-foreground flex-1">VeriTrack</span>
        <button
          type="button"
          onClick={() => onDismiss(n.id, true)}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          aria-label="Dismiss and mark as read"
        >
          <X size={14} />
        </button>
      </div>
      <button
        type="button"
        onClick={() => {
          onDismiss(n.id, true);
          onOpenPanel();
        }}
        className="w-full text-left px-3 py-2.5 hover:bg-secondary/40 transition-colors"
      >
        <div className="flex gap-2">
          <Icon size={16} className={`shrink-0 mt-0.5 ${color}`} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground leading-snug">{n.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">{n.msg}</p>
            <p className="text-[10px] text-muted-foreground/60 mt-1">{n.time}</p>
          </div>
        </div>
      </button>
      <div className="h-0.5 bg-muted overflow-hidden">
        <div
          className="h-full bg-primary/70 origin-left"
          style={{ animation: `notif-shrink ${TOAST_DURATION_MS}ms linear forwards` }}
        />
      </div>
    </div>
  );
}

export function NotificationToasts({ panelOpen, onOpenPanel }: Props) {
  const { notifs, markNotifRead, pollNotifications, isAuthenticated } = useData();
  const [toasts, setToasts] = useState<NotifRecord[]>([]);
  const shownIds = useRef<Set<number>>(new Set());

  const dismissToast = useCallback(
    (id: number, markRead: boolean) => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      if (markRead) markNotifRead(id);
    },
    [markNotifRead]
  );

  useEffect(() => {
    if (!isAuthenticated) return;
    const id = window.setInterval(() => pollNotifications(), POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [isAuthenticated, pollNotifications]);

  useEffect(() => {
    if (panelOpen) return;
    for (const n of notifs) {
      if (!n.read && !shownIds.current.has(n.id)) {
        shownIds.current.add(n.id);
        setToasts((prev) => {
          if (prev.some((t) => t.id === n.id)) return prev;
          return [...prev, n].slice(-3);
        });
        if (document.hidden && window.propvault?.showNotification) {
          window.propvault.showNotification({ title: n.title, body: n.msg });
        }
      }
    }
  }, [notifs, panelOpen]);

  if (toasts.length === 0) return null;

  return (
    <>
      <div
        className="fixed bottom-4 right-4 z-[1100] flex flex-col gap-2 w-[min(100vw-2rem,360px)] pointer-events-none"
        aria-live="polite"
      >
        {toasts.map((n) => (
          <ToastCard key={n.id} n={n} onDismiss={dismissToast} onOpenPanel={onOpenPanel} />
        ))}
      </div>
      <style>{`
        @keyframes notif-shrink {
          from { transform: scaleX(1); }
          to { transform: scaleX(0); }
        }
      `}</style>
    </>
  );
}
