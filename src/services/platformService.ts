import { z } from 'zod';
import { apiService, ApiError } from './apiService';

const id = z.string().regex(/^[a-f\d]{24}$/i);

const userSchema = z.object({
  id,
  name: z.string(),
  email: z.string(),
  status: z.enum(['active', 'disabled']),
  platformRole: z.enum(['user', 'super_admin']),
});

export const subscriptionFeaturesSchema = z.object({
  punchGps: z.boolean().default(true),
  whatsappAlerts: z.boolean().default(true),
  onlinePayments: z.boolean().default(true),
  advancedPayroll: z.boolean().default(true),
});

export const subscriptionSchema = z.object({
  plan: z.enum(['starter', 'pro', 'enterprise', 'none']),
  status: z.enum(['active', 'grace_period', 'expired', 'unsubscribed']),
  purchasedAt: z.string().nullable().optional(),
  renewsAt: z.string().nullable().optional(),
  amountPaid: z.number().optional(),
  billingCycle: z.string().optional(),
  features: subscriptionFeaturesSchema.default({
    punchGps: true,
    whatsappAlerts: true,
    onlinePayments: true,
    advancedPayroll: true,
  }),
});

const schoolSchema = z.object({
  id,
  name: z.string(),
  slug: z.string(),
  code: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  timezone: z.string(),
  status: z.enum(['active', 'suspended', 'archived']),
  subscription: subscriptionSchema.optional(),
  principalName: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional(),
});

const auditSchema = z.object({
  id,
  action: z.string(),
  reason: z.string().optional(),
  actorType: z.enum(['operator', 'user']),
  actorUserId: id.optional(),
  targetId: id.optional(),
  createdAt: z.string(),
  requestId: z.string(),
});

export type PlatformUser = z.infer<typeof userSchema>;
export type PlatformSchool = z.infer<typeof schoolSchema>;
export type SchoolSubscription = z.infer<typeof subscriptionSchema>;
export type SchoolSubscriptionFeatures = z.infer<typeof subscriptionFeaturesSchema>;
export type PlatformEvent = z.infer<typeof auditSchema>;
export type NewAccount = { name: string; email: string; password: string };
export type NewSchool = {
  name: string;
  slug: string;
  timezone: string;
  code?: string;
  email?: string;
  phone?: string;
} & ({ owner: NewAccount; ownerUserId?: never } | { ownerUserId: string; owner?: never });

export type PlatformPage<T> = { items: T[]; nextCursor: string | null };

export type SchoolSubscriptionRecord = {
  schoolId: string;
  schoolName: string;
  code: string | null;
  city: string | null;
  hasPlan: boolean;
  plan: 'starter' | 'pro' | 'enterprise' | 'none';
  planLabel: string;
  amountPaid: number;
  annualRate: number;
  status: 'active' | 'grace_period' | 'expired' | 'unsubscribed';
  purchasedAt: string | null;
  renewsAt: string | null;
};

export type PlatformStats = {
  summary: {
    totalSchools: number;
    activeSchools: number;
    suspendedSchools: number;
    totalStudents: number;
    totalStaff: number;
    totalRevenue: number;
    subscriptionRevenue: number;
    totalFeeCollections: number;
    subscribedSchoolsCount: number;
    unsubscribedSchoolsCount: number;
  };
  monthlyGrowth: Array<{ label: string; count: number }>;
  schoolDirectory: Array<PlatformSchool & { studentCount: number; staffCount: number }>;
  schoolSubscriptions: SchoolSubscriptionRecord[];
};

export type PlatformAnnouncement = {
  id: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  target: 'all' | 'specific';
  targetSchoolIds: string[];
  active: boolean;
  startsAt: string;
  expiresAt?: string;
  createdAt?: string;
};

export type ActiveSchoolAnnouncement = {
  id: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  startsAt: string;
  expiresAt?: string;
};

export type SystemHealthData = {
  gateways: {
    sms: { provider: string; status: string; creditsRemaining: number; senderId: string };
    whatsapp: {
      provider: string;
      status: string;
      qualityRating: string;
      templatesApproved: number;
      responseRatePercent: number;
    };
    database: { provider: string; status: string; latencyMs: number; replicaSet: string; uptimeHours: number };
  };
  storage: {
    totalEstimatedMb: number;
    schools: Array<{
      schoolId: string;
      schoolName: string;
      code: string | null;
      studentsCount: number;
      photosCount: number;
      feeReceiptsCount: number;
      estimatedMb: number;
    }>;
  };
  backup: {
    lastAutomatedBackup: string;
    backupStatus: string;
    retentionDays: number;
  };
};

function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success)
    throw new ApiError(0, 'INVALID_RESPONSE', 'The platform response could not be read.');
  return result.data;
}

async function list<T>(
  resource: string,
  schema: z.ZodType<T>,
  signal?: AbortSignal,
  cursor?: string,
  email?: string,
): Promise<PlatformPage<T>> {
  const params = new URLSearchParams();
  if (cursor) params.set('after', cursor);
  if (email) params.set('email', email);
  return parse(
    z.object({ items: z.array(schema), nextCursor: id.nullable() }),
    await apiService.request(`/platform/${resource}${params.size ? `?${params}` : ''}`, { signal }),
  );
}

export const platformService = {
  schools: (signal?: AbortSignal, cursor?: string) => list('schools', schoolSchema, signal, cursor),
  users: (signal?: AbortSignal, cursor?: string, email?: string) =>
    list('users', userSchema, signal, cursor, email),
  events: (signal?: AbortSignal, cursor?: string) =>
    list('audit-events', auditSchema, signal, cursor),

  async stats(signal?: AbortSignal): Promise<PlatformStats> {
    return (await apiService.request('/platform/stats', { signal })) as PlatformStats;
  },

  async updateSubscription(
    schoolId: string,
    input: {
      plan: 'starter' | 'pro' | 'enterprise' | 'none';
      status: 'active' | 'grace_period' | 'expired' | 'unsubscribed';
      renewsAt?: string;
      features?: Partial<SchoolSubscriptionFeatures>;
    },
  ): Promise<PlatformSchool> {
    return parse(
      schoolSchema,
      await apiService.request(`/platform/schools/${schoolId}/subscription`, {
        method: 'PATCH',
        body: input,
      }),
    );
  },

  async announcements(signal?: AbortSignal): Promise<PlatformAnnouncement[]> {
    return (await apiService.request('/platform/announcements', { signal })) as PlatformAnnouncement[];
  },

  async createAnnouncement(input: {
    title: string;
    message: string;
    severity: 'info' | 'warning' | 'critical';
    target: 'all' | 'specific';
    targetSchoolIds?: string[];
    active?: boolean;
    startsAt?: string;
    expiresAt?: string;
  }): Promise<PlatformAnnouncement> {
    return (await apiService.request('/platform/announcements', {
      method: 'POST',
      body: input,
    })) as PlatformAnnouncement;
  },

  async updateAnnouncement(
    id: string,
    input: Partial<PlatformAnnouncement>,
  ): Promise<PlatformAnnouncement> {
    return (await apiService.request(`/platform/announcements/${id}`, {
      method: 'PATCH',
      body: input,
    })) as PlatformAnnouncement;
  },

  async deleteAnnouncement(id: string): Promise<{ deleted: boolean }> {
    return (await apiService.request(`/platform/announcements/${id}`, {
      method: 'DELETE',
    })) as { deleted: boolean };
  },

  async activeSchoolAnnouncements(
    schoolId: string,
    signal?: AbortSignal,
  ): Promise<ActiveSchoolAnnouncement[]> {
    return (await apiService.request(`/schools/${schoolId}/profile/active-announcements`, {
      signal,
    })) as ActiveSchoolAnnouncement[];
  },

  async systemHealth(signal?: AbortSignal): Promise<SystemHealthData> {
    return (await apiService.request('/platform/system-health', { signal })) as SystemHealthData;
  },

  async exportBackup(): Promise<void> {
    const res = await apiService.request('/platform/backup/export');
    const blob = new Blob([JSON.stringify(res, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `schoolwell-platform-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  async recoverOwner(schoolId: string, userId: string, reason: string) {
    return parse(
      z.object({ recovered: z.literal(true) }),
      await apiService.request(`/platform/schools/${schoolId}/recover-owner`, {
        method: 'POST',
        body: { userId, reason },
      }),
    );
  },

  async createSchool(input: NewSchool) {
    return parse(
      z.object({ school: z.object({ id, name: z.string() }), ownerUserId: id }),
      await apiService.request('/platform/schools', { method: 'POST', body: input }),
    );
  },

  async updateSchool(
    schoolId: string,
    input: { name?: string; slug?: string; timezone?: string; status?: 'active' | 'suspended' },
  ) {
    return parse(
      schoolSchema,
      await apiService.request(`/platform/schools/${schoolId}`, { method: 'PATCH', body: input }),
    );
  },

  async archiveSchool(schoolId: string) {
    return parse(
      schoolSchema,
      await apiService.request(`/platform/schools/${schoolId}`, { method: 'DELETE' }),
    );
  },

  async createUser(input: NewAccount) {
    return parse(
      z.object({ id, name: z.string(), email: z.string() }),
      await apiService.request('/platform/users', { method: 'POST', body: input }),
    );
  },

  async updateUser(
    userId: string,
    input: { name?: string; email?: string; status?: 'active' | 'disabled' },
  ) {
    return parse(
      userSchema,
      await apiService.request(`/platform/users/${userId}`, { method: 'PATCH', body: input }),
    );
  },

  async disableUser(userId: string) {
    return parse(
      userSchema,
      await apiService.request(`/platform/users/${userId}`, { method: 'DELETE' }),
    );
  },

  async resetPassword(userId: string, password: string) {
    return parse(
      z.object({ reset: z.literal(true) }),
      await apiService.request(`/platform/users/${userId}/password`, {
        method: 'POST',
        body: { password },
      }),
    );
  },
};

export function platformError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === 'LAST_USABLE_OWNER') return error.message;
    if (error.status === 404) return 'This platform record is unavailable. Refresh the list.';
    if (error.status === 409)
      return 'The email, school slug, or code may already exist, or this account is protected.';
    if (error.status === 403)
      return 'Super Admin access is required, or the security check expired. Refresh and retry.';
    return error.message;
  }
  return 'The request could not be completed. Refresh to check the result before retrying.';
}

export function validateNewPassword(password: string, repeat: string) {
  if (password !== repeat) return 'Passwords do not match.';
  if (
    password.length < 8 ||
    password.length > 64 ||
    new TextEncoder().encode(password).length > 72 ||
    password.includes('\0')
  )
    return 'Use 8–64 characters and at most 72 UTF-8 bytes for the password.';
  return '';
}
