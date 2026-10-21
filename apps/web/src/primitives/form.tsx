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
  /** Dark immersive auth panel (desktop split). */
  tone?: 'default' | 'ink';
  onBlurValidate?: () => void;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>;

const INK_FIELD = {
  label: 'rgba(244,232,216,0.55)',
  bg: '#1A1F1C',
  text: '#F4E8D8',
  soft: 'rgba(244,232,216,0.45)',
  focus: 'rgba(181,97,63,0.85)',
} as const;

export function FormField({
  label, value, onChange, hint, error, password, tone = 'default', onBlurValidate, ...input
}: FieldProps) {
  const th = useTh();
  const t = useT();
  const [show, setShow] = useState(false);
  const [focused, setFocused] = useState(false);
  const autoId = useId();
  const fieldId = input.id || autoId;
  const described = error ? `${fieldId}-err` : hint ? `${fieldId}-hint` : undefined;
  const ink = tone === 'ink';
  const labelColor = ink ? INK_FIELD.label : th.soft;
  const softColor = ink ? INK_FIELD.soft : th.soft;
  const iconColor = ink ? INK_FIELD.soft : th.soft;
  return (
    <div className="pv-label block" style={{ color: labelColor }}>
      <label htmlFor={fieldId}>{label}</label>
      <span className="relative mt-1 block">
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
          className="w-full rounded-2xl px-4 py-3 outline-none min-h-11"
          style={{
            background: ink ? INK_FIELD.bg : th.cardBg,
            color: ink ? INK_FIELD.text : th.inkText,
            boxShadow: error
              ? `inset 0 0 0 1.5px ${ACCENT}`
              : focused && ink
                ? `inset 0 0 0 1.5px ${INK_FIELD.focus}`
                : undefined,
          }}
        />
        {password && (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center"
            aria-label={show ? t('hidePassword') : t('showPassword')}
            onClick={() => setShow((v) => !v)}>
            {show ? <EyeOff size={16} color={iconColor} /> : <Eye size={16} color={iconColor} />}
          </button>
        )}
      </span>
      {error ? (
        <p id={`${fieldId}-err`} className="pv-caption mt-1" style={{ color: ACCENT }}>{error}</p>
      ) : hint ? (
        <p id={`${fieldId}-hint`} className="pv-caption mt-1" style={{ color: softColor }}>{hint}</p>
      ) : null}
    </div>
  );
}

export function FormNeed({ children }: { children: ReactNode }) {
  return <p className="pv-caption" style={{ color: ACCENT }}>{children}</p>;
}
