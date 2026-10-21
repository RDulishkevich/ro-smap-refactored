import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import {
  Camera, ChevronRight, Download, Heart, Headphones, MapPin, MessageCircle,
  MoreHorizontal, Route, Search, Send, Share2, UserPlus,
} from 'lucide-react';
import { color, type ThemeTokens } from '@polevka/design';
import {
  apiChangeLogin, apiChangePassword, apiConfirmEmailVerification, apiConfirmPasswordReset,
  apiDeleteAccount, apiOauthUnlink,
  apiGetSecurityEvents, apiPatchSound, apiRequestEmailVerification, apiRequestPasswordReset,
  readLastLogin, hasCookieConsentForAuth,
  apiSyncJson, apiTotpConfirm, apiTotpDisable, apiTotpSetup, conversationPeers, makeMailMsg,
  matchSupportBotFaq,   normalizeComment, normalizeTimeMarkers, spamGuardCheck, spamGuardMessage, SUPPORT_AVATAR, SUPPORT_LOGIN,
  SUPPORT_NAME, uploadUserMedia, upsertInboxPatch, formatPlays,
  type ApiError, type Comment, type FeedPost, type Sound,
} from '@polevka/core';
import { LEGAL_DOCS } from '../../../../src/data/legalDocs.js';
import { PUBLISH_RULE_SECTIONS } from '../../../../src/data/publishRules.js';
import { useAuth } from '../state/AuthContext';
import { useNav, type ScreenConfig } from '../state/NavContext';
import { useTh } from '../state/ThemeContext';
import { useData } from '../state/DataContext';
import { useUi } from '../state/UiContext';
import { ListSkeleton, PinPlayer, ScreenHeader, SoundTypeTag, OtpInput } from '../primitives/ui';
import { EmptyNote } from '../primitives/EmptyNote';
import { SwipeRow } from '../primitives/SwipeRow';
import { FormField, FormNeed } from '../primitives/form';
import { PhotoCarousel } from '../primitives/PhotoCarousel';
import { HoverMenu } from '../primitives/HoverMenu';
import { SoundPlayerMenuButton, SoundPlayerSheet } from '../primitives/SoundPlayerSheet';
import { openCookieBanner } from '../primitives/CookieBanner';
import { SoundMap } from '../lib/SoundMap';
import { formatClock, parseDurationLabel } from '../lib/waveform';
import { useSoundMeta } from '../lib/audio-meta';
import { ConversationScreen } from './ConversationScreen';
import { DraftsScreen } from './DraftsScreen';
import { RecordScreen } from './RecordScreen';
import { syncDevicePush } from '../lib/notify';
import { AddSoundScreen } from './AddSoundScreen';
import { SettingsScreen } from './SettingsScreen';
import { CatalogPage, ExpeditionsPage, FeedPage } from './FeedScreen';
import { StaffScreen } from './StaffScreen';
import { ExpeditionDetailScreen, ExpeditionEditScreen, PickLocationScreen } from './ExpeditionScreens';
import { downloadLegalPrint } from '../lib/legal-print';
import { pathForSound } from '../lib/routes';
import { shareLink } from '../lib/share';
import { SEARCH_KIND_LABEL, searchAll } from '../lib/search-all';
import { useIsDesktop } from '../lib/use-media';
import { downloadSound } from '../lib/download-sound';
import { usePrefs, useT } from '../state/PrefsContext';
import { resolveExpeditionInvite } from '../lib/expedition-invite';
import { isAmbisonicSound, isSoundwalkPrinciple, soundAuthor, soundRoute } from '../lib/sound-media';
import { watchConditionalUnlock } from '../lib/device-unlock';
import { beginOAuth, loadOauthConfig } from '../lib/oauth';
import { runSmartCaptcha } from '../lib/smart-captcha';
import { pathForAuth } from '../lib/routes';
import { Avatar } from '../primitives/Avatar';
import { NotificationRow } from '../primitives/NotificationRow';
import { SoundTagLines } from '../primitives/SoundTagLines';
import { CommentsThread } from '../primitives/CommentsThread';
import { SoundRow } from '../primitives/SoundRow';
import { useLeaveGuard } from '../lib/use-leave-guard';
import { formatPresenceLabel, isUserOnline } from '../lib/presence';
import BrandMark from '@/brand/BrandMark';

const ACCENT = color.accent;

export function ScreenContent({ screen, onBack }: { screen: ScreenConfig; onBack: () => void }) {
  switch (screen.type) {
    case 'sound-detail': return <SoundDetailScreen sound={screen.sound} onBack={onBack} />;
    case 'user-profile': return <UserProfileScreen name={screen.name} avatar={screen.avatar} username={screen.username} onBack={onBack} />;
    case 'expedition-detail': return <ExpeditionDetailScreen exp={screen.exp} onBack={onBack} />;
    case 'expedition-edit': return <ExpeditionEditScreen exp={screen.exp} onBack={onBack} />;
    case 'settings': return <SettingsScreen onBack={onBack} />;
    case 'events': return <EventsScreen onBack={onBack} focusId={screen.focusId} />;
    case 'auth': return <AuthScreen onBack={onBack} mode={screen.mode} />;
    case 'reset-password': return <AuthScreen onBack={onBack} mode="in" panel="reset" />;
    case 'feed-post': return <FeedPostScreen post={screen.post} onBack={onBack} />;
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
    case 'delete-account': return <DeleteAccountScreen onBack={onBack} />;
    case 'guessr': return <GuessrScreen onBack={onBack} />;
    case 'catalog': return <CatalogPage onBack={onBack} />;
    case 'feed': return <FeedPage onBack={onBack} />;
    case 'expeditions': return <ExpeditionsPage onBack={onBack} />;
    case 'drafts': return <DraftsScreen onBack={onBack} />;
    case 'my-sounds': return <MySoundsScreen onBack={onBack} />;
    default: return null;
  }
}

function SoundDetailScreen({ sound, onBack }: { sound: Sound; onBack: () => void }) {
  const { push, reset, setActiveTab } = useNav();
  const { isLoggedIn, user } = useAuth();
  const {
    togglePlay, playing, playingId, progress, allSounds, reload, setFocused, seek, patchSoundLocal, profiles,
  } = useData();
  const { toast, confirm } = useUi();
  const th = useTh();
  const desktop = useIsDesktop();
  const live = allSounds.find((s) => String(s.id) === String(sound.id)) || sound;
  const authorLogin = String(live.recordistId || '').toLowerCase();
  const authorProfile = profiles.find((p) => String(p.loginName || '').toLowerCase() === authorLogin);
  const meta = useSoundMeta(live);
  const on = playing && String(playingId) === String(live.id);
  const comments = (live.comments || []).map((c) => normalizeComment(c));
  const liked = !!user && (live.likedBy || []).includes(user.loginName);
  const disliked = !!user && (live.dislikedBy || []).includes(user.loginName);

  useEffect(() => {
    if (!desktop) setFocused(live);
  }, [desktop, live.id, setFocused]);

  const toggleReaction = async (kind: 'like' | 'dislike', onNow: boolean) => {
    if (!isLoggedIn || !user) { push({ type: 'auth' }); toast('Войдите, чтобы оценить запись'); return; }
    const guard = spamGuardCheck('like');
    if (!guard.ok) { toast(spamGuardMessage(guard)); return; }
    const login = user.loginName;
    const snapshot = live;
    patchSoundLocal(live.id, (s) => {
      const likedBy = new Set(s.likedBy || []);
      const dislikedBy = new Set(s.dislikedBy || []);
      if (kind === 'like') {
        if (onNow) likedBy.delete(login); else { likedBy.add(login); dislikedBy.delete(login); }
      } else if (onNow) dislikedBy.delete(login); else { dislikedBy.add(login); likedBy.delete(login); }
      return { ...s, likedBy: [...likedBy], dislikedBy: [...dislikedBy] };
    });
    try {
      await apiPatchSound(live.id, { reaction: kind, reactionSet: !onNow });
      toast(kind === 'like' ? (onNow ? 'Лайк снят' : 'Нравится') : (onNow ? 'Дизлайк снят' : 'Не нравится'), {
        undo: () => { void toggleReaction(kind, !onNow); },
      });
    } catch (e: unknown) {
      patchSoundLocal(live.id, snapshot);
      toast((e as Error).message || 'Не удалось');
    }
  };

  const download = () => downloadSound(live, toast);

  const goToMap = () => {
    setFocused(live);
    if (desktop) {
      toast('Точка на карте справа');
      return;
    }
    reset();
    setActiveTab('map');
  };

  const hasWalk = isSoundwalkPrinciple(live.principle) || soundRoute(live).length >= 2;
  const menuItems = [
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
    // Walk CTA is inline on the card — avoid a second «На карте» when that button is shown.
    ...(!hasWalk || desktop ? [{ label: 'На карте', onClick: goToMap }] : []),
    // Download is inline on mobile sheet; keep in ⋯ for desktop header.
    ...(desktop ? [{ label: 'Скачать WAV', onClick: download }] : []),
  ];

  const cardBody = (
    <>
      <div className="mx-4 mt-2 rounded-3xl p-4" style={{ background: th.cardBg }}>
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0">
            {desktop && <p className="pv-heading" style={{ color: th.inkText }}>{live.title}</p>}
            <div className="flex items-center gap-1.5 mt-0.5">
              <MapPin size={11} style={{ color: th.soft }} /><span className="pv-caption" style={{ color: th.muted }}>{live.location}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <SoundTypeTag type={String(live.type)} />
            {meta.durationSec > 0 && (
              <span className="pv-micro" style={{ color: th.soft }}>{meta.durationLabel}</span>
            )}
          </div>
        </div>
        {live.description && <p className="pv-body mb-3" style={{ color: th.muted }}>{live.description}</p>}
        {!!normalizeTimeMarkers(live.timeMarkers).length && (
          <ul className="mb-3 flex flex-col gap-1.5">
            {normalizeTimeMarkers(live.timeMarkers).map((m, i) => (
              <li key={`${m.t}-${m.label}-${i}`}>
                <button type="button" className="flex items-baseline gap-2 text-left w-full"
                  onClick={() => {
                    const total = meta.durationSec || parseDurationLabel(live.duration);
                    if (total > 0) seek(Math.max(0, Math.min(1, m.t / total)));
                    if (!on) togglePlay(live);
                  }}>
                  <span className="pv-label tabular-nums" style={{ color: ACCENT }}>{formatClock(m.t)}</span>
                  <span className="pv-caption min-w-0 truncate" style={{ color: th.inkText }}>{m.label}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {(live.principle || live.channels) && (
          <p className="pv-caption mb-2" style={{ color: th.soft }}>
            {[live.principle, live.channels].filter(Boolean).join(' · ')}
            {isAmbisonicSound(live) ? ' · сфера 360° в плеере' : ''}
          </p>
        )}
        {hasWalk && (
          <button type="button" className="pv-label mb-3 h-9 px-3 rounded-full inline-flex items-center gap-1.5"
            style={{ background: th.phoneBg, color: ACCENT }}
            onClick={goToMap}>
            <Route size={13} /> Показать прогулку на карте
          </button>
        )}
        {(live.user || soundAuthor(live)) && (
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => push({ type: 'user-profile', name: String(live.user || soundAuthor(live)), avatar: String(authorProfile?.avatar || live.avatar || '🎙️'), username: `@${String(live.recordistId || live.user || 'user').toLowerCase().replace(/\s/g, '_')}` })}
            className="flex items-center gap-2.5 w-full p-2.5 rounded-2xl" style={{ background: th.phoneBg }}>
            <Avatar src={authorProfile?.avatar || live.avatar} name={String(live.user || soundAuthor(live))} size={36} rounded="rounded-full" />
            <div className="flex-1 text-left">
              <p className="pv-subtitle" style={{ color: th.inkText }}>{live.user || soundAuthor(live)}</p>
              <p className="pv-micro" style={{ color: th.soft }}>{live.gear || 'полевая запись'}</p>
            </div>
            <ChevronRight size={13} style={{ color: th.soft }} />
          </motion.button>
        )}
      </div>
      <div className="mx-4 mt-3 rounded-3xl p-4" style={{ background: th.cardBg }}>
        <div className="flex gap-4 mb-4">
          {[{ icon: <Headphones size={13} />, val: formatPlays(live.plays), label: 'прослушиваний' },
            { icon: <Heart size={13} />, val: String(live.likes ?? 0), label: 'лайков' },
            { icon: <MessageCircle size={13} />, val: String(comments.length), label: 'комментариев' }].map(({ icon, val, label }) => (
            <div key={label} className="flex-1 text-center">
              <div className="flex items-center justify-center gap-1 mb-0.5" style={{ color: th.soft }}>{icon}<span className="pv-subtitle" style={{ color: th.inkText }}>{val}</span></div>
              <p className="pv-micro" style={{ color: th.soft }}>{label}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          {/* Mobile: like lives on the player sheet heart — avoid a third «Нравится». */}
          {desktop && (
            <motion.button whileTap={{ scale: 0.92 }} onClick={() => void toggleReaction('like', liked)} className="pv-button flex-1 py-2.5 rounded-2xl flex items-center justify-center gap-1.5"
              style={{ background: liked ? ACCENT : th.lightBg, color: liked ? '#fff' : th.muted }}>
              <Heart size={13} fill={liked ? '#fff' : 'none'} />Нравится
            </motion.button>
          )}
          <motion.button whileTap={{ scale: 0.92 }} onClick={() => void toggleReaction('dislike', disliked)} className="pv-button flex-1 py-2.5 rounded-2xl flex items-center justify-center gap-1.5"
            style={{ background: disliked ? th.solid : th.lightBg, color: disliked ? '#fff' : th.muted }}>
            Не нравится
          </motion.button>
          {!desktop && (
            <motion.button whileTap={{ scale: 0.92 }} className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: th.lightBg }}
              aria-label="Скачать" onClick={download}>
              <Download size={16} style={{ color: th.muted }} />
            </motion.button>
          )}
          <motion.button whileTap={{ scale: 0.92 }} className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: th.lightBg }}
            aria-label="Поделиться"
            onClick={() => {
              void shareLink(pathForSound(live.id), String(live.title || 'Полёвка')).then((how) => {
                if (how === 'copied') toast('Ссылка скопирована');
                if (how === 'fail') toast('Не удалось поделиться');
              });
            }}>
            <Share2 size={16} style={{ color: th.muted }} />
          </motion.button>
        </div>
      </div>
      <div className="mx-4 mt-3 mb-6 rounded-3xl p-4" style={{ background: th.cardBg }}>
        <CommentsThread
          comments={comments}
          onSave={async (next) => {
            patchSoundLocal(live.id, { comments: next });
            try {
              await apiSyncJson('map_data.json', [{ ...live, comments: next }]);
            } catch (e) {
              await reload();
              throw e;
            }
          }}
        />
      </div>
    </>
  );

  if (!desktop) {
    return (
      <SoundPlayerSheet
        sound={live}
        playing={on}
        progress={on ? progress : 0}
        liked={liked}
        onToggle={() => togglePlay(live)}
        onSeek={on ? seek : (r) => { togglePlay(live); seek(r); }}
        onLike={() => void toggleReaction('like', liked)}
        onClose={onBack}
        menu={<SoundPlayerMenuButton title={live.title} items={menuItems} />}>
        {cardBody}
      </SoundPlayerSheet>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      <ScreenHeader title={live.title} onBack={onBack} right={
        <HoverMenu title={live.title} items={menuItems}>
          <span className="w-9 h-9 rounded-2xl flex items-center justify-center" style={{ background: th.lightBg }}>
            <MoreHorizontal size={15} color={th.muted} />
          </span>
        </HoverMenu>
      } />
      <div className="flex-1 overflow-y-auto scrollbar-none">
        <PhotoCarousel images={(live.images || []).filter(Boolean)} title={live.title} />
        {cardBody}
      </div>
    </div>
  );
}

function UserProfileScreen({ name, avatar, username, onBack }: { name: string; avatar: string; username: string; onBack: () => void }) {
  const { push } = useNav();
  const { sounds, profiles, reload } = useData();
  const { user, isLoggedIn } = useAuth();
  const { toast } = useUi();
  const th = useTh();
  const login = username.replace(/^@/, '').toLowerCase();
  const profile = profiles.find((p) => String(p.loginName || '').toLowerCase() === login
    || String(p.displayName || p.username) === name);
  const peer = String(profile?.loginName || login).toLowerCase();
  const isOwn = !!user && peer === String(user.loginName || '').toLowerCase();
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
          <div className="mx-auto mb-3 flex justify-center">
            <Avatar src={profile?.avatar || avatar} name={profile?.displayName || name} size={80} rounded="rounded-full" fallback="icon" className="shadow-md" />
          </div>
          <p className="pv-page" style={{ color: th.inkText }}>{profile?.displayName || name}</p>
          <p className="pv-caption mb-1" style={{ color: th.soft }}>@{peer}</p>
          {profile?.bio && <p className="pv-body mb-2" style={{ color: th.muted }}>{profile.bio}</p>}
          {profile?.gear && <p className="pv-caption mb-2" style={{ color: th.soft }}>{profile.gear}</p>}
          {profile?.links && <p className="pv-caption mb-3" style={{ color: ACCENT }}>{profile.links}</p>}
          <div className="flex gap-2">
            {isOwn ? (
              <button type="button" onClick={() => push({ type: 'edit-profile' })}
                className="pv-button flex-1 py-2.5 rounded-2xl text-white" style={{ background: ACCENT }}>
                Редактировать
              </button>
            ) : (
              <>
                <button type="button" onClick={() => void toggleFollow()} className="pv-button flex-1 py-2.5 rounded-2xl text-white flex items-center justify-center gap-1.5" style={{ background: ACCENT }}><UserPlus size={13} />{isFollowed ? 'Вы подписаны' : 'Подписаться'}</button>
                <button type="button" className="pv-button flex-1 py-2.5 rounded-2xl" style={{ background: th.lightBg, color: th.muted }} onClick={() => push({ type: 'conversation', name, avatar, peer })}>Написать</button>
              </>
            )}
          </div>
        </div>
        {shown.length > 0 && (
          <div className="relative h-36 rounded-3xl overflow-hidden mb-3">
            <SoundMap sounds={shown} activeId={null} onSelect={(s) => push({ type: 'sound-detail', sound: s })} />
          </div>
        )}
        <div className="flex flex-col gap-2">
          {shown.map((item) => (
            <SoundRow key={String(item.id)} item={item} onOpen={() => push({ type: 'sound-detail', sound: item })} />
          ))}
        </div>
        {!shown.length && <p className="text-xs" style={{ color: th.soft }}>Нет опубликованных записей</p>}
      </div>
    </div>
  );
}


function Row({ label, right, th, onClick }: { label: string; right?: ReactNode; th: ThemeTokens; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-left" style={{ background: th.cardBg }}>
      <span className="text-xs font-semibold" style={{ color: th.inkText }}>{label}</span>
      {right}
    </button>
  );
}

function EventsScreen({ onBack, focusId }: { onBack: () => void; focusId?: string }) {
  const { events, reload, loading, patchEventsLocal } = useData();
  const th = useTh();
  const { isLoggedIn, user } = useAuth();
  const { toast } = useUi();
  const { push } = useNav();
  const t = useT();
  const canCreate = !!isLoggedIn && !!user;
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [loc, setLoc] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [tag, setTag] = useState('встреча');
  const [busy, setBusy] = useState(false);
  useLeaveGuard(creating && !!(title.trim() || loc.trim() || date.trim() || time.trim()));

  const signup = async (ev: (typeof events)[number], i: number) => {
    if (!isLoggedIn || !user) { push({ type: 'auth' }); return; }
    const guard = spamGuardCheck('comment');
    if (!guard.ok) { toast(spamGuardMessage(guard)); return; }
    const id = String(ev.id || `e${i}`);
    const participants = Array.isArray(ev.participants) ? ev.participants.map(String)
      : Array.isArray(ev.attendees) ? ev.attendees.map(String) : [];
    if (participants.includes(user.loginName)) { toast('Вы уже записаны'); return; }
    const patched = {
      ...ev,
      id: ev.id || id,
      participants: [...participants, user.loginName],
      n: (Number(ev.n) || participants.length) + 1,
      updatedAt: new Date().toISOString(),
    };
    patchEventsLocal((prev) => prev.map((row, j) => (j === i || String(row.id) === id ? patched : row)));
    try {
      await apiSyncJson('events.json', [patched]);
      toast('Заявка отправлена');
    } catch (e: unknown) {
      await reload();
      toast((e as Error).message || 'Не удалось записаться');
    }
  };

  const createEvent = async () => {
    if (!canCreate || !title.trim()) { toast('Укажите название'); return; }
    setBusy(true);
    const id = `ev${Date.now().toString(36)}`;
    const next = {
      id,
      title: title.trim(),
      loc: loc.trim(),
      location: loc.trim(),
      date: date.trim(),
      time: time.trim(),
      tag: tag.trim() || 'встреча',
      status: 'open',
      n: 0,
      participants: [] as string[],
      ownerLogin: user.loginName,
      emoji: '🎟️',
      createdAt: new Date().toISOString(),
    };
    patchEventsLocal((prev) => [next, ...prev]);
    try {
      await apiSyncJson('events.json', [next]);
      toast('Ивент создан');
      setCreating(false);
      setTitle('');
      setLoc('');
      setDate('');
      setTime('');
    } catch (e: unknown) {
      await reload();
      toast((e as Error).message || 'Не удалось создать');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      <ScreenHeader title={t('events')} onBack={onBack} right={(
        <button type="button" className="pv-button px-3 h-10 rounded-2xl text-white" style={{ background: ACCENT }}
          onClick={() => {
            if (!canCreate) { push({ type: 'auth' }); return; }
            setCreating((v) => !v);
          }}>{creating ? 'Скрыть' : 'Создать'}</button>
      )} />
      <div className="flex-1 overflow-y-auto scrollbar-none p-4 flex flex-col gap-3">
        {creating && canCreate && (
          <div className="rounded-3xl p-4 flex flex-col gap-2" style={{ background: th.cardBg }}>
            <p className="pv-subtitle" style={{ color: th.inkText }}>Новый ивент</p>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Название"
              className="rounded-2xl px-3 py-2.5 text-sm outline-none" style={{ background: th.lightBg, color: th.inkText }} />
            <input value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="Место"
              className="rounded-2xl px-3 py-2.5 text-sm outline-none" style={{ background: th.lightBg, color: th.inkText }} />
            <div className="flex gap-2">
              <input value={date} onChange={(e) => setDate(e.target.value)} placeholder="Дата" type="date"
                className="flex-1 rounded-2xl px-3 py-2.5 text-sm outline-none" style={{ background: th.lightBg, color: th.inkText }} />
              <input value={time} onChange={(e) => setTime(e.target.value)} placeholder="Время" type="time"
                className="w-28 rounded-2xl px-3 py-2.5 text-sm outline-none" style={{ background: th.lightBg, color: th.inkText }} />
            </div>
            <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Тег"
              className="rounded-2xl px-3 py-2.5 text-sm outline-none" style={{ background: th.lightBg, color: th.inkText }} />
            <button type="button" disabled={busy} onClick={() => void createEvent()}
              className="pv-button w-full py-2.5 rounded-2xl text-white" style={{ background: ACCENT }}>
              {busy ? '…' : 'Опубликовать'}
            </button>
          </div>
        )}
        {loading && !events.length && <ListSkeleton rows={3} />}
        {!loading && !events.length && (
          <EmptyNote title={t('eventsEmpty')} hint={canCreate ? 'Создайте первый ивент кнопкой выше.' : t('eventsEmptyHint')} />
        )}
        {events.map((ev, i) => (
          <div key={String(ev.id || i)} className="rounded-3xl p-4" style={{ background: th.cardBg, outline: focusId && String(ev.id || `e${i}`) === focusId ? `2px solid ${ACCENT}` : undefined }}>
            <p className="pv-micro uppercase" style={{ color: th.soft }}>{String(ev.tag || ev.status || t('kindEvent'))}</p>
            <p className="pv-subtitle" style={{ color: th.inkText }}>{ev.title}</p>
            <p className="pv-caption mb-3" style={{ color: th.muted }}>{String(ev.loc || ev.location || '')} · {String(ev.date || '')} {String(ev.time || '')}</p>
            <button className="pv-button w-full py-2 rounded-2xl text-white" style={{ background: ACCENT }}
              onClick={() => void signup(ev, i)}>Записаться</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function FeedPostScreen({ post, onBack }: { post: FeedPost; onBack: () => void }) {
  const th = useTh();
  const t = useT();
  const { feed, sounds, reload, patchFeedLocal } = useData();
  const { push } = useNav();
  const live = feed.find((p) => String(p.id || p.title) === String(post.id || post.title)) || post;
  const images = (live.images || []).map(String).filter(Boolean);
  const comments = (Array.isArray(live.comments) ? live.comments : []).map((c) => normalizeComment(c));
  const linked = live.soundId ? sounds.find((s) => String(s.id) === String(live.soundId)) : undefined;
  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      <ScreenHeader title={String(live.title || t('kindPost'))} onBack={onBack} />
      <div className="flex-1 overflow-y-auto scrollbar-none">
        {!!images.length && <PhotoCarousel images={images} title={String(live.title || '')} />}
        <div className="mx-4 mt-4 rounded-3xl p-4" style={{ background: th.cardBg }}>
          <p className="text-[11px] font-semibold" style={{ color: th.soft }}>{String(live.author || 'Полёвка')}</p>
          {live.createdAt ? <p className="text-[10px] mt-0.5" style={{ color: th.soft }}>{(() => {
            const ts = Date.parse(String(live.createdAt));
            return Number.isNaN(ts) ? String(live.createdAt) : new Date(ts).toLocaleString();
          })()}</p> : null}
          <p className="pv-heading mt-2" style={{ color: th.inkText }}>{String(live.title || t('kindPost'))}</p>
          {live.text ? <p className="text-[13px] leading-relaxed mt-2" style={{ color: th.muted }}>{String(live.text)}</p> : null}
          {linked && (
            <div className="mt-3">
              <SoundRow item={linked} onOpen={() => push({ type: 'sound-detail', sound: linked })} />
            </div>
          )}
        </div>
        <div className="mx-4 mt-3 mb-6 rounded-3xl p-4" style={{ background: th.cardBg }}>
          <CommentsThread
            comments={comments}
            onSave={async (next) => {
              patchFeedLocal(live.id || live.title, { comments: next });
              try {
                await apiSyncJson('feed.json', [{ ...live, comments: next }]);
              } catch (e) {
                await reload();
                throw e;
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}

function AuthScreen({
  onBack,
  mode: startMode = 'in',
  panel: startPanel,
}: {
  onBack: () => void;
  mode?: 'in' | 'up';
  panel?: 'in' | 'up' | 'reset';
}) {
  const th = useTh();
  const desktop = useIsDesktop();
  const { login, register, offerDeviceUnlock, resumeStoredSession } = useAuth();
  const { toast, confirm } = useUi();
  const { push, pop } = useNav();
  const { reload } = useData();
  const t = useT();
  const [mode, setMode] = useState<'in' | 'up' | 'reset'>(startPanel || startMode);
  const [loginName, setLogin] = useState(() => readLastLogin());
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [totp, setTotp] = useState('');
  const [needTotp, setNeedTotp] = useState(false);
  const [totpError, setTotpError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState<'yandex' | 'vk' | null>(null);
  const [seen, setSeen] = useState({ login: false, password: false, first: false, last: false });
  const [resetLogin, setResetLogin] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetPw, setResetPw] = useState('');
  const [captchaOn, setCaptchaOn] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  /** Consent is implied by continuing (shown as footer copy); API still needs the flag. */
  const pdConsent = true;

  useEffect(() => {
    void import('../lib/smart-captcha').then((m) => m.getSmartCaptchaSitekey()).then((k) => setCaptchaOn(!!k)).catch(() => {});
  }, []);

  const startOauth = async (provider: 'yandex' | 'vk') => {
    if (!hasCookieConsentForAuth()) {
      openCookieBanner();
      toast(t('cookiesNeed'));
      return;
    }
    setOauthBusy(provider);
    try {
      await beginOAuth(provider, { pdConsent: true });
    } catch (e: unknown) {
      toast((e as Error).message || t('oauthFailed'));
      setOauthBusy(null);
    }
  };

  useEffect(() => {
    if (mode === 'reset') return;
    const path = pathForAuth(mode);
    if (`${location.pathname}` !== path) history.replaceState({ polevka: true }, '', path);
  }, [mode]);

  const loginErr = seen.login && !loginName.trim() ? t('loginNeed') : '';
  const passwordErr = seen.password && password.length < 8 ? t('passwordNeed') : '';
  const firstErr = mode === 'up' && seen.first && !firstName.trim() ? t('nameNeed') : '';
  const lastErr = mode === 'up' && seen.last && !lastName.trim() ? t('nameNeed') : '';
  const missing = !loginName.trim() || password.length < 8
    || (mode === 'up' && (!firstName.trim() || !lastName.trim()));

  useEffect(() => {
    if (mode !== 'in') return;
    const ac = new AbortController();
    void watchConditionalUnlock(ac.signal).then(async (stored) => {
      if (ac.signal.aborted) return;
      const ok = await resumeStoredSession();
      if (ok) {
        toast('Добро пожаловать');
        pop();
        return;
      }
      if (stored?.login) setLogin(stored.login);
    }).catch(() => { /* cancelled or no passkey */ });
    return () => ac.abort();
  }, [mode, pop, resumeStoredSession, toast]);

  const submit = async (totpCode?: string, formEl?: HTMLFormElement | null) => {
    const fd = formEl ? new FormData(formEl) : null;
    const nextLogin = String(fd?.get('username') || loginName).trim();
    const nextPassword = String(fd?.get('password') || password);
    const nextFirst = String(fd?.get('given-name') || firstName).trim();
    const nextLast = String(fd?.get('family-name') || lastName).trim();
    const nextName = `${nextFirst} ${nextLast}`.trim();
    if (nextLogin !== loginName) setLogin(nextLogin);
    if (nextPassword !== password) setPassword(nextPassword);
    if (nextFirst !== firstName) setFirstName(nextFirst);
    if (nextLast !== lastName) setLastName(nextLast);
    setBusy(true);
    setTotpError(false);
    try {
      const captchaToken = (await runSmartCaptcha()) || undefined;
      const code = (totpCode ?? totp).trim();
      if (mode === 'up') {
        await register(nextLogin, nextPassword, nextName || nextLogin, pdConsent, captchaToken);
        await apiSyncJson('profiles.json', [{
          loginName: nextLogin,
          displayName: nextName || nextLogin,
          profileUpdatedAt: new Date().toISOString(),
        }]);
        await reload();
      }
      else await login(nextLogin, nextPassword, code || undefined, rememberMe, captchaToken);
      if (rememberMe) {
        const enable = await confirm({
          title: t('enableFaceId'),
          body: t('enableFaceIdBody'),
          ok: t('enableFaceId'),
        });
        if (enable) {
          try { await offerDeviceUnlock(nextLogin, nextName || nextLogin); toast(t('deviceUnlockOn')); }
          catch { /* user cancelled sensor */ }
        }
      }
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
      } else if (err.code === 'captcha_required' || err.code === 'captcha_failed' || err.code === 'captcha_unavailable') {
        toast(err.message || t('captchaFailed'));
      } else if (err.code === 'bad_totp') {
        setTotpError(true);
        setTotp('');
        toast('Неверный код 2FA');
      } else {
        toast(err.message || 'Ошибка входа');
      }
    } finally { setBusy(false); }
  };
  const panelBg = th.phoneBg;
  const panelRgb = th.isDark ? '11,11,11' : '232,237,234';
  const oauthSurface = th.isDark ? '#2E2E2E' : '#F0F1F3';
  const switchMode = (m: 'in' | 'up' | 'reset') => {
    setMode(m);
    setNeedTotp(false);
    setTotp('');
    setTotpError(false);
    if (m === 'reset' && loginName.trim()) setResetLogin(loginName.trim());
  };

  const setLoginSafe = (v: string) => {
    setLogin(v.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32));
  };

  const sendResetCode = async () => {
    const who = resetLogin.trim();
    if (!who) { toast(t('loginNeed')); return; }
    setBusy(true);
    try {
      const captchaToken = (await runSmartCaptcha()) || undefined;
      await apiRequestPasswordReset(who, captchaToken);
      toast('Если аккаунт есть, код отправлен');
    } catch (e: unknown) {
      toast((e as Error).message);
    } finally { setBusy(false); }
  };

  const saveResetPassword = async () => {
    const who = resetLogin.trim();
    if (!who || !resetCode.trim() || resetPw.length < 8) {
      toast(t('passwordNeed'));
      return;
    }
    setBusy(true);
    try {
      await apiConfirmPasswordReset(who, resetCode.trim(), resetPw);
      toast('Пароль обновлён');
      setResetCode('');
      setResetPw('');
      switchMode('in');
      setLogin(who);
    } catch (e: unknown) {
      toast((e as Error).message);
    } finally { setBusy(false); }
  };

  const consentNote = (
    <p className="pv-micro leading-snug" style={{ color: th.soft }}>
      {t('pdConsentContinue')}{' '}
      <button
        type="button"
        className="underline underline-offset-2"
        style={{ color: th.muted }}
        onClick={() => push({ type: 'legal', doc: 'privacy' })}
      >
        {t('privacyPolicy')}
      </button>
    </p>
  );

  const oauthRow = (
    <section className={`flex ${desktop ? 'flex-row gap-2' : 'flex-col gap-2'}`}>
      <button
        type="button"
        disabled={!!oauthBusy}
        onClick={() => void startOauth('yandex')}
        className={`pv-button rounded-2xl flex items-center justify-center gap-2 cursor-pointer ${desktop ? 'flex-1 min-h-10' : 'w-full min-h-11'}`}
        style={{
          background: oauthSurface,
          color: th.inkText,
          boxShadow: `inset 0 0 0 1px ${th.border}`,
          opacity: oauthBusy && oauthBusy !== 'yandex' ? 0.6 : 1,
        }}
      >
        <span className="w-5 h-5 rounded-md flex items-center justify-center text-[11px] font-semibold text-white" style={{ background: '#FC3F1D' }}>Я</span>
        <span className="truncate">{oauthBusy === 'yandex' ? '…' : (desktop ? 'Яндекс' : t('continueWithYandex'))}</span>
      </button>
      <button
        type="button"
        disabled={!!oauthBusy}
        onClick={() => void startOauth('vk')}
        className={`pv-button rounded-2xl flex items-center justify-center gap-2 cursor-pointer ${desktop ? 'flex-1 min-h-10' : 'w-full min-h-11'}`}
        style={{ background: '#0077FF', color: '#fff', opacity: oauthBusy && oauthBusy !== 'vk' ? 0.6 : 1 }}
      >
        <span className="pv-subtitle text-white shrink-0">VK</span>
        {!desktop && <span className="truncate">{oauthBusy === 'vk' ? '…' : t('continueWithVk')}</span>}
        {desktop && oauthBusy === 'vk' && <span>…</span>}
      </button>
    </section>
  );

  const resetForm = (
    <div className={`flex flex-col w-full ${desktop ? 'gap-2' : 'gap-3'}`}>
      <FormField
        label={t('loginName')}
        value={resetLogin}
        onChange={setResetLogin}
        name="username"
        autoComplete="username"
        compact={desktop}
        tip={t('loginCreatorTip')}
      />
      <button
        type="button"
        disabled={busy}
        className="pv-button w-full min-h-10 py-2.5 rounded-2xl text-white cursor-pointer"
        style={{ background: th.solid, opacity: busy ? 0.7 : 1 }}
        onClick={() => void sendResetCode()}
      >
        {busy ? '…' : t('authResetSend')}
      </button>
      <FormField
        label="Код"
        value={resetCode}
        onChange={setResetCode}
        name="one-time-code"
        autoComplete="one-time-code"
        inputMode="numeric"
        compact={desktop}
        maxLength={8}
      />
      <FormField
        label="Новый пароль"
        value={resetPw}
        onChange={setResetPw}
        password
        name="new-password"
        autoComplete="new-password"
        compact={desktop}
      />
      <button
        type="button"
        disabled={busy}
        className="pv-button w-full min-h-10 py-2.5 rounded-2xl text-white cursor-pointer"
        style={{ background: ACCENT, opacity: busy ? 0.7 : 1 }}
        onClick={() => void saveResetPassword()}
      >
        {busy ? '…' : t('authResetSave')}
      </button>
      <button
        type="button"
        className="pv-caption self-start min-h-8"
        style={{ color: ACCENT }}
        onClick={() => switchMode('in')}
      >
        {t('authResetBack')}
      </button>
    </div>
  );

  const form = (
    <form
      ref={formRef}
      autoComplete="on"
      method="post"
      action="."
      onSubmit={(e) => { e.preventDefault(); void submit(undefined, e.currentTarget); }}
      className={`flex flex-col w-full ${desktop ? 'gap-2' : 'gap-4'}`}
    >
      {!desktop && (
        <div className="flex gap-1 p-1 rounded-2xl" style={{ background: th.cardBg }}>
          {(['in', 'up'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className="flex-1 pv-label min-h-10 rounded-xl"
              style={{
                color: mode === m ? th.inkText : th.muted,
                background: mode === m ? th.phoneBg : 'transparent',
                boxShadow: mode === m ? `inset 0 0 0 1px ${th.border}` : undefined,
              }}
            >
              {m === 'in' ? t('login') : t('register')}
            </button>
          ))}
        </div>
      )}

      {oauthRow}

      <div className="flex items-center gap-3" aria-hidden>
        <span className="flex-1 h-px" style={{ background: th.border }} />
        <span className="pv-micro" style={{ color: th.soft }}>{t('orEmailLogin')}</span>
        <span className="flex-1 h-px" style={{ background: th.border }} />
      </div>

      <section className={`flex flex-col ${desktop ? 'gap-1.5' : 'gap-3'}`}>
        {mode === 'up' && (
          <div className={`grid ${desktop ? 'grid-cols-2 gap-2' : 'grid-cols-1 gap-3'}`}>
            <FormField
              label={t('firstName')}
              value={firstName}
              onChange={setFirstName}
              name="given-name"
              autoComplete="given-name"
              compact={desktop}
              tip={t('firstNameTip')}
              error={firstErr}
              onBlurValidate={() => setSeen((s) => ({ ...s, first: true }))}
            />
            <FormField
              label={t('lastName')}
              value={lastName}
              onChange={setLastName}
              name="family-name"
              autoComplete="family-name"
              compact={desktop}
              tip={t('lastNameTip')}
              error={lastErr}
              onBlurValidate={() => setSeen((s) => ({ ...s, last: true }))}
            />
          </div>
        )}
        <FormField
          label={t('loginName')}
          value={loginName}
          onChange={mode === 'up' ? setLoginSafe : setLogin}
          name="username"
          compact={desktop}
          tip={t('loginCreatorTip')}
          autoComplete={mode === 'in' ? 'username webauthn' : 'username'}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          hint={desktop || mode === 'up' ? undefined : t('loginHint')}
          error={loginErr}
          onBlurValidate={() => setSeen((s) => ({ ...s, login: true }))}
        />
        <FormField
          label={t('password')}
          value={password}
          onChange={setPassword}
          password
          name="password"
          compact={desktop}
          autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
          hint={desktop ? undefined : t('passwordHint')}
          error={passwordErr}
          onBlurValidate={() => setSeen((s) => ({ ...s, password: true }))}
        />
        {mode === 'in' && (
          <div className="flex items-center justify-between gap-3">
            <label className="pv-caption flex items-center gap-2" style={{ color: th.muted }}>
              <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="shrink-0" />
              <span>{t('rememberMe')}</span>
            </label>
            <button
              type="button"
              className="pv-caption min-h-8 shrink-0"
              style={{ color: th.soft }}
              onClick={() => switchMode('reset')}
            >
              {t('forgotPassword')}
            </button>
          </div>
        )}
        {mode === 'in' && needTotp && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl p-3"
            style={{ background: th.cardBg, border: `1px solid ${th.border}` }}>
            <p className="pv-subtitle mb-1" style={{ color: th.inkText }}>Код из приложения</p>
            <p className="pv-caption mb-2 leading-snug" style={{ color: th.soft }}>
              Шесть цифр из Google Authenticator, Яндекс Ключ или другого приложения
            </p>
            <OtpInput value={totp} error={totpError} autoFocus disabled={busy}
              onChange={(v) => { setTotp(v); setTotpError(false); }}
              onComplete={(code) => { if (!busy) void submit(code, formRef.current); }} />
          </motion.div>
        )}
      </section>

      <div className={`flex flex-col ${desktop ? 'gap-1.5' : 'gap-2'} pt-0.5`}>
        <button
          type="submit"
          disabled={busy}
          className={`pv-button w-full rounded-2xl text-white cursor-pointer ${desktop ? 'min-h-10 py-2.5' : 'min-h-11 py-3'}`}
          style={{ background: ACCENT, opacity: busy ? 0.7 : 1 }}
          onClick={() => setSeen({ login: true, password: true, first: true, last: true })}
        >
          {busy ? '…' : mode === 'in' ? t('signIn') : t('createAccount')}
        </button>
        {consentNote}
        {captchaOn && (
          <p className="pv-micro leading-snug" style={{ color: th.soft }}>{t('captchaNotice')}</p>
        )}
        {seen.login && missing && (
          <FormNeed>{loginErr || passwordErr || firstErr || lastErr || t('loginNeed')}</FormNeed>
        )}
        {!hasCookieConsentForAuth() && (
          <p className="pv-micro leading-snug" style={{ color: th.soft }}>{t('cookiesNeed')}</p>
        )}
      </div>
    </form>
  );

  const eyebrow = mode === 'reset'
    ? t('authResetTitle')
    : mode === 'up' ? t('authStartFree') : t('welcomeBack');
  const title = mode === 'reset'
    ? t('authResetTitle')
    : mode === 'up' ? t('authCreateTitle') : t('authSignInTitle');
  const panelBody = mode === 'reset' ? resetForm : form;

  if (desktop) {
    return (
      <div className="relative flex h-full min-h-0 overflow-hidden overscroll-none" style={{ background: panelBg }}>
        <div className="relative z-10 flex flex-col w-full max-w-[440px] xl:max-w-[480px] flex-shrink-0 h-full min-h-0 overflow-hidden px-7 xl:px-10 py-4">
          <header className="flex items-center gap-3 flex-shrink-0 mb-2">
            <button type="button" onClick={onBack} className="pv-caption min-h-8" style={{ color: th.soft }}>
              ← Назад
            </button>
            <div className="flex items-center gap-2 ml-auto">
              <div className="w-6 h-6"><BrandMark /></div>
              <span className="pv-wordmark text-[15px]" style={{ color: th.inkText }}>Полёвка</span>
            </div>
          </header>

          <div className="flex-1 min-h-0 flex flex-col justify-center max-w-[380px] w-full overflow-hidden">
            <p className="pv-micro uppercase tracking-[0.12em] mb-1" style={{ color: th.soft }}>
              {eyebrow}
            </p>
            <h1 className="pv-title mb-1.5 text-[1.65rem] leading-tight" style={{ color: th.inkText }}>
              {title}
              <span style={{ color: ACCENT }}>.</span>
            </h1>
            {mode !== 'reset' && (
              <p className="pv-caption mb-3 leading-snug" style={{ color: th.muted }}>
                {mode === 'up' ? t('authHaveAccount') : t('authNoAccount')}{' '}
                <button
                  type="button"
                  className="pv-subtitle underline-offset-2 hover:underline"
                  style={{ color: ACCENT }}
                  onClick={() => switchMode(mode === 'up' ? 'in' : 'up')}
                >
                  {mode === 'up' ? t('signIn') : t('createAccount')}
                </button>
              </p>
            )}
            {mode === 'reset' && (
              <p className="pv-caption mb-3 leading-snug" style={{ color: th.muted }}>
                Код придёт на подтверждённый email аккаунта.
              </p>
            )}
            {panelBody}
          </div>
        </div>

        <div className="relative flex-1 min-w-[240px] h-full overflow-hidden" aria-hidden>
          <img
            src="/auth/field.jpg"
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{ objectPosition: '28% center' }}
            decoding="async"
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `linear-gradient(90deg, ${panelBg} 0%, rgba(${panelRgb},0.94) 14%, rgba(${panelRgb},0.55) 40%, rgba(${panelRgb},0.16) 64%, transparent 82%)`,
            }}
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: th.isDark
                ? 'linear-gradient(180deg, rgba(11,11,11,0.28) 0%, transparent 30%, transparent 72%, rgba(11,11,11,0.45) 100%)'
                : 'linear-gradient(180deg, rgba(232,237,234,0.2) 0%, transparent 28%, transparent 75%, rgba(45,60,57,0.22) 100%)',
            }}
          />
          <div className="absolute bottom-6 right-6 w-9 h-9 opacity-90">
            <BrandMark />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      <ScreenHeader
        title={mode === 'reset' ? t('authResetTitle') : mode === 'in' ? t('login') : t('register')}
        onBack={mode === 'reset' ? () => switchMode('in') : onBack}
      />
      <div className="px-5 pt-4 pb-8 flex flex-col gap-3 flex-1 overflow-y-auto scrollbar-none">
        <p className="pv-caption mb-1 leading-snug" style={{ color: th.muted }}>
          {mode === 'reset'
            ? 'Код придёт на подтверждённый email аккаунта.'
            : mode === 'in' ? t('welcomeBack') : t('newExplorer')}
        </p>
        {panelBody}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, th, password, inputMode, readOnly, autoComplete, name }: {
  label: string; value: string; onChange: (v: string) => void; th: ThemeTokens;
  password?: boolean; inputMode?: 'numeric' | 'email' | 'text'; readOnly?: boolean;
  autoComplete?: string; name?: string;
}) {
  return (
    <label className="pv-label" style={{ color: th.soft }}>
      {label}
      <input
        type={password ? 'password' : 'text'}
        id={name}
        name={name}
        autoComplete={autoComplete}
        autoCapitalize={password ? 'off' : 'none'}
        autoCorrect="off"
        spellCheck={false}
        inputMode={inputMode}
        readOnly={readOnly}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-1 w-full rounded-2xl px-3 py-3 outline-none ${readOnly ? 'opacity-80' : ''}`}
        style={{ background: th.cardBg, color: th.inkText }} />
    </label>
  );
}

export function MessagesScreen({ onBack, embed = false }: { onBack?: () => void; embed?: boolean }) {
  const th = useTh();
  const desktop = useIsDesktop();
  const t = useT();
  const { push } = useNav();
  const { profiles, mail } = useData();
  const { user, isLoggedIn } = useAuth();
  const { prefs } = usePrefs();
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const peers = isLoggedIn && user ? conversationPeers(mail, user.loginName, profiles) : [];
  const filtered = peers.filter((p) => {
    if (tab === 'unread' && p.unread < 1) return false;
    if (!q.trim()) return true;
    const needle = q.trim().toLowerCase();
    return p.name.toLowerCase().includes(needle) || p.login.toLowerCase().includes(needle) || (p.lastText || '').toLowerCase().includes(needle);
  });
  useEffect(() => {
    if (isLoggedIn && prefs.notifyDevice) void syncDevicePush(true);
  }, [isLoggedIn, prefs.notifyDevice]);
  const fmtTime = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      {!desktop && !embed && onBack && <ScreenHeader title={t('messages')} onBack={onBack} />}
      <div className={`flex-1 overflow-y-auto ${desktop ? 'px-6 pt-6 pb-4' : 'p-4'}`}>
        {(embed || desktop) && (
          <div className={`${embed ? 'pv-safe-top' : ''} mb-3`}>
            <p className="pv-page" style={{ color: th.inkText }}>{t('messages')}</p>
          </div>
        )}
        {isLoggedIn && (
          <>
            <label className="flex items-center gap-2 h-12 rounded-2xl px-3.5 mb-3" style={{ background: th.cardBg }}>
              <Search size={16} color={th.soft} className="flex-shrink-0" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t('search')}
                className="flex-1 min-w-0 bg-transparent outline-none"
                style={{ color: th.inkText }}
                aria-label={t('search')}
              />
            </label>
            <div className="flex gap-1.5 mb-3 overflow-x-auto scrollbar-none">
              {([
                { id: 'all' as const, label: t('all') },
                { id: 'unread' as const, label: `${t('unread')}${peers.some((p) => p.unread) ? ` ${peers.filter((p) => p.unread).length}` : ''}` },
              ]).map((chip) => (
                <button key={chip.id} type="button" onClick={() => setTab(chip.id)}
                  className="pv-label min-h-9 h-9 px-3 rounded-full flex-shrink-0"
                  style={{ background: tab === chip.id ? ACCENT : th.cardBg, color: tab === chip.id ? '#fff' : th.muted }}>
                  {chip.label}
                </button>
              ))}
            </div>
          </>
        )}
        {!isLoggedIn && (
          <EmptyNote title={t('msgNeedAuth')} hint={t('msgNeedAuthHint')} actionLabel={t('signIn')} onAction={() => push({ type: 'auth' })} />
        )}
        {isLoggedIn && peers.length === 0 && (
          <EmptyNote title={t('msgEmpty')} hint={t('msgEmptyHint')} />
        )}
        {isLoggedIn && peers.length > 0 && filtered.length === 0 && (
          <EmptyNote title={t('nothingFound')} hint={t('nothingFoundHint')} />
        )}
        {filtered.map((p) => {
          const peerProfile = profiles.find((row) => String(row.loginName || '').toLowerCase() === p.login);
          const isSupport = p.login === SUPPORT_LOGIN;
          const online = isSupport || isUserOnline(peerProfile);
          const presence = isSupport
            ? t('online')
            : formatPresenceLabel(peerProfile, prefs.locale === 'en' ? 'en' : 'ru');
          return (
          <button key={p.login} type="button" onClick={() => push({ type: 'conversation', name: p.name, avatar: p.avatar || '', peer: p.login })}
            className="w-full flex items-center gap-3 py-3 px-1 mb-0.5 text-left min-h-[68px]">
            <span className="relative flex-shrink-0">
              <Avatar src={p.avatar} name={p.name} size={52} rounded="rounded-full" fallback="icon" />
              {online && (
                <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full border-2"
                  style={{ background: color.olive, borderColor: th.phoneBg }} aria-hidden />
              )}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="pv-subtitle truncate flex-1" style={{ color: th.inkText }}>{p.name}</p>
                <span className="pv-micro flex-shrink-0" style={{ color: th.soft }}>{fmtTime(p.lastDate)}</span>
              </div>
              <p className="pv-micro truncate mt-0.5" style={{ color: online ? color.olive : th.soft }}>{presence}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="pv-caption truncate flex-1" style={{ color: th.soft }}>{p.lastText || 'Написать'}</p>
                {p.unread > 0 && (
                  <span className="min-w-5 h-5 px-1.5 rounded-full text-white pv-micro flex items-center justify-center flex-shrink-0" style={{ background: ACCENT }}>
                    {p.unread > 9 ? '9+' : p.unread}
                  </span>
                )}
              </div>
            </div>
          </button>
          );
        })}
      </div>
    </div>
  );
}

function NotificationsScreen({ onBack }: { onBack: () => void }) {
  const th = useTh();
  const t = useT();
  const { mail, profiles, sounds, events, reload, reloadMail, markNotificationsRead } = useData();
  const { user } = useAuth();
  const { toast } = useUi();
  const [busy, setBusy] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  useEffect(() => { void markNotificationsRead(); }, [markNotificationsRead]);
  const box = mail.find((b) => b.loginName === user?.loginName);
  const list = (box?.notifications || []) as Array<{
    id?: string; type?: string; fromName?: string; fromId?: string; text?: string; date?: string;
    expeditionId?: string; expeditionOwner?: string; soundId?: string; soundTitle?: string;
  }>;
  const decide = async (n: (typeof list)[number], accept: boolean) => {
    if (!user || !n.expeditionId || !n.expeditionOwner) return;
    const key = `${n.expeditionId}:${n.soundId}:${accept}`;
    setBusy(key);
    try {
      await resolveExpeditionInvite({
        profiles,
        accept,
        expeditionId: String(n.expeditionId),
        expeditionOwner: String(n.expeditionOwner),
        soundId: String(n.soundId || ''),
        memberLogin: user.loginName,
      });
      toast(accept ? 'Вы в экспедиции' : 'Приглашение отклонено');
      await reload();
      await reloadMail();
    } catch (e: unknown) {
      toast((e as Error).message || 'Не удалось ответить');
    } finally { setBusy(null); }
  };
  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      <ScreenHeader title={t('notifications')} onBack={onBack} />
      <div className="p-4 flex flex-col gap-2">
        {list.filter((n, i) => !hidden.has(String(n.id || i))).length === 0 && <EmptyNote title={t('quiet')} />}
        {list.map((n, i) => {
          const key = String(n.id || i);
          if (hidden.has(key)) return null;
          return (
          <SwipeRow key={key} onDismiss={() => {
            setHidden((prev) => new Set(prev).add(key));
            toast(t('hidden'), { undo: () => setHidden((prev) => { const next = new Set(prev); next.delete(key); return next; }) });
          }}>
          <div>
            <NotificationRow n={n} ctx={{ sounds: sounds as Sound[], profiles, events }} />
            {n.type === 'expedition-invite' && n.expeditionId && (
              <div className="flex gap-2 mt-2 px-1">
                <button type="button" disabled={busy != null} className="flex-1 min-h-11 py-2 rounded-xl text-[11px] font-semibold text-white" style={{ background: ACCENT }}
                  onClick={() => void decide(n, true)}>{busy ? '…' : 'Принять'}</button>
                <button type="button" disabled={busy != null} className="flex-1 min-h-11 py-2 rounded-xl text-[11px] font-semibold" style={{ background: th.lightBg, color: th.muted }}
                  onClick={() => void decide(n, false)}>Отклонить</button>
              </div>
            )}
          </div>
          </SwipeRow>
          );
        })}
      </div>
    </div>
  );
}

function SearchScreen({ onBack }: { onBack: () => void }) {
  const th = useTh();
  const t = useT();
  const { sounds, profiles, events, feed } = useData();
  const { push } = useNav();
  const [q, setQ] = useState('');
  const hits = searchAll(q, { sounds, profiles, events, feed });
  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      <ScreenHeader title="Поиск" onBack={onBack} />
      <div className="p-4 flex-1 overflow-y-auto">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Звуки, люди, экспедиции, события…" className="w-full min-h-11 rounded-2xl px-3 py-3 text-sm outline-none mb-3" style={{ background: th.cardBg, color: th.inkText }} aria-label={t('search')} />
        {!q.trim() && <EmptyNote title="Поиск" hint="Начните вводить — ищем по всей Полёвке" />}
        {q.trim() && !hits.length && <EmptyNote title={t('nothingFound')} hint={t('nothingFoundHint')} />}
        {hits.map((hit) => (
          <button key={hit.id} onClick={() => {
            if (hit.kind === 'sound') push({ type: 'sound-detail', sound: hit.sound });
            else if (hit.kind === 'expedition') push({ type: 'expedition-detail', exp: hit.exp });
            else if (hit.kind === 'event') push({ type: 'events', focusId: String(hit.event.id || '') });
            else if (hit.kind === 'person') {
              const login = String(hit.profile.loginName || hit.profile.login || '').replace(/^@/, '');
              push({ type: 'user-profile', name: hit.title, avatar: String(hit.profile.avatar || '🎙️'), username: `@${login || hit.title}` });
            } else push({ type: 'feed' });
          }} className="w-full text-left rounded-2xl p-3 mb-2" style={{ background: th.cardBg }}>
            <p className="text-[10px] font-semibold uppercase" style={{ color: th.soft }}>{SEARCH_KIND_LABEL[hit.kind]}</p>
            <p className="text-xs font-bold" style={{ color: th.inkText }}>{hit.title}</p>
            {hit.hint && <p className="text-[10px]" style={{ color: th.soft }}>{hit.hint}</p>}
          </button>
        ))}
      </div>
    </div>
  );
}

function MySoundsScreen({ onBack }: { onBack: () => void }) {
  const th = useTh();
  const t = useT();
  const { push } = useNav();
  const { user } = useAuth();
  const { allSounds } = useData();
  const desktop = useIsDesktop();
  const login = String(user?.loginName || '').toLowerCase();
  const name = String(user?.username || '').toLowerCase();
  const mine = allSounds.filter((s) => {
    const rid = String(s.recordistId || s.user || '').toLowerCase();
    return (rid === login || String(s.recordist || '').toLowerCase() === name)
      && (!s.status || s.status === 'published');
  });
  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      {!desktop && <ScreenHeader title={t('mySounds')} onBack={onBack} />}
      <div className={`flex-1 overflow-y-auto scrollbar-none ${desktop ? 'px-6 pt-6 pb-4' : 'p-4'}`}>
        {desktop && (
          <div className="mb-4">
            <p className="pv-page" style={{ color: th.inkText }}>{t('mySounds')}</p>
            <p className="pv-caption mt-1" style={{ color: th.soft }}>{t('mySoundsHint')}</p>
          </div>
        )}
        <div className="flex flex-col gap-2">
          {mine.map((item) => (
            <SoundRow key={String(item.id)} item={item} onOpen={() => push({ type: 'sound-detail', sound: item })} />
          ))}
          {!mine.length && (
            <EmptyNote title={t('noOwnSounds')} actionLabel={t('openCatalog')} onAction={() => push({ type: 'catalog' })} />
          )}
        </div>
      </div>
    </div>
  );
}

function EditProfileScreen({ onBack }: { onBack: () => void }) {
  const th = useTh();
  const t = useT();
  const { user, patchUser, applySession } = useAuth();
  const { profiles, reload } = useData();
  const { toast } = useUi();
  const mine = profiles.find((p) => String(p.loginName).toLowerCase() === user?.loginName);
  const [name, setName] = useState(user?.displayName || user?.username || '');
  const [bio, setBio] = useState(user?.bio || mine?.bio || '');
  const [gear, setGear] = useState(String(mine?.gear || ''));
  const [links, setLinks] = useState(String(mine?.links || ''));
  const [loginEdit, setLoginEdit] = useState(user?.loginName || '');
  const [loginPw, setLoginPw] = useState('');
  const [loginTotp, setLoginTotp] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!avatarFile) { setAvatarPreview(null); return; }
    const url = URL.createObjectURL(avatarFile);
    setAvatarPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);
  const dirty = name !== (user?.displayName || user?.username || '')
    || bio !== (user?.bio || mine?.bio || '')
    || gear !== String(mine?.gear || '')
    || links !== String(mine?.links || '')
    || !!avatarFile;
  useLeaveGuard(dirty && !busy);
  const save = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const login = user.loginName;
      let avatarUrl = user.avatar || mine?.avatar;
      if (avatarFile) avatarUrl = await uploadUserMedia(avatarFile, avatarFile.name, avatarFile.type || 'image/jpeg');
      const idx = profiles.findIndex((p) => String(p.loginName || '').toLowerCase() === login);
      const prev = idx >= 0 ? profiles[idx] : {};
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
      await apiSyncJson('profiles.json', [record]);
      patchUser({ displayName: record.displayName, username: record.displayName, bio: record.bio, avatar: avatarUrl });
      toast('Профиль сохранён');
      await reload();
      onBack();
    } catch (e: unknown) {
      toast((e as Error).message || 'Не удалось сохранить');
    } finally { setBusy(false); }
  };
  const changeLogin = async () => {
    if (!user) return;
    const next = loginEdit.trim().toLowerCase();
    if (next.length < 3) { toast('Логин: минимум 3 символа'); return; }
    if (next === user.loginName) { toast('Это уже ваш логин'); return; }
    setBusy(true);
    try {
      const data = await apiChangeLogin({
        newLogin: next,
        ...(user.oauth?.oauthOnly
          ? { confirmLogin: user.loginName }
          : { password: loginPw }),
        totpCode: loginTotp.trim() || undefined,
      }) as { token?: string; refreshToken?: string; user?: Record<string, unknown>; rememberMe?: boolean };
      applySession(data);
      setLoginPw('');
      setLoginTotp('');
      setLoginEdit(next);
      toast('Логин обновлён');
      await reload();
    } catch (e: unknown) {
      const err = e as ApiError;
      if (err.code === 'login_taken') toast('Этот логин уже занят');
      else if (err.code === 'bad_credentials') toast('Неверный пароль');
      else if (err.code === 'bad_totp' || err.code === 'totp_required') toast('Нужен код 2FA');
      else toast(err.message || 'Не удалось сменить логин');
    } finally { setBusy(false); }
  };
  const previewSrc = avatarPreview || user?.avatar || mine?.avatar;
  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      <ScreenHeader title={t('manageProfile')} onBack={onBack} />
      <div className="flex-1 overflow-y-auto scrollbar-none px-4 pb-8">
        <div className="rounded-3xl overflow-hidden mb-4" style={{ background: th.cardBg }}>
          <div className="h-24" style={{
            background: th.isDark
              ? 'linear-gradient(135deg, #2E2E2E 0%, #1A1A1A 100%)'
              : `linear-gradient(135deg, ${color.light} 0%, ${color.cream} 55%, ${color.mist}55 100%)`,
          }} />
          <div className="px-5 pb-5 -mt-12 flex flex-col items-center">
            <div className="relative mb-3">
              <Avatar src={previewSrc} name={name || user?.username} size={96} rounded="rounded-full" fallback="icon" className="shadow-md" />
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => setAvatarFile(e.target.files?.[0] || null)} />
              <button type="button" onClick={() => fileRef.current?.click()}
                className="absolute bottom-0 right-0 w-9 h-9 rounded-full flex items-center justify-center text-white shadow-md"
                style={{ background: ACCENT }} aria-label="Сменить фото">
                <Camera size={16} />
              </button>
            </div>
            <p className="pv-heading text-center" style={{ color: th.inkText }}>{name.trim() || user?.username}</p>
            <p className="pv-caption" style={{ color: th.soft }}>@{user?.loginName}</p>
          </div>
        </div>
        <div className="rounded-3xl p-4 flex flex-col gap-3.5 mb-4" style={{ background: th.cardBg }}>
          <FormField label="Имя" value={name} onChange={setName} maxLength={48} autoComplete="nickname" />
          <label className="pv-label block" style={{ color: th.soft }}>
            О себе
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              maxLength={280}
              placeholder="Коротко о себе и полевых записях"
              className="mt-1 w-full rounded-2xl px-4 py-3 outline-none resize-none min-h-[88px] pv-body"
              style={{ background: th.phoneBg, color: th.inkText }}
            />
          </label>
          <FormField label="Техника" value={gear} onChange={setGear} placeholder="Zoom H5, binaural…" maxLength={80} />
          <FormField label="Ссылки" value={links} onChange={setLinks} placeholder="сайт или соцсеть" maxLength={120} inputMode="url" />
        </div>
        <div className="rounded-3xl p-4 flex flex-col gap-3 mb-4" style={{ background: th.cardBg }}>
          <p className="pv-subtitle" style={{ color: th.inkText }}>Логин</p>
          <p className="pv-caption leading-snug" style={{ color: th.soft }}>
            С ним входите на сайт. После смены другие устройства выйдут из аккаунта.
          </p>
          <FormField
            label="Новый логин"
            value={loginEdit}
            onChange={setLoginEdit}
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="username"
            maxLength={32}
            hint="Латиница, цифры, _ . -"
          />
          {user?.oauth?.oauthOnly ? (
            <p className="pv-caption leading-snug" style={{ color: th.soft }}>
              Аккаунт через соцсеть — пароль не нужен. Смена логина подтверждается текущей сессией.
            </p>
          ) : (
            <FormField label="Текущий пароль" value={loginPw} onChange={setLoginPw} password autoComplete="current-password" />
          )}
          {user?.totpEnabled && (
            <FormField label="Код 2FA" value={loginTotp} onChange={setLoginTotp} inputMode="numeric" autoComplete="one-time-code" maxLength={6} />
          )}
          <button
            type="button"
            disabled={busy || !loginEdit.trim() || loginEdit.trim().toLowerCase() === user?.loginName}
            onClick={() => void changeLogin()}
            className="w-full min-h-11 py-2.5 rounded-2xl pv-button text-white"
            style={{ background: th.solid, opacity: busy ? 0.7 : 1 }}
          >
            Сменить логин
          </button>
        </div>
        <motion.button type="button" whileTap={{ scale: 0.97 }} disabled={busy || !dirty}
          className="w-full min-h-12 py-3 rounded-2xl text-white pv-button"
          style={{ background: ACCENT, opacity: busy || !dirty ? 0.45 : 1 }}
          onClick={() => void save()}>
          {busy ? 'Сохранение…' : 'Сохранить'}
        </motion.button>
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
          <SoundMap sounds={[sound]} activeId={sound.id} onSelect={() => {}} route={route} />
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
  const { mail, reloadMail, absorbMail } = useData();
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
        const res = await apiSyncJson('mail.json', upsertInboxPatch(mail, SUPPORT_LOGIN, msg));
        if (Array.isArray(res?.data)) absorbMail(res.data);
        else await reloadMail();
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
            <p className="pv-page" style={{ color: th.inkText }}>Поддержка Полёвки</p>
            <p className="pv-body mt-1.5 max-w-[22rem]" style={{ color: th.muted }}>
              Вопросы про публикацию, аккаунт и карту — или напишите «обращение».
            </p>
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          {faqs.map((f) => (
            <button key={f.label} type="button" onClick={() => void sendText(f.text)}
              className="pv-label px-3 py-1.5 rounded-full" style={{ background: th.cardBg, color: th.muted }}>{f.label}</button>
          ))}
        </div>
        <div className="flex-1 min-h-[180px] flex flex-col gap-2">
          {log.map((m, i) => (
            <div key={i} className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-snug ${m.from === 'me' ? 'self-end text-white' : 'self-start'}`}
              style={{ background: m.from === 'me' ? ACCENT : th.cardBg, color: m.from === 'me' ? '#fff' : th.inkText }}>{m.text}</div>
          ))}
        </div>
        <div className="flex gap-2 pb-1">
          <button className="text-[11px] font-semibold" style={{ color: th.soft }} onClick={() => push({ type: 'conversation', name: SUPPORT_NAME, avatar: SUPPORT_AVATAR, peer: SUPPORT_LOGIN })}>Чат с человеком</button>
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
      <div className="flex-1 overflow-y-auto p-4 text-xs leading-relaxed" style={{ color: th.muted }}>
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
  const t = useT();
  const { user, refreshUser, isStaff } = useAuth();
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
  const [oauthCfg, setOauthCfg] = useState<{ yandex?: boolean; vk?: boolean }>({});

  useEffect(() => {
    setEmail(user?.email || '');
  }, [user?.email]);

  useEffect(() => {
    void loadOauthConfig().then((cfg) => setOauthCfg({ yandex: !!cfg.yandex, vk: !!cfg.vk })).catch(() => {});
  }, []);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    void apiGetSecurityEvents().then((d) => {
      const list = (d as { events?: Array<{ type?: string; login?: string; at?: string }> }).events || [];
      setEvents(list);
    }).catch(() => {});
  }, [user?.role]);

  const linkOauth = async (provider: 'yandex' | 'vk') => {
    setBusy(true);
    try {
      if (!hasCookieConsentForAuth()) {
        openCookieBanner();
        toast(t('cookiesNeed'));
        setBusy(false);
        return;
      }
      await beginOAuth(provider, { intent: 'link', pdConsent: true });
    } catch (e: unknown) {
      toast((e as Error).message || t('oauthFailed'));
      setBusy(false);
    }
  };

  const unlinkOauth = async (provider: 'yandex' | 'vk') => {
    const label = provider === 'yandex' ? 'Яндекс' : 'VK';
    const ok = await confirm({
      title: t('oauthLinkedAccounts'),
      body: `Отвязать ${label} от аккаунта?`,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await apiOauthUnlink(provider);
      await refreshUser();
      toast(t('oauthUnlinked'));
    } catch (e: unknown) {
      const err = e as ApiError;
      toast(err.message || t('oauthFailed'));
    } finally { setBusy(false); }
  };

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
    const oauthSet = !!user?.oauth?.oauthOnly;
    if (!oauthSet && !curPw) { toast('Введите текущий пароль'); return; }
    setBusy(true);
    try {
      await apiChangePassword(oauthSet ? '' : curPw, newPw);
      setCurPw(''); setNewPw(''); setNewPw2('');
      await refreshUser();
      toast(oauthSet
        ? 'Пароль задан. Можно входить логином или через соцсеть.'
        : 'Пароль обновлён. Другие устройства вышли из аккаунта.');
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
          <p className="text-[10px] mb-2 font-semibold" style={{ color: verified ? ACCENT : th.soft }}>
            {verified ? 'Подтверждена' : 'Не подтверждена'}
          </p>
          <Field label="Адрес" value={email} onChange={setEmail} th={th} inputMode="email" readOnly={verified} name="email" autoComplete="email" />
          {!verified && (
            <>
              <button disabled={busy} onClick={() => void sendEmailCode()} className="mt-2 w-full py-2.5 rounded-2xl text-xs font-semibold text-white" style={{ background: th.solid }}>Отправить код</button>
              <Field label="Код из письма" value={code} onChange={setCode} th={th} inputMode="numeric" />
              <button disabled={busy} onClick={() => void confirmEmail()} className="mt-2 w-full py-2.5 rounded-2xl text-xs font-semibold text-white" style={{ background: ACCENT }}>Подтвердить</button>
            </>
          )}
        </div>

        <div className="rounded-3xl p-4" style={{ background: th.cardBg }}>
          <p className="text-xs font-bold mb-2" style={{ color: th.inkText }}>Пароль</p>
          {user?.oauth?.oauthOnly ? (
            <p className="text-[10px] mb-2" style={{ color: th.soft }}>
              Аккаунт через соцсеть — задайте пароль ниже (без текущего). Либо сброс на подтверждённый email с экрана входа.
            </p>
          ) : null}
          {!user?.oauth?.oauthOnly && (
            <Field label="Текущий" value={curPw} onChange={setCurPw} th={th} password name="current-password" autoComplete="current-password" />
          )}
          <Field label={user?.oauth?.oauthOnly ? 'Новый пароль' : 'Новый'} value={newPw} onChange={setNewPw} th={th} password name="new-password" autoComplete="new-password" />
          <Field label="Повтор" value={newPw2} onChange={setNewPw2} th={th} password name="new-password-confirm" autoComplete="new-password" />
          <button disabled={busy} onClick={() => void changePw()} className="mt-2 w-full py-2.5 rounded-2xl text-xs font-semibold text-white" style={{ background: ACCENT }}>
            {user?.oauth?.oauthOnly ? 'Задать пароль' : 'Сменить пароль'}
          </button>
        </div>

        {(oauthCfg.yandex || oauthCfg.vk) && (
          <div className="rounded-3xl p-4" style={{ background: th.cardBg }}>
            <p className="text-xs font-bold mb-1" style={{ color: th.inkText }}>{t('oauthLinkedAccounts')}</p>
            <p className="text-[10px] mb-3" style={{ color: th.soft }}>{t('oauthLinkedHint')}</p>
            {oauthCfg.yandex && (
              <div className="flex items-center justify-between gap-2 mb-2">
                <div>
                  <p className="text-xs font-semibold" style={{ color: th.inkText }}>Яндекс</p>
                  <p className="text-[10px]" style={{ color: user?.oauth?.yandex ? ACCENT : th.soft }}>
                    {user?.oauth?.yandex ? t('oauthLinkedYes') : t('oauthLinkedNo')}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void (user?.oauth?.yandex ? unlinkOauth('yandex') : linkOauth('yandex'))}
                  className="shrink-0 px-3 py-2 rounded-2xl text-[11px] font-semibold"
                  style={{
                    background: user?.oauth?.yandex ? th.solid : (th.isDark ? '#2E2E2E' : '#F0F1F3'),
                    color: user?.oauth?.yandex ? '#fff' : th.inkText,
                  }}
                >
                  {user?.oauth?.yandex ? t('oauthUnlinkYandex') : t('oauthLinkYandex')}
                </button>
              </div>
            )}
            {oauthCfg.vk && (
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold" style={{ color: th.inkText }}>VK</p>
                  <p className="text-[10px]" style={{ color: user?.oauth?.vk ? ACCENT : th.soft }}>
                    {user?.oauth?.vk ? t('oauthLinkedYes') : t('oauthLinkedNo')}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void (user?.oauth?.vk ? unlinkOauth('vk') : linkOauth('vk'))}
                  className="shrink-0 px-3 py-2 rounded-2xl text-[11px] font-semibold text-white"
                  style={{ background: user?.oauth?.vk ? th.solid : '#0077FF' }}
                >
                  {user?.oauth?.vk ? t('oauthUnlinkVk') : t('oauthLinkVk')}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="rounded-3xl p-4" style={{ background: th.cardBg }}>
          <p className="text-xs font-bold mb-1" style={{ color: th.inkText }}>Двухфакторная защита</p>
          <p className="text-[10px] mb-3" style={{ color: th.soft }}>{totpStatus}</p>
          {!totpOn && (
            <>
              <button disabled={busy} onClick={() => void startTotp()} className="w-full py-2.5 rounded-2xl text-xs font-semibold text-white" style={{ background: th.solid }}>Настроить 2FA</button>
              {totpSecret && (
                <div className="mt-3">
                  <p className="text-[10px] break-all mb-1" style={{ color: th.muted }}>{totpSecret}</p>
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
              <button disabled={busy} onClick={() => void disableTotp()} className="mt-3 w-full py-2.5 rounded-2xl text-xs font-semibold text-white" style={{ background: th.solid }}>Отключить 2FA</button>
            </>
          )}
        </div>

        {user?.role === 'admin' && events.length > 0 && (
          <div className="rounded-3xl p-4" style={{ background: th.cardBg }}>
            <p className="text-xs font-bold mb-2" style={{ color: th.inkText }}>События безопасности</p>
            {events.slice(0, 12).map((ev, i) => (
              <p key={i} className="text-[10px] mb-1" style={{ color: th.muted }}>{ev.type} · {ev.login} · {ev.at}</p>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}

function DeleteAccountScreen({ onBack }: { onBack: () => void }) {
  const th = useTh();
  const t = useT();
  const { user, logout } = useAuth();
  const { reset } = useNav();
  const { toast, confirm } = useUi();
  const [pw, setPw] = useState('');
  const [confirmLogin, setConfirmLogin] = useState('');
  const [totp, setTotp] = useState('');
  const [busy, setBusy] = useState(false);
  const protectedAcc = user?.loginName === 'admin' || user?.loginName === 'support';
  const oauthOnly = !!user?.oauth?.oauthOnly;

  const submit = async () => {
    if (oauthOnly) {
      if (normalizeLoginLocal(confirmLogin) !== normalizeLoginLocal(user?.loginName || '')) {
        toast('Введите свой логин для подтверждения');
        return;
      }
    } else if (!pw) {
      toast(t('deleteAccountPw'));
      return;
    }
    if (user?.totpEnabled && !/^\d{6}$/.test(totp.trim())) {
      toast(t('deleteAccountTotp'));
      return;
    }
    const ok = await confirm({
      title: t('deleteAccountTitle'),
      body: t('deleteAccountBody'),
      ok: t('deleteAccountConfirm'),
    });
    if (!ok) return;
    setBusy(true);
    try {
      await apiDeleteAccount(
        oauthOnly ? '' : pw,
        user?.totpEnabled ? totp.trim() : undefined,
        oauthOnly ? user?.loginName : undefined,
      );
      await logout();
      reset();
      toast(t('deleteAccountDone'));
    } catch (e: unknown) {
      const err = e as ApiError;
      if (err.code === 'bad_credentials') toast(oauthOnly ? 'Логин не совпал' : 'Неверный пароль');
      else if (err.code === 'bad_totp') toast('Неверный код 2FA');
      else if (err.code === 'protected_account') toast(t('deleteAccountProtected'));
      else toast(err.message || t('deleteAccount'));
    } finally { setBusy(false); }
  };

  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      <ScreenHeader title={t('deleteAccountTitle')} onBack={onBack} />
      <div className="flex-1 overflow-y-auto scrollbar-none p-4 flex flex-col gap-3">
        <div className="rounded-3xl p-4" style={{ background: th.cardBg }}>
          <p className="text-xs leading-relaxed" style={{ color: th.soft }}>{t('deleteAccountBody')}</p>
          {oauthOnly && (
            <p className="text-[10px] mt-2" style={{ color: th.soft }}>
              Привязки Яндекс/VK удалятся вместе с аккаунтом — тот же соцаккаунт можно будет зарегистрировать заново.
            </p>
          )}
        </div>
        {protectedAcc ? (
          <p className="text-xs" style={{ color: ACCENT }}>{t('deleteAccountProtected')}</p>
        ) : (
          <div className="rounded-3xl p-4 flex flex-col gap-3" style={{ background: th.cardBg }}>
            {oauthOnly ? (
              <Field
                label={`Введите логин «${user?.loginName || ''}»`}
                value={confirmLogin}
                onChange={setConfirmLogin}
                th={th}
                name="confirm-login"
                autoComplete="username"
              />
            ) : (
              <Field label={t('deleteAccountPw')} value={pw} onChange={setPw} th={th} password />
            )}
            {user?.totpEnabled && (
              <div>
                <p className="text-[10px] font-semibold mb-1" style={{ color: th.soft }}>{t('deleteAccountTotp')}</p>
                <OtpInput value={totp} onChange={setTotp} />
              </div>
            )}
            <button type="button" disabled={busy} onClick={() => void submit()}
              className="w-full py-3 rounded-2xl text-xs font-semibold text-white cursor-pointer"
              style={{ background: ACCENT }}>
              {t('deleteAccountConfirm')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function normalizeLoginLocal(s: string) {
  return String(s || '').trim().toLowerCase();
}

function GuessrScreen({ onBack }: { onBack: () => void }) {
  const th = useTh();
  const t = useT();
  const { sounds, togglePlay } = useData();
  const [pick, setPick] = useState<Sound | null>(null);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    if (pick) return;
    const pool = sounds.filter((s) => Number.isFinite(Number(s.lat)) && Number.isFinite(Number(s.lng)));
    if (!pool.length) return;
    setPick(pool[Math.floor(Math.random() * pool.length)]);
  }, [sounds, pick]);
  if (!pick) {
    return (
      <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
        <ScreenHeader title={t('guessr')} onBack={onBack} />
        <div className="px-4">
          <EmptyNote title={t('guessrEmpty')} hint={t('guessrEmptyHint')} />
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      <ScreenHeader title={t('guessr')} onBack={onBack} />
      <div className="p-5">
        <p className="pv-body mb-4" style={{ color: th.muted }}>{t('guessrHint')}</p>
        <button className="w-full min-h-12 py-3 rounded-2xl text-white pv-button mb-3" style={{ background: ACCENT }} onClick={() => togglePlay(pick)}>Играть фрагмент</button>
        <div className="relative h-64 rounded-3xl overflow-hidden">
          <SoundMap sounds={sounds} activeId={null} onSelect={(s) => setMsg(String(s.id) === String(pick.id) ? 'Верно!' : 'Мимо, попробуйте ещё')} />
        </div>
        {msg && <p className="pv-subtitle mt-3" style={{ color: ACCENT }}>{msg}</p>}
      </div>
    </div>
  );
}
