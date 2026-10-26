import { z } from 'zod';
import { apiService, ApiError } from './apiService';
const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  platformRole: z.enum(['user', 'super_admin']).default('user'),
});
const membershipSchema = z.object({
  id: z.string(),
  schoolId: z.string().regex(/^[a-f\d]{24}$/i),
  schoolName: z.string().optional(),
  userId: z.string(),
  roleId: z.string(),
  status: z.literal('active'),
});
const sessionSchema = z.object({
  user: userSchema,
  expiresAt: z.string(),
  memberships: z.array(membershipSchema),
});
export type Session = z.infer<typeof sessionSchema>;
export function parseSession(data: unknown): Session {
  const result = sessionSchema.safeParse(data);
  if (!result.success)
    throw new ApiError(0, 'INVALID_RESPONSE', 'The session response could not be read.');
  return result.data;
}
export const authService = {
  async session(signal?: AbortSignal) {
    return parseSession(await apiService.request('/auth/session', { signal }));
  },
  async login(email: string, password: string) {
    const raw = await apiService.request('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    const result = z
      .object({ user: userSchema, expiresAt: z.string(), csrfToken: z.string().min(1) })
      .safeParse(raw);
    if (!result.success)
      throw new ApiError(0, 'INVALID_RESPONSE', 'The sign-in response could not be read.');
    apiService.setCsrfToken(result.data.csrfToken);
  },
  async logout(all = false) {
    try {
      await apiService.request(all ? '/auth/logout-all' : '/auth/logout', { method: 'POST' });
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) throw error;
    }
    apiService.clearSession();
  },
};
