import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import {
  ChevronRight, Flag, Heart, Headphones, Info, LogOut, MapPin, MessageCircle, Mic,
  Moon, MoreHorizontal, Route, Send, Share2, Sun, UserPlus, Volume2,
} from 'lucide-react';
import { color, pinColor } from '@polevka/design';
import {
  apiChangePassword, apiConfirmEmailVerification, apiConfirmPasswordReset,
  apiGetSecurityEvents, apiLogoutAll, apiPatchSound, apiRequestEmailVerification, apiRequestPasswordReset,
  apiSyncJson, apiTotpConfirm, apiTotpDisable, apiTotpSetup, conversationPeers, makeMailMsg,
  matchSupportBotFaq,   normalizeComment, normalizeTimeMarkers, spamGuardCheck, spamGuardMessage, SUPPORT_LOGIN,
  SUPPORT_NAME, threadWith, uploadUserMedia, upsertInboxPatch, formatPlays,
  type ApiError, type Comment, type Sound, type TimeMarker,
} from '@polevka/core';
import { LEGAL_DOCS } from '../../../../src/data/legalDocs.js';
import { PUBLISH_RULE_SECTIONS } from '../../../../src/data/publishRules.js';
import { useAuth } from '../state/AuthContext';
import { useNav, type ScreenConfig } from '../state/NavContext';
import { useTh, useToggleTheme, useIsDark } from '../state/ThemeContext';
import { useData } from '../state/DataContext';
import { useUi } from '../state/UiContext';
import { PlayPauseIcon, PinPlayer, ScreenHeader, SoundTypeTag, OtpInput } from '../primitives/ui';
import { PhotoCarousel } from '../primitives/PhotoCarousel';
import { HoverMenu } from '../primitives/HoverMenu';
import { AudioEditor, LiveWaveform } from '../primitives/AudioEditor';
import { openCookieBanner } from '../primitives/CookieBanner';
import { SoundMap } from '../lib/SoundMap';
import { setDraftRecording } from '../lib/record-buffer';
import { formatClock, parseDurationLabel } from '../lib/waveform';
import { AddSoundScreen } from './AddSoundScreen';
import { StaffScreen } from './StaffScreen';
import { ExpeditionDetailScreen, ExpeditionEditScreen, PickLocationScreen } from './ExpeditionScreens';
import { downloadLegalPrint } from '../lib/legal-print';
import { pathForSound, shareUrl } from '../lib/routes';
import { useIsDesktop } from '../lib/use-media';
import { isAmbisonicSound, isSoundwalkPrinciple, soundRoute } from '../lib/sound-media';
import LogoApp from '@/brand/LogoApp';

const SAGE = color.sage;
const OLIVE = color.olive;
const ACCENT = color.accent;
const DARK = color.dark;
const LIGHT = color.light;

export function ScreenContent({ screen, onBack }: { screen: ScreenConfig; onBack: () => void }) {
  switch (screen.type) {
    case 'sound-detail': return <SoundDetailScreen sound={screen.sound} onBack={onBack} />;
    case 'user-profile': return <UserProfileScreen name={screen.name} avatar={screen.avatar} username={screen.username} onBack={onBack} />;
    case 'expedition-detail': return <ExpeditionDetailScreen exp={screen.exp} onBack={onBack} />;
    case 'expedition-edit': return <ExpeditionEditScreen exp={screen.exp} onBack={onBack} />;
    case 'settings': return <SettingsScreen onBack={onBack} />;
    case 'events': return <EventsScreen onBack={onBack} focusId={screen.focusId} />;
    case 'auth': return <AuthScreen onBack={onBack} />;
    case 'record': return <RecordScreen onBack={onBack} />;
    case 'add-sound': return <AddSoundScreen onBack={onBack} edit={screen.edit} />;
    case 'messages': return <MessagesScreen onBack={onBack} />;
    case 'conversation': return <ConversationScreen name={screen.name} avatar={screen.avatar} peer={screen.peer} onBack={onBack} />;
    case 'notifications': return <NotificationsScreen onBack={onBack} />;
    case 'search': return <SearchScreen onBack={onBack} />;
    case 'edit-profile': return <EditProfileScreen onBack={onBack} />;
    case 'map-location': return <MapLocationScreen sound={screen.sound} onBack={onBack} />;
    case 'pick-location': return <PickLocationScreen mode={screen.mode} onBack={onBack} />;
    case 'staff': return <StaffScreen onBack={onBack} />;
    case 'help': return <HelpScreen onBack={onBack} />;
    case 'legal': return <LegalScreen doc={screen.doc} onBack={onBack} />;
    case 'cabinet': return <CabinetScreen onBack={onBack} />;
    case 'guessr': return <GuessrScreen onBack={onBack} />;
    case 'reset-password': return <ResetPasswordScreen onBack={onBack} />;
    default: return null;
  }
}

function SoundDetailScreen({ sound, onBack }: { sound: Sound; onBack: () => void }) {
  const { push, reset, setActiveTab } = useNav();
  const { isLoggedIn, user } = useAuth();
  const { togglePlay, playing, playingId, allSounds, reload, setFocused, progress, seek, volume, muted, setVolume, toggleMute } = useData();
  const { toast, confirm } = useUi();
  const th = useTh();
  const desktop = useIsDesktop();
  const live = allSounds.find((s) => String(s.id) === String(sound.id)) || sound;
  const on = playing && String(playingId) === String(live.id);
  const comments = live.comments || [];
  const liked = !!user && (live.likedBy || []).includes(user.loginName);
  const disliked = !!user && (live.dislikedBy || []).includes(user.loginName);

  const toggleReaction = async (kind: 'like' | 'dislike', onNow: boolean) => {
    if (!isLoggedIn) { push({ type: 'auth' }); toast('Войдите, чтобы оценить запись'); return; }
    const guard = spamGuardCheck('like');
    if (!guard.ok) { toast(spamGuardMessage(guard)); return; }
    try {
      await apiPatchSound(live.id, { reaction: kind, reactionSet: !onNow });
      toast(kind === 'like' ? (onNow ? 'Лайк снят' : 'Нравится') : (onNow ? 'Дизлайк снят' : 'Не нравится'));
      await reload();
    } catch (e: unknown) {
      toast((e as Error).message || 'Не удалось');
    }
  };

  const download = () => {
    if (!live.url) { toast('Нет файла'); return; }
    const a = document.createElement('a');
    a.href = String(live.url);
    a.download = `${live.title || 'sound'}.wav`;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    void apiPatchSound(live.id, { incDownloads: 1 }).catch(() => {});
    toast('Скачивание WAV');
  };

  useEffect(() => { setFocused(live); }, [live.id, setFocused]);

  const goToMap = () => {
    setFocused(live);
    if (desktop) {
      toast('Точка на карте справа');
      return;
    }
    reset();
    setActiveTab('map');
  };

  const toggleCommentReaction = async (s: Sound, cm: Comment) => {
    if (!user) { push({ type: 'auth' }); return; }
    const guard = spamGuardCheck('like');
    if (!guard.ok) { toast(spamGuardMessage(guard)); return; }
    const login = user.loginName;
    const now = new Date().toISOString();
    const comments = (s.comments || []).map((c) => {
      if (c.id !== cm.id) return c;
      const reactedBy = [...(c.reactedBy || [])];
      const i = reactedBy.indexOf(login);
      if (i >= 0) reactedBy.splice(i, 1); else reactedBy.push(login);
      return { ...c, reactedBy, reactedAt: now, updatedAt: now };
    });
    try {
      await apiSyncJson('map_data.json', [{ ...s, comments }]);
      await reload();
    } catch (e: unknown) { toast((e as Error).message || 'Не удалось'); }
  };

  const reportComment = async (s: Sound, commentId: string) => {
    if (!user) { push({ type: 'auth' }); toast('Войдите, чтобы пожаловаться'); return; }
    const ok = await confirm({ title: 'Пожаловаться на комментарий?', body: 'Жалоба уйдёт модераторам.', ok: 'Отправить' });
    if (!ok) return;
    const next = {
      ...s,
      reports: [...((s.reports as unknown[]) || []), {
        id: `r${Date.now()}`, fromId: user.loginName, reason: 'user', type: 'comment', commentId, date: new Date().toISOString(),
      }],
    };
    try {
      await apiSyncJson('map_data.json', [next]);
      toast('Жалоба отправлена модераторам');
      await reload();
    } catch (e: unknown) { toast((e as Error).message || 'Не удалось'); }
  };

  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      <ScreenHeader title={live.title} onBack={onBack} right={
        <HoverMenu title={live.title} items={[
          { label: 'Пожаловаться', danger: true, onClick: () => { void (async () => {
            if (!isLoggedIn) { push({ type: 'auth' }); toast('Войдите, чтобы пожаловаться'); return; }
            const ok = await confirm({ title: 'Пожаловаться на запись?', body: 'Жалоба уйдёт модераторам.', ok: 'Отправить' });
            if (!ok) return;
            const next = {
              ...live,
              reports: [...((live.reports as unknown[]) || []), { id: `r${Date.now()}`, fromId: user?.loginName, reason: 'user', type: 'sound', date: new Date().toISOString() }],
            };
            try { await apiSyncJson('map_data.json', [next]); toast('Жалоба отправлена модераторам'); await reload(); }
            catch (e: unknown) { toast((e as Error).message || 'Не удалось'); }
          })(); } },
          { label: 'На карте', onClick: goToMap },
          { label: 'Скачать WAV', onClick: download },
        ]}>
          <span className="w-9 h-9 rounded-2xl flex items-center justify-center" style={{ background: th.lightBg }}>
            <MoreHorizontal size={15} color={OLIVE} />
          </span>
        </HoverMenu>
      } />
      <div className="flex-1 overflow-y-auto scrollbar-none">
        <PhotoCarousel images={(live.images || []).filter(Boolean)} title={live.title} />
        <div className="mx-4 mt-4 rounded-3xl p-4" style={{ background: th.cardBg }}>
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="min-w-0">
              <p className="text-base font-bold" style={{ color: th.inkText }}>{live.title}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <MapPin size={11} style={{ color: SAGE }} /><span className="text-xs" style={{ color: OLIVE }}>{live.location}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
              <SoundTypeTag type={String(live.type)} />
              {parseDurationLabel(live.duration) > 0 && (
                <span className="text-[10px]" style={{ color: SAGE }}>{live.duration}</span>
              )}
            </div>
          </div>
          {live.description && <p className="text-xs leading-relaxed mb-3" style={{ color: OLIVE }}>{live.description}</p>}
          {!!normalizeTimeMarkers(live.timeMarkers).length && (
            <ul className="mb-3 flex flex-col gap-1.5">
              {normalizeTimeMarkers(live.timeMarkers).map((m, i) => (
                <li key={`${m.t}-${m.label}-${i}`}>
                  <button type="button" className="flex items-baseline gap-2 text-left w-full"
                    onClick={() => {
                      const total = parseDurationLabel(live.duration);
                      if (total > 0) seek(Math.max(0, Math.min(1, m.t / total)));
                      if (!on) togglePlay(live);
                    }}>
                    <span className="text-[11px] font-semibold tabular-nums" style={{ color: ACCENT }}>{formatClock(m.t)}</span>
                    <span className="text-[11px] min-w-0 truncate" style={{ color: th.inkText }}>{m.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {(live.principle || live.channels) && (
            <p className="text-[11px] mb-2" style={{ color: SAGE }}>
              {[live.principle, live.channels].filter(Boolean).join(' · ')}
              {isAmbisonicSound(live) ? ' · сфера 360° в плеере' : ''}
            </p>
          )}
          {(isSoundwalkPrinciple(live.principle) || soundRoute(live).length >= 2) && (
            <button type="button" className="mb-3 h-9 px-3 rounded-full text-[12px] font-semibold inline-flex items-center gap-1.5"
              style={{ background: th.phoneBg, color: ACCENT }}
              onClick={goToMap}>
              <Route size={13} /> Показать прогулку на карте
            </button>
          )}
          {desktop && (
            <div className="mb-3 rounded-3xl overflow-hidden" style={{ background: th.cardBg }}>
              <PinPlayer sound={live} simple
                playing={on} onToggle={() => togglePlay(live)} progress={progress}
                onClose={() => { if (on) togglePlay(live); }}
                onSeek={seek} volume={volume} muted={muted} onVolume={setVolume} onMute={toggleMute} />
            </div>
          )}
          {live.user && (
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => push({ type: 'user-profile', name: String(live.user), avatar: String(live.avatar || '🎙️'), username: `@${String(live.recordistId || live.user).toLowerCase().replace(/\s/g, '_')}` })}
              className="flex items-center gap-2.5 w-full p-2.5 rounded-2xl" style={{ background: th.phoneBg }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg" style={{ background: th.lightBg }}>{live.avatar || '🎙️'}</div>
              <div className="flex-1 text-left">
                <p className="text-xs font-semibold" style={{ color: th.inkText }}>{live.user}</p>
                <p className="text-[10px]" style={{ color: SAGE }}>{live.gear || 'полевая запись'}</p>
              </div>
              <ChevronRight size={13} style={{ color: SAGE }} />
            </motion.button>
          )}
        </div>
        <div className="mx-4 mt-3 rounded-3xl p-4" style={{ background: th.cardBg }}>
          <div className="flex gap-4 mb-4">
            {[{ icon: <Headphones size={13} />, val: formatPlays(live.plays), label: 'прослушиваний' },
              { icon: <Heart size={13} />, val: String(live.likes ?? 0), label: 'лайков' },
              { icon: <MessageCircle size={13} />, val: String(comments.length), label: 'комментариев' }].map(({ icon, val, label }) => (
              <div key={label} className="flex-1 text-center">
                <div className="flex items-center justify-center gap-1 mb-0.5" style={{ color: SAGE }}>{icon}<span className="text-xs font-bold" style={{ color: th.inkText }}>{val}</span></div>
                <p className="text-[9px]" style={{ color: SAGE }}>{label}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <motion.button whileTap={{ scale: 0.92 }} onClick={() => void toggleReaction('like', liked)} className="flex-1 py-2.5 rounded-2xl flex items-center justify-center gap-1.5 text-xs font-semibold"
              style={{ background: liked ? ACCENT : th.lightBg, color: liked ? '#fff' : OLIVE }}>
              <Heart size={13} fill={liked ? '#fff' : 'none'} />Нравится
            </motion.button>
            <motion.button whileTap={{ scale: 0.92 }} onClick={() => void toggleReaction('dislike', disliked)} className="flex-1 py-2.5 rounded-2xl flex items-center justify-center gap-1.5 text-xs font-semibold"
              style={{ background: disliked ? DARK : th.lightBg, color: disliked ? '#fff' : OLIVE }}>
              Не нравится
            </motion.button>
            <motion.button whileTap={{ scale: 0.92 }} className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: th.lightBg }}
              onClick={() => { void navigator.clipboard?.writeText(shareUrl(pathForSound(live.id))); toast('Ссылка скопирована'); }}>
              <Share2 size={14} style={{ color: OLIVE }} />
            </motion.button>
          </div>
        </div>
        <div className="mx-4 mt-3 mb-6 rounded-3xl p-4" style={{ background: th.cardBg }}>
          <p className="text-sm font-bold mb-4" style={{ color: th.inkText }}>Комментарии · {comments.length}</p>
          {comments.length === 0 && <p className="text-xs mb-3" style={{ color: SAGE }}>Пока нет комментариев — напишите первый</p>}
          <div className="flex flex-col gap-3">
          {comments.map((cm) => {
            const likedC = (cm.reactedBy || []).includes(user?.loginName || '');
            return (
            <div key={cm.id} className="flex gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: th.lightBg, color: ACCENT }}>
                {(cm.author || '?').slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2 mb-0.5">
                  <p className="text-xs font-semibold truncate" style={{ color: th.inkText }}>{cm.author}</p>
                  <p className="text-[10px] flex-shrink-0" style={{ color: SAGE }}>{cm.date}</p>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: OLIVE }}>{cm.text}</p>
                {(cm.replies || []).length > 0 && (
                  <div className="mt-2 pl-3 flex flex-col gap-2" style={{ borderLeft: `2px solid ${th.border}` }}>
                    {(cm.replies || []).map((r) => (
                      <div key={r.id}>
                        <p className="text-[10px] font-semibold" style={{ color: th.inkText }}>{r.author}</p>
                        <p className="text-[11px] leading-relaxed" style={{ color: OLIVE }}>{r.text}</p>
                      </div>
                    ))}
                  </div>
                )}
                {isLoggedIn && (
                  <div className="flex items-center gap-3 mt-1.5">
                    <button className="text-[10px] flex items-center gap-1" style={{ color: likedC ? ACCENT : SAGE }}
                      onClick={() => void toggleCommentReaction(live, cm)}>
                      <Heart size={11} fill={likedC ? ACCENT : 'none'} />{(cm.reactedBy || []).length || ''}
                    </button>
                    <CommentReply sound={live} commentId={cm.id} onDone={reload} />
                    <button className="text-[10px] flex items-center gap-1" style={{ color: SAGE }}
                      onClick={() => void reportComment(live, cm.id)}>
                      <Flag size={10} />пожаловаться
                    </button>
                  </div>
                )}
              </div>
            </div>
            );
          })}
          </div>
          {isLoggedIn ? <CommentForm sound={live} onDone={reload} /> : (
            <button className="mt-4 w-full py-2.5 rounded-2xl text-xs font-semibold" style={{ background: th.lightBg, color: OLIVE }}
              onClick={() => push({ type: 'auth' })}>Войдите, чтобы комментировать</button>
          )}
        </div>
      </div>
    </div>
  );
}

function CommentForm({ sound, onDone }: { sound: Sound; onDone: () => Promise<void> }) {
  const { user } = useAuth();
  const { toast } = useUi();
  const [text, setText] = useState('');
  const th = useTh();
  const send = async () => {
    const t = text.trim();
    if (!t) return;
    const guard = spamGuardCheck('comment');
    if (!guard.ok) { toast(spamGuardMessage(guard)); return; }
    const next = {
      ...sound,
      comments: [...(sound.comments || []), normalizeComment({ author: user?.username || 'Я', authorId: user?.loginName, text: t, date: new Date().toLocaleDateString('ru') })],
    };
    try {
      await apiSyncJson('map_data.json', [next]);
      setText('');
      toast('Комментарий отправлен');
      await onDone();
    } catch (e: unknown) {
      toast((e as Error).message || 'Не удалось отправить');
    }
  };
  return (
    <div className="flex gap-2 mt-4 pt-3" style={{ borderTop: `1px solid ${th.border}` }}>
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Написать комментарий…"
        className="flex-1 text-sm rounded-2xl px-4 py-2.5 outline-none" style={{ background: th.lightBg, color: th.inkText }}
        onKeyDown={(e) => { if (e.key === 'Enter') void send(); }} />
      <button type="button" onClick={() => void send()} className="w-11 h-11 rounded-2xl flex items-center justify-center text-white flex-shrink-0" style={{ background: ACCENT }}><Send size={15} /></button>
    </div>
  );
}

function CommentReply({ sound, commentId, onDone }: { sound: Sound; commentId: string; onDone: () => Promise<void> }) {
  const { user } = useAuth();
  const { toast } = useUi();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const th = useTh();
  const send = async () => {
    const t = text.trim();
    if (!t) return;
    const guard = spamGuardCheck('comment');
    if (!guard.ok) { toast(spamGuardMessage(guard)); return; }
    const comments = (sound.comments || []).map((c) => c.id === commentId
      ? { ...c, replies: [...(c.replies || []), { id: `cr${Date.now()}`, author: user?.username || 'Я', authorId: user?.loginName, text: t, date: new Date().toLocaleDateString('ru') }] }
      : c);
    try {
      await apiSyncJson('map_data.json', [{ ...sound, comments }]);
      setText(''); setOpen(false);
      toast('Ответ отправлен');
      await onDone();
    } catch (e: unknown) { toast((e as Error).message || 'Не удалось'); }
  };
  return (
    <div className="mt-0">
      <button className="text-[9px]" style={{ color: SAGE }} onClick={() => setOpen((v) => !v)}>Ответить</button>
      {open && (
        <div className="flex gap-1 mt-1">
          <input value={text} onChange={(e) => setText(e.target.value)} className="flex-1 text-[10px] rounded-xl px-2 py-1 outline-none" style={{ background: th.cardBg, color: th.inkText }} />
          <button onClick={() => void send()} className="text-[9px] font-semibold" style={{ color: ACCENT }}>OK</button>
        </div>
      )}
    </div>
  );
}

function UserProfileScreen({ name, avatar, username, onBack }: { name: string; avatar: string; username: string; onBack: () => void }) {
  const { push } = useNav();
  const { sounds, togglePlay, playing, playingId, profiles, reload } = useData();
  const { user, isLoggedIn } = useAuth();
  const { toast } = useUi();
  const th = useTh();
  const login = username.replace(/^@/, '').toLowerCase();
  const profile = profiles.find((p) => String(p.loginName || '').toLowerCase() === login
    || String(p.displayName || p.username) === name);
  const peer = String(profile?.loginName || login).toLowerCase();
  const shown = sounds.filter((s) => String(s.recordistId || '').toLowerCase() === peer || s.user === name);
  const myProf = profiles.find((p) => String(p.loginName).toLowerCase() === user?.loginName);
  const following = (myProf?.following || []).map(String);
  const isFollowed = following.includes(peer);
  const toggleFollow = async () => {
    if (!isLoggedIn || !user) { push({ type: 'auth' }); return; }
    const cur = (myProf?.following || []).map(String);
    const followingNext = isFollowed ? cur.filter((x) => x !== peer) : [...cur, peer];
    const patch = {
      ...(myProf || { loginName: user.loginName, displayName: user.username }),
      loginName: user.loginName,
      following: followingNext,
      profileUpdatedAt: new Date().toISOString(),
    };
    try {
      await apiSyncJson('profiles.json', [patch]);
      toast(isFollowed ? 'Отписка' : 'Подписка');
      await reload();
    } catch (e: unknown) { toast((e as Error).message); }
  };
  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      <ScreenHeader title={username} onBack={onBack} />
      <div className="flex-1 overflow-y-auto scrollbar-none p-4">
        <div className="rounded-3xl p-5 mb-3 text-center" style={{ background: th.cardBg }}>
          <div className="w-20 h-20 rounded-3xl mx-auto flex items-center justify-center text-4xl mb-3 overflow-hidden" style={{ background: th.lightBg }}>
            {profile?.avatar && String(profile.avatar).startsWith('http') ? <img src={String(profile.avatar)} alt="" className="w-full h-full object-cover" /> : (avatar)}
          </div>
          <p className="text-base font-bold" style={{ color: th.inkText }}>{profile?.displayName || name}</p>
          <p className="text-xs mb-1" style={{ color: SAGE }}>@{peer}</p>
          {profile?.bio && <p className="text-[10px] mb-2" style={{ color: OLIVE }}>{profile.bio}</p>}
          {profile?.gear && <p className="text-[10px] mb-2" style={{ color: SAGE }}>{profile.gear}</p>}
          {profile?.links && <p className="text-[10px] mb-3" style={{ color: ACCENT }}>{profile.links}</p>}
          <div className="flex gap-2">
            <button onClick={() => void toggleFollow()} className="flex-1 py-2.5 rounded-2xl text-xs font-semibold text-white flex items-center justify-center gap-1.5" style={{ background: ACCENT }}><UserPlus size={13} />{isFollowed ? 'Вы подписаны' : 'Подписаться'}</button>
            <button className="flex-1 py-2.5 rounded-2xl text-xs font-semibold" style={{ background: th.lightBg, color: OLIVE }} onClick={() => push({ type: 'conversation', name, avatar, peer })}>Написать</button>
          </div>
        </div>
        {shown.length > 0 && (
          <div className="relative h-36 rounded-3xl overflow-hidden mb-3">
            <SoundMap sounds={shown} activeId={null} onSelect={(s) => push({ type: 'sound-detail', sound: s })} />
          </div>
        )}
        {shown.map((item) => (
          <button key={String(item.id)} onClick={() => push({ type: 'sound-detail', sound: item })} className="w-full rounded-3xl p-3 mb-2 flex items-center gap-2.5 text-left" style={{ background: th.cardBg }}>
            <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: pinColor[String(item.type)] || ACCENT }} onClick={(e) => { e.stopPropagation(); togglePlay(item); }}>
              <PlayPauseIcon playing={playing && String(playingId) === String(item.id)} size={12} />
            </span>
            <span className="flex-1 min-w-0"><span className="block text-xs font-bold truncate" style={{ color: th.inkText }}>{item.title}</span>
              <span className="block text-[10px]" style={{ color: OLIVE }}>{item.location}</span></span>
          </button>
        ))}
        {!shown.length && <p className="text-xs" style={{ color: SAGE }}>Нет опубликованных записей</p>}
      </div>
    </div>
  );
}


function SettingsScreen({ onBack }: { onBack: () => void }) {
  const th = useTh();
  const desktop = useIsDesktop();
  const toggle = useToggleTheme();
  const dark = useIsDark();
  const { logout, isStaff } = useAuth();
  const { push, reset } = useNav();
  const { toast } = useUi();
  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      {!desktop && <ScreenHeader title="Настройки" onBack={onBack} />}
      <div className={`flex-1 overflow-y-auto scrollbar-none flex flex-col gap-2 ${desktop ? 'p-6' : 'p-4'}`}>
        {desktop && <p className="text-lg font-bold mb-2" style={{ color: th.inkText }}>Настройки</p>}
        <Row label="Тёмная тема" right={<button onClick={toggle}>{dark ? <Moon size={16} /> : <Sun size={16} />}</button>} th={th} />
        <Row label="Уведомления" right={<Volume2 size={16} color={OLIVE} />} th={th} />
        <Row label="Cookies и согласие" right={<Info size={16} color={OLIVE} />} th={th} onClick={() => openCookieBanner()} />
        <Row label="Помощь и поддержка" th={th} onClick={() => push({ type: 'help' })} />
        <Row label="Политика конфиденциальности" th={th} onClick={() => push({ type: 'legal', doc: 'privacy' })} />
        <Row label="Условия использования" th={th} onClick={() => push({ type: 'legal', doc: 'terms' })} />
        <Row label="Правила публикации" th={th} onClick={() => push({ type: 'legal', doc: 'publish' })} />
        {isStaff && <Row label="Модерация" th={th} onClick={() => push({ type: 'staff' })} />}
        <motion.button whileTap={{ scale: 0.96 }} className="mt-4 w-full py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 text-white" style={{ background: DARK }}
          onClick={async () => { await logout(); reset(); toast('Вы вышли'); }}>
          <LogOut size={15} />Выйти
        </motion.button>
      </div>
    </div>
  );
}

function Row({ label, right, th, onClick }: { label: string; right?: ReactNode; th: { cardBg: string; inkText: string }; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-left" style={{ background: th.cardBg }}>
      <span className="text-xs font-semibold" style={{ color: th.inkText }}>{label}</span>
      {right}
    </button>
  );
}

function EventsScreen({ onBack, focusId }: { onBack: () => void; focusId?: string }) {
  const { events, reload } = useData();
  const th = useTh();
  const { isLoggedIn, user } = useAuth();
  const { toast } = useUi();
  const { push } = useNav();
  const list = events.length ? events : [
    { title: 'Звуковой воркшоп', loc: 'Ростов', date: 'скоро', time: '', n: 0, emoji: '🎙️', tag: 'Воркшоп' },
  ];
  const signup = async (ev: typeof list[number], i: number) => {
    if (!isLoggedIn || !user) { push({ type: 'auth' }); return; }
    const guard = spamGuardCheck('comment');
    if (!guard.ok) { toast(spamGuardMessage(guard)); return; }
    const id = String(ev.id || `e${i}`);
    const attendees = Array.isArray(ev.attendees) ? ev.attendees.map(String) : [];
    if (attendees.includes(user.loginName)) { toast('Вы уже записаны'); return; }
    if (!events.length) { toast('События ещё не опубликованы'); return; }
    const patched = {
      ...ev,
      id: ev.id || id,
      attendees: [...attendees, user.loginName],
      n: (Number(ev.n) || attendees.length) + 1,
      updatedAt: new Date().toISOString(),
    };
    try {
      await apiSyncJson('events.json', [patched]);
      toast('Заявка отправлена');
      await reload();
    } catch (e: unknown) {
      toast((e as Error).message || 'Не удалось записаться');
    }
  };
  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      <ScreenHeader title="События" onBack={onBack} />
      <div className="flex-1 overflow-y-auto scrollbar-none p-4 flex flex-col gap-3">
        {list.map((ev, i) => (
          <div key={String(ev.id || i)} className="rounded-3xl p-4" style={{ background: th.cardBg, outline: focusId && String(ev.id || `e${i}`) === focusId ? `2px solid ${ACCENT}` : undefined }}>
            <p className="text-[10px] uppercase" style={{ color: SAGE }}>{String(ev.tag || ev.status || 'Событие')}</p>
            <p className="text-sm font-bold" style={{ color: th.inkText }}>{ev.title}</p>
            <p className="text-[10px] mb-3" style={{ color: OLIVE }}>{String(ev.loc || ev.location || '')} · {String(ev.date || '')} {String(ev.time || '')}</p>
            <button className="w-full py-2 rounded-2xl text-xs font-semibold text-white" style={{ background: ACCENT }}
              onClick={() => void signup(ev, i)}>Записаться</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AuthScreen({ onBack }: { onBack: () => void }) {
  const th = useTh();
  const desktop = useIsDesktop();
  const { login, register } = useAuth();
  const { toast } = useUi();
  const { push, pop } = useNav();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [loginName, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [totp, setTotp] = useState('');
  const [needTotp, setNeedTotp] = useState(false);
  const [totpError, setTotpError] = useState(false);
  const [pdConsent, setPdConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (totpCode?: string) => {
    setBusy(true);
    setTotpError(false);
    try {
      const code = (totpCode ?? totp).trim();
      if (mode === 'up') await register(loginName.trim(), password, name.trim() || loginName.trim(), pdConsent);
      else await login(loginName.trim(), password, code || undefined);
      toast('Добро пожаловать');
      pop();
    } catch (e: unknown) {
      const err = e as ApiError;
      if (err.code === 'totp_required') {
        setNeedTotp(true);
        toast('Введите код из приложения-аутентификатора');
      } else if (err.code === 'consent') {
        openCookieBanner();
        toast(err.message || 'Нужно принять cookies сессии');
      } else if (err.code === 'pd_consent') {
        toast('Нужно согласие на обработку персональных данных');
      } else if (err.code === 'bad_totp') {
        setTotpError(true);
        setTotp('');
        toast('Неверный код 2FA');
      } else {
        toast(err.message || 'Ошибка входа');
      }
    } finally { setBusy(false); }
  };
  const form = (
    <>
      <div className="flex gap-1 p-1 rounded-2xl" style={{ background: th.lightBg }}>
        {(['in', 'up'] as const).map((m) => (
          <button key={m} onClick={() => { setMode(m); setNeedTotp(false); setTotp(''); setTotpError(false); }} className="flex-1 py-2 rounded-xl text-xs font-semibold" style={{ background: mode === m ? th.cardBg : 'transparent', color: mode === m ? ACCENT : OLIVE }}>
            {m === 'in' ? 'Вход' : 'Регистрация'}
          </button>
        ))}
      </div>
      {mode === 'up' && <Field label="Имя" value={name} onChange={setName} th={th} />}
      <Field label="Логин" value={loginName} onChange={setLogin} th={th} />
      <Field label="Пароль" value={password} onChange={setPassword} th={th} password />
      {mode === 'in' && needTotp && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-3xl p-4" style={{ background: th.cardBg }}>
          <p className="text-xs font-bold mb-1" style={{ color: th.inkText }}>Код из приложения</p>
          <p className="text-[10px] mb-3" style={{ color: SAGE }}>Шесть цифр из Google Authenticator, Яндекс Ключ или другого приложения</p>
          <OtpInput value={totp} error={totpError} autoFocus disabled={busy}
            onChange={(v) => { setTotp(v); setTotpError(false); }}
            onComplete={(code) => { if (!busy) void submit(code); }} />
        </motion.div>
      )}
      {mode === 'up' && (
        <label className="flex items-start gap-2 text-[10px]" style={{ color: OLIVE }}>
          <input type="checkbox" checked={pdConsent} onChange={(e) => setPdConsent(e.target.checked)} className="mt-0.5" />
          <span>Соглашаюсь на обработку персональных данных. <button type="button" className="underline" onClick={() => push({ type: 'legal', doc: 'privacy' })}>Политика</button> и <button type="button" className="underline" onClick={() => push({ type: 'legal', doc: 'terms' })}>условия</button>.</span>
        </label>
      )}
      <button disabled={busy} onClick={() => void submit()} className="w-full py-3.5 rounded-2xl text-white text-sm font-bold" style={{ background: ACCENT }}>{busy ? '…' : mode === 'in' ? 'Войти' : 'Создать аккаунт'}</button>
      {mode === 'in' && <button className="text-xs" style={{ color: SAGE }} onClick={() => push({ type: 'reset-password' })}>Забыли пароль?</button>}
      <p className="text-[10px]" style={{ color: SAGE }}>Для входа нужно принять cookies сессии.</p>
    </>
  );
  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      <ScreenHeader title={mode === 'in' ? 'Вход' : 'Регистрация'} onBack={onBack} />
      {desktop ? (
        <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center px-8 pb-16">
          <div className="w-24 h-24 rounded-[28px] overflow-hidden shadow-xl mb-5"><LogoApp /></div>
          <h2 className="text-2xl font-bold mb-6" style={{ color: th.inkText, fontFamily: 'Klukva, "Geist Variable", serif' }}>
            {mode === 'in' ? 'С возвращением' : 'Новый исследователь'}
          </h2>
          <div className="w-full max-w-[400px] flex flex-col gap-3">{form}</div>
        </div>
      ) : (
        <div className="p-5 flex flex-col gap-3">{form}</div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, th, password, inputMode, readOnly }: { label: string; value: string; onChange: (v: string) => void; th: { cardBg: string; inkText: string }; password?: boolean; inputMode?: 'numeric' | 'email' | 'text'; readOnly?: boolean }) {
  return (
    <label className="text-[10px] font-semibold" style={{ color: SAGE }}>
      {label}
      <input type={password ? 'password' : 'text'} inputMode={inputMode} readOnly={readOnly} value={value} onChange={(e) => onChange(e.target.value)}
        className={`mt-1 w-full rounded-2xl px-3 py-3 text-sm outline-none ${readOnly ? 'opacity-80' : ''}`} style={{ background: th.cardBg, color: th.inkText }} />
    </label>
  );
}

function ResetPasswordScreen({ onBack }: { onBack: () => void }) {
  const th = useTh();
  const desktop = useIsDesktop();
  const { toast } = useUi();
  const [loginOrEmail, setL] = useState('');
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const fields = (
    <>
      <Field label="Логин или email" value={loginOrEmail} onChange={setL} th={th} />
      <button className="py-3 rounded-2xl text-xs font-semibold text-white" style={{ background: DARK }} onClick={async () => {
        try { await apiRequestPasswordReset(loginOrEmail); toast('Если аккаунт есть, код отправлен'); } catch (e: unknown) { toast((e as Error).message); }
      }}>Отправить код</button>
      <Field label="Код" value={code} onChange={setCode} th={th} />
      <Field label="Новый пароль" value={pw} onChange={setPw} th={th} password />
      <button className="py-3 rounded-2xl text-xs font-semibold text-white" style={{ background: ACCENT }} onClick={async () => {
        try { await apiConfirmPasswordReset(loginOrEmail, code, pw); toast('Пароль обновлён'); onBack(); } catch (e: unknown) { toast((e as Error).message); }
      }}>Сохранить пароль</button>
    </>
  );
  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      <ScreenHeader title="Сброс пароля" onBack={onBack} />
      {desktop ? (
        <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center px-8 pb-16">
          <div className="w-full max-w-[400px] flex flex-col gap-3">{fields}</div>
        </div>
      ) : (
        <div className="p-5 flex flex-col gap-3">{fields}</div>
      )}
    </div>
  );
}

function RecordScreen({ onBack }: { onBack: () => void }) {
  const th = useTh();
  const desktop = useIsDesktop();
  const { toast } = useUi();
  const { reset } = useNav();
  const [stage, setStage] = useState<'idle' | 'rec' | 'review'>('idle');
  const [sec, setSec] = useState(0);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [draft, setDraft] = useState<{ blob: Blob; durationSec: number; mime: string; trimStart: number; trimEnd: number; gain: number; timeMarkers: TimeMarker[] } | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const started = useRef(0);
  const commit = useRef(false);

  useEffect(() => {
    if (stage !== 'rec') return;
    const t = setInterval(() => setSec(Math.max(0, Math.round((Date.now() - started.current) / 1000))), 250);
    return () => clearInterval(t);
  }, [stage]);

  useEffect(() => () => {
    recRef.current?.stop();
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    void ctxRef.current?.close();
  }, []);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      streamRef.current = stream;
      chunks.current = [];
      commit.current = false;
      const ctx = new AudioContext();
      if (ctx.state === 'suspended') await ctx.resume();
      const source = ctx.createMediaStreamSource(stream);
      const node = ctx.createAnalyser();
      node.fftSize = 1024;
      node.smoothingTimeConstant = 0.45;
      const dest = ctx.createMediaStreamDestination();
      source.connect(node);
      source.connect(dest);
      ctxRef.current = ctx;
      setAnalyser(node);
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
      const mr = new MediaRecorder(dest.stream, { mimeType: mime });
      mr.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      mr.start(120);
      recRef.current = mr;
      started.current = Date.now();
      setSec(0);
      setStage('rec');
    } catch {
      toast('Нет доступа к микрофону');
    }
  };

  const stop = () => {
    const mr = recRef.current;
    if (!mr) { setStage('idle'); return; }
    commit.current = true;
    mr.onstop = () => {
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      void ctxRef.current?.close();
      ctxRef.current = null;
      setAnalyser(null);
      const mime = mr.mimeType || 'audio/webm';
      const blob = new Blob(chunks.current, { type: mime });
      if (!commit.current) { setStage('idle'); return; }
      if (!blob.size) {
        toast('Пустая запись — попробуйте ещё раз');
        setStage('idle');
        return;
      }
      const durationSec = Math.max(1, Math.round((Date.now() - started.current) / 1000));
      setDraft({ blob, durationSec, mime, trimStart: 0, trimEnd: 1, gain: 1, timeMarkers: [] });
      setStage('review');
    };
    if (mr.state === 'recording') {
      try { mr.requestData(); } catch { /* */ }
      mr.stop();
    } else if (mr.state !== 'inactive') {
      mr.stop();
    }
    recRef.current = null;
  };

  const toPublish = () => {
    if (!draft) return;
    setDraftRecording(draft);
    toast('Черновик сохранён — оформите публикацию');
    reset({ type: 'add-sound' });
  };

  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      {!desktop && <ScreenHeader title="Запись" onBack={onBack} />}
      {stage !== 'review' && (
        <div className="flex-1 flex flex-col px-6 py-6 min-h-0">
          <div className={desktop ? 'mb-5' : 'mb-4'}>
            <p className="text-lg font-bold" style={{ color: th.inkText }}>{stage === 'rec' ? 'Идёт запись' : 'Записать звук'}</p>
            <p className="text-[12px] mt-1 leading-relaxed" style={{ color: OLIVE }}>
              {stage === 'rec' ? 'Говорите или ловите фон. Остановите, когда хватит материала.' : 'Разрешите микрофон. После остановки можно обрезать и послушать перед оформлением.'}
            </p>
          </div>
          <div className="flex-1 min-h-0 rounded-[24px] p-5 flex flex-col items-center justify-center gap-5" style={{ background: th.cardBg }}>
            <p className="text-[40px] font-bold tabular-nums leading-none" style={{ color: th.inkText }}>{formatClock(sec)}</p>
            <div className="w-full max-w-lg rounded-2xl px-3 py-3" style={{ background: th.phoneBg }}>
              <LiveWaveform analyser={analyser} color={stage === 'rec' ? ACCENT : SAGE} h={72} />
            </div>
            <motion.button whileTap={{ scale: 0.96 }} onClick={() => { if (stage === 'rec') stop(); else void start(); }}
              className="w-[72px] h-[72px] rounded-full flex items-center justify-center shadow-[0_8px_24px_rgba(181,97,63,0.28)]"
              style={{ background: stage === 'rec' ? ACCENT : DARK }}
              aria-label={stage === 'rec' ? 'Остановить' : 'Начать запись'}>
              {stage === 'rec' ? <span className="w-5 h-5 rounded-md bg-white" /> : <Mic size={26} color="white" />}
            </motion.button>
            <p className="text-[12px] font-semibold" style={{ color: SAGE }}>{stage === 'rec' ? 'Остановить' : 'Начать запись'}</p>
          </div>
        </div>
      )}
      {stage === 'review' && draft && (
        <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-4">
          <div>
            <p className="text-lg font-bold" style={{ color: th.inkText }}>Прослушайте и обрежьте</p>
            <p className="text-[12px] mt-1" style={{ color: OLIVE }}>Тяните ручки на волне, поставьте метки и проверьте громкость перед оформлением.</p>
          </div>
          <AudioEditor blob={draft.blob} durationSec={draft.durationSec}
            trimStart={draft.trimStart} trimEnd={draft.trimEnd} gain={draft.gain}
            markers={draft.timeMarkers}
            onMarkers={(timeMarkers) => setDraft({ ...draft, timeMarkers })}
            onChange={(next) => setDraft({ ...draft, ...next })} />
          <div className="flex gap-2">
            <button type="button" className="flex-1 py-3 rounded-2xl text-sm font-semibold" style={{ background: th.lightBg, color: OLIVE }}
              onClick={() => { setDraft(null); setStage('idle'); setSec(0); }}>Записать снова</button>
            <button type="button" className="flex-[1.4] py-3.5 rounded-2xl text-sm font-bold text-white" style={{ background: ACCENT }}
              onClick={toPublish}>К оформлению</button>
          </div>
        </div>
      )}
    </div>
  );
}


function MessagesScreen({ onBack }: { onBack: () => void }) {
  const th = useTh();
  const desktop = useIsDesktop();
  const { push } = useNav();
  const { profiles, mail } = useData();
  const { user, isLoggedIn } = useAuth();
  const peers = isLoggedIn && user ? conversationPeers(mail, user.loginName, profiles) : [];
  const letter = (name: string) => (name.trim()[0] || '?').toUpperCase();
  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      {!desktop && <ScreenHeader title="Сообщения" onBack={onBack} />}
      <div className={`flex-1 overflow-y-auto ${desktop ? 'px-6 pt-6 pb-4' : 'p-4'}`}>
        {desktop && (
          <div className="mb-5">
            <p className="text-lg font-bold" style={{ color: th.inkText }}>Сообщения</p>
            <p className="text-[12px] mt-1" style={{ color: OLIVE }}>Переписка с исследователями и поддержкой</p>
          </div>
        )}
        {!isLoggedIn && (
          <div className="rounded-[24px] p-8 text-center" style={{ background: th.cardBg }}>
            <MessageCircle size={28} color={SAGE} className="mx-auto mb-3" />
            <p className="text-sm font-semibold" style={{ color: th.inkText }}>Войдите, чтобы писать</p>
            <p className="text-[12px] mt-1" style={{ color: SAGE }}>Диалоги появятся здесь после входа</p>
            <button type="button" className="mt-4 h-10 px-5 rounded-full text-[13px] font-bold text-white" style={{ background: ACCENT }}
              onClick={() => push({ type: 'auth' })}>Войти</button>
          </div>
        )}
        {isLoggedIn && peers.length === 0 && (
          <div className="rounded-[24px] p-8 text-center" style={{ background: th.cardBg }}>
            <MessageCircle size={28} color={SAGE} className="mx-auto mb-3" />
            <p className="text-sm font-semibold" style={{ color: th.inkText }}>Пока нет диалогов</p>
            <p className="text-[12px] mt-1" style={{ color: SAGE }}>Напишите человеку из карточки звука или откройте поддержку</p>
          </div>
        )}
        {peers.map((p) => (
          <button key={p.login} onClick={() => push({ type: 'conversation', name: p.name, avatar: '👤', peer: p.login })}
            className="w-full flex items-center gap-3 p-3.5 rounded-[20px] mb-2 text-left" style={{ background: th.cardBg }}>
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-sm font-bold" style={{ background: th.lightBg, color: OLIVE }}>{letter(p.name)}</div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold" style={{ color: th.inkText }}>{p.name}</p>
              <p className="text-[11px] truncate mt-0.5" style={{ color: SAGE }}>{p.lastText || 'Написать'}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ConversationScreen({ name, peer, onBack }: { name: string; avatar: string; peer: string; onBack: () => void }) {
  const th = useTh();
  const { user, isLoggedIn } = useAuth();
  const { mail, reloadMail } = useData();
  const { toast } = useUi();
  const { push } = useNav();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const msgs = user ? threadWith(mail, user.loginName, peer) : [];
  const send = async () => {
    const t = text.trim();
    if (!t || !user) return;
    if (!isLoggedIn) { push({ type: 'auth' }); return; }
    const guard = spamGuardCheck('comment');
    if (!guard.ok) { toast(spamGuardMessage(guard)); return; }
    setBusy(true);
    try {
      const msg = makeMailMsg(user.loginName, user.displayName || user.username, t);
      const notif = { id: `n${Date.now()}`, type: 'message', text: `${user.username} написал(а) вам`, fromId: user.loginName, fromName: user.username, date: msg.date, read: false };
      const next = upsertInboxPatch(mail, peer, msg, peer === SUPPORT_LOGIN ? undefined : notif);
      await apiSyncJson('mail.json', next);
      setText('');
      await reloadMail();
    } catch (e: unknown) {
      toast((e as Error).message || 'Не удалось отправить');
    } finally { setBusy(false); }
  };
  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      <ScreenHeader title={name} onBack={onBack} />
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
        {msgs.length === 0 && <p className="text-[10px]" style={{ color: SAGE }}>Начните переписку</p>}
        {msgs.map((m) => (
          <div key={m.id} className={`max-w-[80%] px-3 py-2 rounded-2xl text-xs ${m.mine ? 'self-end text-white' : 'self-start'}`}
            style={{ background: m.mine ? ACCENT : th.cardBg, color: m.mine ? '#fff' : th.inkText }}>{m.text}</div>
        ))}
      </div>
      <div className="p-3 flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} className="flex-1 rounded-2xl px-3 py-2 text-xs outline-none" style={{ background: th.cardBg, color: th.inkText }} />
        <button disabled={busy} onClick={() => void send()} className="w-10 h-10 rounded-2xl text-white flex items-center justify-center" style={{ background: ACCENT }}><Send size={14} /></button>
      </div>
    </div>
  );
}

function NotificationsScreen({ onBack }: { onBack: () => void }) {
  const th = useTh();
  const { mail } = useData();
  const { user } = useAuth();
  const box = mail.find((b) => b.loginName === user?.loginName);
  const list = (box?.notifications || []) as Array<{ fromName?: string; fromId?: string; text?: string; date?: string }>;
  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      <ScreenHeader title="Уведомления" onBack={onBack} />
      <div className="p-4 flex flex-col gap-2">
        {list.length === 0 && <p className="text-xs" style={{ color: SAGE }}>Пока тихо</p>}
        {list.map((n, i) => (
          <div key={i} className="rounded-2xl p-3" style={{ background: th.cardBg }}>
            <p className="text-xs font-semibold" style={{ color: th.inkText }}>{n.fromName || n.fromId}</p>
            <p className="text-[10px]" style={{ color: OLIVE }}>{n.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SearchScreen({ onBack }: { onBack: () => void }) {
  const th = useTh();
  const { sounds } = useData();
  const { push } = useNav();
  const [q, setQ] = useState('');
  const found = sounds.filter((s) => `${s.title} ${s.location} ${s.user}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      <ScreenHeader title="Поиск" onBack={onBack} />
      <div className="p-4">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Название, место, автор" className="w-full rounded-2xl px-3 py-3 text-sm outline-none mb-3" style={{ background: th.cardBg, color: th.inkText }} />
        {found.map((s) => (
          <button key={String(s.id)} onClick={() => push({ type: 'sound-detail', sound: s })} className="w-full text-left rounded-2xl p-3 mb-2" style={{ background: th.cardBg }}>
            <p className="text-xs font-bold" style={{ color: th.inkText }}>{s.title}</p>
            <p className="text-[10px]" style={{ color: SAGE }}>{s.location}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function EditProfileScreen({ onBack }: { onBack: () => void }) {
  const th = useTh();
  const { user, patchUser } = useAuth();
  const { profiles, reload } = useData();
  const { toast } = useUi();
  const [name, setName] = useState(user?.displayName || user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [gear, setGear] = useState('');
  const [links, setLinks] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const login = user.loginName;
      let avatarUrl = user.avatar;
      if (avatarFile) avatarUrl = await uploadUserMedia(avatarFile, avatarFile.name, avatarFile.type || 'image/jpeg');
      const next = [...profiles];
      const idx = next.findIndex((p) => String(p.loginName || '').toLowerCase() === login);
      const prev = idx >= 0 ? next[idx] : {};
      const record = {
        ...prev,
        loginName: login,
        displayName: name.trim() || login,
        bio: bio.trim(),
        gear: gear.trim(),
        links: links.trim(),
        avatar: avatarUrl,
        profileUpdatedAt: new Date().toISOString(),
      };
      if (idx >= 0) next[idx] = record; else next.push(record);
      await apiSyncJson('profiles.json', [record]);
      patchUser({ displayName: record.displayName, username: record.displayName, bio: record.bio, avatar: avatarUrl });
      toast('Профиль сохранён');
      await reload();
      onBack();
    } catch (e: unknown) {
      toast((e as Error).message || 'Не удалось сохранить');
    } finally { setBusy(false); }
  };
  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      <ScreenHeader title="Профиль" onBack={onBack} />
      <div className="p-5 flex flex-col gap-3">
        <label className="text-[10px] font-semibold" style={{ color: SAGE }}>Аватар
          <input type="file" accept="image/*" className="mt-1 block w-full text-[11px]" onChange={(e) => setAvatarFile(e.target.files?.[0] || null)} />
        </label>
        <Field label="Имя" value={name} onChange={setName} th={th} />
        <Field label="О себе" value={bio} onChange={setBio} th={th} />
        <Field label="Техника" value={gear} onChange={setGear} th={th} />
        <Field label="Ссылки" value={links} onChange={setLinks} th={th} />
        <button disabled={busy} className="py-3 rounded-2xl text-sm font-bold text-white" style={{ background: ACCENT }} onClick={() => void save()}>
          {busy ? 'Сохранение…' : 'Сохранить'}
        </button>
      </div>
    </div>
  );
}

function MapLocationScreen({ sound, onBack }: { sound: Sound; onBack: () => void }) {
  const th = useTh();
  const { togglePlay, playing, playingId, progress, seek, volume, muted, setVolume, toggleMute } = useData();
  const route = soundRoute(sound);
  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      <ScreenHeader title={sound.title} onBack={onBack} />
      <div className="flex-1 min-h-0 mx-3 mb-2 rounded-[24px] overflow-hidden">
        <div className="relative h-full">
          <SoundMap sounds={[sound]} activeId={sound.id} onSelect={() => {}} route={route} nativeZoom={false} />
        </div>
      </div>
      <div className="flex-shrink-0 mx-3 mb-3 rounded-3xl overflow-hidden" style={{ background: th.cardBg }}>
        <PinPlayer sound={sound} onClose={onBack} simple playing={playing && String(playingId) === String(sound.id)} onToggle={() => togglePlay(sound)} progress={progress}
          onSeek={seek} volume={volume} muted={muted} onVolume={setVolume} onMute={toggleMute} />
      </div>
    </div>
  );
}


function HelpScreen({ onBack }: { onBack: () => void }) {
  const th = useTh();
  const desktop = useIsDesktop();
  const { push } = useNav();
  const { user, isLoggedIn } = useAuth();
  const { mail, reloadMail } = useData();
  const { toast } = useUi();
  const [q, setQ] = useState('');
  const [log, setLog] = useState<{ from: 'me' | 'bot'; text: string }[]>([{ from: 'bot', text: 'Поддержка Полёвки. Спросите про публикацию, аккаунт или карту — или напишите «обращение», если нужен человек.' }]);
  const sendText = async (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    setQ('');
    const faq = matchSupportBotFaq(t);
    const isTicket = /обращен/i.test(t);
    const ticketNumber = isTicket ? Math.floor(1000 + Math.random() * 9000) : undefined;
    const reply = isTicket
      ? `Создано обращение №${ticketNumber}. Модератор ответит в этом чате.`
      : (faq?.answer || 'Не нашёл в FAQ. Напишите «обращение», создадим тикет.');
    setLog((l) => [...l, { from: 'me', text: t }, { from: 'bot', text: reply }]);
    if (faq && 'openLegal' in faq && faq.openLegal) push({ type: 'legal', doc: faq.openLegal });
    if (isLoggedIn && user) {
      try {
        const msg = makeMailMsg(user.loginName, user.displayName || user.username, isTicket ? `Обращение: ${t}` : t, ticketNumber ? { ticketNumber, _ticket: true } : {});
        await apiSyncJson('mail.json', upsertInboxPatch(mail, SUPPORT_LOGIN, msg));
        await reloadMail();
      } catch (e: unknown) {
        toast((e as Error).message || 'Не удалось сохранить обращение');
      }
    } else if (isTicket) {
      toast('Войдите, чтобы обращение получило номер у модераторов');
      push({ type: 'auth' });
    }
  };
  const send = () => void sendText(q);
  const faqs = [
    { label: 'Как добавить звук?', text: 'Как опубликовать запись?' },
    { label: 'Модерация', text: 'Почему запись на модерации?' },
    { label: 'Аккаунт', text: 'Как войти и восстановить пароль?' },
    { label: 'Обращение', text: 'обращение' },
  ];
  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      {!desktop && <ScreenHeader title="Поддержка Полёвки" onBack={onBack} />}
      <div className={`flex-1 overflow-y-auto flex flex-col gap-3 ${desktop ? 'px-6 pt-6' : 'p-4'}`}>
        {desktop && (
          <div>
            <p className="text-lg font-bold" style={{ color: th.inkText }}>Поддержка Полёвки</p>
            <p className="text-[12px] mt-1 leading-relaxed" style={{ color: OLIVE }}>
              Карта полевых записей: слушайте точки, добавляйте свои звуки, создавайте экспедиции. Здесь — ответы и чат с поддержкой.
            </p>
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          {faqs.map((f) => (
            <button key={f.label} type="button" onClick={() => void sendText(f.text)}
              className="px-3 py-1.5 rounded-full text-[11px] font-semibold" style={{ background: th.cardBg, color: OLIVE }}>{f.label}</button>
          ))}
        </div>
        <div className="flex-1 min-h-[180px] flex flex-col gap-2">
          {log.map((m, i) => (
            <div key={i} className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-snug ${m.from === 'me' ? 'self-end text-white' : 'self-start'}`}
              style={{ background: m.from === 'me' ? ACCENT : th.cardBg, color: m.from === 'me' ? '#fff' : th.inkText }}>{m.text}</div>
          ))}
        </div>
        <div className="flex gap-2 pb-1">
          <button className="text-[11px] font-semibold" style={{ color: SAGE }} onClick={() => push({ type: 'guessr' })}>Аудио-угадайка</button>
          <button className="text-[11px] font-semibold" style={{ color: SAGE }} onClick={() => push({ type: 'conversation', name: SUPPORT_NAME, avatar: '🛟', peer: SUPPORT_LOGIN })}>Чат с человеком</button>
        </div>
      </div>
      <div className="p-4 flex gap-2" style={{ borderTop: `1px solid ${th.border}` }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Вопрос или «обращение»" className="flex-1 rounded-2xl px-3.5 py-2.5 text-[13px] outline-none" style={{ background: th.cardBg, color: th.inkText }} />
        <button onClick={send} className="w-11 h-11 rounded-2xl text-white flex items-center justify-center" style={{ background: ACCENT }} aria-label="Отправить"><Send size={15} /></button>
      </div>
    </div>
  );
}

function LegalScreen({ doc, onBack }: { doc: 'privacy' | 'terms' | 'publish'; onBack: () => void }) {
  const th = useTh();
  const { toast } = useUi();
  const title = doc === 'publish' ? 'Правила публикации' : (LEGAL_DOCS[doc]?.title || 'Документ');
  const sections = doc === 'publish'
    ? PUBLISH_RULE_SECTIONS
    : (LEGAL_DOCS[doc]?.sections || []);
  const print = () => {
    if (!downloadLegalPrint(doc)) toast('Разрешите всплывающие окна для печати PDF');
  };
  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      <ScreenHeader title={title} onBack={onBack} right={<button className="text-[10px] font-semibold" style={{ color: ACCENT }} onClick={print}>Скачать PDF</button>} />
      <div className="flex-1 overflow-y-auto p-4 text-xs leading-relaxed" style={{ color: OLIVE }}>
        {sections.map((sec: { title: string; intro?: string; items?: Array<{ title: string; body: string }> }) => (
          <div key={sec.title} className="mb-4">
            <p className="font-bold mb-2" style={{ color: th.inkText }}>{sec.title}</p>
            {sec.intro && <p className="mb-2 italic">{sec.intro}</p>}
            {sec.items?.map((it) => (
              <p key={it.title} className="mb-2"><strong>{it.title}.</strong> {it.body}</p>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function CabinetScreen({ onBack }: { onBack: () => void }) {
  const th = useTh();
  const { user, refreshUser, logout, isStaff } = useAuth();
  const { push, reset } = useNav();
  const { toast, confirm } = useUi();
  const verified = !!(user?.email && user.emailVerified);
  const [email, setEmail] = useState(user?.email || '');
  const [code, setCode] = useState('');
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [otpauthUrl, setOtpauthUrl] = useState('');
  const [totpConfirm, setTotpConfirm] = useState('');
  const [disPw, setDisPw] = useState('');
  const [disCode, setDisCode] = useState('');
  const [events, setEvents] = useState<Array<{ type?: string; login?: string; at?: string }>>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setEmail(user?.email || '');
  }, [user?.email]);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    void apiGetSecurityEvents().then((d) => {
      const list = (d as { events?: Array<{ type?: string; login?: string; at?: string }> }).events || [];
      setEvents(list);
    }).catch(() => {});
  }, [user?.role]);

  const sendEmailCode = async () => {
    const next = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) { toast('Введите корректный email'); return; }
    if (verified && next.toLowerCase() === String(user?.email || '').toLowerCase()) {
      toast('Email уже подтверждён');
      return;
    }
    setBusy(true);
    try {
      const data = await apiRequestEmailVerification(next) as { alreadyVerified?: boolean };
      if (data.alreadyVerified) {
        await refreshUser();
        toast('Email уже подтверждён');
        return;
      }
      toast('Код отправлен на почту');
    } catch (e: unknown) {
      toast((e as Error).message || 'Не удалось отправить код');
    } finally { setBusy(false); }
  };

  const confirmEmail = async () => {
    if (!code.trim()) { toast('Введите код'); return; }
    setBusy(true);
    try {
      await apiConfirmEmailVerification(code.trim());
      setCode('');
      await refreshUser();
      toast('Email подтверждён');
    } catch (e: unknown) {
      toast((e as Error).message || 'Неверный код');
    } finally { setBusy(false); }
  };

  const changePw = async () => {
    if (newPw.length < 8) { toast('Новый пароль слишком короткий (мин. 8)'); return; }
    if (newPw !== newPw2) { toast('Новые пароли не совпадают'); return; }
    setBusy(true);
    try {
      await apiChangePassword(curPw, newPw);
      setCurPw(''); setNewPw(''); setNewPw2('');
      toast('Пароль обновлён. Другие устройства вышли из аккаунта.');
    } catch (e: unknown) {
      const err = e as ApiError;
      toast(err.code === 'bad_credentials' ? 'Текущий пароль неверен' : (err.message || 'Не удалось сменить пароль'));
    } finally { setBusy(false); }
  };

  const startTotp = async () => {
    setBusy(true);
    try {
      const data = await apiTotpSetup() as { secret?: string; otpauthUrl?: string };
      setTotpSecret(data.secret || '');
      setOtpauthUrl(data.otpauthUrl || '');
      toast('Секрет создан. Добавьте его в приложение и подтвердите кодом.');
    } catch (e: unknown) {
      const err = e as ApiError;
      toast(err.code === 'totp_already_enabled' ? '2FA уже включена' : (err.message || 'Не удалось начать настройку 2FA'));
    } finally { setBusy(false); }
  };

  const confirmTotp = async (code?: string) => {
    const otp = (code ?? totpConfirm).trim();
    if (!/^\d{6}$/.test(otp)) { toast('Введите 6-значный код'); return; }
    setBusy(true);
    try {
      await apiTotpConfirm(otp);
      setTotpConfirm(''); setTotpSecret(''); setOtpauthUrl('');
      await refreshUser();
      toast('Двухфакторная защита включена');
    } catch (e: unknown) {
      const err = e as ApiError;
      toast(err.code === 'bad_totp' ? 'Неверный код' : (err.message || 'Не удалось подтвердить 2FA'));
      setTotpConfirm('');
    } finally { setBusy(false); }
  };

  const disableTotp = async () => {
    if (!disPw) { toast('Введите пароль'); return; }
    if (!/^\d{6}$/.test(disCode.trim())) { toast('Введите код 2FA'); return; }
    setBusy(true);
    try {
      await apiTotpDisable(disPw, disCode.trim());
      setDisPw(''); setDisCode('');
      await refreshUser();
      toast('2FA отключена');
    } catch (e: unknown) {
      const err = e as ApiError;
      if (err.code === 'bad_credentials') toast('Неверный пароль');
      else if (err.code === 'bad_totp') toast('Неверный код 2FA');
      else if (err.code === 'totp_required_staff') toast('Staff не может отключить 2FA');
      else toast(err.message || 'Не удалось отключить 2FA');
    } finally { setBusy(false); }
  };

  const logoutEverywhere = async () => {
    const ok = await confirm({ title: 'Выйти везде?', body: 'Все сессии на других устройствах будут завершены.', ok: 'Выйти везде' });
    if (!ok) return;
    try { await apiLogoutAll(); } catch { /* still clear local */ }
    await logout();
    reset();
    toast('Все сессии завершены');
  };

  const totpOn = !!user?.totpEnabled;
  const totpStatus = totpOn
    ? (isStaff ? '2FA включена (обязательна для staff)' : '2FA включена')
    : (isStaff ? '2FA выключена — обязательно для admin / moderator' : '2FA выключена');

  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      <ScreenHeader title="Кабинет" onBack={onBack} />
      <div className="flex-1 overflow-y-auto scrollbar-none p-4 flex flex-col gap-3">
        <div className="rounded-3xl p-4" style={{ background: th.cardBg }}>
          <p className="text-xs font-bold mb-2" style={{ color: th.inkText }}>Email</p>
          <p className="text-[10px] mb-2 font-semibold" style={{ color: verified ? ACCENT : SAGE }}>
            {verified ? 'Подтверждена' : 'Не подтверждена'}
          </p>
          <Field label="Адрес" value={email} onChange={setEmail} th={th} inputMode="email" readOnly={verified} />
          {!verified && (
            <>
              <button disabled={busy} onClick={() => void sendEmailCode()} className="mt-2 w-full py-2.5 rounded-2xl text-xs font-semibold text-white" style={{ background: DARK }}>Отправить код</button>
              <Field label="Код из письма" value={code} onChange={setCode} th={th} inputMode="numeric" />
              <button disabled={busy} onClick={() => void confirmEmail()} className="mt-2 w-full py-2.5 rounded-2xl text-xs font-semibold text-white" style={{ background: ACCENT }}>Подтвердить</button>
            </>
          )}
        </div>

        <div className="rounded-3xl p-4" style={{ background: th.cardBg }}>
          <p className="text-xs font-bold mb-2" style={{ color: th.inkText }}>Пароль</p>
          <Field label="Текущий" value={curPw} onChange={setCurPw} th={th} password />
          <Field label="Новый" value={newPw} onChange={setNewPw} th={th} password />
          <Field label="Повтор" value={newPw2} onChange={setNewPw2} th={th} password />
          <button disabled={busy} onClick={() => void changePw()} className="mt-2 w-full py-2.5 rounded-2xl text-xs font-semibold text-white" style={{ background: ACCENT }}>Сменить пароль</button>
        </div>

        <div className="rounded-3xl p-4" style={{ background: th.cardBg }}>
          <p className="text-xs font-bold mb-1" style={{ color: th.inkText }}>Двухфакторная защита</p>
          <p className="text-[10px] mb-3" style={{ color: SAGE }}>{totpStatus}</p>
          {!totpOn && (
            <>
              <button disabled={busy} onClick={() => void startTotp()} className="w-full py-2.5 rounded-2xl text-xs font-semibold text-white" style={{ background: DARK }}>Настроить 2FA</button>
              {totpSecret && (
                <div className="mt-3">
                  <p className="text-[10px] break-all mb-1" style={{ color: OLIVE }}>{totpSecret}</p>
                  {otpauthUrl && <a href={otpauthUrl} className="text-[10px] underline" style={{ color: ACCENT }}>Открыть в приложении-аутентификаторе</a>}
                  <OtpInput value={totpConfirm} autoFocus
                    onChange={setTotpConfirm}
                    onComplete={(code) => { setTotpConfirm(code); if (!busy) void confirmTotp(code); }} />
                  <button disabled={busy} onClick={() => void confirmTotp()} className="mt-3 w-full py-2.5 rounded-2xl text-xs font-semibold text-white" style={{ background: ACCENT }}>Включить 2FA</button>
                </div>
              )}
            </>
          )}
          {totpOn && !isStaff && (
            <>
              <Field label="Пароль" value={disPw} onChange={setDisPw} th={th} password />
              <div className="mt-2">
                <OtpInput value={disCode} onChange={setDisCode} />
              </div>
              <button disabled={busy} onClick={() => void disableTotp()} className="mt-3 w-full py-2.5 rounded-2xl text-xs font-semibold text-white" style={{ background: DARK }}>Отключить 2FA</button>
            </>
          )}
        </div>

        {user?.role === 'admin' && events.length > 0 && (
          <div className="rounded-3xl p-4" style={{ background: th.cardBg }}>
            <p className="text-xs font-bold mb-2" style={{ color: th.inkText }}>События безопасности</p>
            {events.slice(0, 12).map((ev, i) => (
              <p key={i} className="text-[10px] mb-1" style={{ color: OLIVE }}>{ev.type} · {ev.login} · {ev.at}</p>
            ))}
          </div>
        )}

        <Row label="Настройки приложения" th={th} onClick={() => push({ type: 'settings' })} />
        <Row label="Сообщения" th={th} onClick={() => push({ type: 'messages' })} />
        <Row label="Помощь" th={th} onClick={() => push({ type: 'help' })} />
        <button disabled={busy} onClick={() => void logoutEverywhere()} className="w-full py-3 rounded-2xl text-xs font-semibold text-white" style={{ background: DARK }}>Выйти на всех устройствах</button>
      </div>
    </div>
  );
}

function GuessrScreen({ onBack }: { onBack: () => void }) {
  const th = useTh();
  const { sounds, togglePlay } = useData();
  const [pick] = useState(() => sounds[Math.floor(Math.random() * Math.max(sounds.length, 1))]);
  const [msg, setMsg] = useState('');
  if (!pick) return <div className="p-4"><ScreenHeader title="Угадайка" onBack={onBack} /><p>Нет записей</p></div>;
  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      <ScreenHeader title="Угадайка" onBack={onBack} />
      <div className="p-5">
        <p className="text-xs mb-4" style={{ color: OLIVE }}>Послушайте звук и найдите его на карте.</p>
        <button className="w-full py-3 rounded-2xl text-white text-sm font-bold mb-3" style={{ background: ACCENT }} onClick={() => togglePlay(pick)}>Играть фрагмент</button>
        <div className="relative h-64 rounded-3xl overflow-hidden">
          <SoundMap sounds={sounds.slice(0, 12)} activeId={null} onSelect={(s) => setMsg(String(s.id) === String(pick.id) ? 'Верно!' : 'Мимо, попробуйте ещё')} />
        </div>
        {msg && <p className="text-sm font-bold mt-3" style={{ color: ACCENT }}>{msg}</p>}
      </div>
    </div>
  );
}
