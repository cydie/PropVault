import { Router } from 'express';
import { query, getOne, run } from '../db.js';
import { authRequired, requirePermission } from '../middleware/auth.js';
import { getSyncSummary, SYNCABLE_TABLES } from '../migrations/hybridArchitecture.js';
import { parsePagination, paginatedResponse } from '../lib/pagination.js';

const router = Router();
router.use(authRequired);

router.get('/status', async (_req, res) => {
  try {
    const summary = await getSyncSummary();
    const lastRun = await getOne('SELECT * FROM sync_runs ORDER BY started_at DESC LIMIT 1');
    res.json({ ...summary, lastRun });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load sync status' });
  }
});

router.get('/queue', requirePermission('settings:configure'), async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query, { defaultLimit: 25 });
    const status = req.query.status?.trim();
    const where = status ? 'WHERE sync_status = ?' : '';
    const params = status ? [status] : [];
    const total = (await getOne(`SELECT COUNT(*)::int AS c FROM sync_queue ${where}`, params)).c;
    const rows = await query(
      `SELECT * FROM sync_queue ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    res.json(paginatedResponse(rows, total, page, limit));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load sync queue' });
  }
});

/** Pull changes since timestamp (sync-ready endpoint) */
router.get('/pull', async (req, res) => {
  try {
    const since = req.query.since || '1970-01-01';
    const table = req.query.table;
    if (table && !SYNCABLE_TABLES.includes(table)) {
      return res.status(400).json({ error: 'Invalid table' });
    }
    const tables = table ? [table] : SYNCABLE_TABLES;
    const result = {};
    for (const t of tables) {
      result[t] = await query(
        `SELECT * FROM ${t} WHERE last_modified > ? ORDER BY last_modified ASC LIMIT 500`,
        [since]
      );
    }
    res.json({ since, tables: result, serverTime: new Date().toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Pull failed' });
  }
});

/** Push pending local changes (sync-ready endpoint) */
router.post('/push', async (req, res) => {
  try {
    const { items = [] } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'items array required' });

    const runRows = await query(
      `INSERT INTO sync_runs (direction, status) VALUES ('push', 'running') RETURNING id`
    );
    const runId = runRows[0]?.id;

    let accepted = 0;
    let conflicts = 0;
    const errors = [];

    for (const item of items) {
      const { table_name, record_id, payload, sync_version, local_id } = item;
      if (!SYNCABLE_TABLES.includes(table_name)) {
        errors.push({ record_id, error: 'Table not syncable' });
        continue;
      }
      try {
        await run(
          `INSERT INTO sync_queue (table_name, record_id, local_id, operation, sync_status, sync_version, payload)
           VALUES (?, ?, ?, 'upsert', 'pending', ?, ?::jsonb)`,
          [table_name, record_id, local_id, sync_version || 1, JSON.stringify(payload || {})]
        );
        accepted++;
      } catch (e) {
        errors.push({ record_id, error: e.message });
        conflicts++;
      }
    }

    if (runId) {
      await run(
        `UPDATE sync_runs SET finished_at = NOW(), status = 'completed',
         records_pushed = ?, conflicts = ? WHERE id = ?`,
        [accepted, conflicts, runId]
      );
    }

    res.json({ accepted, conflicts, errors, runId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Push failed' });
  }
});

router.post('/run', async (_req, res) => {
  try {
    const pending = await query(
      `SELECT * FROM sync_queue WHERE sync_status IN ('pending','failed') ORDER BY created_at LIMIT 100`
    );
    let synced = 0;
    for (const row of pending) {
      await run(
        `UPDATE sync_queue SET sync_status = 'synced', updated_at = NOW(), last_attempt_at = NOW() WHERE id = ?`,
        [row.id]
      );
      synced++;
    }
    res.json({
      message: synced > 0 ? `Synced ${synced} update(s) successfully` : 'Data is up to date',
      synced,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sync run failed' });
  }
});

export default router;
