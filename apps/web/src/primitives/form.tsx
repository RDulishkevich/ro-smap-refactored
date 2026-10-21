import { useEffect, useId, useRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, ChevronDown, CircleHelp, Eye, EyeOff, Loader2 } from 'lucide-react';
import { color, spring, tap } from '@polevka/design';
import { useTh } from '../state/ThemeContext';
import { useT } from '../state/PrefsContext';

const ACCENT = color.accent;

type FieldProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  /** Hover / focus popover next to the label. */
  tip?: string;
  error?: string;
  password?: boolean;
  /** Tighter vertical rhythm (desktop auth). */
  compact?: boolean;
  /** Inset fill on card surfaces (phoneBg). */
  inset?: boolean;
  onBlurValidate?: () => void;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>;

export function FormField({
  label, value, onChange, hint, tip, error, password, compact, inset, onBlurValidate, ...input
}: FieldProps) {
  const th = useTh();
  const t = useT();
  const [show, setShow] = useState(false);
  const [focused, setFocused] = useState(false);
  const autoId = useId();
  const fieldId = input.id || autoId;
  const tipId = `${fieldId}-tip`;
  const described = error ? `${fieldId}-err` : hint ? `${fieldId}-hint` : tip ? tipId : undefined;
  return (
    <div className="pv-label block" style={{ color: th.soft }}>
      <label htmlFor={fieldId} className="inline-flex items-center gap-1 max-w-full">
        <span>{label}</span>
        {tip ? (
          <span className="relative inline-flex group/tip shrink-0">
            <button
              type="button"
              className="w-5 h-5 rounded-full flex items-center justify-center"
              aria-label={tip}
              aria-describedby={tipId}
              tabIndex={0}
            >
              <CircleHelp size={13} color={th.muted} strokeWidth={1.75} />
            </button>
            <span
              id={tipId}
              role="tooltip"
              className="pointer-events-none absolute left-0 bottom-[calc(100%+6px)] z-40 w-[min(240px,70vw)] rounded-2xl px-3 py-2 pv-caption leading-snug opacity-0 shadow-[0_10px_28px_rgba(45,60,57,0.18)] transition-opacity duration-150 group-hover/tip:opacity-100 group-focus-within/tip:opacity-100"
              style={{ background: th.cardBg, color: th.inkText, border: `1px solid ${th.border}` }}
            >
              {tip}
            </span>
          </span>
        ) : null}
      </label>
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
          className={`w-full rounded-2xl px-4 outline-none ${compact ? 'py-2 min-h-9' : 'py-3 min-h-11'}`}
          style={{
            background: inset ? th.phoneBg : th.cardBg,
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

export type SelectOption = { value: string; label: string };

/** Design-token dropdown — replaces native `<select>` in product forms. */
export function SelectField({
  label,
  value,
  onChange,
  options,
  tip,
  compact,
  placeholder = 'Выберите…',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  tip?: string;
  compact?: boolean;
  placeholder?: string;
}) {
  const th = useTh();
  const autoId = useId();
  const tipId = `${autoId}-tip`;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="pv-label relative block" style={{ color: th.soft }}>
      <span className="inline-flex items-center gap-1 max-w-full">
        <span>{label}</span>
        {tip ? (
          <span className="relative inline-flex group/tip shrink-0">
            <button type="button" className="w-5 h-5 rounded-full flex items-center justify-center" aria-label={tip} tabIndex={0}>
              <CircleHelp size={13} color={th.muted} strokeWidth={1.75} />
            </button>
            <span
              id={tipId}
              role="tooltip"
              className="pointer-events-none absolute left-0 bottom-[calc(100%+6px)] z-40 w-[min(240px,70vw)] rounded-2xl px-3 py-2 pv-caption leading-snug opacity-0 shadow-[0_10px_28px_rgba(45,60,57,0.18)] transition-opacity duration-150 group-hover/tip:opacity-100 group-focus-within/tip:opacity-100"
              style={{ background: th.cardBg, color: th.inkText, border: `1px solid ${th.border}` }}
            >
              {tip}
            </span>
          </span>
        ) : null}
      </span>
      <motion.button
        type="button"
        whileTap={tap.btn}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`w-full rounded-2xl px-3 flex items-center gap-2 text-left outline-none cursor-pointer ${compact ? 'py-2 min-h-9' : 'py-2.5 min-h-11'}`}
        style={{
          background: th.phoneBg,
          color: th.inkText,
          boxShadow: open ? `inset 0 0 0 1.5px ${ACCENT}` : `inset 0 0 0 1px ${th.border}`,
        }}
      >
        <span className="pv-body flex-1 min-w-0 truncate">{selected?.label || placeholder}</span>
        <ChevronDown size={16} color={th.soft} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={spring.fade}
            className="absolute left-0 right-0 z-50 mt-1.5 max-h-56 overflow-y-auto rounded-2xl p-1.5 shadow-[0_12px_32px_rgba(45,60,57,0.16)] scrollbar-none"
            style={{ background: th.cardBg, border: `1px solid ${th.border}` }}
          >
            {options.map((opt) => {
              const on = opt.value === value;
              return (
                <li key={opt.value || '__empty'}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={on}
                    className="pv-subtitle w-full text-left min-h-10 px-3 py-2 rounded-xl flex items-center gap-2 cursor-pointer"
                    style={{
                      color: th.inkText,
                      background: on ? (th.isDark ? '#2E2E2E' : '#F0F1F3') : 'transparent',
                    }}
                    onClick={() => { onChange(opt.value); setOpen(false); }}
                  >
                    <span className="flex-1 min-w-0 truncate">{opt.label}</span>
                    {on && <Check size={14} color={ACCENT} className="shrink-0" />}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

export function BusySpinner({ label }: { label?: string }) {
  const th = useTh();
  return (
    <span className="inline-flex items-center gap-2" style={{ color: th.muted }}>
      <Loader2 size={14} className="animate-spin" color={ACCENT} />
      {label ? <span className="pv-caption">{label}</span> : null}
    </span>
  );
}

export function FillProgress({
  percent,
  label,
}: {
  percent: number;
  label?: string;
}) {
  const th = useTh();
  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div className="rounded-2xl px-3.5 py-3" style={{ background: th.phoneBg, border: `1px solid ${th.border}` }}>
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="pv-caption" style={{ color: th.muted }}>{label || 'Заполненность карточки'}</p>
        <p className="pv-subtitle tabular-nums" style={{ color: th.inkText }}>{pct}%</p>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: th.isDark ? '#2E2E2E' : '#E2E8E4' }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: ACCENT }}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={spring.pill}
        />
      </div>
    </div>
  );
}
