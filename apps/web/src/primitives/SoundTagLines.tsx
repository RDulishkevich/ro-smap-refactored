import type { Sound } from '@polevka/core';
import { soundTagLines } from '../lib/sound-tags';
import { typeI18nKey } from '../lib/i18n';
import { useNav } from '../state/NavContext';
import { useTh } from '../state/ThemeContext';
import { useT } from '../state/PrefsContext';

/** Catalog-style UCS / FX tags — hover wash + open sound card. */
export function SoundTagLines({
  sound,
  className = '',
  openOnClick = true,
}: {
  sound: Sound;
  className?: string;
  openOnClick?: boolean;
}) {
  const th = useTh();
  const t = useT();
  const { push } = useNav();
  const tags = soundTagLines(sound, t(typeI18nKey(String(sound.type || ''))));
  if (!tags.primary && !tags.secondary) return null;

  const body = (
    <>
      {tags.primary ? <p className="pv-caption truncate" style={{ color: th.inkText }}>{tags.primary}</p> : null}
      {tags.secondary ? <p className="pv-micro truncate mt-0.5" style={{ color: th.muted }}>{tags.secondary}</p> : null}
    </>
  );

  if (!openOnClick) {
    return <div className={`min-w-0 ${className}`}>{body}</div>;
  }

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); push({ type: 'sound-detail', sound }); }}
      className={`pv-tag-hit min-w-0 text-left rounded-xl px-2 py-1 -mx-2 -my-1 cursor-pointer ${className}`}
      aria-label={sound.title || tags.primary}
    >
      {body}
    </button>
  );
}
