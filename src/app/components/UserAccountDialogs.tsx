import { useEffect, useState, type ComponentType } from 'react';
import {
  Activity,
  CheckCircle,
  HelpCircle,
  Lock,
  Settings,
  Shield,
  User,
  Users,
  XCircle,
} from 'lucide-react';
import { api, type AuthUser } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import type { UserRole, View } from '@/lib/rbac';

export type AccountDialog = 'profile' | 'password' | 'history' | 'help' | null;

type Props = {
  open: AccountDialog;
  onClose: () => void;
  user: AuthUser;
  onNavigate?: (view: View) => void;
};

const inputCls =
  'w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10';

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

export function UserAccountDialogs({ open, onClose, user, onNavigate }: Props) {
  const { refreshUser } = useAuth();

  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [username, setUsername] = useState(user.username);
  const [status, setStatus] = useState('Active');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const [history, setHistory] = useState<{ id: number; ip: string; success: boolean; created_at: string }[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open !== 'profile') return;
    setName(user.name);
    setEmail(user.email);
    setUsername(user.username);
    api.me().then((me) => {
      if (me.status) setStatus(me.status);
    }).catch(() => {});
  }, [open, user]);

  useEffect(() => {
    if (open !== 'history') return;
    setHistoryLoading(true);
    api
      .getLoginHistory()
      .then(setHistory)
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : 'Could not load login history');
        setHistory([]);
      })
      .finally(() => setHistoryLoading(false));
  }, [open]);

  useEffect(() => {
    if (!open) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  }, [open]);

  async function handleSaveProfile() {
    if (!name.trim() || !email.trim()) {
      toast.error('Name and email are required');
      return;
    }
    setSaving(true);
    try {
      const updated = await api.updateProfile({ name: name.trim(), email: email.trim() });
      refreshUser(updated);
      toast.success('Profile updated');
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save profile');
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword() {
    if (!currentPassword || !newPassword) {
      toast.error('Fill in all password fields');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    setSaving(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      toast.success('Password updated successfully');
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Password change failed');
    } finally {
      setSaving(false);
    }
  }

  const lastSuccess = history.find((h) => h.success);

  return (
    <>
      <Dialog open={open === 'profile'} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User size={18} className="text-primary" />
              My Profile
            </DialogTitle>
            <DialogDescription>Update your display name and contact email.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Full Name</label>
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Email</label>
              <input
                type="email"
                className={inputCls}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Username</label>
                <input className={`${inputCls} bg-muted/50`} value={username} readOnly />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Role</label>
                <input className={`${inputCls} bg-muted/50`} value={user.role} readOnly />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Account Status</label>
              <input className={`${inputCls} bg-muted/50`} value={status} readOnly />
            </div>
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSaveProfile}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open === 'password'} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock size={18} className="text-primary" />
              Change Password
            </DialogTitle>
            <DialogDescription>Use a strong password with at least 8 characters.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Current Password</label>
              <input
                type={showCurrent ? 'text' : 'password'}
                className={inputCls}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">New Password</label>
              <input
                type={showNew ? 'text' : 'password'}
                className={inputCls}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Confirm New Password</label>
              <input
                type={showNew ? 'text' : 'password'}
                className={inputCls}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={showNew} onChange={(e) => setShowNew(e.target.checked)} />
              Show new password
            </label>
          </div>
          <DialogFooter>
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-secondary">
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleChangePassword}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
            >
              {saving ? 'Updating…' : 'Update Password'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open === 'history'} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity size={18} className="text-primary" />
              Login History
            </DialogTitle>
            <DialogDescription>
              Recent sign-in activity for your account
              {lastSuccess ? ` · Last success: ${formatWhen(lastSuccess.created_at)}` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-72 overflow-y-auto border border-border rounded-lg">
            {historyLoading ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</p>
            ) : history.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">No login history yet</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">When</th>
                    <th className="px-3 py-2 font-medium">IP</th>
                    <th className="px-3 py-2 font-medium">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => (
                    <tr key={row.id} className="border-t border-border/60">
                      <td className="px-3 py-2 text-xs">{formatWhen(row.created_at)}</td>
                      <td className="px-3 py-2 text-xs font-mono">{row.ip || '—'}</td>
                      <td className="px-3 py-2">
                        {row.success ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                            <CheckCircle size={12} /> Success
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-red-600">
                            <XCircle size={12} /> Failed
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <DialogFooter>
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
              Close
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open === 'help'} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle size={18} className="text-primary" />
              Help & Support
            </DialogTitle>
            <DialogDescription>VeriTrack — Municipal Assessor Information System</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
              <p className="font-medium text-foreground flex items-center gap-2">
                <Shield size={15} className="text-primary" />
                IT Support
              </p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                For account lockouts, email delivery, or system issues, contact the Municipal Assessor IT office.
              </p>
              <p className="text-xs">
                <span className="text-muted-foreground">Email:</span>{' '}
                <a href="mailto:it@rizal.gov.ph" className="text-primary hover:underline">
                  it@rizal.gov.ph
                </a>
              </p>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-4">
              <li>Use <strong>Forgot password</strong> on the login page to sign in with an email code.</li>
              <li>Change your password regularly from this menu.</li>
              <li>Review Login History if you notice unfamiliar activity.</li>
              <li>Sign out when leaving a shared workstation.</li>
            </ul>
            {(user.role === 'Admin' || user.role === 'IT') && onNavigate && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigate(user.role === 'IT' ? 'settings' : 'users');
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-border hover:bg-secondary text-sm font-medium"
              >
                {user.role === 'IT' ? <Settings size={14} /> : <Users size={14} />}
                {user.role === 'IT' ? 'Open IT Settings' : 'Open User Management'}
              </button>
            )}
          </div>
          <DialogFooter>
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
              Close
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export type ProfileMenuItem = {
  icon: ComponentType<{ size?: number; className?: string }>;
  label: string;
  action: AccountDialog | 'navigate';
  view?: View;
  roles?: UserRole[];
};

export const PROFILE_MENU: ProfileMenuItem[] = [
  { icon: User, label: 'My Profile', action: 'profile' },
  { icon: Lock, label: 'Change Password', action: 'password' },
  { icon: Activity, label: 'Login History', action: 'history' },
  { icon: HelpCircle, label: 'Help & Support', action: 'help' },
  { icon: Users, label: 'User Management', action: 'navigate', view: 'users', roles: ['Admin'] },
  { icon: Settings, label: 'System Settings', action: 'navigate', view: 'settings', roles: ['Admin', 'IT'] },
];
