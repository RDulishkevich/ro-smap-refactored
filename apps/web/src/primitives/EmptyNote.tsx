import type { ReactNode } from 'react';
import { color } from '@polevka/design';
import { useTh } from '../state/ThemeContext';

const ACCENT = color.accent;

/** Empty state: optional cover, title, hint, one action. No icon chip. */
export function EmptyNote({
  title,
  hint,
  image,
  actionLabel,
  onAction,
  action,
}: {
  title: string;
  hint?: string;
  image?: string;
  actionLabel?: string;
  onAction?: () => void;
  action?: ReactNode;
}) {
  const th = useTh();
  return (
    <div className="pt-7 pb-2 pr-6">
      {image ? (
        <div className="relative aspect-[16/10] w-full max-w-[20rem] rounded-2xl overflow-hidden mb-5">
          <img src={image} alt="" className="absolute inset-0 w-full h-full object-cover" />
        </div>
      ) : null}
      <p className="pv-title" style={{ color: th.inkText }}>{title}</p>
      {hint ? (
        <p className="pv-body mt-2 max-w-[20rem]" style={{ color: th.muted }}>{hint}</p>
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
