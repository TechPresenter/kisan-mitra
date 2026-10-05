// Native attributes the kit forwards, spelled out on purpose: the project builds without
// @types/react (React's own attribute interfaces resolve to `any` and add nothing), and with
// those types installed these stay assignable to the real ones.
import type { ChangeEvent, ClipboardEvent, CSSProperties, FocusEvent, KeyboardEvent, MouseEvent, PointerEvent } from 'react';

/** aria-* and data-* passthrough. */
export interface AriaDataAttrs {
  [aria: `aria-${string}`]: string | number | boolean | undefined;
  [data: `data-${string}`]: string | number | boolean | undefined;
}

export interface CommonAttrs extends AriaDataAttrs {
  id?: string;
  className?: string;
  style?: CSSProperties;
  title?: string;
  role?: string;
  tabIndex?: number;
}

export interface NativeButtonProps extends CommonAttrs {
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  form?: string;
  name?: string;
  value?: string;
  autoFocus?: boolean;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  onFocus?: (e: FocusEvent<HTMLButtonElement>) => void;
  onBlur?: (e: FocusEvent<HTMLButtonElement>) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLButtonElement>) => void;
  onPointerDown?: (e: PointerEvent<HTMLButtonElement>) => void;
  onContextMenu?: (e: MouseEvent<HTMLButtonElement>) => void;
}

export type InputMode = 'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search';
export type EnterKeyHint = 'enter' | 'done' | 'go' | 'next' | 'previous' | 'search' | 'send';

export interface NativeInputProps extends CommonAttrs {
  name?: string;
  type?: string;
  value?: string | number;
  defaultValue?: string | number;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  autoFocus?: boolean;
  autoComplete?: string;
  autoCapitalize?: string;
  autoCorrect?: string;
  spellCheck?: boolean;
  inputMode?: InputMode;
  enterKeyHint?: EnterKeyHint;
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  min?: number | string;
  max?: number | string;
  step?: number | string;
  list?: string;
  form?: string;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  onFocus?: (e: FocusEvent<HTMLInputElement>) => void;
  onBlur?: (e: FocusEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  onPaste?: (e: ClipboardEvent<HTMLInputElement>) => void;
}

export interface NativeSelectProps extends CommonAttrs {
  name?: string;
  disabled?: boolean;
  required?: boolean;
  autoFocus?: boolean;
  form?: string;
  onFocus?: (e: FocusEvent<HTMLSelectElement>) => void;
  onBlur?: (e: FocusEvent<HTMLSelectElement>) => void;
}

export interface NativeTextAreaProps extends CommonAttrs {
  name?: string;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  autoFocus?: boolean;
  autoCapitalize?: string;
  spellCheck?: boolean;
  enterKeyHint?: EnterKeyHint;
  maxLength?: number;
  minLength?: number;
  rows?: number;
  form?: string;
  onFocus?: (e: FocusEvent<HTMLTextAreaElement>) => void;
  onBlur?: (e: FocusEvent<HTMLTextAreaElement>) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste?: (e: ClipboardEvent<HTMLTextAreaElement>) => void;
}
