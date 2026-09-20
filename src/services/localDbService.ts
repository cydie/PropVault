import type { LandRecord, PaginatedResult } from '@/lib/api';
import type { LandQuery } from './apiService';

export const localDbService = {
  async testConnection() {
    if (!window.propvault?.testLocalDb) {
      return { ok: false, error: 'Local database bridge unavailable' };
    }
    return window.propvault.testLocalDb();
  },

  async initSchema() {
    if (!window.propvault?.initLocalSchema) {
      return { ok: false, error: 'Local schema init unavailable' };
    }
    return window.propvault.initLocalSchema();
  },

  async getLandPaginated(params: LandQuery = {}): Promise<PaginatedResult<LandRecord>> {
    if (!window.propvault?.localGetLand) {
      return { items: [], total: 0, page: 1, limit: 50, totalPages: 1 };
    }
    return window.propvault.localGetLand(params);
  },

  async getLandRecords(params: LandQuery = {}): Promise<LandRecord[]> {
    const page = await this.getLandPaginated(params);
    return page.items;
  },

  async getSyncSummary() {
    if (!window.propvault?.localSyncSummary) {
      return { queuePending: 0, queueConflicts: 0 };
    }
    return window.propvault.localSyncSummary();
  },

  async backupLocal() {
    if (!window.propvault?.backupLocalDb) {
      return { ok: false, error: 'Backup unavailable' };
    }
    return window.propvault.backupLocalDb();
  },
};
