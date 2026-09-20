import { api, type LandRecord, type PaginatedResult } from '@/lib/api';

export type LandQuery = {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  barangay?: string;
};

export const apiService = {
  async getLandRecords(params: LandQuery = {}): Promise<LandRecord[]> {
    const result = await api.getLandPaginated(params);
    return result.items;
  },

  async getLandPaginated(params: LandQuery = {}): Promise<PaginatedResult<LandRecord>> {
    return api.getLandPaginated(params);
  },

  async getBuildingRecords() {
    return api.getBuildings();
  },

  async getNotifications() {
    return api.getNotifications();
  },

  async getDashboardStats() {
    return api.getDashboardStats();
  },

  async getSettings() {
    return api.getSettings();
  },

  async getAudit(module?: string) {
    return api.getAudit(module);
  },

  async getUsers() {
    return api.getUsers();
  },

  async getCertifications() {
    return api.getCertifications();
  },

  async getSyncStatus() {
    return api.getSyncStatus();
  },

  async runServerSync() {
    return api.runSync();
  },

  async pingHealth() {
    return api.health();
  },
};
