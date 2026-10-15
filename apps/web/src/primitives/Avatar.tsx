import { useEffect, useState } from 'react';
import { User } from 'lucide-react';
import { resolveMediaUrl } from '../lib/media-url';
import { useTh } from '../state/ThemeContext';

export function Avatar({
  src,
  name,
  size = 40,
  className = '',
  rounded = 'rounded-2xl',
  fallback = 'letter',
}: {
  src?: string | null;
  name?: string;
  size?: number;
  className?: string;
  rounded?: string;
  /** Catalog etc.: profile icon when no photo; default keeps letter. */
  fallback?: 'letter' | 'icon';
}) {
  const th = useTh();
  const url = resolveMediaUrl(src);
  const [broken, setBroken] = useState(false);
  useEffect(() => { setBroken(false); }, [url]);
  const letter = (String(name || '?').trim()[0] || '?').toUpperCase();
  const show = !!url && !broken;
  const iconSize = Math.max(10, Math.round(size * 0.55));

  return (
    <div
      className={`${rounded} overflow-hidden flex items-center justify-center flex-shrink-0 ${className}`}
      style={{ width: size, height: size, background: th.lightBg, color: th.muted }}
      aria-hidden={!show}
    >
      {show
        ? <img src={url} alt="" className="w-full h-full object-cover" onError={() => setBroken(true)} />
        : fallback === 'icon'
          ? <User size={iconSize} strokeWidth={1.75} aria-hidden />
          : <span className="pv-subtitle leading-none">{letter}</span>}
    </div>
  );
}
