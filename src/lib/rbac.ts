/** Role-Based Access Control — single source of truth for the frontend */

export type UserRole = 'Admin' | 'Treasury' | 'Staff Assessor' | 'IT';

export type View =
  | 'dashboard'
  | 'land'
  | 'buildings'
  | 'certifications'
  | 'payments'
  | 'gis'
  | 'cadastral'
  | 'reports'
  | 'users'
  | 'audit'
  | 'settings';

export const ROLES = {
  ADMIN: 'Admin',
  TREASURY: 'Treasury',
  STAFF_ASSESSOR: 'Staff Assessor',
  IT: 'IT',
} as const;

export const VALID_ROLES: UserRole[] = [
  ROLES.ADMIN,
  ROLES.TREASURY,
  ROLES.STAFF_ASSESSOR,
  ROLES.IT,
];

export const ROLE_LEVEL: Record<UserRole, number> = {
  Admin: 1,
  Treasury: 2,
  'Staff Assessor': 2,
  IT: 2,
};

export const ROLE_VIEWS: Record<UserRole, View[]> = {
  Admin: [
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
  ],
  Treasury: ['dashboard', 'payments', 'reports', 'land', 'buildings'],
  'Staff Assessor': ['dashboard', 'land', 'buildings', 'gis', 'cadastral', 'reports', 'certifications', 'settings'],
  IT: ['dashboard', 'audit', 'settings', 'reports'],
};

export const PERMISSIONS = {
  'records:create': ['Admin', 'Staff Assessor'],
  'records:edit': ['Admin', 'Staff Assessor'],
  'records:update': ['Admin', 'Staff Assessor'],
  'records:archive': ['Admin', 'Staff Assessor'],
  'records:delete': ['Admin'],
  'assessments:manage': ['Admin', 'Staff Assessor'],
  /** Staff submits for review; only Admin final-approves */
  'assessments:submit': ['Admin', 'Staff Assessor'],
  'assessments:approve': ['Admin'],
  'owners:manage': ['Admin', 'Staff Assessor'],
  'classifications:update': ['Admin', 'Staff Assessor'],
  'documents:upload': ['Admin', 'Staff Assessor'],
  'documents:generate': ['Admin', 'Treasury', 'Staff Assessor'],
  'payments:manage': ['Admin', 'Treasury'],
  'payments:validate': ['Admin', 'Treasury'],
  'payments:approve': ['Admin', 'Treasury'],
  'receipts:generate': ['Admin', 'Treasury'],
  'payments:history': ['Admin', 'Treasury'],
  'properties:view': ['Admin', 'Treasury', 'Staff Assessor'],
  'properties:view.payment': ['Admin', 'Treasury'],
  'reports:all': ['Admin', 'IT'],
  'reports:collection': ['Admin', 'Treasury'],
  'reports:assessment': ['Admin', 'Staff Assessor'],
  'gis:access': ['Admin', 'Staff Assessor'],
  'cadastral:access': ['Admin', 'Staff Assessor'],
  'users:manage': ['Admin'],
  'treasury:manage': ['Admin'],
  'staff:manage': ['Admin'],
  'roles:manage': ['Admin'],
  'audit:access': ['Admin', 'IT'],
  'backup:restore': ['Admin', 'IT'],
  'settings:configure': ['Admin', 'IT'],
  'certifications:approve': ['Admin', 'Staff Assessor'],
  'certifications:request': ['Admin'],
  'permissions:override': ['Admin'],
} as const satisfies Record<string, UserRole[]>;

export type Permission = keyof typeof PERMISSIONS;

export const MANAGEABLE_ROLES: UserRole[] = [
  ROLES.TREASURY,
  ROLES.STAFF_ASSESSOR,
  ROLES.IT,
];

/** Map URL paths to views */
export const PATH_TO_VIEW: Record<string, View> = {
  '/': 'dashboard',
  '/dashboard': 'dashboard',
  '/land': 'land',
  '/buildings': 'buildings',
  '/certifications': 'certifications',
  '/payments': 'payments',
  '/gis': 'gis',
  '/cadastral': 'cadastral',
  '/reports': 'reports',
  '/users': 'users',
  '/audit': 'audit',
  '/settings': 'settings',
};

export const VIEW_TO_PATH: Record<View, string> = {
  dashboard: '/dashboard',
  land: '/land',
  buildings: '/buildings',
  certifications: '/certifications',
  payments: '/payments',
  gis: '/gis',
  cadastral: '/cadastral',
  reports: '/reports',
  users: '/users',
  audit: '/audit',
  settings: '/settings',
};

export function isAdmin(role: UserRole | string | undefined | null): boolean {
  return role === ROLES.ADMIN;
}

export function canAccessView(role: UserRole | string | undefined | null, view: View): boolean {
  if (!role || !view) return false;
  if (isAdmin(role)) return true;
  return (ROLE_VIEWS[role as UserRole] || []).includes(view);
}

export function hasPermission(role: UserRole | string | undefined | null, permission: Permission): boolean {
  if (!role || !permission) return false;
  if (isAdmin(role)) return true;
  const allowed = PERMISSIONS[permission];
  return allowed.includes(role as UserRole);
}

export function pathToView(pathname: string): View | null {
  const normalized = pathname.replace(/\/$/, '') || '/';
  return PATH_TO_VIEW[normalized] ?? PATH_TO_VIEW[pathname] ?? null;
}

export function isValidRole(role: string): role is UserRole {
  return VALID_ROLES.includes(role as UserRole);
}
