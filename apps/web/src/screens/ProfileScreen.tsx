import { useState } from 'react';
import { motion } from 'motion/react';
import { Headphones, LogIn, Mic, Settings, Trash2 } from 'lucide-react';
import { color, pinColor } from '@polevka/design';
import { formatPlays, type Sound } from '@polevka/core';
import { useSoundMeta } from '../lib/audio-meta';
import { useT } from '../state/PrefsContext';
import { useAuth } from '../state/AuthContext';
import { useNav } from '../state/NavContext';
import { useTh } from '../state/ThemeContext';
import { useData } from '../state/DataContext';
import { NavBar, PlayPauseIcon, SoundTypeTag } from '../primitives/ui';
import BrandMark from '@/brand/BrandMark';
import LogoApp from '@/brand/LogoApp';

const SAGE = color.sage;
const OLIVE = color.olive;
const ACCENT = color.accent;
const DARK = color.dark;
const LIGHT = color.light;

export function GuestProfileScreen({ showNav = true }: { showNav?: boolean }) {
  const { push } = useNav();
  const th = useTh();
  const t = useT();
  return (
    <div className="flex flex-col h-full relative" style={{ background: th.phoneBg }}>
      <div className="relative flex-1 flex flex-col items-center justify-center px-6 text-center pv-safe-top">
        <div className="w-20 h-20 rounded-3xl overflow-hidden shadow-xl mx-auto mb-4"><LogoApp /></div>
        <h1 className="text-xl font-bold mb-2" style={{ color: th.inkText, fontFamily: 'Klukva, "Geist Variable", serif' }}>Полёвка</h1>
        <p className="text-xs leading-relaxed mb-6" style={{ color: SAGE }}>
          {t('signInToSave')}
        </p>
        <div className="w-full flex flex-col gap-3">
          <motion.button whileTap={{ scale: 0.96 }} onClick={() => push({ type: 'auth' })}
            className="w-full py-3.5 rounded-2xl text-white text-sm font-bold flex items-center justify-center gap-2 cursor-pointer" style={{ backgroundColor: ACCENT }}>
            <LogIn size={15} />{t('signInAccount')}
          </motion.button>
          <motion.button whileTap={{ scale: 0.96 }} onClick={() => push({ type: 'auth', mode: 'up' })}
            className="w-full py-3 rounded-2xl text-sm font-semibold cursor-pointer" style={{ background: th.lightBg, color: OLIVE }}>
            {t('register')}
          </motion.button>
        </div>
        <p className="text-[10px] mt-6 px-4 leading-relaxed" style={{ color: th.isDark ? '#6A8A78' : '#B0B8A8' }}>
          <button className="underline" onClick={() => push({ type: 'legal', doc: 'terms' })}>{t('terms')}</button>
          {' · '}
          <button className="underline" onClick={() => push({ type: 'legal', doc: 'privacy' })}>{t('privacyPolicy')}</button>
        </p>
      </div>
      {showNav && <div className="rounded-t-3xl shadow-lg overflow-hidden flex-shrink-0"><NavBar /></div>}
    </div>
  );
}

export function ProfileScreen({ showNav = true }: { showNav?: boolean }) {
  const { user } = useAuth();
  const { push } = useNav();
  const th = useTh();
  const t = useT();
  const { togglePlay, playing, playingId, allSounds, profiles } = useData();
  const mineProfile = profiles.find((p) => String(p.loginName).toLowerCase() === String(user?.loginName || '').toLowerCase());
  const avatarUrl = String(user?.avatar || mineProfile?.avatar || '');
  const mineAll = allSounds.filter((s) => String(s.recordistId || s.user || '').toLowerCase() === String(user?.loginName || '').toLowerCase()
    || String(s.recordist || '').toLowerCase() === String(user?.username || '').toLowerCase());
  const mine = mineAll.filter((s) => !s.status || s.status === 'published');
  const drafts = mineAll.filter((s) => s.status === 'draft' || s.status === 'pending' || s.status === 'rejected');
  const shown = mine.length ? mine : [];
  const mySessions = profiles.find((p) => String(p.loginName).toLowerCase() === user?.loginName)?.sessions || [];

  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      <div className="flex-1 overflow-y-auto scrollbar-none">
        <div className="relative p-4 pb-3 overflow-hidden pv-safe-top">
          <div className="relative flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 relative flex-shrink-0"><BrandMark /></div>
              <p className="text-[10px] font-medium tracking-wide uppercase" style={{ color: SAGE }}>{t('profile')}</p>
            </div>
            <motion.button whileTap={{ scale: 0.88 }} onClick={() => push({ type: 'settings' })}
              className="w-10 h-10 rounded-2xl shadow-sm flex items-center justify-center" style={{ background: th.cardBg }}>
              <Settings size={15} style={{ color: OLIVE }} />
            </motion.button>
          </div>
          <div className="relative flex items-center gap-4 mb-5">
            <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-md flex-shrink-0">
              {/^(https?:|data:)/i.test(avatarUrl)
                ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                : <LogoApp />}
            </div>
            <div>
              <p className="text-base font-bold" style={{ color: th.inkText }}>{user?.displayName || user?.username}</p>
              <p className="text-xs mb-2" style={{ color: SAGE }}>@{user?.loginName}</p>
              <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold" style={{ background: th.cream, color: ACCENT }}>
                <Mic size={9} />{t('fieldResearcher')}
              </div>
            </div>
          </div>
          <div className="relative rounded-3xl p-4 shadow-sm mb-4" style={{ background: th.cardBg }}>
            <div className="flex justify-around">
              {[[String(mine.length), t('recordings')], [String(drafts.length), t('pending')], [String(mySessions.length), t('expeditions')]].map(([v, l]) => (
                <div key={l} className="text-center">
                  <p className="text-base font-bold" style={{ color: th.inkText }}>{v}</p>
                  <p className="text-[10px]" style={{ color: SAGE }}>{l}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-2 mb-2 relative">
            <motion.button whileTap={{ scale: 0.94 }} onClick={() => push({ type: 'edit-profile' })}
              className="flex-1 py-2.5 rounded-2xl text-xs font-semibold shadow-sm cursor-pointer" style={{ background: th.cardBg, color: th.isDark ? LIGHT : DARK }}>{t('edit')}</motion.button>
            <motion.button whileTap={{ scale: 0.94 }} onClick={() => push({ type: 'cabinet' })}
              className="flex-1 py-2.5 rounded-2xl text-xs font-semibold shadow-sm cursor-pointer" style={{ background: th.cardBg, color: th.isDark ? LIGHT : DARK }}>{t('cabinet')}</motion.button>
          </div>
          {user?.loginName !== 'admin' && user?.loginName !== 'support' && (
            <motion.button type="button" whileTap={{ scale: 0.94 }} onClick={() => push({ type: 'delete-account' })}
              className="w-full py-2.5 rounded-2xl text-xs font-semibold shadow-sm cursor-pointer flex items-center justify-center gap-1.5 relative mb-1"
              style={{ background: th.cardBg, color: ACCENT }}>
              <Trash2 size={12} />{t('deleteAccount')}
            </motion.button>
          )}
        </div>
        <div className="px-4 pb-48">
          <p className="text-sm font-semibold mb-3" style={{ color: th.inkText }}>{t('mySounds')}</p>
          <div className="flex flex-col gap-3">
            {drafts.map((item) => (
              <button key={`d${String(item.id)}`} onClick={() => {
                if (item.status === 'draft' || item.status === 'rejected') push({ type: 'add-sound', edit: item });
                else push({ type: 'sound-detail', sound: item });
              }} className="rounded-2xl p-3 text-left" style={{ background: th.lightBg }}>
                <p className="text-[10px] uppercase" style={{ color: SAGE }}>{item.status}</p>
                <p className="text-xs font-bold" style={{ color: th.inkText }}>{item.title}</p>
                {item.rejectNote ? <p className="text-[10px]" style={{ color: ACCENT }}>{String(item.rejectNote)}</p> : null}
              </button>
            ))}
            {shown.map((item) => (
              <ProfileSoundCard key={String(item.id)} item={item} playing={playing && String(playingId) === String(item.id)}
                onPlay={() => togglePlay(item)} onOpen={() => push({ type: 'sound-detail', sound: item })} />
            ))}
            {!shown.length && !drafts.length && <p className="text-xs" style={{ color: SAGE }}>{t('noOwnSounds')}</p>}
          </div>
        </div>
      </div>
      {showNav && <div className="rounded-t-3xl shadow-lg overflow-hidden flex-shrink-0"><NavBar /></div>}
    </div>
  );
}

function ProfileSoundCard({ item, playing, onPlay, onOpen }: {
  item: Sound; playing: boolean; onPlay: () => void; onOpen: () => void;
}) {
  const th = useTh();
  const meta = useSoundMeta(item);
  const c = pinColor[String(item.type)] ?? ACCENT;
  return (
    <div className="rounded-2xl px-3 py-2.5 flex items-center gap-3" style={{ background: th.cardBg }}>
      <motion.button type="button" onClick={onPlay} whileTap={{ scale: 0.88 }}
        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: c }}>
        <PlayPauseIcon playing={playing} size={12} />
      </motion.button>
      <button type="button" className="flex-1 min-w-0 text-left" onClick={onOpen}>
        <p className="text-[13px] font-semibold truncate" style={{ color: th.inkText }}>{item.title}</p>
        <p className="text-[11px] truncate mt-0.5" style={{ color: OLIVE }}>
          {item.location || '—'}
          {meta.durationSec > 0 ? ` · ${meta.durationLabel}` : ''}
        </p>
      </button>
      <SoundTypeTag type={String(item.type)} />
      <span className="inline-flex items-center gap-0.5 flex-shrink-0" style={{ color: SAGE }}>
        <Headphones size={11} /><span className="text-[10px]">{formatPlays(item.plays)}</span>
      </span>
    </div>
  );
}
