import { useEffect, useMemo, useState } from 'react';
import {
  apiSyncJson, normalizeComment, soundsByAuthor, uploadUserMedia,
  type Comment, type Expedition, type ExpeditionInvite, type Sound,
} from '@polevka/core';
import { color, pinColor, typeMeta } from '@polevka/design';
import { ChevronDown, Clock, ImagePlus, MapPin, Search, UserPlus, X } from 'lucide-react';
import { EXPEDITION_KINDS, locLabel } from '../lib/onboarding';
import { usePrefs } from '../state/PrefsContext';
import { ScreenHeader } from '../primitives/ui';
import { PhotoLightbox, PhotoStrip } from '../primitives/PhotoCarousel';
import { SoundMap } from '../lib/SoundMap';
import { isOwnSound, ownerOfSound, sendExpeditionInvites } from '../lib/expedition-invite';
import { useAuth } from '../state/AuthContext';
import { useData } from '../state/DataContext';
import { useNav } from '../state/NavContext';
import { useTh } from '../state/ThemeContext';
import { useUi } from '../state/UiContext';
import { useLeaveGuard } from '../lib/use-leave-guard';
import { SoundRow } from '../primitives/SoundRow';
import { CommentsThread } from '../primitives/CommentsThread';

const ACCENT = color.accent;

export function ExpeditionDetailScreen({ exp, onBack }: { exp: Expedition; onBack: () => void }) {
  const th = useTh();
  const { sounds, setRoutePreview, profiles, reload } = useData();
  const { user } = useAuth();
  const { push } = useNav();
  const { toast } = useUi();
  const ownerLogin = String(exp.ownerLogin || '').toLowerCase();
  const ownerProfile = profiles.find((p) => String(p.loginName || '').toLowerCase() === ownerLogin);
  const live = (ownerProfile?.sessions || []).find((s) => String(s.id) === String(exp.id)) || exp;
  const route = live.route || [];
  const linked = sounds.filter((s) => (live.soundIds || []).map(String).includes(String(s.id)) || String(s.sessionId) === String(live.id));
  const mine = ownerLogin === user?.loginName;
  const comments = (live.comments || []).map((c) => normalizeComment(c));

  const saveComments = async (next: Comment[]) => {
    if (!ownerProfile && !ownerLogin) throw new Error('Нет владельца экспедиции');
    const sessions = [...(ownerProfile?.sessions || [])];
    const idx = sessions.findIndex((s) => String(s.id) === String(live.id));
    const updated: Expedition = { ...live, comments: next };
    if (idx >= 0) sessions[idx] = updated;
    else sessions.push(updated);
    const record = {
      ...(ownerProfile || { loginName: ownerLogin, displayName: ownerLogin }),
      loginName: ownerLogin || ownerProfile?.loginName,
      sessions,
      profileUpdatedAt: new Date().toISOString(),
    };
    await apiSyncJson('profiles.json', [record]);
    await reload();
  };

  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      <ScreenHeader title={live.title} onBack={onBack} right={mine ? (
        <button className="text-[10px] font-semibold" style={{ color: ACCENT }} onClick={() => push({ type: 'expedition-edit', exp: live })}>Изменить</button>
      ) : undefined} />
      <div className="flex-1 overflow-y-auto scrollbar-none p-4">
        <div className="rounded-3xl p-5 mb-3 text-center" style={{ background: th.cardBg }}>
          <div className="text-5xl mb-3">{live.emoji || '🗺️'}</div>
          <p className="text-sm font-bold mb-1" style={{ color: th.inkText }}>{live.title}</p>
          <p className="text-xs mb-4" style={{ color: th.muted }}>{live.preview || live.desc}</p>
          {(live.place || live.date || live.kind) && (
            <p className="text-[11px] mb-3" style={{ color: th.soft }}>
              {[live.kind && (EXPEDITION_KINDS.find((k) => k.id === live.kind)?.ru || live.kind), live.date, live.place].filter(Boolean).join(' · ')}
            </p>
          )}
          {!!(live.members || []).length && (
            <p className="text-[11px] mb-3" style={{ color: th.muted }}>Участники: {(live.members || []).join(', ')}</p>
          )}
          <div className="flex justify-around">
            {[{ icon: <Clock size={13} />, val: live.dur || '—', label: 'Время' },
              { icon: <MapPin size={13} />, val: String(live.n || route.length || '—'), label: 'Точек' }].map(({ icon, val, label }) => (
              <div key={label} className="text-center">
                <div className="flex justify-center mb-0.5" style={{ color: th.soft }}>{icon}</div>
                <p className="text-sm font-bold" style={{ color: th.inkText }}>{val}</p>
                <p className="text-[9px]" style={{ color: th.soft }}>{label}</p>
              </div>
            ))}
          </div>
        </div>
        {!!route.length && (
          <div className="relative h-48 rounded-3xl overflow-hidden mb-3">
            <SoundMap sounds={linked} activeId={null} onSelect={(s) => push({ type: 'sound-detail', sound: s })} route={route} />
          </div>
        )}
        {!!(live.photos || []).length && (
          <PhotoStrip images={(live.photos || []).filter(Boolean)} title={live.title} />
        )}
        <div className="flex flex-col gap-2 mb-3">
          {linked.map((s) => (
            <SoundRow key={String(s.id)} item={s} onOpen={() => push({ type: 'sound-detail', sound: s })} />
          ))}
        </div>
        {!!route.length && (
          <button className="text-[10px] font-semibold mb-3" style={{ color: ACCENT }} onClick={() => { setRoutePreview(route); push({ type: 'pick-location', mode: 'route' }); }}>Показать маршрут на карте</button>
        )}
        <div className="rounded-3xl p-4 mb-2" style={{ background: th.cardBg }}>
          <CommentsThread
            comments={comments}
            onSave={async (next) => {
              try { await saveComments(next); }
              catch (e: unknown) { toast((e as Error).message || 'Не удалось сохранить комментарий'); throw e; }
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function ExpeditionEditScreen({ exp, onBack }: { exp?: Expedition; onBack: () => void }) {
  const th = useTh();
  const { user } = useAuth();
  const { profiles, sounds, mail, reload, reloadMail, routeDraft, setRouteDraft, setPickMode, clearMapPick } = useData();
  const { toast } = useUi();
  const { push } = useNav();
  const { prefs } = usePrefs();
  const loc = prefs.locale === 'en' ? 'en' : 'ru';
  const [title, setTitle] = useState(exp?.title || '');
  const [desc, setDesc] = useState(exp?.desc || '');
  const [dur, setDur] = useState(exp?.dur || '');
  const [date, setDate] = useState(exp?.date || '');
  const [place, setPlace] = useState(exp?.place || '');
  const [kind, setKind] = useState(exp?.kind || '');
  const [emoji, setEmoji] = useState(exp?.emoji || '🗺️');
  const [memberQ, setMemberQ] = useState('');
  const [openPeople, setOpenPeople] = useState(false);
  const [keptPhotos, setKeptPhotos] = useState<string[]>(() => (exp?.photos || []).filter(Boolean));
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [soundIds, setSoundIds] = useState<string[]>(() => (exp?.soundIds || []).map(String));
  const [invites, setInvites] = useState<ExpeditionInvite[]>(() => exp?.invites || []);
  const [members, setMembers] = useState<string[]>(() => (exp?.members || []).map((m) => m.toLowerCase()));
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const [q, setQ] = useState('');
  const [openList, setOpenList] = useState(false);
  const [fullPhoto, setFullPhoto] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const route = routeDraft.length ? routeDraft : (exp?.route || []);
  const photoUrls = useMemo(() => photoFiles.map((f) => URL.createObjectURL(f)), [photoFiles]);
  const gallery = useMemo(() => [...keptPhotos, ...photoUrls], [keptPhotos, photoUrls]);
  useEffect(() => () => { photoUrls.forEach((u) => URL.revokeObjectURL(u)); }, [photoUrls]);
  const slotsLeft = Math.max(0, 6 - keptPhotos.length - photoFiles.length);
  const dirty = !!(title.trim() || desc.trim() || place.trim() || photoFiles.length || routeDraft.length || soundIds.length || invites.length);
  useLeaveGuard(dirty && !busy, clearMapPick);

  const mineSounds = useMemo(
    () => (user ? soundsByAuthor(sounds, user.loginName, user.username) : []),
    [sounds, user],
  );
  const pool = scope === 'mine' ? mineSounds : sounds;
  const people = useMemo(() => {
    const self = (user?.loginName || '').toLowerCase();
    const needle = memberQ.trim().toLowerCase();
    return profiles.filter((p) => {
      const login = String(p.loginName || p.login || '').replace(/^@/, '').toLowerCase();
      if (!login || login === self || members.includes(login)) return false;
      if (!needle) return true;
      return `${p.displayName} ${p.username} ${login}`.toLowerCase().includes(needle);
    }).slice(0, 20);
  }, [profiles, memberQ, members, user]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const taken = new Set([...soundIds, ...invites.map((i) => i.soundId)]);
    return pool.filter((s) => {
      if (taken.has(String(s.id))) return false;
      if (!needle) return true;
      return `${s.title} ${s.location} ${s.user} ${s.recordist}`.toLowerCase().includes(needle);
    }).slice(0, 24);
  }, [pool, q, soundIds, invites]);

  const addPhotos = (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (!images.length) return;
    setPhotoFiles((prev) => [...prev, ...images].slice(0, Math.max(0, 6 - keptPhotos.length)));
  };

  const pickSound = (s: Sound) => {
    if (!user) return;
    const id = String(s.id);
    if (isOwnSound(s, user.loginName, profiles)) {
      setSoundIds((prev) => prev.includes(id) ? prev : [...prev, id]);
      setOpenList(false);
      setQ('');
      return;
    }
    const login = ownerOfSound(s, profiles);
    if (!login || login === user.loginName) {
      setSoundIds((prev) => prev.includes(id) ? prev : [...prev, id]);
      setOpenList(false);
      setQ('');
      return;
    }
    setInvites((prev) => prev.some((i) => i.soundId === id) ? prev : [...prev, { login, soundId: id, status: 'pending' }]);
    setOpenList(false);
    setQ('');
    toast('Приглашение уйдёт владельцу метки. Он станет участником после подтверждения.');
  };

  const save = async () => {
    if (!user) return;
    if (!title.trim()) { toast('Название экспедиции'); return; }
    setBusy(true);
    try {
      const id = exp?.id || `x${Date.now()}`;
      const photos = [...keptPhotos];
      for (const file of photoFiles.slice(0, slotsLeft + photoFiles.length)) {
        photos.push(await uploadUserMedia(file, file.name, file.type || 'image/jpeg'));
      }
      const acceptedMembers = invites.filter((i) => i.status === 'accepted').map((i) => i.login);
      const session: Expedition = {
        id,
        title: title.trim(),
        desc: desc.trim(),
        preview: desc.trim(),
        dur: dur.trim(),
        emoji,
        n: Math.max(route.length, soundIds.length),
        ownerLogin: user.loginName,
        members: [...new Set([...members, ...acceptedMembers])],
        route,
        photos: photos.slice(0, 8),
        soundIds,
        invites,
        date: date.trim(),
        place: place.trim(),
        kind,
        createdAt: exp?.createdAt || new Date().toISOString(),
      };
      const mine = profiles.find((p) => String(p.loginName).toLowerCase() === user.loginName);
      const sessions = [...(mine?.sessions || [])];
      const idx = sessions.findIndex((s) => String(s.id) === id);
      if (idx >= 0) sessions[idx] = session; else sessions.push(session);
      const record = {
        ...(mine || { loginName: user.loginName, displayName: user.username }),
        loginName: user.loginName,
        sessions,
        profileUpdatedAt: new Date().toISOString(),
      };
      await apiSyncJson('profiles.json', [record]);
      const fresh = invites.filter((i) => i.status === 'pending' && !(exp?.invites || []).some((x) => x.soundId === i.soundId && x.login === i.login && x.status === 'pending'));
      if (fresh.length) {
        await sendExpeditionInvites({
          mail,
          ownerLogin: user.loginName,
          ownerName: user.displayName || user.username,
          expedition: session,
          invites: fresh,
        });
        await reloadMail();
      }
      setRouteDraft([]);
      toast('Экспедиция сохранена');
      await reload();
      onBack();
    } catch (e: unknown) {
      toast((e as Error).message || 'Не удалось сохранить');
    } finally { setBusy(false); }
  };

  const selectedSounds = sounds.filter((s) => soundIds.includes(String(s.id)) || invites.some((i) => i.soundId === String(s.id)));

  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      <ScreenHeader title={exp ? 'Экспедиция' : 'Новая экспедиция'} onBack={onBack} />
      <div className="flex-1 overflow-y-auto scrollbar-none px-4 pb-8 pt-3 flex flex-col gap-4">
        <section className="rounded-3xl p-4 flex flex-col gap-3" style={{ background: th.cardBg }}>
          <div className="flex items-center gap-3">
            <input value={emoji} onChange={(e) => setEmoji(e.target.value.slice(0, 4))} aria-label="Эмодзи"
              className="w-14 h-14 rounded-2xl text-center text-2xl outline-none" style={{ background: th.lightBg }} />
            <label className="flex-1 min-w-0 text-[10px] font-semibold" style={{ color: th.soft }}>Название
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например, Дон на рассвете"
                className="mt-1 w-full rounded-2xl px-3 py-2.5 text-sm outline-none" style={{ background: th.lightBg, color: th.inkText }} />
            </label>
          </div>
          <label className="text-[10px] font-semibold" style={{ color: th.soft }}>Описание
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Куда идём и что записываем"
              className="mt-1 w-full rounded-2xl px-3 py-2.5 text-sm outline-none min-h-[88px]" style={{ background: th.lightBg, color: th.inkText }} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[10px] font-semibold" style={{ color: th.soft }}>Дата
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full rounded-2xl px-3 py-2.5 text-sm outline-none" style={{ background: th.lightBg, color: th.inkText }} />
            </label>
            <label className="text-[10px] font-semibold" style={{ color: th.soft }}>Длительность
              <input value={dur} onChange={(e) => setDur(e.target.value)} placeholder="2–3 часа"
                className="mt-1 w-full rounded-2xl px-3 py-2.5 text-sm outline-none" style={{ background: th.lightBg, color: th.inkText }} />
            </label>
          </div>
          <label className="text-[10px] font-semibold" style={{ color: th.soft }}>Место сбора
            <input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Площадь, станция, ориентир"
              className="mt-1 w-full rounded-2xl px-3 py-2.5 text-sm outline-none" style={{ background: th.lightBg, color: th.inkText }} />
          </label>
          <div>
            <p className="text-[10px] font-semibold mb-1.5" style={{ color: th.soft }}>Тип экспедиции</p>
            <div className="flex flex-wrap gap-1.5">
              {EXPEDITION_KINDS.map((k) => {
                const on = kind === k.id;
                return (
                  <button key={k.id} type="button" onClick={() => setKind(on ? '' : k.id)}
                    className="h-8 px-3 rounded-full text-[11px] font-semibold"
                    style={{ background: on ? ACCENT : th.lightBg, color: on ? '#fff' : th.muted }}>
                    {locLabel(k, loc)}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="rounded-3xl p-4" style={{ background: th.cardBg }}>
          <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: th.soft }}>Фото</p>
          <p className="text-[11px] mb-3" style={{ color: th.muted }}>До шести кадров. Перетащите или выберите файлы.</p>
          <div className="grid grid-cols-3 gap-2">
            {keptPhotos.map((src, i) => (
              <div key={src} className="relative aspect-[4/3] rounded-2xl overflow-hidden" style={{ background: th.phoneBg }}>
                <button type="button" className="w-full h-full" onClick={() => setFullPhoto(i)} aria-label="Открыть фото">
                  <img src={src} alt="" className="w-full h-full object-cover" />
                </button>
                <button type="button" className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'rgba(45,60,57,0.72)' }}
                  onClick={() => setKeptPhotos((prev) => prev.filter((u) => u !== src))} aria-label="Убрать фото">
                  <X size={12} color="#fff" />
                </button>
              </div>
            ))}
            {photoUrls.map((src, i) => (
              <div key={src} className="relative aspect-[4/3] rounded-2xl overflow-hidden" style={{ background: th.phoneBg }}>
                <button type="button" className="w-full h-full" onClick={() => setFullPhoto(keptPhotos.length + i)} aria-label="Открыть фото">
                  <img src={src} alt="" className="w-full h-full object-cover" />
                </button>
                <button type="button" className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'rgba(45,60,57,0.72)' }}
                  onClick={() => setPhotoFiles((prev) => prev.filter((_, n) => n !== i))} aria-label="Убрать фото">
                  <X size={12} color="#fff" />
                </button>
              </div>
            ))}
            {slotsLeft > 0 && (
              <label className="aspect-[4/3] rounded-2xl flex flex-col items-center justify-center gap-1 cursor-pointer"
                style={{ background: th.phoneBg, border: `1px dashed ${th.border}` }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); addPhotos(Array.from(e.dataTransfer.files || [])); }}>
                <ImagePlus size={18} color={th.soft} />
                <span className="text-[10px] font-semibold" style={{ color: th.soft }}>Добавить</span>
                <input type="file" accept="image/*" multiple className="hidden"
                  onChange={(e) => { addPhotos(Array.from(e.target.files || [])); e.target.value = ''; }} />
              </label>
            )}
          </div>
        </section>

        <section className="rounded-3xl p-4" style={{ background: th.cardBg }}>
          <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: th.soft }}>Метки</p>
          <div className="flex gap-1 p-1 rounded-2xl mb-2" style={{ background: th.lightBg }}>
            {([['mine', 'Мои метки'], ['all', 'Все метки']] as const).map(([id, label]) => (
              <button key={id} type="button" onClick={() => setScope(id)}
                className="flex-1 py-2 rounded-xl text-[11px] font-semibold"
                style={{ background: scope === id ? th.cardBg : 'transparent', color: scope === id ? ACCENT : th.muted }}>
                {label}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setOpenList((v) => !v)}
            className="w-full h-11 rounded-2xl px-3 flex items-center gap-2 text-left" style={{ background: th.lightBg }}>
            <Search size={15} color={th.soft} />
            <span className="flex-1 text-[13px]" style={{ color: q ? th.inkText : th.soft }}>{q || 'Выбрать метку'}</span>
            <ChevronDown size={14} color={th.muted} />
          </button>
          {openList && (
            <div className="mt-2 rounded-2xl overflow-hidden" style={{ background: th.lightBg }}>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Название или место"
                className="w-full px-3 py-2.5 text-[13px] outline-none bg-transparent" style={{ color: th.inkText }}
                aria-label="Поиск меток" />
              <div className="max-h-52 overflow-y-auto scrollbar-none">
                {filtered.map((s) => (
                  <button key={String(s.id)} type="button" onClick={() => pickSound(s)}
                    className="w-full text-left px-3 py-2.5 flex items-center gap-2" style={{ borderTop: `1px solid ${th.border}` }}>
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: pinColor[String(s.type)] || ACCENT }} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12px] font-semibold truncate" style={{ color: th.inkText }}>{s.title}</span>
                      <span className="block text-[10px] truncate" style={{ color: th.soft }}>
                        {typeMeta[String(s.type || '')]?.label || 'Метка'} · {s.location}
                        {!isOwnSound(s, user?.loginName || '', profiles) ? ' · приглашение' : ''}
                      </span>
                    </span>
                  </button>
                ))}
                {!filtered.length && <p className="px-3 py-4 text-[11px] text-center" style={{ color: th.soft }}>Нет подходящих меток</p>}
              </div>
            </div>
          )}
          <div className="flex flex-col gap-1.5 mt-3">
            {selectedSounds.map((s) => {
              const inv = invites.find((i) => i.soundId === String(s.id));
              return (
                <div key={String(s.id)} className="rounded-2xl px-3 py-2 flex items-center gap-2" style={{ background: th.lightBg }}>
                  <span className="min-w-0 flex-1">
                    <p className="text-[12px] font-semibold truncate" style={{ color: th.inkText }}>{s.title}</p>
                    <p className="text-[10px]" style={{ color: inv?.status === 'pending' ? ACCENT : th.soft }}>
                      {inv?.status === 'pending' ? 'Ждём подтверждения владельца' : s.location}
                    </p>
                  </span>
                  <button type="button" aria-label="Убрать метку" onClick={() => {
                    setSoundIds((prev) => prev.filter((id) => id !== String(s.id)));
                    setInvites((prev) => prev.filter((i) => i.soundId !== String(s.id)));
                  }}>
                    <X size={14} color={th.muted} />
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-3xl p-4" style={{ background: th.cardBg }}>
          <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: th.soft }}>Участники</p>
          <p className="text-[11px] mb-3" style={{ color: th.muted }}>Добавьте людей из Полёвки. Владельцы чужих меток получат приглашение отдельно.</p>
          <button type="button" onClick={() => setOpenPeople((v) => !v)}
            className="w-full h-11 rounded-2xl px-3 flex items-center gap-2 text-left" style={{ background: th.lightBg }}>
            <UserPlus size={15} color={th.soft} />
            <span className="flex-1 text-[13px]" style={{ color: memberQ ? th.inkText : th.soft }}>{memberQ || 'Выбрать пользователя'}</span>
            <ChevronDown size={14} color={th.muted} />
          </button>
          {openPeople && (
            <div className="mt-2 rounded-2xl overflow-hidden" style={{ background: th.lightBg }}>
              <input value={memberQ} onChange={(e) => setMemberQ(e.target.value)} placeholder="Имя или логин"
                className="w-full px-3 py-2.5 text-[13px] outline-none bg-transparent" style={{ color: th.inkText }}
                aria-label="Поиск участников" />
              <div className="max-h-52 overflow-y-auto scrollbar-none">
                {people.map((p) => {
                  const login = String(p.loginName || p.login || '').replace(/^@/, '').toLowerCase();
                  const name = String(p.displayName || p.username || login);
                  return (
                    <button key={login} type="button" onClick={() => {
                      setMembers((prev) => prev.includes(login) ? prev : [...prev, login]);
                      setOpenPeople(false);
                      setMemberQ('');
                    }}
                      className="w-full text-left px-3 py-2.5" style={{ borderTop: `1px solid ${th.border}` }}>
                      <span className="block text-[12px] font-semibold truncate" style={{ color: th.inkText }}>{name}</span>
                      <span className="block text-[10px]" style={{ color: th.soft }}>@{login}</span>
                    </button>
                  );
                })}
                {!people.length && <p className="px-3 py-4 text-[11px] text-center" style={{ color: th.soft }}>Никого не нашлось</p>}
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {members.map((login) => (
              <span key={login} className="h-8 pl-3 pr-1.5 rounded-full inline-flex items-center gap-1 text-[11px] font-semibold" style={{ background: th.lightBg, color: th.muted }}>
                @{login}
                <button type="button" aria-label="Убрать участника" onClick={() => setMembers((prev) => prev.filter((m) => m !== login))}>
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        </section>

        <section className="rounded-3xl p-4" style={{ background: th.cardBg }}>
          <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: th.soft }}>Маршрут</p>
          <p className="text-[11px] mb-3" style={{ color: th.muted }}>{route.length ? `${route.length} точек на карте` : 'Маршрут пока не нарисован'}</p>
          <button type="button" className="w-full py-3 rounded-2xl text-[12px] font-semibold" style={{ background: th.lightBg, color: th.muted }}
            onClick={() => { setPickMode('route'); push({ type: 'pick-location', mode: 'route' }); }}>
            {route.length ? 'Править маршрут' : 'Нарисовать маршрут на карте'}
          </button>
        </section>

        <button disabled={busy} className="w-full py-3.5 rounded-2xl text-sm font-bold text-white" style={{ background: ACCENT }} onClick={() => void save()}>
          {busy ? 'Сохранение…' : 'Сохранить экспедицию'}
        </button>
      </div>
      {fullPhoto != null && gallery.length > 0 && (
        <PhotoLightbox images={gallery} index={Math.min(fullPhoto, gallery.length - 1)} title={title || 'Фото'}
          onClose={() => setFullPhoto(null)} onIndex={setFullPhoto} />
      )}
    </div>
  );
}

export function PickLocationScreen({ mode = 'point', onBack }: { mode?: 'point' | 'route'; onBack: () => void }) {
  const th = useTh();
  const { filteredSounds, setPickedPoint, setPickMode, setRouteDraft, routeDraft, pickedPoint, clearMapPick } = useData();
  const { toast } = useUi();
  const leavePick = () => {
    if (mode === 'point' && !pickedPoint) clearMapPick();
    else setPickMode(null);
    onBack();
  };
  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      <ScreenHeader title={mode === 'route' ? 'Маршрут' : 'Точка на карте'} onBack={leavePick} />
      <div className="relative flex-1">
        <SoundMap sounds={filteredSounds} activeId={null} pickMode
          pickMarker={pickedPoint}
          route={routeDraft}
          onSelect={() => {}}
          onPick={(pt) => {
            if (mode === 'route') {
              setRouteDraft((p) => [...p, pt]);
              toast('Точка добавлена');
            } else {
              setPickedPoint(pt);
              setPickMode(null);
              toast('Точка выбрана');
              onBack();
            }
          }} />
      </div>
      {mode === 'route' && (
        <button className="m-3 py-3 rounded-2xl text-sm font-bold text-white" style={{ background: ACCENT }}
          onClick={() => { setPickMode(null); onBack(); }}>Готово ({routeDraft.length})</button>
      )}
    </div>
  );
}
