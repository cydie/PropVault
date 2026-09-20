/**
 * Central data router — Server REST API vs Local PostgreSQL (Electron offline).
 */
import { getRuntimeInfo, usesLocalDatabase, usesServerApi, type RuntimeInfo } from '@/lib/runtime';
import { apiService, type LandQuery } from './apiService';
import { localDbService } from './localDbService';
import type { LandRecord, PaginatedResult } from '@/lib/api';

let cachedRuntime: RuntimeInfo | null = null;

export async function refreshRuntime(): Promise<RuntimeInfo> {
  cachedRuntime = await getRuntimeInfo();
  return cachedRuntime;
}

export async function getRuntime(): Promise<RuntimeInfo> {
  if (!cachedRuntime) return refreshRuntime();
  return cachedRuntime;
}

export const dataService = {
  refreshRuntime,

  async getLandRecords(params: LandQuery = {}): Promise<LandRecord[]> {
    const rt = await getRuntime();
    if (usesLocalDatabase(rt)) {
      return localDbService.getLandRecords(params);
    }
    return apiService.getLandRecords(params);
  },

  async getLandPaginated(params: LandQuery = {}): Promise<PaginatedResult<LandRecord>> {
    const rt = await getRuntime();
    if (usesLocalDatabase(rt)) {
      return localDbService.getLandPaginated(params);
    }
    return apiService.getLandPaginated(params);
  },

  async getBuildingRecords() {
    const rt = await getRuntime();
    if (usesLocalDatabase(rt)) {
      return [] as Awaited<ReturnType<typeof apiService.getBuildingRecords>>;
    }
    return apiService.getBuildingRecords();
  },

  async getNotifications() {
    const rt = await getRuntime();
    if (!usesServerApi(rt)) return [];
    return apiService.getNotifications();
  },

  async getDashboardStats() {
    const rt = await getRuntime();
    if (!usesServerApi(rt)) return null;
    return apiService.getDashboardStats();
  },

  async getSettings() {
    const rt = await getRuntime();
    if (!usesServerApi(rt)) return null;
    return apiService.getSettings();
  },

  async getAudit(module?: string) {
    const rt = await getRuntime();
    if (!usesServerApi(rt)) return [];
    return apiService.getAudit(module);
  },

  async getUsers() {
    const rt = await getRuntime();
    if (!usesServerApi(rt)) return [];
    return apiService.getUsers();
  },

  async getCertifications() {
    const rt = await getRuntime();
    if (!usesServerApi(rt)) return [];
    return apiService.getCertifications();
  },

  isOfflineCapable() {
    return typeof window !== 'undefined' && Boolean(window.propvault?.isDesktop);
  },
};
