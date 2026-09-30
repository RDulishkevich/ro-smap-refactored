import { useState } from 'react';
import { motion } from 'motion/react';
import { Headphones, LogIn, MapPin, Mic, Settings } from 'lucide-react';
import { color, pinColor } from '@polevka/design';
import { formatPlays, WF } from '@polevka/core';
import { useAuth } from '../state/AuthContext';
import { useNav } from '../state/NavContext';
import { useTh } from '../state/ThemeContext';
import { useData } from '../state/DataContext';
import { DecorBand, NavBar, PlayPauseIcon, SoundTypeTag, WaveformSVG } from '../primitives/ui';
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
  return (
    <div className="flex flex-col h-full relative" style={{ background: th.phoneBg }}>
      <DecorBand opacity={th.isDark ? 0.1 : 0.18} flip />
      <div className="relative flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="w-20 h-20 rounded-3xl overflow-hidden shadow-xl mx-auto mb-4"><LogoApp /></div>
        <h1 className="text-xl font-bold mb-2" style={{ color: th.inkText, fontFamily: 'Klukva, Geologica, serif' }}>Полёвка</h1>
        <p className="text-xs leading-relaxed mb-6" style={{ color: SAGE }}>
          Войдите, чтобы сохранять звуки, создавать экспедиции и общаться с другими исследователями
        </p>
        <div className="w-full flex flex-col gap-3">
          <motion.button whileTap={{ scale: 0.96 }} onClick={() => push({ type: 'auth' })}
            className="w-full py-3.5 rounded-2xl text-white text-sm font-bold flex items-center justify-center gap-2" style={{ backgroundColor: ACCENT }}>
            <LogIn size={15} />Войти в аккаунт
          </motion.button>
          <motion.button whileTap={{ scale: 0.96 }} onClick={() => push({ type: 'auth' })}
            className="w-full py-3 rounded-2xl text-sm font-semibold" style={{ background: th.lightBg, color: OLIVE }}>
            Зарегистрироваться
          </motion.button>
        </div>
        <p className="text-[10px] mt-6 px-4 leading-relaxed" style={{ color: th.isDark ? '#6A8A78' : '#B0B8A8' }}>
          Продолжая, вы соглашаетесь с <button className="underline" onClick={() => push({ type: 'legal', doc: 'terms' })}>условиями</button> и <button className="underline" onClick={() => push({ type: 'legal', doc: 'privacy' })}>политикой конфиденциальности</button>
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
  const { togglePlay, playing, playingId, progress, allSounds, profiles } = useData();
  const mineAll = allSounds.filter((s) => String(s.recordistId || s.user || '').toLowerCase() === String(user?.loginName || '').toLowerCase()
    || String(s.recordist || '').toLowerCase() === String(user?.username || '').toLowerCase());
  const mine = mineAll.filter((s) => !s.status || s.status === 'published');
  const drafts = mineAll.filter((s) => s.status === 'draft' || s.status === 'pending' || s.status === 'rejected');
  const shown = mine.length ? mine : [];
  const mySessions = profiles.find((p) => String(p.loginName).toLowerCase() === user?.loginName)?.sessions || [];

  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      <div className="flex-1 overflow-y-auto scrollbar-none">
        <div className="relative p-5 pb-3 overflow-hidden">
          <DecorBand opacity={th.isDark ? 0.1 : 0.15} />
          <div className="relative flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 relative flex-shrink-0"><BrandMark /></div>
              <p className="text-[10px] font-medium tracking-wide uppercase" style={{ color: SAGE }}>Профиль</p>
            </div>
            <motion.button whileTap={{ scale: 0.88 }} onClick={() => push({ type: 'settings' })}
              className="w-10 h-10 rounded-2xl shadow-sm flex items-center justify-center" style={{ background: th.cardBg }}>
              <Settings size={15} style={{ color: OLIVE }} />
            </motion.button>
          </div>
          <div className="relative flex items-center gap-4 mb-5">
            <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-md flex-shrink-0"><LogoApp /></div>
            <div>
              <p className="text-base font-bold" style={{ color: th.inkText }}>{user?.displayName || user?.username}</p>
              <p className="text-xs mb-2" style={{ color: SAGE }}>@{user?.loginName}</p>
              <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold" style={{ background: th.cream, color: ACCENT }}>
                <Mic size={9} />Полевой исследователь
              </div>
            </div>
          </div>
          <div className="relative rounded-3xl p-4 shadow-sm mb-4" style={{ background: th.cardBg }}>
            <div className="flex justify-around">
              {[[String(mine.length), 'Записи'], [String(drafts.length), 'На модерации'], [String(mySessions.length), 'Экспедиций']].map(([v, l]) => (
                <div key={l} className="text-center">
                  <p className="text-base font-bold" style={{ color: th.inkText }}>{v}</p>
                  <p className="text-[10px]" style={{ color: SAGE }}>{l}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-2 mb-2 relative">
            <motion.button whileTap={{ scale: 0.94 }} onClick={() => push({ type: 'edit-profile' })}
              className="flex-1 py-2.5 rounded-2xl text-xs font-semibold shadow-sm" style={{ background: th.cardBg, color: th.isDark ? LIGHT : DARK }}>Редактировать</motion.button>
            <motion.button whileTap={{ scale: 0.94 }} onClick={() => push({ type: 'cabinet' })}
              className="flex-1 py-2.5 rounded-2xl text-xs font-semibold shadow-sm" style={{ background: th.cardBg, color: th.isDark ? LIGHT : DARK }}>Кабинет</motion.button>
          </div>
        </div>
        <div className="px-5 pb-4">
          <p className="text-sm font-semibold mb-3" style={{ color: th.inkText }}>Мои звуки</p>
          <div className="flex flex-col gap-3">
            {drafts.map((item) => (
              <button key={`d${String(item.id)}`} onClick={() => push({ type: 'sound-detail', sound: item })} className="rounded-2xl p-3 text-left" style={{ background: th.lightBg }}>
                <p className="text-[10px] uppercase" style={{ color: SAGE }}>{item.status}</p>
                <p className="text-xs font-bold" style={{ color: th.inkText }}>{item.title}</p>
                {item.rejectNote ? <p className="text-[10px]" style={{ color: ACCENT }}>{String(item.rejectNote)}</p> : null}
              </button>
            ))}
            {shown.map((item) => {
              const on = playing && String(playingId) === String(item.id);
              const c = pinColor[String(item.type)] ?? ACCENT;
              return (
                <div key={String(item.id)} className="rounded-3xl p-4 shadow-sm" style={{ background: th.cardBg }}>
                  <div className="flex justify-between items-start mb-2">
                    <button className="flex-1 min-w-0 text-left" onClick={() => push({ type: 'sound-detail', sound: item })}>
                      <p className="text-xs font-bold truncate" style={{ color: th.inkText }}>{item.title}</p>
                      <div className="flex items-center gap-1"><MapPin size={9} style={{ color: SAGE }} /><p className="text-[10px] truncate" style={{ color: OLIVE }}>{item.location}</p></div>
                    </button>
                    <SoundTypeTag type={String(item.type)} />
                  </div>
                  <div className="flex items-center gap-3">
                    <motion.button onClick={() => togglePlay(item)} whileTap={{ scale: 0.88 }} className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: c }}>
                      <PlayPauseIcon playing={!!on} size={12} />
                    </motion.button>
                    <div className="flex-1 overflow-hidden"><WaveformSVG data={WF[Number(item.wf || 0) % 4]} color={c} progress={on ? progress : 0} /></div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[10px]">{item.duration}</p>
                      <div className="flex items-center gap-1 justify-end" style={{ color: SAGE }}><Headphones size={9} /><span className="text-[9px]">{formatPlays(item.plays)}</span></div>
                    </div>
                  </div>
                </div>
              );
            })}
            {!shown.length && !drafts.length && <p className="text-xs" style={{ color: SAGE }}>Пока нет своих записей</p>}
          </div>
        </div>
      </div>
      {showNav && <div className="rounded-t-3xl shadow-lg overflow-hidden flex-shrink-0"><NavBar /></div>}
    </div>
  );
}
