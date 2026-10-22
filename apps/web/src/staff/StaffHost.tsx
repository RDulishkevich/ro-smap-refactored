import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { apiAdminEmailConflicts, roleAtLeast, type Sound } from '@polevka/core';
import { color, spring } from '@polevka/design';
import { useAuth } from '../state/AuthContext';
import { useData } from '../state/DataContext';
import { useNav } from '../state/NavContext';
import { useTh } from '../state/ThemeContext';
import { useUi } from '../state/UiContext';
import { useIsDesktop } from '../lib/use-media';
import { ScreenContent } from '../screens/stack';
import { SwipeBack } from '../lib/swipe-back';
import { StaffPlayerBar } from './StaffPlayerBar';
import {
  AnalyticsModule, ConsoleModule, InboxModule, OverviewModule, QueueModule, ReportsModule,
  STAFF_MODULES, UsersModule, type StaffModuleId,
} from './modules';

const ACCENT = color.accent;
const RAIL_W = 200;

function loadMetrika(counterId: string) {
  if (typeof window === 'undefined' || !counterId) return;
  type YmFn = ((...args: unknown[]) => void) & { a?: unknown[] };
  const w = window as Window & { ym?: YmFn };
  if (typeof w.ym === 'function') {
    w.ym(Number(counterId), 'hit', window.location.href);
    return;
  }
  const stub: YmFn = (...args: unknown[]) => { (stub.a = stub.a || []).push(args); };
  w.ym = stub;
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://mc.yandex.ru/metrika/tag.js';
  document.head.appendChild(s);
  stub(Number(counterId), 'init', { clickmap: true, trackLinks: true, accurateTrackBounce: true });
}

export function StaffHost() {
  const th = useTh();
  const desktop = useIsDesktop();
  const { user } = useAuth();
  const { toast, confirm } = useUi();
  const { stack, pop, push } = useNav();
  const { playingId, allSounds } = useData();
  const [module, setModule] = useState<StaffModuleId>('overview');
  const [focus, setFocus] = useState<Sound | null>(null);

  const canAdmin = roleAtLeast(user?.role, 'admin');
  const canOwner = roleAtLeast(user?.role, 'owner');

  useEffect(() => {
    const id = String(import.meta.env.VITE_YANDEX_METRIKA_ID || '').trim();
    if (id) loadMetrika(id);
  }, []);

  // Keep dock in sync with audio engine when playing from queue.
  useEffect(() => {
    if (playingId == null) return;
    const live = allSounds.find((s) => String(s.id) === String(playingId));
    if (live) setFocus(live);
  }, [playingId, allSounds]);

  const modules = useMemo(
    () => STAFF_MODULES.filter((m) => {
      if (!m.minRole) return true;
      return roleAtLeast(user?.role, m.minRole);
    }),
    [user?.role],
  );

  const scanEmailConflicts = async () => {
    try {
      const data = await apiAdminEmailConflicts() as {
        conflicts?: Array<{ email: string; accounts: Array<{ login: string }> }>;
      };
      const listC = data.conflicts || [];
      if (!listC.length) {
        toast('Конфликтов email нет');
        return;
      }
      const body = listC.slice(0, 12).map((c) => `${c.email}: ${c.accounts.map((a) => a.login).join(', ')}`).join('\n');
      await confirm({
        title: `Конфликты email (${listC.length})`,
        body: `${body}${listC.length > 12 ? '\n…' : ''}`,
        ok: 'Понятно',
      });
    } catch (e: unknown) {
      toast((e as Error).message || 'Не удалось');
    }
  };

  const roleLabel = user?.role === 'owner' ? 'Владелец' : user?.role === 'admin' ? 'Админ' : 'Модератор';

  const body = (() => {
    switch (module) {
      case 'overview': return <OverviewModule onGo={setModule} />;
      case 'queue': return (
        <QueueModule
          focusId={focus ? String(focus.id) : null}
          onFocus={setFocus}
        />
      );
      case 'reports': return <ReportsModule onFocus={setFocus} />;
      case 'inbox': return <InboxModule />;
      case 'users': return <UsersModule />;
      case 'analytics': return <AnalyticsModule />;
      case 'console': return canOwner
        ? <ConsoleModule scanEmailConflicts={scanEmailConflicts} />
        : null;
      default: return null;
    }
  })();

  const showPlayer = !!focus;

  return (
    <div className="relative h-full w-full flex flex-col min-h-0" style={{ background: th.phoneBg }}>
      <div className="flex flex-1 min-h-0">
        {desktop && (
          <aside
            className="flex-shrink-0 flex flex-col py-4 px-3 gap-1"
            style={{ width: RAIL_W, background: th.cardBg, borderRight: `1px solid ${th.border}` }}
          >
            <p className="pv-micro px-3 mb-2" style={{ color: th.soft }}>{roleLabel}</p>
            {modules.map(({ id, label, Icon }) => {
              const on = module === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setModule(id)}
                  className="flex items-center gap-3 w-full h-11 px-3 rounded-2xl text-left"
                  style={{ background: on ? (th.isDark ? '#2E2E2E' : '#F0F1F3') : 'transparent' }}
                >
                  <Icon size={18} color={on ? ACCENT : th.muted} strokeWidth={on ? 2.25 : 1.75} />
                  <span className="pv-subtitle truncate" style={{ color: on ? th.inkText : th.muted }}>{label}</span>
                </button>
              );
            })}
            {canAdmin && (
              <button type="button" onClick={() => void scanEmailConflicts()}
                className="mt-auto pv-micro px-3 py-2 rounded-xl text-left"
                style={{ color: th.soft }}>
                Конфликты email
              </button>
            )}
          </aside>
        )}

        <div className="flex-1 min-w-0 flex flex-col min-h-0">
          {!desktop && (
            <div className="flex gap-1.5 overflow-x-auto px-3 pt-3 pb-1 flex-shrink-0 scrollbar-none">
              {modules.map(({ id, label }) => (
                <button key={id} type="button" onClick={() => setModule(id)}
                  className="pv-caption px-3 py-2 rounded-2xl whitespace-nowrap flex-shrink-0"
                  style={{ background: module === id ? ACCENT : th.cardBg, color: module === id ? '#fff' : th.muted }}>
                  {label}
                </button>
              ))}
            </div>
          )}
          <div className={`flex-1 min-h-0 overflow-y-auto ${desktop ? 'p-6' : 'p-4'}`}>
            {body}
          </div>
          {showPlayer && focus && (
            <StaffPlayerBar
              sound={focus}
              onOpen={() => push({ type: 'sound-detail', sound: focus })}
              onClose={() => setFocus(null)}
            />
          )}
        </div>
      </div>

      <AnimatePresence>
        {stack.map((screen, i) => {
          const underTop = i < stack.length - 1;
          return (
            <motion.div
              key={screen._id}
              className="absolute inset-0"
              aria-hidden={underTop || undefined}
              style={{ zIndex: 100 + i, background: th.phoneBg }}
              initial={screen.type === 'sound-detail' ? { opacity: 0, y: 48 } : { opacity: 0, x: 36 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={screen.type === 'sound-detail' ? { opacity: 0, y: 40 } : { opacity: 0, x: 20 }}
              transition={screen.type === 'sound-detail' ? spring.sheet : spring.stack}
            >
              <SwipeBack className="h-full" onBack={pop} enabled={screen.type !== 'sound-detail'}>
                <ScreenContent screen={screen} onBack={pop} />
              </SwipeBack>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
