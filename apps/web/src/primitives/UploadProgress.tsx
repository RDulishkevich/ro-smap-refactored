import { motion } from 'motion/react';
import { color, spring } from '@polevka/design';
import type { UploadProgress as Progress } from '@polevka/core';
import { useTh } from '../state/ThemeContext';
import { BusySpinner } from './form';

const ACCENT = color.accent;

function formatMb(n: number) {
  if (!n || n < 0) return '0';
  return (n / (1024 * 1024)).toFixed(n >= 10 * 1024 * 1024 ? 1 : 2);
}

export function UploadProgressBar({
  label,
  progress,
  phaseHint,
}: {
  label: string;
  progress?: Progress | null;
  /** Extra stage when not in put (prepare/save). */
  phaseHint?: string;
}) {
  const th = useTh();
  const ratio = progress?.stage === 'done'
    ? 1
    : progress?.stage === 'put'
      ? Math.min(1, Math.max(0, progress.ratio))
      : progress?.stage === 'presign'
        ? 0.05
        : 0;
  const pct = Math.round(ratio * 100);
  const bytes = progress && progress.total > 0
    ? `${formatMb(progress.loaded)} / ${formatMb(progress.total)} МБ`
    : null;
  const title = progress?.stage === 'presign'
    ? 'Получаем ссылку для загрузки…'
    : progress?.stage === 'put'
      ? (label || 'Отправляем файл…')
      : progress?.stage === 'done'
        ? 'Файл на сервере'
        : (phaseHint || label || 'Готовим…');

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={spring.fade}
      className="rounded-2xl px-4 py-3 flex flex-col gap-2"
      style={{ background: th.cardBg, border: `1px solid ${th.border}` }}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <BusySpinner label={title} />
        <div className="flex-1 min-w-0">
          <p className="pv-caption truncate" style={{ color: th.inkText }}>{title}</p>
          <p className="pv-micro" style={{ color: th.soft }}>
            {bytes ? `${pct}% · ${bytes}` : (phaseHint && !progress ? phaseHint : `${pct}%`)}
          </p>
        </div>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: th.phoneBg }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: ACCENT }}
          animate={{ width: `${Math.max(4, pct)}%` }}
          transition={spring.pill}
        />
      </div>
    </motion.div>
  );
}
