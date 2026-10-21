import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { color } from '@polevka/design';
import { useTh } from '../state/ThemeContext';
import { useT } from '../state/PrefsContext';

const ACCENT = color.accent;

type FieldProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  error?: string;
  password?: boolean;
  /** Tighter vertical rhythm (desktop auth). */
  compact?: boolean;
  onBlurValidate?: () => void;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>;

export function FormField({
  label, value, onChange, hint, error, password, compact, onBlurValidate, ...input
}: FieldProps) {
  const th = useTh();
  const t = useT();
  const [show, setShow] = useState(false);
  const [focused, setFocused] = useState(false);
  const autoId = useId();
  const fieldId = input.id || autoId;
  const described = error ? `${fieldId}-err` : hint ? `${fieldId}-hint` : undefined;
  return (
    <div className="pv-label block" style={{ color: th.soft }}>
      <label htmlFor={fieldId}>{label}</label>
      <span className={`relative block ${compact ? 'mt-0.5' : 'mt-1'}`}>
        <input
          {...input}
          id={fieldId}
          type={password && !show ? 'password' : input.inputMode === 'email' ? 'email' : 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={(e) => { setFocused(true); input.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); onBlurValidate?.(); input.onBlur?.(e); }}
          aria-invalid={!!error}
          aria-describedby={described}
          className={`w-full rounded-2xl px-4 outline-none ${compact ? 'py-2.5 min-h-10' : 'py-3 min-h-11'}`}
          style={{
            background: th.cardBg,
            color: th.inkText,
            boxShadow: error
              ? `inset 0 0 0 1.5px ${ACCENT}`
              : focused
                ? `inset 0 0 0 1.5px ${ACCENT}`
                : `inset 0 0 0 1px ${th.border}`,
          }}
        />
        {password && (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center"
            aria-label={show ? t('hidePassword') : t('showPassword')}
            onClick={() => setShow((v) => !v)}>
            {show ? <EyeOff size={16} color={th.soft} /> : <Eye size={16} color={th.soft} />}
          </button>
        )}
      </span>
      {error ? (
        <p id={`${fieldId}-err`} className="pv-caption mt-1" style={{ color: ACCENT }}>{error}</p>
      ) : hint ? (
        <p id={`${fieldId}-hint`} className="pv-caption mt-1" style={{ color: th.soft }}>{hint}</p>
      ) : null}
    </div>
  );
}

export function FormNeed({ children }: { children: ReactNode }) {
  return <p className="pv-caption" style={{ color: ACCENT }}>{children}</p>;
}
