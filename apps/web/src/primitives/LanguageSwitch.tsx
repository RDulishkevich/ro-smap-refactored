import { color } from '@polevka/design';
import { usePrefs } from '../state/PrefsContext';
import { useTh } from '../state/ThemeContext';
import type { Locale } from '../lib/i18n';

export function LanguageSwitch({ compact = false }: { compact?: boolean }) {
  const th = useTh();
  const { prefs, setPref } = usePrefs();
  const loc: Locale = prefs.locale === 'en' ? 'en' : 'ru';
  const btn = (id: Locale, label: string) => (
    <button
      type="button"
      onClick={() => setPref('locale', id)}
      className={`${compact ? 'h-7 px-2.5 text-[10px]' : 'h-8 px-3 text-[11px]'} rounded-full font-semibold`}
      style={{ background: loc === id ? color.accent : 'transparent', color: loc === id ? '#fff' : color.olive }}
      aria-pressed={loc === id}
      aria-label={id === 'ru' ? 'Русский' : 'English'}>
      {label}
    </button>
  );
  return (
    <div
      className="inline-flex items-center gap-0.5 p-0.5 rounded-full"
      style={{ background: th.lightBg }}
      role="group"
      aria-label="Язык">
      {btn('ru', 'RU')}
      {btn('en', 'EN')}
    </div>
  );
}
