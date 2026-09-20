/** Role-Based Access Control — single source of truth for the API */

export const ROLES = {
  ADMIN: 'Admin',
  TREASURY: 'Treasury',
  STAFF_ASSESSOR: 'Staff Assessor',
  IT: 'IT',
};

export const VALID_ROLES = Object.values(ROLES);

/** Role hierarchy: lower number = higher privilege */
export const ROLE_LEVEL = {
  [ROLES.ADMIN]: 1,
  [ROLES.TREASURY]: 2,
  [ROLES.STAFF_ASSESSOR]: 2,
  [ROLES.IT]: 2,
};

export const VIEWS = [
  'dashboard',
  'land',
  'buildings',
  'certifications',
  'payments',
  'gis',
  'cadastral',
  'reports',
  'users',
  'audit',
  'settings',
];

/** Module views each role may access */
export const ROLE_VIEWS = {
  [ROLES.ADMIN]: [...VIEWS],
  [ROLES.TREASURY]: ['dashboard', 'payments', 'reports', 'land', 'buildings'],
  [ROLES.STAFF_ASSESSOR]: ['dashboard', 'land', 'buildings', 'gis', 'cadastral', 'reports', 'certifications', 'settings'],
  [ROLES.IT]: ['dashboard', 'audit', 'settings', 'reports'],
};

export const PERMISSIONS = {
  'records:create': [ROLES.ADMIN, ROLES.STAFF_ASSESSOR],
  'records:edit': [ROLES.ADMIN, ROLES.STAFF_ASSESSOR],
  'records:update': [ROLES.ADMIN, ROLES.STAFF_ASSESSOR],
  'records:archive': [ROLES.ADMIN, ROLES.STAFF_ASSESSOR],
  'records:delete': [ROLES.ADMIN],
  'assessments:manage': [ROLES.ADMIN, ROLES.STAFF_ASSESSOR],
  'assessments:submit': [ROLES.ADMIN, ROLES.STAFF_ASSESSOR],
  'assessments:approve': [ROLES.ADMIN],
  'owners:manage': [ROLES.ADMIN, ROLES.STAFF_ASSESSOR],
  'classifications:update': [ROLES.ADMIN, ROLES.STAFF_ASSESSOR],
  'documents:upload': [ROLES.ADMIN, ROLES.STAFF_ASSESSOR],
  'documents:generate': [ROLES.ADMIN, ROLES.TREASURY, ROLES.STAFF_ASSESSOR],
  'payments:manage': [ROLES.ADMIN, ROLES.TREASURY],
  'payments:validate': [ROLES.ADMIN, ROLES.TREASURY],
  'payments:approve': [ROLES.ADMIN, ROLES.TREASURY],
  'receipts:generate': [ROLES.ADMIN, ROLES.TREASURY],
  'payments:history': [ROLES.ADMIN, ROLES.TREASURY],
  'properties:view': [ROLES.ADMIN, ROLES.TREASURY, ROLES.STAFF_ASSESSOR],
  'properties:view.payment': [ROLES.ADMIN, ROLES.TREASURY],
  'reports:all': [ROLES.ADMIN, ROLES.IT],
  'reports:collection': [ROLES.ADMIN, ROLES.TREASURY],
  'reports:assessment': [ROLES.ADMIN, ROLES.STAFF_ASSESSOR],
  'gis:access': [ROLES.ADMIN, ROLES.STAFF_ASSESSOR],
  'cadastral:access': [ROLES.ADMIN, ROLES.STAFF_ASSESSOR],
  'users:manage': [ROLES.ADMIN],
  'treasury:manage': [ROLES.ADMIN],
  'staff:manage': [ROLES.ADMIN],
  'roles:manage': [ROLES.ADMIN],
  'audit:access': [ROLES.ADMIN, ROLES.IT],
  'backup:restore': [ROLES.ADMIN, ROLES.IT],
  'settings:configure': [ROLES.ADMIN, ROLES.IT],
  'certifications:approve': [ROLES.ADMIN, ROLES.STAFF_ASSESSOR],
  'certifications:request': [ROLES.ADMIN],
  'permissions:override': [ROLES.ADMIN],
};

/** Roles Admin may assign when creating/editing accounts */
export const MANAGEABLE_ROLES = [ROLES.TREASURY, ROLES.STAFF_ASSESSOR, ROLES.IT];

export function isAdmin(role) {
  return role === ROLES.ADMIN;
}

export function canAccessView(role, view) {
  if (!role || !view) return false;
  if (isAdmin(role)) return true;
  return (ROLE_VIEWS[role] || []).includes(view);
}

export function hasPermission(role, permission) {
  if (!role || !permission) return false;
  if (isAdmin(role)) return true;
  const allowed = PERMISSIONS[permission];
  return Array.isArray(allowed) && allowed.includes(role);
}

export function requireValidRole(role) {
  return VALID_ROLES.includes(role);
}
