// One-time migration from the v1 single-screen app (un-prefixed localStorage keys)
// so existing users stay logged in with their name, photo and theme.
import { KEYS, store } from './store';
import type { UserProfile } from '../types/models';

export function migrateFromV1() {
  try {
    if (localStorage.getItem('km:v2:migrated')) return;
    const loggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const rawUser = localStorage.getItem('user');
    const theme = localStorage.getItem('theme');
    if (loggedIn && rawUser) {
      const u = JSON.parse(rawUser) as { name?: string; email?: string; picture?: string; isVerified?: boolean };
      const profile: UserProfile = { name: u.name || '', email: u.email, picture: u.picture, isVerified: u.isVerified };
      store.set(KEYS.profile, profile);
      store.set(KEYS.session, { loggedIn: true, method: 'email', loggedInAt: new Date().toISOString() });
    }
    if (theme === 'dark' || theme === 'light') {
      store.set(KEYS.settings, (prev: Record<string, unknown>) => ({ ...prev, theme }), {});
    }
    ['isLoggedIn', 'user', 'theme'].forEach(k => localStorage.removeItem(k));
    localStorage.setItem('km:v2:migrated', '1');
  } catch {
    /* storage unavailable — nothing to migrate */
  }
}
