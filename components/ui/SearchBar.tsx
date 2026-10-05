import { useRef, type FormEvent, type ReactNode } from 'react';
import { Search, X } from 'lucide-react';
import { useT } from '../../lib/i18n';
import { cx } from './cx';
import type { NativeInputProps } from './types';
import { MicButton } from './Voice';
import './strings';
import '../../lib/common-strings';

export interface SearchBarProps extends Omit<NativeInputProps, 'value' | 'defaultValue' | 'onChange' | 'type'> {
  value: string;
  onChange: (value: string) => void;
  /** Enter / search key (and a voice result when `voice` is on). */
  onSubmit?: (value: string) => void;
  /** Adds a mic button that fills (and submits) the query by voice. */
  voice?: boolean;
  /** Custom slot on the right instead of the built-in mic. */
  mic?: ReactNode;
  /** Hindi accessible name; defaults to "खोजें". */
  ariaLabel?: string;
  /** onDark = white field for use inside the green header. */
  variant?: 'default' | 'onDark';
  className?: string;
}

/** Rounded search field with clear button and optional voice input. */
export function SearchBar({
  value,
  onChange,
  onSubmit,
  voice = false,
  mic,
  ariaLabel,
  placeholder,
  variant = 'default',
  className,
  ...rest
}: SearchBarProps) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    inputRef.current?.blur();
    onSubmit?.(value.trim());
  };
  return (
    <form role="search" onSubmit={submit} className={cx('w-full', className)}>
      <div
        className={cx(
          'flex min-h-12 items-center gap-1 rounded-full border pr-1 pl-4 transition-colors duration-150',
          'focus-within:ring-2 focus-within:ring-brand-600/20',
          variant === 'onDark'
            ? 'border-transparent bg-surface shadow-float'
            : 'border-line bg-surface focus-within:border-brand-600',
        )}
      >
        <Search aria-hidden className="size-5 shrink-0 text-ink-3" />
        <input
          ref={inputRef}
          type="search"
          enterKeyHint="search"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder ?? t('common.search')}
          aria-label={ariaLabel ?? t('common.search')}
          className="min-w-0 flex-1 bg-transparent py-2.5 pl-1 text-body text-ink outline-none [&::-webkit-search-cancel-button]:hidden"
          {...rest}
        />
        {value && (
          <button
            type="button"
            aria-label={t('ui.clear')}
            onClick={() => {
              onChange('');
              inputRef.current?.focus();
            }}
            className="press inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-surface-2"
          >
            <X aria-hidden className="size-5" />
          </button>
        )}
        {mic ??
          (voice ? (
            <MicButton
              size="sm"
              variant="ghost"
              onResult={text => {
                onChange(text);
                onSubmit?.(text);
              }}
            />
          ) : null)}
      </div>
    </form>
  );
}
