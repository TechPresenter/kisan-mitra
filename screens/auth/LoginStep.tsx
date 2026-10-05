// 03 Login (reference screen 3): green farm header with the logo tile, name and tagline; then
// Google (web only), "या", mobile-or-email + name and "लॉगिन करें". There is no server, so no
// password or OTP: the details are saved on this phone.
import { Suspense, lazy } from 'react';
import { LogIn } from 'lucide-react';
import { BrandLogo } from '../../components/brand/BrandLogo';
import { FarmScene, SCENE_INK } from '../../components/illustrations';
import { Button, Card, Screen, Skeleton } from '../../components/ui';
import { FEATURES } from '../../lib/features';
import { useT } from '../../lib/i18n';
import { ContactField, NameField, PrivacyNote, useIdentityForm, type IdentityDraft } from './fields';
import type { GoogleIdentity } from './GoogleSection';
import type { Contact } from './validate';
import { LanguageButton } from './LanguageButton';
import './strings';

// On a flaky network the chunk can fail to load: then there is simply no Google button
// (the mobile/email form below still works) instead of a blank login screen.
const GoogleSection = lazy(() =>
  import('./GoogleSection').catch(() => ({ default: (_: { onSignedIn: (id: GoogleIdentity) => void }) => null })),
);

export interface LoginStepProps {
  onLogin: (v: { name: string; contact: Contact }) => void;
  onGoogle: (id: GoogleIdentity) => void;
  onSignup: () => void;
  headingRef?: { current: HTMLHeadingElement | null };
  /** What was typed on the signup step (or here before), so nothing is typed twice. */
  initial?: IdentityDraft;
  onDraftChange?: (v: IdentityDraft) => void;
}

/** Green header over the farm strip: logo tile, app name and tagline in white. */
function LoginHeader() {
  const t = useT();
  return (
    // Pulled up under the status bar so the green runs edge to edge.
    <div className="relative -mt-[var(--inset-top)] overflow-hidden bg-brand-900 pt-[var(--inset-top)]">
      <FarmScene variant="header" className="absolute inset-0 size-full" />
      <LanguageButton onDark className="absolute end-1 top-[calc(var(--inset-top)+0.25rem)] z-[1]" />
      <div className="relative flex flex-col items-center px-6 pt-8 pb-20 text-center" style={{ color: SCENE_INK.header }}>
        <span className="rounded-[26%] bg-white/95 p-1 shadow-float">
          <BrandLogo variant="mark" size={68} alt="" />
        </span>
        <p className="mt-3 text-[1.75rem] leading-snug font-bold">{t('auth.appName')}</p>
        <p className="text-body leading-snug opacity-90">{t('auth.tagline')}</p>
      </div>
    </div>
  );
}

export function LoginStep({ onLogin, onGoogle, onSignup, headingRef, initial, onDraftChange }: LoginStepProps) {
  const t = useT();
  const form = useIdentityForm({ ...initial, onChange: onDraftChange });

  const submit = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    const v = form.validate();
    if (v) onLogin(v);
  };

  return (
    <Screen header={false} bottomNav={false} padded={false}>
      <LoginHeader />
      <div className="relative -mt-10 px-4">
        <Card padding="lg" elevated className="flex flex-col gap-4">
          <div>
            <h1 ref={headingRef} tabIndex={-1} className="text-section leading-snug font-bold text-ink outline-none">
              {t('auth.login.heading')}
            </h1>
            <p className="mt-0.5 text-small text-ink-2">{t('auth.login.sub')}</p>
          </div>

          {FEATURES.googleLogin && (
            <Suspense fallback={<Skeleton className="h-12 w-full" rounded="full" />}>
              <GoogleSection onSignedIn={onGoogle} />
            </Suspense>
          )}

          <form noValidate onSubmit={submit} className="flex flex-col gap-4">
            <ContactField
              value={form.contact}
              onChange={form.setContact}
              mode={form.mode}
              onModeChange={form.setMode}
              error={form.contactError && t(form.contactError)}
              inputRef={form.contactRef}
              onEnter={e => {
                // "Next" on the keyboard: go to the name field instead of submitting a half-filled form.
                if (form.nameOk) return;
                e.preventDefault();
                form.nameRef.current?.focus();
              }}
            />
            <NameField
              value={form.name}
              onChange={form.setName}
              error={form.nameError && t(form.nameError)}
              inputRef={form.nameRef}
              enterKeyHint="go"
            />
            <Button type="submit" fullWidth size="lg" icon={LogIn}>
              {t('auth.login.submit')}
            </Button>
          </form>
        </Card>
      </div>

      <div className="flex flex-col items-center gap-2 px-4 pt-5">
        <p className="flex flex-wrap items-center justify-center gap-x-1 text-body text-ink-2">
          <span>{t('auth.login.newUser')}</span>
          <button
            type="button"
            onClick={onSignup}
            className="press inline-flex min-h-12 items-center rounded-btn px-2 font-bold text-brand underline-offset-4 hover:underline"
          >
            {t('auth.login.signup')}
          </button>
        </p>
        <PrivacyNote />
      </div>
    </Screen>
  );
}
