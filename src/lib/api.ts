const API_BASE = import.meta.env.VITE_API_URL || '/api';

import type { UserRole } from './rbac';
export type { UserRole };

export interface AuthUser {
  id: string;
  name: string;
  username: string;
  email: string;
  role: UserRole;
}

let token: string | null = localStorage.getItem('propvault_token');

export function setToken(t: string | null) {
  token = t;
  if (t) localStorage.setItem('propvault_token', t);
  else localStorage.removeItem('propvault_token');
}

export function getToken() {
  return token;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText || 'Request failed');
  return data as T;
}

export const api = {
  health: () => request<{ status: string }>('/health'),

  login: (body: { username: string; password: string; captcha?: string; captchaExpected?: string; remember?: boolean }) =>
    request<{ token: string; user: AuthUser }>('/auth/login', { method: 'POST', body: JSON.stringify(body) }),

  forgotPassword: (email: string) =>
    request<{ message: string }>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),

  requestForgotCode: (email: string) =>
    request<{ message: string }>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),

  verifyForgotCode: (email: string, code: string) =>
    request<{ token: string; user: AuthUser }>('/auth/verify-forgot-code', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    }),

  me: () => request<AuthUser & { status?: string }>('/auth/me'),

  updateProfile: (body: { name: string; email: string }) =>
    request<AuthUser>('/auth/profile', { method: 'PUT', body: JSON.stringify(body) }),

  getLoginHistory: () =>
    request<{ id: number; ip: string; success: boolean; created_at: string }[]>('/auth/login-history'),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  getUsers: () => request<unknown[]>('/users'),
  createUser: (body: Record<string, unknown>) => request('/users', { method: 'POST', body: JSON.stringify(body) }),
  updateUser: (id: string, body: Record<string, unknown>) =>
    request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteUser: (id: string) => request(`/users/${id}`, { method: 'DELETE' }),

  getLand: () => request<LandRecord[]>('/properties/land'),
  getLandPaginated: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    barangay?: string;
  }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.search) q.set('search', params.search);
    if (params?.status) q.set('status', params.status);
    if (params?.barangay) q.set('barangay', params.barangay);
    const qs = q.toString();
    return request<PaginatedResult<LandRecord>>(`/properties/land${qs ? `?${qs}` : '?page=1&limit=200'}`);
  },
  getBuildings: () => request<BuildingRecord[]>('/properties/buildings'),
  createLand: (body: Record<string, unknown>) =>
    request<{ id: string }>('/properties/land', { method: 'POST', body: JSON.stringify(body) }),
  updateLand: (id: string, body: Record<string, unknown>) =>
    request<{ id: string }>(`/properties/land/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  createBuilding: (body: Record<string, unknown>) =>
    request<{ id: string }>('/properties/buildings', { method: 'POST', body: JSON.stringify(body) }),
  updateBuilding: (id: string, body: Record<string, unknown>) =>
    request<{ id: string }>(`/properties/buildings/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  updateLandStatus: (id: string, status: string, remarks?: string) =>
    request(`/properties/land/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, remarks }) }),
  updateBuildingStatus: (id: string, status: string, remarks?: string) =>
    request(`/properties/buildings/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, remarks }) }),
  lookupProperty: (q: string) =>
    request<{
      results: {
        type: 'land' | 'building';
        id: string;
        td: string;
        pin: string;
        owner: string;
        barangay: string;
        classification: string;
        mv: string;
        av: string;
        status: string;
      }[];
    }>(`/properties/lookup?q=${encodeURIComponent(q)}`),
  createPayment: (body: {
    propertyId?: string;
    owner: string;
    td?: string;
    pin?: string;
    amount: string;
    taxYear: string;
  }) => request('/payments', { method: 'POST', body: JSON.stringify(body) }),
  addClassification: (name: string) =>
    request<{ id: number; name: string }>('/settings/classifications', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  updateAssessmentLevel: (id: number, body: { name?: string; rate?: number }) =>
    request<{ id: number; name: string; rate: number }>(`/settings/assessment-levels/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  addAssessmentLevel: (name: string, rate: number) =>
    request<{ id: number; name: string; rate: number }>('/settings/assessment-levels', {
      method: 'POST',
      body: JSON.stringify({ name, rate }),
    }),

  getCertifications: () => request<CertRecord[]>('/certifications'),
  createCertification: (body: { type: string; property_id?: string }) =>
    request('/certifications', { method: 'POST', body: JSON.stringify(body) }),
  updateCertStatus: (id: string, status: string, remarks?: string) =>
    request(`/certifications/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, remarks }) }),

  getNotifications: () => request<NotifRecord[]>('/notifications'),
  markNotificationRead: (id: number) =>
    request<{ success: boolean }>(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: () => request('/notifications/read-all', { method: 'POST' }),

  getAudit: (module?: string) =>
    request<AuditRecord[]>(`/audit${module && module !== 'All' ? `?module=${encodeURIComponent(module)}` : ''}`),

  getDashboardStats: () => request<DashboardStats>('/dashboard/stats'),
  getSettings: () => request<SettingsData>('/settings'),
  backup: () => request<{ message: string }>('/settings/backup', { method: 'POST' }),
  updateLgu: (body: SettingsLgu) =>
    request<{ lgu: SettingsLgu }>('/settings/lgu', { method: 'PUT', body: JSON.stringify(body) }),
  updatePropertyKinds: (propertyKinds: SettingsPropertyKind[]) =>
    request<{ propertyKinds: SettingsPropertyKind[] }>('/settings/property-kinds', {
      method: 'PUT',
      body: JSON.stringify({ propertyKinds }),
    }),
  addBarangay: (name: string, code: string) =>
    request<{ id: number; name: string; code: string }>('/settings/barangays', {
      method: 'POST',
      body: JSON.stringify({ name, code }),
    }),
  updateBarangay: (id: number, data: { name?: string; code?: string }) =>
    request<{ id: number; name: string; code: string }>(`/settings/barangays/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteBarangay: (id: number) =>
    request<{ success: boolean }>(`/settings/barangays/${id}`, { method: 'DELETE' }),

  getItConfig: () => request<ItConfig>('/settings/it-config'),
  updateSmtp: (body: Partial<SmtpConfig>) =>
    request<{ smtp: SmtpConfig }>('/settings/smtp', { method: 'PUT', body: JSON.stringify(body) }),
  testSmtp: (to: string) =>
    request<{ message: string }>('/settings/smtp/test', { method: 'POST', body: JSON.stringify({ to }) }),
  getEmailTemplates: () => request<Record<string, EmailTemplate>>,
  updateEmailTemplate: (key: string, body: Partial<EmailTemplate>) =>
    request<EmailTemplate>(`/settings/email-templates/${key}`, { method: 'PUT', body: JSON.stringify(body) }),
  previewEmailTemplate: (key: string, body?: Partial<EmailTemplate>) =>
    request<{ html: string; subject: string }>(`/settings/email-templates/${key}/preview`, {
      method: 'POST',
      body: JSON.stringify(body ?? {}),
    }),
  getGisConfig: () => request<GisConfig>('/settings/gis'),
  updateGisConfig: (body: Partial<GisConfig>) =>
    request<GisConfig>('/settings/gis', { method: 'PUT', body: JSON.stringify(body) }),

  getSyncStatus: () =>
    request<{
      queuePending: number;
      queueConflicts: number;
      landPending?: number;
      lastRun?: unknown;
    }>('/sync/status'),
  runSync: () => request<{ message: string; synced: number }>('/sync/run', { method: 'POST' }),

  verifyProperty: (q: string) => request<{ reference: string; results: unknown[] }>(`/properties/verify?q=${encodeURIComponent(q)}`),

  importPropertyCsv: async (propertyType: 'land' | 'building', file: File) => {
    const form = new FormData();
    form.append('file', file);
    const path = propertyType === 'land' ? '/properties/land/import' : '/properties/buildings/import';
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || res.statusText || 'Import failed');
    return data as {
      created: number;
      skipped: number;
      records: { id: string; pin: string; owner: string }[];
      errors: { row: number; error: string; id?: string }[];
    };
  },

  uploadPropertySoftCopies: async (opts: {
    propertyType: 'land' | 'building';
    files: File[];
    propertyId?: string;
    pin?: string;
    tdOrArp?: string;
  }) => {
    const form = new FormData();
    form.append('propertyType', opts.propertyType);
    if (opts.propertyId) form.append('propertyId', opts.propertyId);
    if (opts.pin) form.append('pin', opts.pin);
    if (opts.tdOrArp) form.append('td', opts.tdOrArp);
    opts.files.forEach((f) => form.append('files', f));
    const res = await fetch(`${API_BASE}/properties/soft-copies`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || res.statusText || 'Upload failed');
    return data as {
      uploaded: number;
      matched: number;
      unmatched: number;
      files: { id: number; originalName: string; url: string; matched: boolean }[];
    };
  },

  getPayments: () => request<PaymentRecord[]>('/payments'),
  updatePaymentStatus: (id: string, status: string, remarks?: string) =>
    request<{ success: boolean; receiptNo?: string }>(`/payments/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, remarks }),
    }),
};

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface LandRecord {
  id: string;
  td: string;
  pin: string;
  owner: string;
  barangay: string;
  classification: string;
  area: string;
  mv: string;
  av: string;
  status: string;
  remarks?: string;
  syncStatus?: string;
  serverId?: string;
  localId?: string;
  lastModified?: string;
}

export interface BuildingRecord {
  id: string;
  arp: string;
  pin: string;
  owner: string;
  barangay: string;
  kind: string;
  structural: string;
  floors: string;
  floorArea: string;
  mv: string;
  av: string;
  status: string;
  remarks?: string;
}

export interface CertRecord {
  id: string;
  type: string;
  requestor: string;
  pid: string;
  date: string;
  due: string;
  status: string;
  remarks?: string;
}

export interface NotifRecord {
  id: number;
  type: string;
  title: string;
  msg: string;
  time: string;
  read: boolean;
  createdAt?: string;
}

export interface AuditRecord {
  id: string;
  time: string;
  user: string;
  action: string;
  module: string;
  detail: string;
  ip: string;
  color: string;
}

export interface DashboardStats {
  totalProperties?: number;
  landRecords?: number;
  buildingRecords?: number;
  pendingAssessments?: number;
  underReviewAssessments?: number;
  encodedDraft?: number;
  encodedToday?: number;
  approvedAssessments?: number;
  rejectedAssessments?: number;
  certificationRequests?: number;
  certificationPending?: number;
  activeUsers?: number;
  archivedRecords?: number;
  brgyData?: { name: string; count: number }[];
  classData?: { name: string; value: number; color: string }[];
  monthlyData?: { month: string; assessments: number; certifications: number }[];
  monthlyMovement?: {
    month: string;
    year: number;
    precedingMonth: string;
    precedingYear: number;
    existingEndPreceding: number;
    newDuringPresent: number;
    cancelledDuringPresent: number;
    endPresent: number;
    totalAssessedValue: number;
  };
  approvalQueue?: {
    id: string;
    td: string;
    pin: string;
    owner: string;
    barangay: string;
    status: string;
    av: string;
  }[];
  fiscalYear?: number;
  paymentRecords?: number;
  paymentsPending?: number;
  paymentsApproved?: number;
  receiptsIssued?: number;
  paymentsApprovedToday?: number;
  assignedProperties?: number;
  auditEvents?: number;
  auditEventsToday?: number;
}

export interface SmtpConfig {
  enabled: boolean;
  deliveryMethod?: 'smtp' | 'brevo_api';
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password?: string;
  hasPassword?: boolean;
  brevoApiKey?: string;
  hasBrevoApiKey?: boolean;
  fromName: string;
  fromEmail: string;
}

export interface EmailTemplate {
  key: string;
  label: string;
  subject: string;
  heading: string;
  greeting: string;
  body: string;
  buttonText: string;
  buttonColor: string;
  accentColor: string;
  footer: string;
  variables?: string[];
}

export interface GisLayerConfig {
  label: string;
  url: string;
  attribution: string;
  enabled: boolean;
}

export interface GisConfig {
  defaultCenter: { lat: number; lng: number };
  defaultZoom: number;
  minZoom: number;
  maxZoom: number;
  street: GisLayerConfig;
  satellite: GisLayerConfig;
  apiKey: string;
  tileProviderNote: string;
}

export interface ItConfig {
  smtp: SmtpConfig;
  emailTemplates: Record<string, EmailTemplate>;
  gis: GisConfig;
}

export interface PaymentRecord {
  id: string;
  propertyId?: string;
  owner: string;
  td?: string;
  pin?: string;
  amount: string;
  taxYear: string;
  paymentDate?: string;
  status: string;
  receiptNo?: string;
  validatedBy?: string;
  remarks?: string;
}

export interface SettingsLgu {
  provinceCode: string;
  provinceName: string;
  municipalCode: string;
  municipalName: string;
}

export interface SettingsPropertyKind {
  code: string;
  label: string;
  short?: string;
  key?: string;
}

export interface SettingsData {
  barangays: { id: number; name: string; code?: string | null }[];
  classifications: { id: number; name: string }[];
  assessmentLevels: { id: number; name: string; rate: number }[];
  lgu?: SettingsLgu;
  propertyKinds?: SettingsPropertyKind[];
}
