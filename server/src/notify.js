import { query, run } from './db.js';
import { ROLES } from './rbac.js';

/**
 * Send a notification to every active user matching one of the given roles.
 * Stores audience_roles so only those roles can see the notification (defense in depth).
 */
export async function notifyByRoles(roles, type, title, message) {
  if (!roles?.length) return;
  const placeholders = roles.map(() => '?').join(', ');
  const users = await query(
    `SELECT id FROM users WHERE status = 'Active' AND role IN (${placeholders})`,
    roles
  );
  const audience = JSON.stringify(roles);
  for (const u of users) {
    await run(
      'INSERT INTO notifications (user_id, type, title, message, audience_roles) VALUES (?, ?, ?, ?, ?)',
      [u.id, type, title, message, audience]
    );
  }
}

/** Notify a single user (e.g. requester when their item is approved). */
export async function notifyUser(userId, type, title, message, audienceRoles = null) {
  if (!userId) return;
  await run(
    'INSERT INTO notifications (user_id, type, title, message, audience_roles) VALUES (?, ?, ?, ?, ?)',
    [userId, type, title, message, audienceRoles ? JSON.stringify(audienceRoles) : null]
  );
}

export const NOTIFY = {
  admins: (type, title, message) => notifyByRoles([ROLES.ADMIN], type, title, message),
  approvers: (type, title, message) =>
    notifyByRoles([ROLES.ADMIN, ROLES.STAFF_ASSESSOR], type, title, message),
  treasury: (type, title, message) =>
    notifyByRoles([ROLES.ADMIN, ROLES.TREASURY], type, title, message),
  it: (type, title, message) => notifyByRoles([ROLES.ADMIN, ROLES.IT], type, title, message),
};
