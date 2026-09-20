import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import {
  api,
  type LandRecord,
  type BuildingRecord,
  type CertRecord,
  type NotifRecord,
  type AuditRecord,
  type DashboardStats,
  type SettingsData,
  getToken,
} from '@/lib/api';
import { dataService } from '@/services/dataService';
import { useAuth } from './AuthContext';

type MonthlyDatum = { month: string; assessments: number; certifications: number };

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const emptyMonthlyData: MonthlyDatum[] = MONTH_LABELS.map((month) => ({
  month,
  assessments: 0,
  certifications: 0,
}));

interface DataContextValue {
  landProps: LandRecord[];
  buildingProps: BuildingRecord[];
  certifications: CertRecord[];
  notifs: NotifRecord[];
  auditLogs: AuditRecord[];
  usersData: { id: string; name: string; username: string; email: string; role: string; status: string; lastLogin: string }[];
  stats: DashboardStats | null;
  settings: SettingsData | null;
  settingsError: string | null;
  monthlyData: MonthlyDatum[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateCertStatus: (id: string, status: string, remarks?: string) => Promise<void>;
  createCertification: (type: string, property_id?: string) => Promise<void>;
  markAllNotifsRead: () => Promise<void>;
  markNotifRead: (id: number) => Promise<void>;
  pollNotifications: () => Promise<void>;
  isAuthenticated: boolean;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  // isAuthenticated exposed for notification polling
  const [landProps, setLand] = useState<LandRecord[]>([]);
  const [buildingProps, setBuildings] = useState<BuildingRecord[]>([]);
  const [certifications, setCerts] = useState<CertRecord[]>([]);
  const [notifs, setNotifs] = useState<NotifRecord[]>([]);
  const [auditLogs, setAudit] = useState<AuditRecord[]>([]);
  const [usersData, setUsers] = useState<DataContextValue['usersData']>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuth();
  const isItUser = user?.role === 'IT';

  const refresh = useCallback(async () => {
    if (!getToken()) return;
    setLoading(true);
    setError(null);
    try {
      await dataService.refreshRuntime();

      const notifications = await dataService.getNotifications();
      setNotifs(notifications);

      if (!isItUser) {
        const [land, buildings] = await Promise.all([
          dataService.getLandRecords({ limit: 200, page: 1 }),
          dataService.getBuildingRecords(),
        ]);
        setLand(land);
        setBuildings(buildings);
      } else {
        setLand([]);
        setBuildings([]);
      }

      try {
        const certs = await dataService.getCertifications();
        setCerts(certs);
      } catch {
        setCerts([]);
      }

      try {
        const dash = await dataService.getDashboardStats();
        setStats(dash);
      } catch {
        /* non-admin may not need all */
      }

      try {
        const s = await dataService.getSettings();
        setSettings(s);
        setSettingsError(null);
      } catch (e) {
        setSettings(null);
        setSettingsError(e instanceof Error ? e.message : 'Failed to load settings');
      }

      try {
        const users = (await dataService.getUsers()) as DataContextValue['usersData'];
        setUsers(users);
      } catch {
        setUsers([]);
      }

      try {
        const audit = await dataService.getAudit();
        setAudit(audit);
      } catch {
        setAudit([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [isItUser]);

  useEffect(() => {
    if (isAuthenticated) refresh();
  }, [isAuthenticated, refresh]);

  const updateCertStatus = async (id: string, status: string, remarks?: string) => {
    await api.updateCertStatus(id, status, remarks);
    await refresh();
  };

  const createCertification = async (type: string, property_id?: string) => {
    await api.createCertification({ type, property_id });
    await refresh();
  };

  const markAllNotifsRead = async () => {
    await api.markAllNotificationsRead();
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markNotifRead = async (id: number) => {
    await api.markNotificationRead(id);
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const pollNotifications = useCallback(async () => {
    if (!getToken()) return;
    try {
      const notifications = await api.getNotifications();
      setNotifs(notifications);
    } catch {
      /* ignore poll errors */
    }
  }, []);

  const monthlyData = stats?.monthlyData?.length ? stats.monthlyData : emptyMonthlyData;

  return (
    <DataContext.Provider
      value={{
        landProps,
        buildingProps,
        certifications,
        notifs,
        auditLogs,
        usersData,
        stats,
        settings,
        settingsError,
        monthlyData,
        loading,
        error,
        refresh,
        updateCertStatus,
        createCertification,
        markAllNotifsRead,
        markNotifRead,
        pollNotifications,
        isAuthenticated,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
