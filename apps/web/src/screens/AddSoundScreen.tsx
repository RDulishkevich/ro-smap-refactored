import { useEffect, useMemo, useState } from 'react';
import {
  apiSyncJson, apiTranslate, buildUcsFileName, FIELD_MICROPHONES, FIELD_RECORDERS,
  preparePublishWav, spamGuardCheck, spamGuardMessage, ucsCategories, ucsStructure,
  uploadUserMedia, type Sound,
} from '@polevka/core';
import { color } from '@polevka/design';
import { ScreenHeader } from '../primitives/ui';
import { AudioEditor } from '../primitives/AudioEditor';
import { useAuth } from '../state/AuthContext';
import { useData } from '../state/DataContext';
import { useNav } from '../state/NavContext';
import { useTh } from '../state/ThemeContext';
import { useUi } from '../state/UiContext';
import { useIsDesktop } from '../lib/use-media';
import { getDraftRecording, setDraftRecording } from '../lib/record-buffer';
import { applyTrimGain } from '../lib/waveform';

const SAGE = color.sage;
const OLIVE = color.olive;
const ACCENT = color.accent;

const LICENSES = ['CC BY 4.0', 'CC BY-SA 4.0', 'CC BY-NC 4.0', 'CC0'];
const PRINCIPLES = ['стерео XY', 'стерео ORTF', 'моно', 'бинаурал', 'ambisonic', 'другой'];
const CHANNELS = ['mono', 'stereo', 'quad', 'ambisonic'];

type UcsCat = Record<string, Array<{ id: string; name: string }>>;

export function AddSoundScreen({ onBack, edit }: { onBack: () => void; edit?: Sound }) {
  const th = useTh();
  const desktop = useIsDesktop();
  const { toast } = useUi();
  const { reload, profiles, pickedPoint, setPickedPoint, setPickMode } = useData();
  const { user } = useAuth();
  const { push } = useNav();
  const [title, setTitle] = useState(edit?.title || '');
  const [desc, setDesc] = useState(String(edit?.description || ''));
  const [location, setLocation] = useState(edit?.location || '');
  const [fxName, setFxName] = useState(String(edit?.fxName || ''));
  const [kind, setKind] = useState(String(edit?.type || 'nature'));
  const [eco, setEco] = useState(String(edit?.ecoCategory || 'geophony'));
  const [ucsCat, setUcsCat] = useState(String(edit?.ucsCat || 'AMBIENCE'));
  const [ucsId, setUcsId] = useState(String(edit?.ucsCatId || 'AMBMisc'));
  const [recorder, setRecorder] = useState(String(edit?.recorder || ''));
  const [microphone, setMicrophone] = useState(String(edit?.microphone || ''));
  const [channels, setChannels] = useState(String(edit?.channels || 'stereo'));
  const [weather, setWeather] = useState(String(edit?.weather || ''));
  const [principle, setPrinciple] = useState(String(edit?.principle || 'стерео XY'));
  const [license, setLicense] = useState(String(edit?.license || LICENSES[0]));
  const [sessionId, setSessionId] = useState(String(edit?.sessionId || ''));
  const [busy, setBusy] = useState(false);
  const [fileLabel, setFileLabel] = useState(edit?.url ? 'Текущий файл сохранён' : '');
  const [photos, setPhotos] = useState<File[]>([]);
  const [draft, setDraft] = useState(() => {
    const rec = edit ? null : getDraftRecording();
    if (!rec) return null;
    return { ...rec, trimStart: rec.trimStart ?? 0, trimEnd: rec.trimEnd ?? 1, gain: rec.gain ?? 1 };
  });
  useEffect(() => {
    if (edit) setDraftRecording(null);
  }, [edit]);
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
    setDraftRecording({ blob: file, durationSec, mime: file.type || 'audio/wav', trimStart: 0, trimEnd: 1, gain: 1 });
    setDraft({ blob: file, durationSec, mime: file.type || 'audio/wav', trimStart: 0, trimEnd: 1, gain: 1 });
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
    if (!rec?.blob && !edit?.url) { toast('Запишите звук или выберите файл'); return; }
    setBusy(true);
    try {
      let url = String(edit?.url || '');
      let formatLabel = String(edit?.formatLabel || '');
      let dur = String(edit?.duration || '0:01');
      if (rec?.blob) {
        const trimmed = await applyTrimGain(rec.blob, rec.trimStart ?? 0, rec.trimEnd ?? 1, rec.gain ?? 1);
        const prepared = await preparePublishWav(trimmed.blob, rec.blob instanceof File ? rec.blob.name : 'audio.wav', {
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
        url = await uploadUserMedia(prepared.blob, prepared.fileName, 'audio/wav');
        formatLabel = prepared.formatLabel;
        dur = `${Math.floor(trimmed.durationSec / 60)}:${String(trimmed.durationSec % 60).padStart(2, '0')}`;
      }
      const images: string[] = [...(edit?.images || [])];
      for (const photo of photos.slice(0, 3)) {
        images.push(await uploadUserMedia(photo, photo.name, photo.type || 'image/jpeg'));
      }
      let lat = pickedPoint?.lat ?? Number(edit?.lat) ?? 47.2313;
      let lng = pickedPoint?.lng ?? Number(edit?.lng) ?? 39.7233;
      if (!pickedPoint && edit?.lat == null) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 4000 });
          });
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        } catch { /* Rostov */ }
      }
      const gear = [recorder, microphone].filter(Boolean).join(' · ');
      const record = {
        id: edit?.id ?? `p${Date.now()}`,
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
        images: images.slice(0, 3),
        formatLabel,
        status,
        recordist: user?.username,
        user: user?.username,
        recordistId: user?.loginName,
        lat, lng, duration: dur, url, comments: edit?.comments || [],
      };
      await apiSyncJson('map_data.json', [record]);
      setDraftRecording(null);
      setDraft(null);
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
    <div className="flex flex-col h-full min-h-0" style={{ background: th.phoneBg }}>
      <ScreenHeader title={edit ? 'Редактировать звук' : 'Добавить звук'} onBack={onBack} />
      <div className={`flex-1 min-h-0 overflow-y-auto ${desktop ? 'px-8 py-6' : 'p-5'}`}>
        <div className={desktop ? 'max-w-4xl mx-auto grid grid-cols-2 gap-x-8 gap-y-3' : 'flex flex-col gap-3'}>
        {(draft || fileLabel) && (
          <div className="col-span-2 flex flex-col gap-2">
            {fileLabel && <p className="text-[10px]" style={{ color: SAGE }}>{fileLabel}</p>}
            {draft && (
              <AudioEditor blob={draft.blob} durationSec={draft.durationSec}
                trimStart={draft.trimStart ?? 0} trimEnd={draft.trimEnd ?? 1} gain={draft.gain ?? 1}
                onChange={(next) => {
                  const rec = { ...draft, ...next };
                  setDraft(rec);
                  setDraftRecording(rec);
                }} />
            )}
          </div>
        )}
        <label className="text-[10px] font-semibold col-span-2" style={{ color: SAGE }}>Файл
          <input type="file" accept="audio/*,.webm,.ogg,.mp3,.wav,.m4a" className="mt-1 block w-full text-[11px]"
            onChange={(e) => void onPickFile(e.target.files?.[0] || null)} />
        </label>
        <Field label="Название" value={title} onChange={setTitle} th={th} />
        <div>
          <Field label="FXName" value={fxName} onChange={setFxName} th={th} />
          <button type="button" className="text-[10px] mt-1 font-semibold" style={{ color: ACCENT }} onClick={() => void translateFx()}>Перевести FXName (RU→EN)</button>
        </div>
        <Field label="Место" value={location} onChange={setLocation} th={th} />
        <div>
          <p className="text-[10px]" style={{ color: SAGE }}>
            Координаты: {pickedPoint ? `${pickedPoint.lat.toFixed(5)}, ${pickedPoint.lng.toFixed(5)}` : (edit?.lat != null ? `${Number(edit.lat).toFixed(5)}, ${Number(edit.lng).toFixed(5)}` : 'геолокация или Ростов')}
          </p>
          <button type="button" className="mt-1 py-2 px-3 rounded-2xl text-[11px] font-semibold" style={{ background: th.lightBg, color: OLIVE }}
            onClick={() => {
              setPickMode('point');
              if (desktop) toast('Кликните по карте, чтобы выбрать точку');
              else push({ type: 'pick-location', mode: 'point' });
            }}>Указать точку на карте</button>
        </div>
        <div className="col-span-2">
          <p className="text-[10px] font-semibold mb-1.5" style={{ color: SAGE }}>Тип</p>
          <div className="flex flex-wrap gap-1.5">
            {[['nature', 'Природа'], ['water', 'Вода'], ['urban', 'Город'], ['forest', 'Лес'], ['birds', 'Птицы']].map(([id, lab]) => (
              <Chip key={id} on={kind === id} onClick={() => setKind(id)} label={lab} th={th} />
            ))}
          </div>
        </div>
        <div className="col-span-2">
          <p className="text-[10px] font-semibold mb-1.5" style={{ color: SAGE }}>Экокатегория</p>
          <div className="flex flex-wrap gap-1.5">
            {[['geophony', 'Геофония'], ['biophony', 'Биофония'], ['anthrophony', 'Антропофония']].map(([id, lab]) => (
              <Chip key={id} on={eco === id} onClick={() => setEco(id)} label={lab} th={th} />
            ))}
          </div>
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
        <p className="text-[10px] break-all col-span-2" style={{ color: SAGE }}>Файл: {ucsFilePreview}</p>
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
        <label className="text-[10px] font-semibold col-span-2" style={{ color: SAGE }}>Описание
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
