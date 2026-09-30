import { useMemo, useState } from 'react';
import {
  apiSyncJson, apiTranslate, buildUcsFileName, FIELD_MICROPHONES, FIELD_RECORDERS,
  preparePublishWav, spamGuardCheck, spamGuardMessage, ucsCategories, ucsStructure,
  uploadUserMedia,
} from '@polevka/core';
import { color } from '@polevka/design';
import { ScreenHeader } from '../primitives/ui';
import { useAuth } from '../state/AuthContext';
import { useData } from '../state/DataContext';
import { useNav } from '../state/NavContext';
import { useTh } from '../state/ThemeContext';
import { useUi } from '../state/UiContext';
import { getDraftRecording, setDraftRecording } from '../lib/record-buffer';

const SAGE = color.sage;
const OLIVE = color.olive;
const ACCENT = color.accent;

const LICENSES = ['CC BY 4.0', 'CC BY-SA 4.0', 'CC BY-NC 4.0', 'CC0'];
const PRINCIPLES = ['стерео XY', 'стерео ORTF', 'моно', 'бинаурал', 'ambisonic', 'другой'];
const CHANNELS = ['mono', 'stereo', 'quad', 'ambisonic'];

type UcsCat = Record<string, Array<{ id: string; name: string }>>;

export function AddSoundScreen({ onBack }: { onBack: () => void }) {
  const th = useTh();
  const { toast } = useUi();
  const { reload, profiles, pickedPoint, setPickedPoint, setPickMode } = useData();
  const { user } = useAuth();
  const { push } = useNav();
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [location, setLocation] = useState('');
  const [fxName, setFxName] = useState('');
  const [kind, setKind] = useState('nature');
  const [eco, setEco] = useState('geophony');
  const [ucsCat, setUcsCat] = useState('AMBIENCE');
  const [ucsId, setUcsId] = useState('AMBMisc');
  const [recorder, setRecorder] = useState('');
  const [microphone, setMicrophone] = useState('');
  const [channels, setChannels] = useState('stereo');
  const [weather, setWeather] = useState('');
  const [principle, setPrinciple] = useState('стерео XY');
  const [license, setLicense] = useState(LICENSES[0]);
  const [sessionId, setSessionId] = useState('');
  const [busy, setBusy] = useState(false);
  const [fileLabel, setFileLabel] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const draft = getDraftRecording();
  const mySessions = (profiles.find((p) => String(p.loginName).toLowerCase() === user?.loginName)?.sessions || []);
  const structure = ucsStructure as UcsCat;
  const subcats = structure[ucsCat] || [];

  const ucsFilePreview = useMemo(() => buildUcsFileName({
    catId: ucsId,
    fxName: fxName || title || 'Untitled',
    creatorId: user?.loginName || 'Anon',
    sourceId: mySessions.find((s) => s.id === sessionId)?.title || 'NONE',
    channels,
    location,
  }) as string, [ucsId, fxName, title, user, mySessions, sessionId, channels, location]);

  const onPickFile = async (file: File | null) => {
    if (!file) return;
    let durationSec = 1;
    try {
      durationSec = await new Promise<number>((resolve, reject) => {
        const a = document.createElement('audio');
        a.preload = 'metadata';
        a.onloadedmetadata = () => {
          const d = Number.isFinite(a.duration) ? Math.max(1, Math.round(a.duration)) : 1;
          URL.revokeObjectURL(a.src);
          resolve(d);
        };
        a.onerror = () => { URL.revokeObjectURL(a.src); reject(new Error('metadata')); };
        a.src = URL.createObjectURL(file);
      });
    } catch { durationSec = 1; }
    setDraftRecording({ blob: file, durationSec, mime: file.type || 'audio/wav' });
    setFileLabel(file.name);
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ''));
    toast('Файл выбран');
  };

  const translateFx = async () => {
    const src = (fxName || title).trim();
    if (!src) { toast('Сначала введите FXName'); return; }
    try {
      const data = await apiTranslate(src) as { translations?: Array<{ text?: string }> };
      const text = String(data.translations?.[0]?.text || '').trim();
      if (text) { setFxName(text); toast('Переведено'); }
      else toast('Пустой ответ перевода');
    } catch (e: unknown) {
      toast((e as Error).message || 'Перевод недоступен');
    }
  };

  const publish = async (status: 'draft' | 'pending') => {
    const guard = spamGuardCheck('publish');
    if (!guard.ok) { toast(spamGuardMessage(guard)); return; }
    if (!title.trim()) { toast('Укажите название'); return; }
    const rec = getDraftRecording();
    if (!rec?.blob) { toast('Запишите звук или выберите файл'); return; }
    setBusy(true);
    try {
      const prepared = await preparePublishWav(rec.blob, rec.blob instanceof File ? rec.blob.name : 'audio.wav', {
        title: title.trim(),
        description: desc.trim(),
        location: location.trim(),
        recordist: user?.username,
        catId: ucsId,
        fxName: fxName || title,
        creatorId: user?.loginName,
        sourceId: mySessions.find((s) => s.id === sessionId)?.title || 'NONE',
        channels,
        ucsCategory: ucsCat,
      });
      const url = await uploadUserMedia(prepared.blob, prepared.fileName, 'audio/wav');
      const images: string[] = [];
      for (const photo of photos.slice(0, 3)) {
        images.push(await uploadUserMedia(photo, photo.name, photo.type || 'image/jpeg'));
      }
      let lat = pickedPoint?.lat ?? 47.2313;
      let lng = pickedPoint?.lng ?? 39.7233;
      if (!pickedPoint) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 4000 });
          });
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        } catch { /* Rostov */ }
      }
      const dur = `${Math.floor(rec.durationSec / 60)}:${String(rec.durationSec % 60).padStart(2, '0')}`;
      const gear = [recorder, microphone].filter(Boolean).join(' · ');
      const record = {
        id: `p${Date.now()}`,
        title: title.trim(),
        description: desc.trim(),
        location: location.trim() || 'Ростовская область',
        type: kind,
        ecoCategory: eco,
        ucsCat,
        ucsCatId: ucsId,
        fxName: fxName || title,
        gear,
        recorder,
        microphone,
        channels,
        weather,
        principle,
        license,
        sessionId: sessionId || null,
        images,
        formatLabel: prepared.formatLabel,
        status,
        recordist: user?.username,
        user: user?.username,
        recordistId: user?.loginName,
        lat, lng, duration: dur, url, comments: [],
      };
      await apiSyncJson('map_data.json', [record]);
      setDraftRecording(null);
      setPickedPoint(null);
      toast(status === 'draft' ? 'Черновик сохранён' : 'Отправлено на модерацию');
      await reload();
      onBack();
    } catch (e: unknown) {
      toast((e as Error).message || 'Не удалось опубликовать');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      <ScreenHeader title="Добавить звук" onBack={onBack} />
      <div className="p-5 flex flex-col gap-3 overflow-y-auto">
        {(draft || fileLabel) && <p className="text-[10px]" style={{ color: SAGE }}>{fileLabel || `Черновик записи: ${draft?.durationSec} с`}</p>}
        <label className="text-[10px] font-semibold" style={{ color: SAGE }}>Файл
          <input type="file" accept="audio/*,.webm,.ogg,.mp3,.wav,.m4a" className="mt-1 block w-full text-[11px]"
            onChange={(e) => void onPickFile(e.target.files?.[0] || null)} />
        </label>
        <Field label="Название" value={title} onChange={setTitle} th={th} />
        <Field label="FXName" value={fxName} onChange={setFxName} th={th} />
        <button type="button" className="text-[10px] self-start font-semibold" style={{ color: ACCENT }} onClick={() => void translateFx()}>Перевести FXName (RU→EN)</button>
        <Field label="Место" value={location} onChange={setLocation} th={th} />
        <p className="text-[10px]" style={{ color: SAGE }}>
          Координаты: {pickedPoint ? `${pickedPoint.lat.toFixed(5)}, ${pickedPoint.lng.toFixed(5)}` : 'геолокация или Ростов'}
        </p>
        <button type="button" className="py-2 rounded-2xl text-[11px] font-semibold" style={{ background: th.lightBg, color: OLIVE }}
          onClick={() => { setPickMode('point'); push({ type: 'pick-location', mode: 'point' }); }}>Указать точку на карте</button>
        <p className="text-[10px] font-semibold" style={{ color: SAGE }}>Тип</p>
        <div className="flex flex-wrap gap-1.5">
          {[['nature', 'Природа'], ['water', 'Вода'], ['urban', 'Город'], ['forest', 'Лес'], ['birds', 'Птицы']].map(([id, lab]) => (
            <Chip key={id} on={kind === id} onClick={() => setKind(id)} label={lab} th={th} />
          ))}
        </div>
        <p className="text-[10px] font-semibold" style={{ color: SAGE }}>Экокатегория</p>
        <div className="flex flex-wrap gap-1.5">
          {[['geophony', 'Геофония'], ['biophony', 'Биофония'], ['anthrophony', 'Антропофония']].map(([id, lab]) => (
            <Chip key={id} on={eco === id} onClick={() => setEco(id)} label={lab} th={th} />
          ))}
        </div>
        <label className="text-[10px] font-semibold" style={{ color: SAGE }}>UCS категория
          <select value={ucsCat} onChange={(e) => {
            const next = e.target.value;
            setUcsCat(next);
            const first = (structure[next] || [])[0];
            if (first) setUcsId(first.id);
          }} className="mt-1 w-full rounded-2xl px-3 py-2 text-xs outline-none" style={{ background: th.cardBg, color: th.inkText }}>
            {(ucsCategories as string[]).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="text-[10px] font-semibold" style={{ color: SAGE }}>UCS CatID
          <select value={ucsId} onChange={(e) => setUcsId(e.target.value)} className="mt-1 w-full rounded-2xl px-3 py-2 text-xs outline-none" style={{ background: th.cardBg, color: th.inkText }}>
            {subcats.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <p className="text-[10px] break-all" style={{ color: SAGE }}>Файл: {ucsFilePreview}</p>
        <label className="text-[10px] font-semibold" style={{ color: SAGE }}>Рекордер
          <input list="recorders" value={recorder} onChange={(e) => setRecorder(e.target.value)} className="mt-1 w-full rounded-2xl px-3 py-2 text-xs outline-none" style={{ background: th.cardBg, color: th.inkText }} />
          <datalist id="recorders">{(FIELD_RECORDERS as string[]).map((g) => <option key={g} value={g} />)}</datalist>
        </label>
        <label className="text-[10px] font-semibold" style={{ color: SAGE }}>Микрофон
          <input list="mics" value={microphone} onChange={(e) => setMicrophone(e.target.value)} className="mt-1 w-full rounded-2xl px-3 py-2 text-xs outline-none" style={{ background: th.cardBg, color: th.inkText }} />
          <datalist id="mics">{(FIELD_MICROPHONES as string[]).map((g) => <option key={g} value={g} />)}</datalist>
        </label>
        <label className="text-[10px] font-semibold" style={{ color: SAGE }}>Каналы
          <select value={channels} onChange={(e) => setChannels(e.target.value)} className="mt-1 w-full rounded-2xl px-3 py-2 text-xs outline-none" style={{ background: th.cardBg, color: th.inkText }}>
            {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="text-[10px] font-semibold" style={{ color: SAGE }}>Принцип записи
          <select value={principle} onChange={(e) => setPrinciple(e.target.value)} className="mt-1 w-full rounded-2xl px-3 py-2 text-xs outline-none" style={{ background: th.cardBg, color: th.inkText }}>
            {PRINCIPLES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <Field label="Погода" value={weather} onChange={setWeather} th={th} />
        <label className="text-[10px] font-semibold" style={{ color: SAGE }}>Лицензия
          <select value={license} onChange={(e) => setLicense(e.target.value)} className="mt-1 w-full rounded-2xl px-3 py-2 text-xs outline-none" style={{ background: th.cardBg, color: th.inkText }}>
            {LICENSES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="text-[10px] font-semibold" style={{ color: SAGE }}>Экспедиция
          <select value={sessionId} onChange={(e) => setSessionId(e.target.value)} className="mt-1 w-full rounded-2xl px-3 py-2 text-xs outline-none" style={{ background: th.cardBg, color: th.inkText }}>
            <option value="">— не привязывать —</option>
            {mySessions.map((s) => <option key={String(s.id)} value={String(s.id)}>{s.title}</option>)}
          </select>
        </label>
        <label className="text-[10px] font-semibold" style={{ color: SAGE }}>Фото сцены (до 3)
          <input type="file" accept="image/*" multiple className="mt-1 block w-full text-[11px]"
            onChange={(e) => setPhotos(Array.from(e.target.files || []).slice(0, 3))} />
        </label>
        <label className="text-[10px] font-semibold" style={{ color: SAGE }}>Описание
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} className="mt-1 w-full rounded-2xl px-3 py-3 text-sm outline-none min-h-[88px]" style={{ background: th.cardBg, color: th.inkText }} />
        </label>
        <button disabled={busy} onClick={() => void publish('draft')} className="py-3 rounded-2xl text-sm font-bold" style={{ background: th.lightBg, color: OLIVE }}>
          {busy ? '…' : 'Сохранить черновик'}
        </button>
        <button disabled={busy} onClick={() => void publish('pending')} className="py-3.5 rounded-2xl text-sm font-bold text-white" style={{ background: ACCENT }}>
          {busy ? 'Отправка…' : 'Отправить на модерацию'}
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, th }: { label: string; value: string; onChange: (v: string) => void; th: { cardBg: string; inkText: string } }) {
  return (
    <label className="text-[10px] font-semibold" style={{ color: SAGE }}>{label}
      <input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-2xl px-3 py-2 text-sm outline-none" style={{ background: th.cardBg, color: th.inkText }} />
    </label>
  );
}

function Chip({ on, onClick, label, th }: { on: boolean; onClick: () => void; label: string; th: { lightBg: string } }) {
  return (
    <button type="button" onClick={onClick} className="px-3 py-1.5 rounded-full text-[10px] font-semibold"
      style={{ background: on ? ACCENT : th.lightBg, color: on ? '#fff' : OLIVE }}>{label}</button>
  );
}
