// "Google से जारी रखें" + the "या" divider (web only: FEATURES.googleLogin). Loaded lazily so the
// Android bundle never pulls in the Google script. Hidden while offline or if the script fails.
import { useEffect, useState } from 'react';
import { GoogleLogin, useGoogleOAuth, type CredentialResponse } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import { Skeleton, toast, useElementWidth } from '../../components/ui';
import { useSettings } from '../../lib/app-state';
import { useOnline } from '../../lib/cache';
import { useT } from '../../lib/i18n';
import './strings';

export interface GoogleIdentity {
  name: string;
  email?: string;
  picture?: string;
  verified: boolean;
}

interface GoogleClaims {
  name?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  email_verified?: boolean;
  picture?: string;
}

/** Give up on the Google button if its script has not loaded by then. */
const SCRIPT_WAIT_MS = 8000;

export function decodeGoogleCredential(credential: string | undefined): GoogleIdentity | null {
  if (!credential) return null;
  try {
    const c = jwtDecode<GoogleClaims>(credential);
    const name = (c.name || [c.given_name, c.family_name].filter(Boolean).join(' ')).trim();
    if (!name && !c.email) return null;
    return {
      name,
      email: c.email?.toLowerCase(),
      picture: c.picture,
      // A missing claim is not proof: only an explicit true counts as a verified email.
      verified: c.email_verified === true,
    };
  } catch {
    return null;
  }
}

export default function GoogleSection({ onSignedIn }: { onSignedIn: (id: GoogleIdentity) => void }) {
  const t = useT();
  const online = useOnline();
  const [settings] = useSettings();
  const { scriptLoadedSuccessfully } = useGoogleOAuth();
  const [gaveUp, setGaveUp] = useState(false);
  const [ref, width] = useElementWidth<HTMLDivElement>();

  useEffect(() => {
    if (scriptLoadedSuccessfully) return;
    const timer = window.setTimeout(() => setGaveUp(true), SCRIPT_WAIT_MS);
    return () => window.clearTimeout(timer);
  }, [scriptLoadedSuccessfully]);

  if (!scriptLoadedSuccessfully && (!online || gaveUp)) return null;

  const fail = () => toast.error(t('auth.google.error'), { id: 'google-login' });
  const onSuccess = (res: CredentialResponse) => {
    const id = decodeGoogleCredential(res.credential);
    if (id) onSignedIn(id);
    else fail();
  };

  // Google draws its own button (200–400 px wide); match the card's width.
  const buttonWidth = Math.round(Math.max(200, Math.min(400, width)));

  return (
    <div className="flex flex-col gap-4">
      <div ref={ref} className="flex min-h-12 w-full items-center justify-center">
        {scriptLoadedSuccessfully && width > 0 ? (
          <GoogleLogin
            onSuccess={onSuccess}
            onError={fail}
            useOneTap={false}
            text="continue_with"
            shape="pill"
            size="large"
            logo_alignment="center"
            theme={settings.theme === 'dark' ? 'filled_black' : 'outline'}
            width={buttonWidth}
          />
        ) : (
          <Skeleton className="h-10 w-full max-w-[25rem]" rounded="full" />
        )}
      </div>
      <div className="flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-line" />
        <span className="text-small font-semibold text-ink-2">{t('auth.or')}</span>
        <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}
