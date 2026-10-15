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
  onBlurValidate?: () => void;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>;

export function FormField({
  label, value, onChange, hint, error, password, onBlurValidate, ...input
}: FieldProps) {
  const th = useTh();
  const t = useT();
  const [show, setShow] = useState(false);
  const autoId = useId();
  const fieldId = input.id || autoId;
  const described = error ? `${fieldId}-err` : hint ? `${fieldId}-hint` : undefined;
  return (
    <div className="pv-label block" style={{ color: th.soft }}>
      <label htmlFor={fieldId}>{label}</label>
      <span className="relative mt-1 block">
        <input
          {...input}
          id={fieldId}
          type={password && !show ? 'password' : input.inputMode === 'email' ? 'email' : 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => onBlurValidate?.()}
          aria-invalid={!!error}
          aria-describedby={described}
          className="w-full rounded-2xl px-4 py-3 outline-none min-h-11"
          style={{
            background: th.cardBg,
            color: th.inkText,
            boxShadow: error ? `inset 0 0 0 1.5px ${ACCENT}` : undefined,
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
