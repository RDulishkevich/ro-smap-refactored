import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  apiHealth, apiSuggestUcs, apiSyncJson, apiTranslate, buildUcsFileName, FIELD_MICROPHONES, FIELD_RECORDERS,
  normalizeTimeMarkers, preparePublishWav, remapMarkersAfterTrim, spamGuardCheck,
  spamGuardMessage, ucsByCatId, ucsCategories, ucsStructure, uploadUserMedia, newSoundId,
  type Sound, type TimeMarker, type UcsSuggestion, type UploadProgress,
} from '@polevka/core';
import { color, spring, tap, type ThemeTokens } from '@polevka/design';
import { AnimatePresence, motion } from 'motion/react';
import { ImagePlus, Route, Sparkles, X } from 'lucide-react';
import { ScreenHeader } from '../primitives/ui';
import { PhotoLightbox } from '../primitives/PhotoCarousel';
import { AudioEditor } from '../primitives/AudioEditor';
import { FormField, SelectField } from '../primitives/form';
import { UploadProgressBar } from '../primitives/UploadProgress';
import { useAuth } from '../state/AuthContext';
import { useData } from '../state/DataContext';
import { useNav } from '../state/NavContext';
import { useTh } from '../state/ThemeContext';
import { useUi } from '../state/UiContext';
import { useIsDesktop } from '../lib/use-media';
import { getDraftRecording, setDraftRecording } from '../lib/record-buffer';
import { clearAddDraft, readAddDraft, writeAddDraft } from '../lib/add-draft';
import { applyTrimGain, parseDurationLabel } from '../lib/waveform';
import { isAmbisonicChannels, isSoundwalkPrinciple, normalizeRoute } from '../lib/sound-media';
import { useLeaveGuard } from '../lib/use-leave-guard';
import { buildUcsAudioClip } from '../lib/ucs-clip';
import { runSmartCaptcha } from '../lib/smart-captcha';

const ACCENT = color.accent;

const LICENSES = ['CC BY 4.0', 'CC BY-SA 4.0', 'CC BY-NC 4.0', 'CC0'];
const PRINCIPLES = ['стерео XY', 'стерео ORTF', 'моно', 'бинаурал', 'ambisonic', 'Звуковая прогулка (Soundwalk)', 'другой'];
const CHANNELS = ['mono', 'stereo', 'binaural', 'quad', 'ambisonic'];

type UcsCat = Record<string, Array<{ id: string; name: string }>>;
type PubPhase = null | 'prepare' | 'upload' | 'photos' | 'save';

const PUB_LABEL: Record<Exclude<PubPhase, null>, string> = {
  prepare: 'Готовим WAV…',
  upload: 'Загружаем аудио…',
  photos: 'Загружаем фото…',
  save: 'Сохраняем карточку…',
};

export function AddSoundScreen({ onBack, edit }: { onBack: () => void; edit?: Sound }) {
  const th = useTh();
  const desktop = useIsDesktop();
  const { toast } = useUi();
  const { reload, profiles, pickedPoint, setPickMode, routeDraft, setRouteDraft, clearMapPick } = useData();
  const { user, isLoggedIn } = useAuth();
  const { push, reset, requireAuth } = useNav();
  const askedRef = useRef(false);
  const saved = edit ? {} : readAddDraft();
  const [title, setTitle] = useState(edit?.title || saved.title || '');
  const [desc, setDesc] = useState(String(edit?.description || saved.desc || ''));
  const [location, setLocation] = useState(edit?.location || saved.location || '');
  const [fxName, setFxName] = useState(String(edit?.fxName || saved.fxName || ''));
  const [kind, setKind] = useState(String(edit?.type || saved.kind || 'nature'));
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
  const [pubPhase, setPubPhase] = useState<PubPhase>(null);
  const [uploadProg, setUploadProg] = useState<UploadProgress | null>(null);
  const [ucsBusy, setUcsBusy] = useState<'text' | 'audio' | null>(null);
  const [ucsAiOn, setUcsAiOn] = useState<boolean | null>(null);
  const [ucsNote, setUcsNote] = useState('');
  const [fileLabel, setFileLabel] = useState(edit?.url ? 'Текущий файл сохранён' : '');
  const [photos, setPhotos] = useState<File[]>([]);
  const [keptImages, setKeptImages] = useState<string[]>(() => (edit?.images || []).filter(Boolean));
  const [fullPhoto, setFullPhoto] = useState<number | null>(null);
  const [draft, setDraft] = useState(() => {
    const rec = edit ? null : getDraftRecording();
    if (!rec) return null;
    return {
      ...rec,
      trimStart: rec.trimStart ?? 0,
      trimEnd: rec.trimEnd ?? 1,
      gain: rec.gain ?? 1,
      timeMarkers: normalizeTimeMarkers(rec.timeMarkers),
    };
  });
  const [markers, setMarkers] = useState<TimeMarker[]>(() => {
    if (edit) return normalizeTimeMarkers(edit.timeMarkers);
    return normalizeTimeMarkers(getDraftRecording()?.timeMarkers);
  });
  useEffect(() => {
    if (isLoggedIn || askedRef.current) return;
    askedRef.current = true;
    toast('Войдите, чтобы записывать и публиковать');
    void reset({ type: 'auth' });
  }, [isLoggedIn, reset, toast]);

  useEffect(() => {
    void apiHealth()
      .then((d) => setUcsAiOn(!!(d as { ucsAi?: boolean }).ucsAi))
      .catch(() => setUcsAiOn(null));
  }, []);

  const dirty = !!(title.trim() || desc.trim() || draft || fileLabel || photos.length || pickedPoint || routeDraft.length >= 2 || markers.length);
  useLeaveGuard(dirty, clearMapPick);

  useEffect(() => {
    if (edit) setDraftRecording(null);
  }, [edit]);
  useEffect(() => {
    if (edit) return;
    const id = window.setTimeout(() => writeAddDraft({ title, desc, location, fxName, kind }), 400);
    return () => window.clearTimeout(id);
  }, [edit, title, desc, location, fxName, kind]);
  useEffect(() => {
    if (!edit) return;
    const r = normalizeRoute(edit.route);
    if (r.length >= 2) setRouteDraft(r);
  }, [edit, setRouteDraft]);
  const photoUrls = useMemo(() => photos.map((f) => URL.createObjectURL(f)), [photos]);
  const gallery = useMemo(() => [...keptImages, ...photoUrls], [keptImages, photoUrls]);
  useEffect(() => () => { photoUrls.forEach((u) => URL.revokeObjectURL(u)); }, [photoUrls]);
  const slotsLeft = Math.max(0, 3 - keptImages.length - photos.length);
  const isWalk = isSoundwalkPrinciple(principle);
  const mySessions = (profiles.find((p) => String(p.loginName).toLowerCase() === user?.loginName)?.sessions || []);
  const structure = ucsStructure as UcsCat;
  const subcats = structure[ucsCat] || [];

  const fillPercent = useMemo(() => {
    let score = 0;
    if (draft || edit?.url || fileLabel) score += 22;
    if (title.trim()) score += 12;
    if (desc.trim().length >= 12) score += 12;
    else if (desc.trim().length >= 4) score += 6;
    if (fxName.trim()) score += 8;
    const hasPlace = !!(location.trim() || pickedPoint || (isWalk && routeDraft.length >= 2) || edit?.lat != null);
    if (hasPlace) score += 14;
    if (kind) score += 5;
    if (eco) score += 5;
    if (ucsId) score += 8;
    if (recorder || microphone) score += 6;
    if (license) score += 4;
    if (keptImages.length + photos.length > 0) score += 4;
    return Math.min(100, score);
  }, [
    draft, edit?.url, edit?.lat, fileLabel, title, desc, fxName, location, pickedPoint,
    isWalk, routeDraft.length, kind, eco, ucsId, recorder, microphone, license,
    keptImages.length, photos.length,
  ]);

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
    const audioLike = file.type.startsWith('audio/') || /\.(wav|mp3|m4a|ogg|webm|flac|aiff?)$/i.test(file.name);
    if (!audioLike) { toast('Нужен аудиофайл'); return; }
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
    const next = { blob: file, durationSec, mime: file.type || 'audio/wav', trimStart: 0, trimEnd: 1, gain: 1, timeMarkers: [] as TimeMarker[] };
    setDraftRecording(next);
    setDraft(next);
    setMarkers([]);
    setFileLabel(file.name);
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ''));
    toast('Файл выбран');
  };

  const addPhotos = (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (!images.length) return;
    setPhotos((prev) => [...prev, ...images].slice(0, Math.max(0, 3 - keptImages.length)));
  };

  const setPrincipleAndMode = (value: string) => {
    setPrinciple(value);
    if (isSoundwalkPrinciple(value)) {
      if (!location.trim()) setLocation('Маршрут звуковой прогулки');
      setPickMode('route');
      if (routeDraft.length === 0 && pickedPoint) setRouteDraft([pickedPoint]);
    } else if (isAmbisonicChannels(value) || /ambison/i.test(value)) {
      setChannels('ambisonic');
    }
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

  const applyUcsSuggestion = (s: UcsSuggestion) => {
    const meta = (ucsByCatId as Record<string, { category?: string } | undefined>)[s.catId];
    if (meta?.category) {
      setUcsCat(meta.category);
      setUcsId(s.catId);
    } else {
      toast(`CatID ${s.catId} не найден в каталоге — проверьте вручную`);
    }
    if (s.fxName) setFxName(s.fxName.replace(/\s+/g, '_'));
    if (s.title && !title.trim()) setTitle(s.title);
    if (s.kind) setKind(s.kind);
    if (s.ecoCategory) setEco(s.ecoCategory);
    setUcsNote(String(s.rationale || '').trim());
  };

  const suggestFromDescription = async () => {
    if (!isLoggedIn) {
      toast('Войдите, чтобы подобрать UCS');
      requireAuth({ type: 'add-sound', edit });
      return;
    }
    if (desc.trim().length < 8 && title.trim().length < 3) {
      toast('Сначала опишите звук (хотя бы пару предложений)');
      return;
    }
    setUcsBusy('text');
    setUcsNote('');
    try {
      const data = await apiSuggestUcs({
        mode: 'text',
        description: desc.trim(),
        title: title.trim(),
        location: location.trim(),
      }) as { suggestion?: UcsSuggestion; groq?: boolean };
      if (!data.suggestion) throw new Error('empty');
      applyUcsSuggestion(data.suggestion);
      const src = String(data.suggestion.source || '');
      if (src.startsWith('groq')) toast('UCS предложен нейросетью');
      else if (src.includes('fallback')) toast('Нейросеть недоступна — подобран по ключевым словам');
      else toast('UCS подобран по описанию');
    } catch (e: unknown) {
      toast((e as Error).message || 'Не удалось подобрать UCS');
    } finally {
      setUcsBusy(null);
    }
  };

  const suggestFromAudio = async () => {
    if (!isLoggedIn) {
      toast('Войдите, чтобы запустить beta-анализ');
      requireAuth({ type: 'add-sound', edit });
      return;
    }
    const rec = getDraftRecording();
    const source = rec?.blob || (edit?.url ? String(edit.url) : null);
    if (!source) {
      toast('Сначала запишите или выберите аудиофайл');
      return;
    }
    setUcsBusy('audio');
    setUcsNote('');
    try {
      const clip = await buildUcsAudioClip(source);
      const data = await apiSuggestUcs({
        mode: 'audio',
        description: desc.trim(),
        title: title.trim(),
        location: location.trim(),
        audioBase64: clip.audioBase64,
        audioMime: clip.audioMime,
      }) as { suggestion?: UcsSuggestion };
      if (!data.suggestion) throw new Error('empty');
      applyUcsSuggestion(data.suggestion);
      if (data.suggestion.title) setTitle(data.suggestion.title);
      toast('Beta: запись разобрана, UCS заполнен — проверьте');
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      if (err.code === 'ucs_ai_unconfigured') {
        toast('Beta-анализ пока выключен на сервере (нужен GROQ_API_KEY)');
      } else {
        toast(err.message || 'Не удалось проанализировать запись');
      }
    } finally {
      setUcsBusy(null);
    }
  };

  const publish = async (status: 'draft' | 'pending') => {
    if (!isLoggedIn || !user) {
      toast('Войдите, чтобы публиковать');
      requireAuth({ type: 'add-sound', edit });
      return;
    }
    const guard = spamGuardCheck('publish');
    if (!guard.ok) { toast(spamGuardMessage(guard)); return; }
    if (!title.trim()) { toast('Укажите название'); return; }
    const rec = getDraftRecording();
    if (!rec?.blob && !edit?.url) { toast('Запишите звук или выберите файл'); return; }
    if (isSoundwalkPrinciple(principle) && routeDraft.length < 2) {
      toast('Для звуковой прогулки нарисуйте маршрут (минимум 2 точки)');
      return;
    }
    setBusy(true);
    setPubPhase('prepare');
    setUploadProg(null);
    try {
      const captchaToken = status === 'pending'
        ? ((await runSmartCaptcha()) || undefined)
        : undefined;
      let url = String(edit?.url || '');
      let formatLabel = String(edit?.formatLabel || '');
      let dur = String(edit?.duration || '0:01');
      let mediaSoundId = '';
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
        setPubPhase('upload');
        mediaSoundId = String(edit?.id && /^snd_/i.test(String(edit.id)) ? edit.id : newSoundId());
        url = await uploadUserMedia(prepared.blob, prepared.fileName, 'audio/wav', setUploadProg, {
          kind: 'sound', soundId: mediaSoundId,
        });
        formatLabel = prepared.formatLabel;
        dur = `${Math.floor(trimmed.durationSec / 60)}:${String(trimmed.durationSec % 60).padStart(2, '0')}`;
      }
      const timeMarkers = rec?.blob
        ? remapMarkersAfterTrim(markers, rec.trimStart ?? 0, rec.trimEnd ?? 1, rec.durationSec)
        : normalizeTimeMarkers(markers);
      const images: string[] = [...keptImages];
      const toUpload = photos.slice(0, Math.max(0, 3 - keptImages.length));
      if (!mediaSoundId) {
        mediaSoundId = String(edit?.id && /^snd_/i.test(String(edit.id)) ? edit.id : newSoundId());
      }
      if (toUpload.length) {
        setPubPhase('photos');
        for (const photo of toUpload) {
          images.push(await uploadUserMedia(photo, photo.name, photo.type || 'image/jpeg', setUploadProg, {
            kind: 'sound', soundId: mediaSoundId,
          }));
        }
      }
      setUploadProg(null);
      setPubPhase('save');
      const walkRoute = isSoundwalkPrinciple(principle) ? routeDraft : [];
      let lat = pickedPoint?.lat ?? Number(edit?.lat) ?? 47.2313;
      let lng = pickedPoint?.lng ?? Number(edit?.lng) ?? 39.7233;
      if (walkRoute.length) {
        lat = walkRoute[0].lat;
        lng = walkRoute[0].lng;
      } else if (!pickedPoint && edit?.lat == null) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 4000 });
          });
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        } catch { /* keep form coords */ }
      }
      const gear = [recorder, microphone].filter(Boolean).join(' · ');
      const record = {
        id: edit?.id ?? (mediaSoundId || newSoundId()),
        title: title.trim(),
        description: desc.trim(),
        location: location.trim() || (walkRoute.length ? 'Маршрут звуковой прогулки' : ''),
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
        route: walkRoute.length >= 2 ? walkRoute : undefined,
        timeMarkers,
      };
      await apiSyncJson('map_data.json', [record], captchaToken ? { captchaToken } : undefined);
      setDraftRecording(null);
      if (!edit) clearAddDraft();
      setDraft(null);
      clearMapPick();
      toast(status === 'draft' ? 'Черновик сохранён' : 'Отправлено на модерацию');
      await reload();
      onBack();
    } catch (e: unknown) {
      toast((e as Error).message || 'Не удалось опубликовать');
    } finally {
      setBusy(false);
      setPubPhase(null);
    }
  };

  const openLegal = (doc: 'privacy' | 'terms' | 'publish') => {
    push({ type: 'legal', doc });
  };

  const recorderOpts = useMemo(
    () => [{ value: '', label: '— не указан —' }, ...(FIELD_RECORDERS as string[]).map((g) => ({ value: g, label: g }))],
    [],
  );
  const micOpts = useMemo(
    () => [{ value: '', label: '— не указан —' }, ...(FIELD_MICROPHONES as string[]).map((g) => ({ value: g, label: g }))],
    [],
  );
  const sessionOpts = useMemo(
    () => [
      { value: '', label: '— не привязывать —' },
      ...mySessions.map((s) => ({ value: String(s.id), label: String(s.title || s.id) })),
    ],
    [mySessions],
  );

  return (
    <div className="flex flex-col h-full min-h-0" style={{ background: th.phoneBg }}>
      {!desktop && <ScreenHeader title={edit ? 'Редактировать звук' : 'Добавить звук'} onBack={onBack} />}
      <div className={`flex-1 min-h-0 overflow-y-auto ${desktop ? 'px-7 py-6' : 'p-5'}`}>
        {desktop && (
          <div className="mb-5">
            <p className="pv-page" style={{ color: th.inkText }}>{edit ? 'Черновик' : 'Добавить звук'}</p>
            <p className="pv-caption mt-1" style={{ color: th.muted }}>Файл, место на карте и карточка публикации — по шагам, без спешки.</p>
          </div>
        )}
        <div className="flex flex-col gap-4 max-w-3xl">
          <FillProgress
            percent={fillPercent}
            label={fillPercent >= 85 ? 'Почти готово к модерации' : 'Заполненность карточки'}
          />

          {edit?.status === 'rejected' && (
            <div className="rounded-3xl px-4 py-3.5" style={{ background: th.cardBg, border: `1px solid ${ACCENT}55` }}>
              <p className="pv-label uppercase" style={{ color: ACCENT }}>Причина отклонения</p>
              <p className="pv-body mt-1.5" style={{ color: th.inkText }}>
                {String(edit.rejectNote || '').trim() || 'Модератор отклонил запись без подробного комментария.'}
              </p>
              <p className="pv-caption mt-2" style={{ color: th.soft }}>
                Исправьте замечания и снова отправьте на модерацию.
              </p>
            </div>
          )}

          <Section title="Аудио" th={th}>
            <label
              className="block rounded-2xl px-4 py-5 text-center cursor-pointer"
              style={{ background: th.phoneBg, border: `1px dashed ${th.border}` }}
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) void onPickFile(file);
              }}>
              <p className="pv-subtitle" style={{ color: th.inkText }}>{fileLabel || 'Перетащите файл или нажмите'}</p>
              <p className="pv-micro mt-1" style={{ color: th.soft }}>WAV, MP3, M4A, OGG, WebM · для ambisonic — 4-канальный WAV (WXYZ)</p>
              <input type="file" accept="audio/*,.webm,.ogg,.mp3,.wav,.m4a" className="hidden"
                onChange={(e) => void onPickFile(e.target.files?.[0] || null)} />
            </label>
            {draft ? (
              <div className="mt-3">
                <AudioEditor blob={draft.blob} durationSec={draft.durationSec}
                  trimStart={draft.trimStart ?? 0} trimEnd={draft.trimEnd ?? 1} gain={draft.gain ?? 1}
                  markers={markers}
                  onMarkers={(next) => {
                    setMarkers(next);
                    const rec = { ...draft, timeMarkers: next };
                    setDraft(rec);
                    setDraftRecording(rec);
                  }}
                  onChange={(next) => {
                    const rec = { ...draft, ...next, timeMarkers: markers };
                    setDraft(rec);
                    setDraftRecording(rec);
                  }} />
              </div>
            ) : edit?.url ? (
              <div className="mt-3">
                <AudioEditor url={String(edit.url)} durationSec={parseDurationLabel(edit.duration) || 1}
                  trimStart={0} trimEnd={1} gain={1} allowTrim={false}
                  markers={markers} onMarkers={setMarkers}
                  onChange={() => {}} />
              </div>
            ) : null}
          </Section>

          <Section title="Карточка" th={th}>
            <div className={desktop ? 'grid grid-cols-2 gap-3' : 'flex flex-col gap-3'}>
              <FormField label="Название" value={title} onChange={setTitle} inset />
              <div>
                <FormField label="FXName" value={fxName} onChange={setFxName} tip="Английское имя в UCS-файле (слова через _)." inset />
                <button type="button" className="pv-caption mt-1.5 font-medium" style={{ color: ACCENT }} onClick={() => void translateFx()}>
                  Перевести FXName
                </button>
              </div>
              <label className="pv-label col-span-2 block" style={{ color: th.soft }}>Описание
                <textarea
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  className="mt-1 w-full rounded-2xl px-3 py-3 pv-body outline-none min-h-[88px]"
                  style={{ background: th.phoneBg, color: th.inkText, boxShadow: `inset 0 0 0 1px ${th.border}` }}
                />
              </label>
            </div>
          </Section>

          <Section title="Место" th={th}>
            <FormField label="Где записано" value={location} onChange={setLocation} inset />
            <p className="pv-micro mt-2" style={{ color: th.soft }}>
              Координаты: {pickedPoint ? `${pickedPoint.lat.toFixed(5)}, ${pickedPoint.lng.toFixed(5)}` : (edit?.lat != null ? `${Number(edit.lat).toFixed(5)}, ${Number(edit.lng).toFixed(5)}` : 'точка на карте или геолокация')}
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              <motion.button type="button" whileTap={tap.btn} className="h-10 px-4 rounded-full pv-button"
                style={{ background: th.phoneBg, color: th.muted, boxShadow: `inset 0 0 0 1px ${th.border}` }}
                onClick={() => {
                  setPickMode('point');
                  if (desktop) toast('Кликните по карте справа — метка останется, можно поставить заново');
                  else push({ type: 'pick-location', mode: 'point' });
                }}>Указать точку на карте</motion.button>
              <motion.button type="button" whileTap={tap.btn} className="h-10 px-4 rounded-full pv-button inline-flex items-center gap-1.5"
                style={{ background: isWalk ? ACCENT : th.phoneBg, color: isWalk ? '#fff' : th.muted, boxShadow: isWalk ? undefined : `inset 0 0 0 1px ${th.border}` }}
                onClick={() => {
                  setPrincipleAndMode(isWalk ? principle : 'Звуковая прогулка (Soundwalk)');
                  setPickMode('route');
                  if (desktop) toast('Кликайте по карте — минимум две точки маршрута');
                  else push({ type: 'pick-location', mode: 'route' });
                }}>
                <Route size={13} /> Нарисовать прогулку
              </motion.button>
            </div>
            {isWalk && (
              <div className="mt-3 rounded-2xl px-3 py-2.5" style={{ background: th.phoneBg }}>
                <p className="pv-caption font-medium" style={{ color: th.inkText }}>
                  {routeDraft.length < 2 ? 'Нужно минимум 2 точки маршрута' : `Маршрут: ${routeDraft.length} точек`}
                </p>
                {routeDraft.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {routeDraft.map((pt, i) => (
                      <button key={`${pt.lat}-${pt.lng}-${i}`} type="button"
                        className="pv-micro px-2 py-1 rounded-full"
                        style={{ background: th.cardBg, color: th.muted }}
                        onClick={() => setRouteDraft((prev) => prev.filter((_, n) => n !== i))}
                        title="Убрать точку">
                        {i + 1}. {pt.lat.toFixed(3)}, {pt.lng.toFixed(3)} ×
                      </button>
                    ))}
                  </div>
                )}
                {routeDraft.length > 0 && (
                  <button type="button" className="pv-caption font-medium mt-2" style={{ color: ACCENT }}
                    onClick={() => setRouteDraft([])}>Сбросить маршрут</button>
                )}
              </div>
            )}
          </Section>

          <Section title="Тип звука" th={th}>
            <p className="pv-micro font-medium mb-1.5" style={{ color: th.soft }}>Категория</p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {[['nature', 'Природа'], ['water', 'Вода'], ['urban', 'Город'], ['forest', 'Лес'], ['birds', 'Птицы']].map(([id, lab]) => (
                <Chip key={id} on={kind === id} onClick={() => setKind(id)} label={lab} th={th} />
              ))}
            </div>
            <p className="pv-micro font-medium mb-1.5" style={{ color: th.soft }}>Экокатегория</p>
            <div className="flex flex-wrap gap-1.5">
              {[['geophony', 'Геофония'], ['biophony', 'Биофония'], ['anthrophony', 'Антропофония']].map(([id, lab]) => (
                <Chip key={id} on={eco === id} onClick={() => setEco(id)} label={lab} th={th} />
              ))}
            </div>
          </Section>

          <Section title="Классификация UCS" th={th}>
            <div className="flex flex-wrap gap-2 mb-3">
              <motion.button
                type="button"
                whileTap={tap.btn}
                disabled={!!ucsBusy}
                onClick={() => void suggestFromDescription()}
                className="h-10 px-3.5 rounded-full pv-button inline-flex items-center gap-1.5 cursor-pointer"
                style={{ background: th.phoneBg, color: th.inkText, boxShadow: `inset 0 0 0 1px ${th.border}`, opacity: ucsBusy ? 0.75 : 1 }}
              >
                {ucsBusy === 'text' ? <BusySpinner label="Подбираем…" /> : (
                  <><Sparkles size={14} color={ACCENT} /> UCS по описанию</>
                )}
              </motion.button>
              <motion.button
                type="button"
                whileTap={tap.btn}
                disabled={!!ucsBusy}
                onClick={() => void suggestFromAudio()}
                className="h-10 px-3.5 rounded-full pv-button inline-flex items-center gap-1.5 cursor-pointer"
                style={{
                  background: th.isDark ? '#2E2E2E' : '#F0F1F3',
                  color: th.muted,
                  boxShadow: `inset 0 0 0 1px ${th.border}`,
                  opacity: ucsBusy ? 0.75 : 1,
                }}
              >
                {ucsBusy === 'audio' ? <BusySpinner label="Слушаем…" /> : 'Beta: анализ записи'}
              </motion.button>
            </div>
            <p className="pv-micro mb-2 leading-snug" style={{ color: th.soft }}>
              {ucsAiOn === false
                ? 'Нейросеть на сервере выключена — работает подбор по ключевым словам. Для AI нужен GROQ_API_KEY и деплой API.'
                : 'Нейросеть предлагает CatID и FXName по описанию. Beta дополнительно слушает клип записи.'}
            </p>
            <AnimatePresence>
              {ucsNote ? (
                <motion.p
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={spring.fade}
                  className="pv-caption mb-3 leading-snug rounded-2xl px-3 py-2"
                  style={{ background: th.phoneBg, color: th.muted }}
                >
                  {ucsNote}
                </motion.p>
              ) : null}
            </AnimatePresence>
            <div className={desktop ? 'grid grid-cols-2 gap-3' : 'flex flex-col gap-3'}>
              <SelectField
                label="Категория"
                value={ucsCat}
                options={(ucsCategories as string[]).map((c) => ({ value: c, label: c }))}
                onChange={(next) => {
                  setUcsCat(next);
                  const first = (structure[next] || [])[0];
                  if (first) setUcsId(first.id);
                }}
              />
              <SelectField
                label="CatID"
                value={ucsId}
                options={subcats.map((s) => ({ value: s.id, label: s.name }))}
                onChange={setUcsId}
              />
            </div>
            <p className="pv-micro break-all mt-2" style={{ color: th.soft }}>{ucsFilePreview}</p>
          </Section>

          <Section title="Техника" th={th}>
            <div className={desktop ? 'grid grid-cols-2 gap-3' : 'flex flex-col gap-3'}>
              <SelectField label="Рекордер" value={recorder} options={recorderOpts} onChange={setRecorder} />
              <SelectField label="Микрофон" value={microphone} options={micOpts} onChange={setMicrophone} />
              <SelectField
                label="Каналы"
                value={channels}
                options={CHANNELS.map((c) => ({ value: c, label: c }))}
                onChange={setChannels}
              />
              <SelectField
                label="Принцип записи"
                value={principle}
                options={PRINCIPLES.map((c) => ({ value: c, label: c }))}
                onChange={setPrincipleAndMode}
              />
              <FormField label="Погода" value={weather} onChange={setWeather} inset />
              <SelectField
                label="Лицензия"
                value={license}
                options={LICENSES.map((c) => ({ value: c, label: c }))}
                onChange={setLicense}
              />
              <div className="col-span-2">
                <SelectField label="Экспедиция" value={sessionId} options={sessionOpts} onChange={setSessionId} />
              </div>
            </div>
          </Section>

          <Section title="Фото сцены" th={th}>
            <p className="pv-caption mb-2" style={{ color: th.soft }}>До трёх кадров места записи — перетащите или выберите файлы.</p>
            <div className="grid grid-cols-3 gap-2 mb-2">
              {keptImages.map((src, i) => (
                <div key={src} className="relative aspect-[4/3] rounded-2xl overflow-hidden" style={{ background: th.phoneBg }}>
                  <button type="button" className="w-full h-full" onClick={() => setFullPhoto(i)} aria-label="Открыть фото">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                  </button>
                  <button type="button" className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'rgba(45,60,57,0.72)' }}
                    onClick={() => setKeptImages((prev) => prev.filter((u) => u !== src))} aria-label="Убрать фото">
                    <X size={12} color="#fff" />
                  </button>
                </div>
              ))}
              {photoUrls.map((src, i) => (
                <div key={src} className="relative aspect-[4/3] rounded-2xl overflow-hidden" style={{ background: th.phoneBg }}>
                  <button type="button" className="w-full h-full" onClick={() => setFullPhoto(keptImages.length + i)} aria-label="Открыть фото">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                  </button>
                  <button type="button" className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'rgba(45,60,57,0.72)' }}
                    onClick={() => setPhotos((prev) => prev.filter((_, n) => n !== i))} aria-label="Убрать фото">
                    <X size={12} color="#fff" />
                  </button>
                </div>
              ))}
              {slotsLeft > 0 && (
                <label
                  className="aspect-[4/3] rounded-2xl flex flex-col items-center justify-center gap-1 cursor-pointer"
                  style={{ background: th.phoneBg, border: `1px dashed ${th.border}` }}
                  onDragOver={(e) => { e.preventDefault(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    addPhotos(Array.from(e.dataTransfer.files || []));
                  }}>
                  <ImagePlus size={18} color={th.soft} />
                  <span className="pv-micro font-medium" style={{ color: th.soft }}>Добавить</span>
                  <input type="file" accept="image/*" multiple className="hidden"
                    onChange={(e) => { addPhotos(Array.from(e.target.files || [])); e.target.value = ''; }} />
                </label>
              )}
            </div>
          </Section>

          <div className="rounded-2xl px-3.5 py-3" style={{ background: th.cardBg }}>
            <p className="pv-micro leading-snug" style={{ color: th.soft }}>
              Публикуя, вы соглашаетесь с{' '}
              <button type="button" className="underline underline-offset-2" style={{ color: th.muted }} onClick={() => openLegal('publish')}>
                правилами публикации
              </button>
              {' '}и{' '}
              <button type="button" className="underline underline-offset-2" style={{ color: th.muted }} onClick={() => openLegal('terms')}>
                условиями использования
              </button>
              .
            </p>
          </div>

          <AnimatePresence>
            {busy && pubPhase && (
              <UploadProgressBar
                label={PUB_LABEL[pubPhase]}
                progress={uploadProg}
                phaseHint={PUB_LABEL[pubPhase]}
              />
            )}
          </AnimatePresence>

          <div className="flex gap-2 pb-4">
            <motion.button
              type="button"
              whileTap={tap.cta}
              disabled={busy}
              onClick={() => void publish('draft')}
              className="pv-button flex-1 py-3 rounded-2xl cursor-pointer"
              style={{ background: th.cardBg, color: th.muted, opacity: busy ? 0.7 : 1 }}
            >
              {busy ? '…' : 'Черновик'}
            </motion.button>
            <motion.button
              type="button"
              whileTap={tap.cta}
              disabled={busy}
              onClick={() => void publish('pending')}
              className="pv-button flex-[1.5] py-3.5 rounded-2xl text-white cursor-pointer inline-flex items-center justify-center gap-2"
              style={{ background: ACCENT, opacity: busy ? 0.85 : 1 }}
            >
              {busy ? <BusySpinner label="Отправка…" /> : 'На модерацию'}
            </motion.button>
          </div>
        </div>
      </div>
      {fullPhoto != null && gallery.length > 0 && (
        <PhotoLightbox
          images={gallery}
          index={Math.min(fullPhoto, gallery.length - 1)}
          title="Фото сцены"
          onClose={() => setFullPhoto(null)}
          onIndex={setFullPhoto} />
      )}
    </div>
  );
}

function Section({ title, th, children }: { title: string; th: ThemeTokens; children: ReactNode }) {
  return (
    <section className="rounded-[24px] p-4" style={{ background: th.cardBg }}>
      <p className="pv-label uppercase mb-3" style={{ color: th.soft }}>{title}</p>
      {children}
    </section>
  );
}

function Chip({ on, onClick, label, th }: { on: boolean; onClick: () => void; label: string; th: ThemeTokens }) {
  return (
    <motion.button type="button" whileTap={tap.chip} onClick={onClick} className="pv-label px-3 py-1.5 rounded-full cursor-pointer"
      style={{ background: on ? ACCENT : th.lightBg, color: on ? '#fff' : th.muted }}>{label}</motion.button>
  );
}
