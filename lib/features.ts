// Feature flags for modules that need infrastructure the app doesn't have yet.
// Community and expert consultation need a moderated backend (accounts, verified experts,
// payments); until then their screens show a preview instead of fake data.
import { Capacitor } from '@capacitor/core';

export const FEATURES = {
  /** Farmer community (posts, groups, expert answers). Requires a moderated backend. */
  community: false,
  /** Paid expert consultation (chat / voice / video). Requires expert onboarding + payments. */
  experts: false,
  /** Google web sign-in is blocked inside Android WebViews; native sign-in needs OAuth setup. */
  googleLogin: !Capacitor.isNativePlatform(),
} as const;
