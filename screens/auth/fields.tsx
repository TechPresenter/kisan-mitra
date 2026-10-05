// Form pieces shared by Login and Signup: name (with voice), mobile-or-email and the
// "your details stay on this phone" reassurance.
import { useRef, useState, type KeyboardEvent } from 'react';
import { Mail, Phone, ShieldCheck } from 'lucide-react';
import { Button, ListGroup, ListRow, MicButton, Sheet, TextField, ToneIcon, type TextFieldProps } from '../../components/ui';
import { useT } from '../../lib/i18n';
import { cleanName, cleanText, parseContact, type Contact, type ContactError } from './validate';
import './strings';

export type ContactMode = 'phone' | 'email';

/** Guess the keyboard to start with from what is already typed. */
export const modeFor = (value: string): ContactMode => (/[@\p{L}]/u.test(value) ? 'email' : 'phone');

/**
 * Runs `onEnter` for the keyboard's Enter / "next" / "go" key, but not while an Indic or
 * transliterating keyboard is still composing a word (that Enter only confirms the word).
 */
const enterHandler = (onEnter?: (e: KeyboardEvent<HTMLInputElement>) => void) =>
  onEnter
    ? (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) onEnter(e);
      }
    : undefined;

type EnterKeyHint = NonNullable<TextFieldProps['enterKeyHint']>;

export interface FieldKeyProps {
  /** The label on the keyboard's Enter key. */
  enterKeyHint?: EnterKeyHint;
  /** Enter pressed. Call e.preventDefault() to stop the form from submitting. */
  onEnter?: (e: KeyboardEvent<HTMLInputElement>) => void;
}

export function NameField({
  value,
  onChange,
  error,
  inputRef,
  autoFocus,
  enterKeyHint = 'next',
  onEnter,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string | null;
  inputRef?: { current: HTMLInputElement | null };
  autoFocus?: boolean;
} & FieldKeyProps) {
  const t = useT();
  return (
    <TextField
      ref={inputRef}
      label={t('auth.name.label')}
      placeholder={t('auth.name.placeholder')}
      value={value}
      onValueChange={onChange}
      error={error || undefined}
      autoComplete="name"
      autoCapitalize="words"
      enterKeyHint={enterKeyHint}
      onKeyDown={enterHandler(onEnter)}
      maxLength={60}
      autoFocus={autoFocus}
      trailing={<MicButton variant="ghost" label={t('auth.name.voice')} onResult={text => onChange(cleanText(text))} />}
    />
  );
}

export function ContactField({
  value,
  onChange,
  mode,
  onModeChange,
  error,
  inputRef,
  enterKeyHint = 'next',
  onEnter,
}: {
  value: string;
  onChange: (v: string) => void;
  mode: ContactMode;
  onModeChange: (m: ContactMode) => void;
  error?: string | null;
  inputRef: { current: HTMLInputElement | null };
} & FieldKeyProps) {
  const t = useT();
  const phone = mode === 'phone';

  // Android only swaps the keyboard when the field is focused again.
  const switchMode = () => {
    onModeChange(phone ? 'email' : 'phone');
    const el = inputRef.current;
    if (!el) return;
    el.blur();
    requestAnimationFrame(() => el.focus());
  };

  return (
    <div className="flex flex-col gap-1">
      <TextField
        ref={inputRef}
        label={t('auth.contact.label')}
        value={value}
        onValueChange={onChange}
        error={error || undefined}
        type={phone ? 'tel' : 'text'}
        inputMode={phone ? 'tel' : 'email'}
        autoComplete={phone ? 'tel-national' : 'email'}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint={enterKeyHint}
        onKeyDown={enterHandler(onEnter)}
        maxLength={phone ? 18 : 80}
        prefix={phone ? '+91' : undefined}
        leadingIcon={phone ? undefined : Mail}
        placeholder={t(phone ? 'auth.contact.phonePlaceholder' : 'auth.contact.emailPlaceholder')}
      />
      <button
        type="button"
        onClick={switchMode}
        className="press inline-flex min-h-12 items-center gap-1.5 self-start rounded-btn px-1 text-small font-semibold text-brand hover:underline"
      >
        {phone ? <Mail aria-hidden className="size-4" /> : <Phone aria-hidden className="size-4" />}
        {t(phone ? 'auth.contact.useEmail' : 'auth.contact.usePhone')}
      </button>
    </div>
  );
}

/** Translated message for a contact parse error. */
export function contactErrorKey(e: ContactError): string {
  return `auth.contact.error.${e}`;
}

/** What the farmer has typed so far, kept by AuthFlow so it survives login ⇄ signup. */
export interface IdentityDraft {
  name: string;
  contact: string;
}

/** Shared form state for name + contact with "validate on submit, then live" errors. */
export function useIdentityForm(initial?: {
  name?: string;
  contact?: string;
  nameFirst?: boolean;
  /** Called on every edit, so the parent can hand the values to the other step. */
  onChange?: (v: IdentityDraft) => void;
}) {
  const [name, setNameState] = useState(initial?.name ?? '');
  const [contact, setContactState] = useState(initial?.contact ?? '');
  const [mode, setMode] = useState<ContactMode>(modeFor(initial?.contact ?? ''));
  const [submitted, setSubmitted] = useState(false);
  const nameRef = useRef<HTMLInputElement | null>(null);
  const contactRef = useRef<HTMLInputElement | null>(null);
  const latest = useRef<IdentityDraft>({ name, contact });
  const onChangeRef = useRef(initial?.onChange);
  onChangeRef.current = initial?.onChange;

  const setName = (v: string) => {
    setNameState(v);
    latest.current = { ...latest.current, name: v };
    onChangeRef.current?.(latest.current);
  };
  const setContact = (v: string) => {
    setContactState(v);
    latest.current = { ...latest.current, contact: v };
    onChangeRef.current?.(latest.current);
  };

  const parsed = parseContact(contact);
  const cleanedName = cleanName(name);
  const nameOk = cleanedName !== null;
  const contactError = submitted && 'error' in parsed ? contactErrorKey(parsed.error) : null;
  const nameError = submitted && !nameOk ? 'auth.name.error' : null;

  /** Returns the clean values, or focuses the first bad field and returns null. */
  const validate = (): { name: string; contact: Contact } | null => {
    setSubmitted(true);
    // Focus the first bad field in the order the form shows them.
    const bad = [
      { ok: nameOk, ref: nameRef, first: !!initial?.nameFirst },
      { ok: parsed.ok, ref: contactRef, first: !initial?.nameFirst },
    ]
      .filter(f => !f.ok)
      .sort((a, b) => Number(b.first) - Number(a.first));
    if (bad.length || !parsed.ok || cleanedName === null) {
      bad[0]?.ref.current?.focus();
      return null;
    }
    return { name: cleanedName, contact: parsed.value };
  };

  return {
    name,
    setName,
    contact,
    setContact,
    mode,
    setMode,
    nameRef,
    contactRef,
    nameOk,
    contactOk: parsed.ok,
    contactError,
    nameError,
    validate,
  };
}

/** "आपकी जानकारी इसी फ़ोन पर सुरक्षित रहती है" with a short explanation sheet. */
export function PrivacyNote({ className }: { className?: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <p className={`flex flex-wrap items-center justify-center gap-x-1.5 text-center text-small text-ink-2 ${className ?? ''}`}>
        <ShieldCheck aria-hidden className="size-5 shrink-0 text-brand" />
        <span>{t('auth.privacy.line')}</span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex min-h-12 items-center px-2 font-semibold text-brand underline underline-offset-4"
        >
          {t('auth.privacy.more')}
        </button>
      </p>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={t('auth.privacy.title')}
        footer={
          <Button fullWidth size="lg" onClick={() => setOpen(false)}>
            {t('auth.privacy.ok')}
          </Button>
        }
      >
        <ListGroup ariaLabel={t('auth.privacy.title')}>
          {(['p1', 'p2', 'p3', 'p4'] as const).map(k => (
            <ListRow
              key={k}
              variant="plain"
              leading={<ToneIcon icon={ShieldCheck} tone="green" size="sm" />}
              title={<span className="font-normal">{t(`auth.privacy.${k}`)}</span>}
            />
          ))}
        </ListGroup>
      </Sheet>
    </>
  );
}
