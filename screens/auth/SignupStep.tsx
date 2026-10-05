// 04 Signup: name, mobile-or-email, and (optionally) village, district and state. Picking a
// place from the location sheet fills district + state and becomes the app's selected place;
// a district typed by hand becomes it too when it is one of the well-known districts.
import { useMemo, useState } from 'react';
import { MapPin, UserPlus } from 'lucide-react';
import { Button, Card, MicButton, Screen, SelectField, TextField } from '../../components/ui';
import { LocationSheet } from '../../components/shared/LocationSheet';
import { usePlace } from '../../lib/app-state';
import { useLanguage, useT } from '../../lib/i18n';
import { INDIAN_STATES, findState } from '../../services/location';
import type { GeoPlace } from '../../types/models';
import { ContactField, NameField, PrivacyNote, useIdentityForm, type IdentityDraft } from './fields';
import { findPopularDistrict, placeMatchesDistrict } from './place-match';
import { cleanText, type Contact } from './validate';
import './strings';

export interface SignupValues {
  name: string;
  contact: Contact;
  village?: string;
  district?: string;
  state?: string;
}

export interface SignupStepProps {
  onSignup: (v: SignupValues) => void;
  onLogin: () => void;
  onBack: () => void;
  headingRef?: { current: HTMLHeadingElement | null };
  /** What was typed on the login step (or here before), so nothing is typed twice. */
  initial?: IdentityDraft;
  onDraftChange?: (v: IdentityDraft) => void;
}

export function SignupStep({ onSignup, onLogin, onBack, headingRef, initial, onDraftChange }: SignupStepProps) {
  const t = useT();
  const { language } = useLanguage();
  const [, setAppPlace] = usePlace();
  const form = useIdentityForm({ ...initial, nameFirst: true, onChange: onDraftChange });
  const [village, setVillage] = useState('');
  const [district, setDistrict] = useState('');
  const [stateCode, setStateCode] = useState('');
  const [placeOpen, setPlaceOpen] = useState(false);
  /** The sheet pick (already the app's place: LocationSheet sets it). */
  const [picked, setPicked] = useState<GeoPlace | null>(null);

  const stateOptions = useMemo(
    () =>
      INDIAN_STATES.map(s => ({ value: s.code, label: language.code === 'en' ? s.nameEn : s.name })).sort((a, b) =>
        a.label.localeCompare(b.label, language.code === 'en' ? 'en' : 'hi'),
      ),
    [language.code],
  );

  const fillFromPlace = (p: GeoPlace) => {
    setPicked(p);
    setDistrict(p.district || p.name);
    const st = findState(p.state);
    if (st) setStateCode(st.code);
  };

  const submit = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    const v = form.validate();
    if (!v) return;
    const st = INDIAN_STATES.find(s => s.code === stateCode);
    const typed = cleanText(district);
    // Stored in Hindi like the rest of the app's place names (services/location).
    let finalDistrict = typed || undefined;
    let finalState = st?.name;
    // A district typed by hand (not the sheet pick) drives weather and mandi too when we know it.
    if (typed && !(picked && placeMatchesDistrict(picked, typed))) {
      const known = findPopularDistrict(typed, st?.name);
      if (known) {
        setAppPlace(known);
        finalDistrict = known.district || known.name;
        finalState = finalState ?? known.state;
      }
    }
    onSignup({ ...v, village: cleanText(village) || undefined, district: finalDistrict, state: finalState });
  };

  return (
    <Screen
      title={t('auth.signup.title')}
      subtitle={t('auth.signup.subtitle')}
      back={onBack}
      bottomNav={false}
      footer={
        <Button type="submit" form="km-signup" fullWidth size="lg" icon={UserPlus}>
          {t('auth.signup.submit')}
        </Button>
      }
    >
      <form id="km-signup" noValidate onSubmit={submit} className="flex flex-col gap-5">
        <Card padding="lg" className="flex flex-col gap-4">
          <h2 ref={headingRef} tabIndex={-1} className="text-card-title font-semibold text-ink outline-none">
            {t('auth.signup.heading')}
          </h2>
          <NameField
            value={form.name}
            onChange={form.setName}
            error={form.nameError && t(form.nameError)}
            inputRef={form.nameRef}
            onEnter={e => {
              // "Next" on the keyboard moves on to the mobile/email field.
              e.preventDefault();
              form.contactRef.current?.focus();
            }}
          />
          <ContactField
            value={form.contact}
            onChange={form.setContact}
            mode={form.mode}
            onModeChange={form.setMode}
            error={form.contactError && t(form.contactError)}
            inputRef={form.contactRef}
            enterKeyHint="done"
            onEnter={e => {
              // The area below is optional: close the keyboard rather than submit half-way.
              e.preventDefault();
              e.currentTarget.blur();
            }}
          />
        </Card>

        <Card padding="lg" className="flex flex-col gap-4">
          <div>
            <h2 className="text-card-title font-semibold text-ink">
              {t('auth.signup.areaHeading')} <span className="text-small font-normal text-ink-3">({t('common.optional')})</span>
            </h2>
            <p className="mt-0.5 text-small text-ink-2">{t('auth.signup.areaHint')}</p>
          </div>
          <Button variant="secondary" fullWidth icon={MapPin} onClick={() => setPlaceOpen(true)}>
            {t('auth.signup.pickPlace')}
          </Button>
          <TextField
            label={t('auth.signup.village')}
            optional
            placeholder={t('auth.signup.villagePlaceholder')}
            value={village}
            onValueChange={setVillage}
            autoComplete="address-level3"
            maxLength={60}
            trailing={<MicButton variant="ghost" label={t('auth.signup.villageVoice')} onResult={text => setVillage(cleanText(text))} />}
          />
          <TextField
            label={t('auth.signup.district')}
            optional
            placeholder={t('auth.signup.districtPlaceholder')}
            value={district}
            onValueChange={setDistrict}
            autoComplete="address-level2"
            maxLength={60}
            trailing={<MicButton variant="ghost" label={t('auth.signup.districtVoice')} onResult={text => setDistrict(cleanText(text))} />}
          />
          <SelectField
            label={t('auth.signup.state')}
            optional
            placeholder={t('auth.signup.statePlaceholder')}
            value={stateCode}
            onChange={setStateCode}
            options={stateOptions}
          />
        </Card>
      </form>

      <div className="flex flex-col items-center gap-2">
        <p className="flex flex-wrap items-center justify-center gap-x-1 text-body text-ink-2">
          <span>{t('auth.signup.haveAccount')}</span>
          <button
            type="button"
            onClick={onLogin}
            className="press inline-flex min-h-12 items-center rounded-btn px-2 font-bold text-brand underline-offset-4 hover:underline"
          >
            {t('auth.signup.login')}
          </button>
        </p>
        <PrivacyNote />
      </div>

      <LocationSheet open={placeOpen} onClose={() => setPlaceOpen(false)} onSelect={fillFromPlace} title={t('auth.signup.pickTitle')} />
    </Screen>
  );
}
