import { useState } from 'react';
import { apiSyncJson, uploadUserMedia, type Expedition } from '@polevka/core';
import { color } from '@polevka/design';
import { Clock, MapPin } from 'lucide-react';
import { ScreenHeader } from '../primitives/ui';
import { SoundMap } from '../lib/SoundMap';
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
          <div className="flex gap-2 overflow-x-auto mb-3">
            {(exp.photos || []).map((src) => (
              <img key={src} src={src} alt="" className="w-20 h-20 rounded-2xl object-cover flex-shrink-0" />
            ))}
          </div>
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
  const { profiles, reload, routeDraft, setRouteDraft, setPickMode } = useData();
  const { toast } = useUi();
  const { push } = useNav();
  const [title, setTitle] = useState(exp?.title || '');
  const [desc, setDesc] = useState(exp?.desc || '');
  const [dur, setDur] = useState(exp?.dur || '');
  const [emoji, setEmoji] = useState(exp?.emoji || '🗺️');
  const [members, setMembers] = useState((exp?.members || []).join(', '));
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const route = routeDraft.length ? routeDraft : (exp?.route || []);

  const save = async () => {
    if (!user) return;
    if (!title.trim()) { toast('Название экспедиции'); return; }
    setBusy(true);
    try {
      const id = exp?.id || `x${Date.now()}`;
      const photos = [...(exp?.photos || [])];
      for (const file of photoFiles.slice(0, 4)) {
        photos.push(await uploadUserMedia(file, file.name, file.type || 'image/jpeg'));
      }
      const session: Expedition = {
        id,
        title: title.trim(),
        desc: desc.trim(),
        preview: desc.trim(),
        dur: dur.trim(),
        emoji,
        n: route.length,
        ownerLogin: user.loginName,
        members: members.split(',').map((m) => m.trim()).filter(Boolean),
        route,
        photos: photos.slice(0, 8),
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
      setRouteDraft([]);
      toast('Экспедиция сохранена');
      await reload();
      onBack();
    } catch (e: unknown) {
      toast((e as Error).message || 'Не удалось сохранить');
    } finally { setBusy(false); }
  };

  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      <ScreenHeader title={exp ? 'Экспедиция' : 'Новая экспедиция'} onBack={onBack} />
      <div className="p-5 flex flex-col gap-3 overflow-y-auto">
        <label className="text-[10px] font-semibold" style={{ color: SAGE }}>Название
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-2xl px-3 py-2 text-sm outline-none" style={{ background: th.cardBg, color: th.inkText }} />
        </label>
        <label className="text-[10px] font-semibold" style={{ color: SAGE }}>Описание
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} className="mt-1 w-full rounded-2xl px-3 py-2 text-sm outline-none min-h-[80px]" style={{ background: th.cardBg, color: th.inkText }} />
        </label>
        <label className="text-[10px] font-semibold" style={{ color: SAGE }}>Длительность
          <input value={dur} onChange={(e) => setDur(e.target.value)} className="mt-1 w-full rounded-2xl px-3 py-2 text-sm outline-none" style={{ background: th.cardBg, color: th.inkText }} />
        </label>
        <label className="text-[10px] font-semibold" style={{ color: SAGE }}>Эмодзи
          <input value={emoji} onChange={(e) => setEmoji(e.target.value)} className="mt-1 w-full rounded-2xl px-3 py-2 text-sm outline-none" style={{ background: th.cardBg, color: th.inkText }} />
        </label>
        <label className="text-[10px] font-semibold" style={{ color: SAGE }}>Участники (логины через запятую)
          <input value={members} onChange={(e) => setMembers(e.target.value)} className="mt-1 w-full rounded-2xl px-3 py-2 text-sm outline-none" style={{ background: th.cardBg, color: th.inkText }} />
        </label>
        <label className="text-[10px] font-semibold" style={{ color: SAGE }}>Фото
          <input type="file" accept="image/*" multiple className="mt-1 block w-full text-[11px]"
            onChange={(e) => setPhotoFiles(Array.from(e.target.files || []).slice(0, 4))} />
        </label>
        {!!(exp?.photos || []).length && (
          <div className="flex gap-2 overflow-x-auto">
            {(exp?.photos || []).map((src) => (
              <img key={src} src={src} alt="" className="w-14 h-14 rounded-xl object-cover" />
            ))}
          </div>
        )}
        <p className="text-[10px]" style={{ color: SAGE }}>Точек маршрута: {route.length}</p>
        <button className="py-2 rounded-2xl text-[11px] font-semibold" style={{ background: th.lightBg, color: OLIVE }}
          onClick={() => { setPickMode('route'); push({ type: 'pick-location', mode: 'route' }); }}>Нарисовать маршрут на карте</button>
        <button disabled={busy} className="py-3 rounded-2xl text-sm font-bold text-white" style={{ background: ACCENT }} onClick={() => void save()}>
          {busy ? 'Сохранение…' : 'Сохранить'}
        </button>
      </div>
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
