import type { ReactNode } from 'react';
import { color } from '@polevka/design';
import { useTh } from '../state/ThemeContext';

const OLIVE = color.olive;
const ACCENT = color.accent;

/** Typography-led empty state — no icon chip, no marshmallow card. */
export function EmptyNote({
  title,
  hint,
  actionLabel,
  onAction,
  action,
}: {
  title: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
  action?: ReactNode;
}) {
  const th = useTh();
  return (
    <div className="pt-7 pb-2 pr-6">
      <p className="pv-title" style={{ color: th.inkText }}>{title}</p>
      {hint ? (
        <p className="pv-body mt-2 max-w-[20rem]" style={{ color: OLIVE }}>{hint}</p>
      ) : null}
      {action}
      {!action && actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="pv-button mt-5"
          style={{ color: ACCENT }}
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
