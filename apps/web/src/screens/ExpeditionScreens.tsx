import { useEffect, useMemo, useState } from 'react';
import { apiSyncJson, soundsByAuthor, uploadUserMedia, type Expedition, type ExpeditionInvite, type Sound } from '@polevka/core';
import { color, pinColor, typeMeta } from '@polevka/design';
import { ChevronDown, Clock, ImagePlus, MapPin, Search, X } from 'lucide-react';
import { ScreenHeader } from '../primitives/ui';
import { PhotoLightbox, PhotoStrip } from '../primitives/PhotoCarousel';
import { SoundMap } from '../lib/SoundMap';
import { isOwnSound, ownerOfSound, sendExpeditionInvites } from '../lib/expedition-invite';
import { useAuth } from '../state/AuthContext';
import { useData } from '../state/DataContext';
import { useNav } from '../state/NavContext';
import { useTh } from '../state/ThemeContext';
import { useUi } from '../state/UiContext';

const SAGE = color.sage;
const OLIVE = color.olive;
const ACCENT = color.accent;

export function ExpeditionDetailScreen({ exp, onBack }: { exp: Expedition; onBack: () => void }) {
  const th = useTh();
  const { sounds, setRoutePreview } = useData();
  const { user } = useAuth();
  const { push } = useNav();
  const route = exp.route || [];
  const linked = sounds.filter((s) => (exp.soundIds || []).map(String).includes(String(s.id)) || String(s.sessionId) === String(exp.id));
  const mine = String(exp.ownerLogin || '').toLowerCase() === user?.loginName;
  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      <ScreenHeader title={exp.title} onBack={onBack} right={mine ? (
        <button className="text-[10px] font-semibold" style={{ color: ACCENT }} onClick={() => push({ type: 'expedition-edit', exp })}>Изменить</button>
      ) : undefined} />
      <div className="flex-1 overflow-y-auto scrollbar-none p-4">
        <div className="rounded-3xl p-5 mb-3 text-center" style={{ background: th.cardBg }}>
          <div className="text-5xl mb-3">{exp.emoji || '🗺️'}</div>
          <p className="text-sm font-bold mb-1" style={{ color: th.inkText }}>{exp.title}</p>
          <p className="text-xs mb-4" style={{ color: OLIVE }}>{exp.preview || exp.desc}</p>
          <div className="flex justify-around">
            {[{ icon: <Clock size={13} />, val: exp.dur || '—', label: 'Время' },
              { icon: <MapPin size={13} />, val: String(exp.n || route.length || '—'), label: 'Точек' }].map(({ icon, val, label }) => (
              <div key={label} className="text-center">
                <div className="flex justify-center mb-0.5" style={{ color: SAGE }}>{icon}</div>
                <p className="text-sm font-bold" style={{ color: th.inkText }}>{val}</p>
                <p className="text-[9px]" style={{ color: SAGE }}>{label}</p>
              </div>
            ))}
          </div>
        </div>
        {!!route.length && (
          <div className="relative h-48 rounded-3xl overflow-hidden mb-3">
            <SoundMap sounds={linked} activeId={null} onSelect={(s) => push({ type: 'sound-detail', sound: s })} route={route} />
          </div>
        )}
        {!!(exp.photos || []).length && (
          <PhotoStrip images={(exp.photos || []).filter(Boolean)} title={exp.title} />
        )}
        {linked.map((s) => (
          <button key={String(s.id)} onClick={() => push({ type: 'sound-detail', sound: s })} className="w-full text-left rounded-2xl p-3 mb-2" style={{ background: th.cardBg }}>
            <p className="text-xs font-bold" style={{ color: th.inkText }}>{s.title}</p>
            <p className="text-[10px]" style={{ color: SAGE }}>{s.location}</p>
          </button>
        ))}
        {!!route.length && (
          <button className="text-[10px] font-semibold" style={{ color: ACCENT }} onClick={() => { setRoutePreview(route); push({ type: 'pick-location', mode: 'route' }); }}>Показать маршрут на карте</button>
        )}
      </div>
    </div>
  );
}

export function ExpeditionEditScreen({ exp, onBack }: { exp?: Expedition; onBack: () => void }) {
  const th = useTh();
  const { user } = useAuth();
  const { profiles, sounds, mail, reload, reloadMail, routeDraft, setRouteDraft, setPickMode } = useData();
  const { toast } = useUi();
  const { push } = useNav();
  const [title, setTitle] = useState(exp?.title || '');
  const [desc, setDesc] = useState(exp?.desc || '');
  const [dur, setDur] = useState(exp?.dur || '');
  const [emoji, setEmoji] = useState(exp?.emoji || '🗺️');
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

  const mineSounds = useMemo(
    () => (user ? soundsByAuthor(sounds, user.loginName, user.username) : []),
    [sounds, user],
  );
  const pool = scope === 'mine' ? mineSounds : sounds;
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
            <label className="flex-1 min-w-0 text-[10px] font-semibold" style={{ color: SAGE }}>Название
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например, Дон на рассвете"
                className="mt-1 w-full rounded-2xl px-3 py-2.5 text-sm outline-none" style={{ background: th.lightBg, color: th.inkText }} />
            </label>
          </div>
          <label className="text-[10px] font-semibold" style={{ color: SAGE }}>Описание
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Куда идём и что записываем"
              className="mt-1 w-full rounded-2xl px-3 py-2.5 text-sm outline-none min-h-[88px]" style={{ background: th.lightBg, color: th.inkText }} />
          </label>
          <label className="text-[10px] font-semibold" style={{ color: SAGE }}>Длительность
            <input value={dur} onChange={(e) => setDur(e.target.value)} placeholder="2–3 часа"
              className="mt-1 w-full rounded-2xl px-3 py-2.5 text-sm outline-none" style={{ background: th.lightBg, color: th.inkText }} />
          </label>
        </section>

        <section className="rounded-3xl p-4" style={{ background: th.cardBg }}>
          <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: SAGE }}>Фото</p>
          <p className="text-[11px] mb-3" style={{ color: OLIVE }}>До шести кадров. Перетащите или выберите файлы.</p>
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
                <ImagePlus size={18} color={SAGE} />
                <span className="text-[10px] font-semibold" style={{ color: SAGE }}>Добавить</span>
                <input type="file" accept="image/*" multiple className="hidden"
                  onChange={(e) => { addPhotos(Array.from(e.target.files || [])); e.target.value = ''; }} />
              </label>
            )}
          </div>
        </section>

        <section className="rounded-3xl p-4" style={{ background: th.cardBg }}>
          <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: SAGE }}>Метки</p>
          <div className="flex gap-1 p-1 rounded-2xl mb-2" style={{ background: th.lightBg }}>
            {([['mine', 'Мои метки'], ['all', 'Все метки']] as const).map(([id, label]) => (
              <button key={id} type="button" onClick={() => setScope(id)}
                className="flex-1 py-2 rounded-xl text-[11px] font-semibold"
                style={{ background: scope === id ? th.cardBg : 'transparent', color: scope === id ? ACCENT : OLIVE }}>
                {label}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setOpenList((v) => !v)}
            className="w-full h-11 rounded-2xl px-3 flex items-center gap-2 text-left" style={{ background: th.lightBg }}>
            <Search size={15} color={SAGE} />
            <span className="flex-1 text-[13px]" style={{ color: q ? th.inkText : SAGE }}>{q || 'Выбрать метку'}</span>
            <ChevronDown size={14} color={OLIVE} />
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
                      <span className="block text-[10px] truncate" style={{ color: SAGE }}>
                        {typeMeta[String(s.type || '')]?.label || 'Метка'} · {s.location}
                        {!isOwnSound(s, user?.loginName || '', profiles) ? ' · приглашение' : ''}
                      </span>
                    </span>
                  </button>
                ))}
                {!filtered.length && <p className="px-3 py-4 text-[11px] text-center" style={{ color: SAGE }}>Нет подходящих меток</p>}
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
                    <p className="text-[10px]" style={{ color: inv?.status === 'pending' ? ACCENT : SAGE }}>
                      {inv?.status === 'pending' ? 'Ждём подтверждения владельца' : s.location}
                    </p>
                  </span>
                  <button type="button" aria-label="Убрать метку" onClick={() => {
                    setSoundIds((prev) => prev.filter((id) => id !== String(s.id)));
                    setInvites((prev) => prev.filter((i) => i.soundId !== String(s.id)));
                  }}>
                    <X size={14} color={OLIVE} />
                  </button>
                </div>
              );
            })}
          </div>
          {!!members.length && (
            <p className="text-[10px] mt-2" style={{ color: SAGE }}>Участники: {members.join(', ')}</p>
          )}
        </section>

        <section className="rounded-3xl p-4" style={{ background: th.cardBg }}>
          <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: SAGE }}>Маршрут</p>
          <p className="text-[11px] mb-3" style={{ color: OLIVE }}>{route.length ? `${route.length} точек на карте` : 'Маршрут пока не нарисован'}</p>
          <button type="button" className="w-full py-3 rounded-2xl text-[12px] font-semibold" style={{ background: th.lightBg, color: OLIVE }}
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
  const { filteredSounds, setPickedPoint, setPickMode, setRouteDraft, routeDraft, pickedPoint } = useData();
  const { toast } = useUi();
  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      <ScreenHeader title={mode === 'route' ? 'Маршрут' : 'Точка на карте'} onBack={() => { setPickMode(null); onBack(); }} />
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
