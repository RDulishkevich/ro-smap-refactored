import { type ReactNode } from 'react';
import { motion } from 'motion/react';
import {
  Bell, Calendar, ChevronRight, FilePenLine, Globe, Headphones, HelpCircle,
  Lock, LogIn, LogOut, Moon, Settings, Shield, Sun, UserRound,
} from 'lucide-react';
import { color, tap, type ThemeTokens } from '@polevka/design';
import { usePrefs, useT } from '../state/PrefsContext';
import { useAuth } from '../state/AuthContext';
import { useNav } from '../state/NavContext';
import { useIsDark, useTh, useToggleTheme } from '../state/ThemeContext';
import { useData } from '../state/DataContext';
import { useUi } from '../state/UiContext';
import { useIsDesktop } from '../lib/use-media';
import { NavBar } from '../primitives/ui';
import { Avatar } from '../primitives/Avatar';

const ACCENT = color.accent;

export function GuestProfileScreen({ showNav = true }: { showNav?: boolean }) {
  const { push } = useNav();
  const th = useTh();
  const t = useT();
  const dark = useIsDark();
  const toggleTheme = useToggleTheme();
  const { prefs, setPref } = usePrefs();
  const desktop = useIsDesktop();
  const loc = prefs.locale === 'en' ? 'en' : 'ru';

  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      <div className={`flex-1 overflow-y-auto scrollbar-none ${showNav ? 'pb-4' : ''}`}>
        <header className="pv-safe-top px-5 pt-4 pb-2 text-center">
          <h1 className="pv-page" style={{ color: th.inkText }}>{t('profile')}</h1>
        </header>

        <div className="px-4 flex flex-col gap-5">
          <div className="rounded-3xl px-4 py-4 flex items-center gap-3.5" style={{ background: th.cardBg }}>
            <Avatar name="П" size={56} rounded="rounded-full" fallback="icon" className="shadow-sm" />
            <div className="min-w-0 flex-1">
              <p className="pv-heading truncate" style={{ color: th.inkText }}>Полёвка</p>
              <p className="pv-caption truncate mt-0.5" style={{ color: th.soft }}>{t('signInToSave')}</p>
            </div>
          </div>

          <MenuSection title={t('account')} th={th}>
            <MenuRow
              th={th}
              icon={<LogIn size={18} strokeWidth={1.75} />}
              label={t('signInAccount')}
              onClick={() => push({ type: 'auth' })}
              last
            />
          </MenuSection>

          {!desktop && (
            <MenuSection title={t('preferences')} th={th}>
              <MenuRow
                th={th}
                icon={<Globe size={18} strokeWidth={1.75} />}
                label={t('language')}
                value={loc === 'en' ? 'EN' : 'RU'}
                onClick={() => setPref('locale', loc === 'en' ? 'ru' : 'en')}
              />
              <MenuRow
                th={th}
                icon={dark ? <Sun size={18} strokeWidth={1.75} /> : <Moon size={18} strokeWidth={1.75} />}
                label={t('theme')}
                value={dark ? t('themeDark') : t('themeLight')}
                onClick={toggleTheme}
                last
              />
            </MenuSection>
          )}

          <MenuSection title={t('supportSection')} th={th}>
            <MenuRow
              th={th}
              icon={<HelpCircle size={18} strokeWidth={1.75} />}
              label={t('helpSupport')}
              onClick={() => push({ type: 'help' })}
              last={desktop}
            />
            {!desktop && (
              <MenuRow
                th={th}
                icon={<Settings size={18} strokeWidth={1.75} />}
                label={t('settings')}
                onClick={() => push({ type: 'settings' })}
                last
              />
            )}
          </MenuSection>

          <p className="pv-micro text-center pb-2 px-2" style={{ color: th.soft }}>
            <button type="button" className="underline" style={{ color: th.muted }} onClick={() => push({ type: 'legal', doc: 'terms' })}>{t('terms')}</button>
            {' · '}
            <button type="button" className="underline" style={{ color: th.muted }} onClick={() => push({ type: 'legal', doc: 'privacy' })}>{t('privacyPolicy')}</button>
          </p>
        </div>
      </div>
      {showNav && <div className="rounded-t-3xl shadow-lg overflow-hidden flex-shrink-0"><NavBar /></div>}
    </div>
  );
}

export function ProfileScreen({ showNav = true }: { showNav?: boolean }) {
  const { user, logout, isStaff } = useAuth();
  const { push, reset } = useNav();
  const th = useTh();
  const t = useT();
  const { toast } = useUi();
  const desktop = useIsDesktop();
  const dark = useIsDark();
  const toggleTheme = useToggleTheme();
  const { prefs, setPref } = usePrefs();
  const { allSounds, profiles } = useData();
  const loc = prefs.locale === 'en' ? 'en' : 'ru';
  const mineProfile = profiles.find((p) => String(p.loginName).toLowerCase() === String(user?.loginName || '').toLowerCase());
  const avatarUrl = String(user?.avatar || mineProfile?.avatar || '');
  const displayName = user?.displayName || user?.username || user?.loginName || '';
  const subtitle = user?.email || (user?.loginName ? `@${user.loginName}` : '');
  const mineAll = allSounds.filter((s) => String(s.recordistId || s.user || '').toLowerCase() === String(user?.loginName || '').toLowerCase()
    || String(s.recordist || '').toLowerCase() === String(user?.username || '').toLowerCase());
  const mine = mineAll.filter((s) => !s.status || s.status === 'published');
  const drafts = mineAll.filter((s) => s.status === 'draft' || s.status === 'pending' || s.status === 'rejected');
  const mySessions = mineProfile?.sessions || [];

  const openPublicProfile = () => {
    if (!user) return;
    push({
      type: 'user-profile',
      name: displayName,
      avatar: avatarUrl || '🎙️',
      username: `@${user.loginName}`,
    });
  };

  const doLogout = async () => {
    await logout();
    reset();
    toast(t('loggedOut'));
  };

  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      <div className={`flex-1 overflow-y-auto scrollbar-none ${showNav ? 'pb-4' : ''}`}>
        <header className={`px-5 pb-2 ${desktop ? 'pt-6' : 'pv-safe-top pt-4'} ${desktop ? 'text-left' : 'text-center'}`}>
          <h1 className="pv-page" style={{ color: th.inkText }}>{t('profile')}</h1>
        </header>

        <div className={`px-4 flex flex-col gap-5 ${showNav ? 'pb-40' : 'pb-8'}`}>
          <motion.button
            type="button"
            whileTap={tap.cta}
            onClick={openPublicProfile}
            className="rounded-3xl px-4 py-4 flex items-center gap-3.5 text-left w-full cursor-pointer"
            style={{ background: th.cardBg }}
          >
            <Avatar
              src={avatarUrl}
              name={displayName}
              size={56}
              rounded="rounded-full"
              fallback="icon"
              className="shadow-sm"
            />
            <div className="min-w-0 flex-1">
              <p className="pv-heading truncate" style={{ color: th.inkText }}>{displayName}</p>
              <p className="pv-caption truncate mt-0.5" style={{ color: th.soft }}>{subtitle}</p>
            </div>
            <ChevronRight size={18} strokeWidth={1.75} style={{ color: th.soft }} className="flex-shrink-0" />
          </motion.button>

          <div className="rounded-3xl px-2 py-3 flex justify-around" style={{ background: th.cardBg }}>
            {[
              { v: String(mine.length), l: t('recordings'), go: () => push({ type: 'my-sounds' }) },
              ...(!desktop ? [{ v: String(drafts.length), l: t('pending'), go: () => push({ type: 'drafts' as const }) }] : []),
              { v: String(mySessions.length), l: t('expeditions'), go: () => push({ type: 'expeditions' }) },
            ].map((row) => (
              <button key={row.l} type="button" className="flex-1 text-center min-h-11 px-1 cursor-pointer" onClick={row.go}>
                <p className="pv-heading tabular-nums" style={{ color: th.inkText }}>{row.v}</p>
                <p className="pv-micro mt-0.5" style={{ color: th.soft }}>{row.l}</p>
              </button>
            ))}
          </div>

          <MenuSection title={t('account')} th={th}>
            <MenuRow
              th={th}
              icon={<UserRound size={18} strokeWidth={1.75} />}
              label={t('manageProfile')}
              onClick={() => push({ type: 'edit-profile' })}
            />
            <MenuRow
              th={th}
              icon={<Headphones size={18} strokeWidth={1.75} />}
              label={t('mySounds')}
              value={mine.length ? String(mine.length) : undefined}
              onClick={() => push({ type: 'my-sounds' })}
            />
            <MenuRow
              th={th}
              icon={<Lock size={18} strokeWidth={1.75} />}
              label={t('profileSecurity')}
              onClick={() => push({ type: 'cabinet' })}
            />
            <MenuRow
              th={th}
              icon={<Bell size={18} strokeWidth={1.75} />}
              label={t('notifications')}
              onClick={() => push({ type: 'notifications' })}
              last={!isStaff && desktop}
            />
            {isStaff && (
              <MenuRow
                th={th}
                icon={<Shield size={18} strokeWidth={1.75} />}
                label={t('staff')}
                onClick={() => push({ type: 'staff' })}
                last={desktop}
              />
            )}
            {!desktop && (
              <MenuRow
                th={th}
                icon={<Globe size={18} strokeWidth={1.75} />}
                label={t('language')}
                value={loc === 'en' ? 'English' : 'Русский'}
                onClick={() => setPref('locale', loc === 'en' ? 'ru' : 'en')}
                last
              />
            )}
          </MenuSection>

          <MenuSection title={t('preferences')} th={th}>
            {!desktop && (
              <MenuRow
                th={th}
                icon={dark ? <Sun size={18} strokeWidth={1.75} /> : <Moon size={18} strokeWidth={1.75} />}
                label={t('theme')}
                value={dark ? t('themeDark') : t('themeLight')}
                onClick={toggleTheme}
              />
            )}
            {!desktop && (
              <MenuRow
                th={th}
                icon={<FilePenLine size={18} strokeWidth={1.75} />}
                label={t('drafts')}
                value={drafts.length ? String(drafts.length) : undefined}
                onClick={() => push({ type: 'drafts' })}
              />
            )}
            <MenuRow
              th={th}
              icon={<Calendar size={18} strokeWidth={1.75} />}
              label={t('expeditions')}
              value={mySessions.length ? String(mySessions.length) : undefined}
              onClick={() => push({ type: 'expeditions' })}
              last={desktop}
            />
            {!desktop && (
              <MenuRow
                th={th}
                icon={<Settings size={18} strokeWidth={1.75} />}
                label={t('settings')}
                onClick={() => push({ type: 'settings' })}
                last
              />
            )}
          </MenuSection>

          <MenuSection title={t('supportSection')} th={th}>
            <MenuRow
              th={th}
              icon={<HelpCircle size={18} strokeWidth={1.75} />}
              label={t('helpSupport')}
              onClick={() => push({ type: 'help' })}
            />
            <MenuRow
              th={th}
              icon={<LogOut size={18} strokeWidth={1.75} />}
              label={t('logout')}
              danger
              onClick={() => { void doLogout(); }}
              last
            />
          </MenuSection>
        </div>
      </div>
      {showNav && <div className="rounded-t-3xl shadow-lg overflow-hidden flex-shrink-0"><NavBar /></div>}
    </div>
  );
}

function MenuSection({ title, children, th }: { title: string; children: ReactNode; th: ThemeTokens }) {
  return (
    <section>
      <p className="pv-label uppercase px-1 mb-1.5" style={{ color: th.soft }}>{title}</p>
      <div className="rounded-3xl overflow-hidden" style={{ background: th.cardBg }}>
        {children}
      </div>
    </section>
  );
}

function MenuRow({
  th,
  icon,
  label,
  value,
  onClick,
  last = false,
  danger = false,
}: {
  th: ThemeTokens;
  icon: ReactNode;
  label: string;
  value?: string;
  onClick: () => void;
  last?: boolean;
  danger?: boolean;
}) {
  return (
    <motion.button
      type="button"
      whileTap={tap.btn}
      onClick={onClick}
      className="w-full flex items-center gap-3 min-h-12 px-4 py-3 text-left cursor-pointer"
      style={{
        background: th.cardBg,
        borderBottom: last ? undefined : `1px solid ${th.border}`,
      }}
    >
      <span
        className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: th.isDark ? '#2E2E2E' : '#F0F1F3', color: danger ? ACCENT : th.inkText }}
        aria-hidden
      >
        {icon}
      </span>
      <span className="pv-subtitle flex-1 min-w-0 truncate" style={{ color: danger ? ACCENT : th.inkText }}>
        {label}
      </span>
      {value ? (
        <span className="pv-caption flex-shrink-0 max-w-[40%] truncate" style={{ color: th.soft }}>{value}</span>
      ) : null}
      <ChevronRight size={18} strokeWidth={1.75} className="flex-shrink-0" style={{ color: th.soft }} aria-hidden />
    </motion.button>
  );
}
