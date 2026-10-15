import type { AppEvent, Profile, Sound } from '@polevka/core';
import type { ScreenConfig } from '../state/NavContext';
import { useNav } from '../state/NavContext';
import { useTh } from '../state/ThemeContext';
import { openNotification, type MailNotif } from '../lib/open-notification';
import { Avatar } from './Avatar';

type Ctx = {
  sounds: Sound[];
  profiles: Profile[];
  events: AppEvent[];
};

function openProfile(fromId: string, fromName: string | undefined, profiles: Profile[], push: (s: ScreenConfig) => void) {
  const from = String(fromId || '').replace(/^@/, '').toLowerCase();
  if (!from) return;
  const profile = profiles.find((p) => String(p.loginName || '').toLowerCase() === from);
  push({
    type: 'user-profile',
    name: String(fromName || profile?.displayName || profile?.username || from),
    avatar: String(profile?.avatar || '🎙️'),
    username: `@${from}`,
  });
}

/** Notification with clickable author / sound / expedition targets. */
export function NotificationRow({
  n,
  ctx,
  onOpened,
  className = '',
  soft = false,
}: {
  n: MailNotif;
  ctx: Ctx;
  onOpened?: () => void;
  className?: string;
  soft?: boolean;
}) {
  const th = useTh();
  const { push } = useNav();
  const from = String(n.fromId || '').replace(/^@/, '').toLowerCase();
  const profile = from
    ? ctx.profiles.find((p) => String(p.loginName || '').toLowerCase() === from)
    : undefined;
  const soundId = n.soundId != null ? String(n.soundId) : '';
  const sound = soundId ? ctx.sounds.find((s) => String(s.id) === soundId) : undefined;
  const expId = n.expeditionId ? String(n.expeditionId) : '';

  const openMain = () => {
    if (openNotification(n, { push, ...ctx })) onOpened?.();
  };

  return (
    <div className={`rounded-2xl p-3 ${className}`} style={{ background: soft ? th.phoneBg : th.cardBg }}>
      <div className="flex gap-2.5 items-start">
        <button
          type="button"
          className="flex-shrink-0 cursor-pointer"
          onClick={() => {
            if (from) { openProfile(from, n.fromName, ctx.profiles, push); onOpened?.(); }
            else openMain();
          }}
          aria-label={n.fromName || from || 'Профиль'}
        >
          <Avatar src={profile?.avatar} name={n.fromName || from || 'П'} size={40} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
            {(n.fromName || from) && (
              <button
                type="button"
                className="pv-subtitle underline-offset-2 hover:underline cursor-pointer text-left"
                style={{ color: th.inkText }}
                onClick={() => { openProfile(from || String(n.fromId || ''), n.fromName, ctx.profiles, push); onOpened?.(); }}
              >
                {n.fromName || from}
              </button>
            )}
            {sound && (
              <button
                type="button"
                className="pv-caption underline-offset-2 hover:underline cursor-pointer text-left"
                style={{ color: th.soft }}
                onClick={() => { push({ type: 'sound-detail', sound }); onOpened?.(); }}
              >
                {sound.title || n.soundTitle || 'звук'}
              </button>
            )}
            {!sound && n.soundTitle && (
              <button
                type="button"
                className="pv-caption underline-offset-2 hover:underline cursor-pointer text-left"
                style={{ color: th.soft }}
                onClick={openMain}
              >
                {n.soundTitle}
              </button>
            )}
            {expId && (
              <button
                type="button"
                className="pv-caption underline-offset-2 hover:underline cursor-pointer text-left"
                style={{ color: th.soft }}
                onClick={openMain}
              >
                экспедиция
              </button>
            )}
          </div>
          {n.text && (
            <button type="button" className="pv-caption mt-0.5 text-left w-full cursor-pointer" style={{ color: th.muted }} onClick={openMain}>
              {n.text}
            </button>
          )}
          {n.date && <p className="text-[9px] mt-1" style={{ color: th.soft }}>{n.date}</p>}
        </div>
      </div>
    </div>
  );
}
