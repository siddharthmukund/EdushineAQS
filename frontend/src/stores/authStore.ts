/**
 * authStore — Zustand store for JWT auth state (ICCV #3).
 *
 * Persisted to localStorage key 'cv-auth-state'.
 * On app mount: re-validates the stored token via GET /auth/me.
 * On 401 responses: api.ts interceptor calls authStore.getState().logout().
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserProfile, UserRole } from '../types/api';

// ---------------------------------------------------------------------------
// Role → permission mapping (mirrors backend auth_service.py PERMISSIONS)
// ---------------------------------------------------------------------------
const ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: [
    'manage_users', 'manage_settings', 'view_audit_logs',
    'analyze', 'view_analytics', 'export_reports',
    'create_committee', 'finalize_decisions', 'view_votes',
    'join_committee', 'vote', 'view_candidates',
  ],
  admin: [
    'manage_users', 'manage_settings', 'view_audit_logs',
    'analyze', 'view_analytics', 'export_reports',
    'view_votes', 'view_candidates',
  ],
  committee_chair: [
    'create_committee', 'finalize_decisions', 'view_votes',
    'analyze', 'view_analytics', 'view_candidates',
  ],
  committee_member: ['join_committee', 'vote', 'view_candidates'],
  analyst: ['analyze', 'export_reports', 'view_analytics', 'view_candidates'],
  observer: ['view_candidates'],
  invited: [],
  viewer: ['view_candidates'],
};

// ---------------------------------------------------------------------------
// State interface
// ---------------------------------------------------------------------------
interface AuthState {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;

  // Actions
  login: (token: string, user: UserProfile) => void;
  logout: () => void;
  updateUser: (updates: Partial<UserProfile>) => void;

  // RBAC helpers
  hasRole: (role: UserRole) => boolean;
  hasPermission: (permission: string) => boolean;
  isAdmin: () => boolean;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: (token, user) => {
        set({ token, user, isAuthenticated: true });
      },

      logout: () => {
        set({ token: null, user: null, isAuthenticated: false });
      },

      updateUser: (updates) => {
        const current = get().user;
        if (current) {
          set({ user: { ...current, ...updates } });
        }
      },

      hasRole: (role) => get().user?.role === role,

      hasPermission: (permission) => {
        const role = get().user?.role ?? '';
        return (ROLE_PERMISSIONS[role] ?? []).includes(permission);
      },

      isAdmin: () => {
        const role = get().user?.role ?? '';
        return role === 'admin' || role === 'super_admin';
      },
    }),
    {
      name: 'cv-auth-state',
      // Only persist token + user; isAuthenticated is derived on rehydrate
      partialize: (state) => ({ token: state.token, user: state.user }),
      // After rehydrate, set isAuthenticated based on persisted token
      onRehydrateStorage: () => (state) => {
        if (state && state.token && state.user) {
          state.isAuthenticated = true;
        }
      },
    },
  ),
);
