// Sign-in flow rendered by the app shell while logged out:
//   splash → welcome carousel (first time only) → login ⇄ signup.
// Android back returns to the previous step. On success the profile and session are saved on
// this phone (there is no server: no password, no OTP) and onDone() is called; the shell then
// shows onboarding because profile.onboardedAt is unset.
import { useEffect, useRef, useState } from 'react';
import { toast } from '../../components/ui';
import { useProfile, useSession, useSettings, type Session } from '../../lib/app-state';
import { useBackHandler } from '../../lib/back';
import { useT } from '../../lib/i18n';
import { usePersisted } from '../../lib/store';
import type { UserProfile } from '../../types/models';
import type { IdentityDraft } from './fields';
import type { GoogleIdentity } from './GoogleSection';
import { LoginStep } from './LoginStep';
import { SignupStep, type SignupValues } from './SignupStep';
import { SplashStep } from './SplashStep';
import type { Contact } from './validate';
import { setStatusBars } from './system-bars';
import { WelcomeStep } from './WelcomeStep';
import './strings';

type Step = 'splash' | 'welcome' | 'login' | 'signup';

/** Set once the farmer has gone past the welcome slides, so they are not shown again. */
export const WELCOME_SEEN_KEY = 'auth.welcomeSeen';

function contactPatch(c: Contact): Partial<UserProfile> {
  return c.kind === 'phone' ? { phone: c.phone, email: undefined } : { email: c.email, phone: undefined };
}

export default function AuthFlow({ onDone }: { onDone: () => void }) {
  const t = useT();
  const [, updateProfile] = useProfile();
  const [, setSession] = useSession();
  const [settings] = useSettings();
  const [welcomeSeen, setWelcomeSeen] = usePersisted<boolean>(WELCOME_SEEN_KEY, false);
  const [history, setHistory] = useState<Step[]>(['splash']);
  const step = history[history.length - 1];
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const finished = useRef(false);
  // Name and number typed on login carry over to signup and back (each step unmounts).
  const [typed, setTyped] = useState<IdentityDraft>({ name: '', contact: '' });

  const push = (next: Step) => setHistory(h => [...h, next]);
  const replace = (next: Step) => setHistory(h => [...h.slice(0, -1), next]);
  const back = () => setHistory(h => (h.length > 1 ? h.slice(0, -1) : h));
  // login → signup → "लॉगिन करें" should go back rather than stack another login.
  const toLogin = () => setHistory(h => (h[h.length - 2] === 'login' ? h.slice(0, -1) : [...h.slice(0, -1), 'login']));

  useBackHandler(back, history.length > 1);

  // Android status bar: dark icons over the light splash art (always light) and the welcome
  // page in the light theme; light icons over the green login header and signup app bar.
  const darkTheme = settings.theme === 'dark';
  useEffect(() => {
    setStatusBars({
      statusIcons: step === 'splash' || (step === 'welcome' && !darkTheme) ? 'dark' : 'light',
      navIcons: step === 'splash' || !darkTheme ? 'dark' : 'light',
    });
  }, [step, darkTheme]);

  // Move screen-reader focus to the new step's heading (not on the first render).
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    headingRef.current?.focus({ preventScroll: true });
  }, [step]);

  const finish = (patch: Partial<UserProfile>, method: NonNullable<Session['method']>) => {
    if (finished.current) return;
    finished.current = true;
    updateProfile(patch);
    if (!welcomeSeen) setWelcomeSeen(true);
    // The session flips the app shell to onboarding, so it is written last.
    setSession({ loggedIn: true, method, loggedInAt: new Date().toISOString() });
    if (patch.name) toast.success(t('auth.hello', { name: patch.name }), { id: 'auth-hello' });
    onDone();
  };

  const login = ({ name, contact }: { name: string; contact: Contact }) =>
    // No 'phone' sign-in method exists in Session yet; a local (non-Google) account is 'email'.
    finish({ name, ...contactPatch(contact), isVerified: false }, 'email');

  const signup = (v: SignupValues) =>
    finish(
      {
        name: v.name,
        ...contactPatch(v.contact),
        isVerified: false,
        ...(v.village ? { village: v.village } : {}),
        ...(v.district ? { district: v.district } : {}),
        ...(v.state ? { state: v.state } : {}),
      },
      'email',
    );

  const google = (id: GoogleIdentity) =>
    finish({ name: id.name, email: id.email, picture: id.picture, isVerified: id.verified }, 'google');

  const leaveWelcome = () => {
    setWelcomeSeen(true);
    push('login');
  };

  switch (step) {
    case 'splash':
      return <SplashStep onNext={() => replace(welcomeSeen ? 'login' : 'welcome')} />;
    case 'welcome':
      return <WelcomeStep headingRef={headingRef} onDone={leaveWelcome} />;
    case 'signup':
      return (
        <SignupStep
          headingRef={headingRef}
          initial={typed}
          onDraftChange={setTyped}
          onSignup={signup}
          onLogin={toLogin}
          onBack={back}
        />
      );
    case 'login':
    default:
      return (
        <LoginStep
          headingRef={headingRef}
          initial={typed}
          onDraftChange={setTyped}
          onLogin={login}
          onGoogle={google}
          onSignup={() => push('signup')}
        />
      );
  }
}
