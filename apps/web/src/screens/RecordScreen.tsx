import { useEffect, useRef, useState } from 'react';
import { Mic } from 'lucide-react';
import { motion } from 'motion/react';
import { color, tap } from '@polevka/design';
import { type TimeMarker } from '@polevka/core';
import { useAuth } from '../state/AuthContext';
import { useNav } from '../state/NavContext';
import { useTh } from '../state/ThemeContext';
import { useUi } from '../state/UiContext';
import { useT } from '../state/PrefsContext';
import { ScreenHeader } from '../primitives/ui';
import { AudioEditor, LiveTape } from '../primitives/AudioEditor';
import { LiveAnalyzers } from '../primitives/AnalyzersPanel';
import { setDraftRecording } from '../lib/record-buffer';
import { formatClock } from '../lib/waveform';
import { useIsDesktop } from '../lib/use-media';
import {
  applyCtxSink, listAudioDevices, readRecInput, readRecOutput, writeRecInput, writeRecOutput,
  type AudioPick,
} from '../lib/record-devices';

const SAGE = color.sage;
const OLIVE = color.olive;
const ACCENT = color.accent;
const DARK = color.dark;

export function RecordScreen({ onBack }: { onBack: () => void }) {
  const th = useTh();
  const t = useT();
  const desktop = useIsDesktop();
  const { toast } = useUi();
  const { isLoggedIn } = useAuth();
  const { reset, requireAuth } = useNav();
  const askedAuth = useRef(false);

  useEffect(() => {
    if (isLoggedIn || askedAuth.current) return;
    askedAuth.current = true;
    toast('Войдите, чтобы записывать и публиковать');
    reset({ type: 'auth' });
  }, [isLoggedIn, reset, toast]);
  const [stage, setStage] = useState<'idle' | 'rec' | 'review'>('idle');
  const [sec, setSec] = useState(0);
  const [mix, setMix] = useState<AnalyserNode | null>(null);
  const [anL, setAnL] = useState<AnalyserNode | null>(null);
  const [anR, setAnR] = useState<AnalyserNode | null>(null);
  const [inputs, setInputs] = useState<AudioPick[]>([]);
  const [outputs, setOutputs] = useState<AudioPick[]>([]);
  const [inputId, setInputId] = useState(readRecInput);
  const [outputId, setOutputId] = useState(readRecOutput);
  const [monitor, setMonitor] = useState(false);
  const [draft, setDraft] = useState<{ blob: Blob; durationSec: number; mime: string; trimStart: number; trimEnd: number; gain: number; timeMarkers: TimeMarker[] } | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const monitorRef = useRef<GainNode | null>(null);
  const started = useRef(0);
  const commit = useRef(false);

  useEffect(() => {
    if (desktop) void refreshDevices();
  }, [desktop]);

  useEffect(() => {
    if (stage !== 'rec') return;
    const tmr = setInterval(() => setSec(Math.max(0, Math.round((Date.now() - started.current) / 1000))), 250);
    return () => clearInterval(tmr);
  }, [stage]);

  useEffect(() => () => {
    recRef.current?.stop();
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    void ctxRef.current?.close();
  }, []);

  const refreshDevices = async () => {
    const next = await listAudioDevices();
    setInputs(next.inputs);
    setOutputs(next.outputs);
  };

  const tearDown = () => {
    recRef.current?.stop();
    recRef.current = null;
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    monitorRef.current = null;
    void ctxRef.current?.close();
    ctxRef.current = null;
    setMix(null);
    setAnL(null);
    setAnR(null);
  };

  const start = async (deviceId = inputId) => {
    if (!isLoggedIn) {
      toast('Войдите, чтобы записывать и публиковать');
      requireAuth({ type: 'record' });
      return;
    }
    try {
      const audio: MediaTrackConstraints = {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      };
      const stream = await navigator.mediaDevices.getUserMedia({ audio });
      streamRef.current = stream;
      chunks.current = [];
      commit.current = false;
      const ctx = new AudioContext();
      if (ctx.state === 'suspended') await ctx.resume();
      await applyCtxSink(ctx, outputId);
      const source = ctx.createMediaStreamSource(stream);
      const node = ctx.createAnalyser();
      node.fftSize = 2048;
      node.smoothingTimeConstant = 0.2;
      const left = ctx.createAnalyser();
      const right = ctx.createAnalyser();
      left.fftSize = 2048;
      right.fftSize = 2048;
      if (source.channelCount > 1) {
        const split = ctx.createChannelSplitter(2);
        source.connect(split);
        split.connect(left, 0);
        split.connect(right, 1);
      } else {
        source.connect(left);
        source.connect(right);
      }
      const dest = ctx.createMediaStreamDestination();
      source.connect(node);
      source.connect(dest);
      const tapGain = ctx.createGain();
      tapGain.gain.value = monitor ? 0.7 : 0;
      source.connect(tapGain);
      tapGain.connect(ctx.destination);
      monitorRef.current = tapGain;
      ctxRef.current = ctx;
      setMix(node);
      setAnL(left);
      setAnR(right);
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
      const mr = new MediaRecorder(dest.stream, { mimeType: mime });
      mr.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      mr.start(80);
      recRef.current = mr;
      started.current = Date.now();
      setSec(0);
      setStage('rec');
      void refreshDevices();
    } catch {
      if (deviceId) {
        writeRecInput('');
        setInputId('');
        try { await start(''); return; } catch { /* */ }
      }
      toast('Нет доступа к микрофону');
    }
  };

  const stop = () => {
    const mr = recRef.current;
    if (!mr) { setStage('idle'); return; }
    commit.current = true;
    mr.onstop = () => {
      tearDown();
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

  const changeInput = (id: string) => {
    setInputId(id);
    writeRecInput(id);
    if (stage !== 'rec') return;
    commit.current = false;
    const mr = recRef.current;
    recRef.current = null;
    if (mr && mr.state !== 'inactive') {
      mr.onstop = () => { /* device switch — keep recording on the new input */ };
      try { mr.stop(); } catch { /* */ }
    }
    tearDown();
    void start(id);
  };

  const changeOutput = (id: string) => {
    setOutputId(id);
    writeRecOutput(id);
    void applyCtxSink(ctxRef.current, id);
  };

  useEffect(() => {
    if (monitorRef.current) monitorRef.current.gain.value = monitor ? 0.7 : 0;
  }, [monitor]);

  const toPublish = () => {
    if (!draft) return;
    if (!isLoggedIn) {
      toast('Войдите, чтобы публиковать');
      requireAuth({ type: 'add-sound' });
      return;
    }
    setDraftRecording(draft);
    toast('Черновик сохранён — оформите публикацию');
    reset({ type: 'add-sound' });
  };

  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      {!desktop && <ScreenHeader title={t('record')} onBack={onBack} />}
      {stage !== 'review' && (
        <div className="flex-1 flex flex-col px-5 py-5 min-h-0 overflow-y-auto">
          <div className="mb-4">
            <p className="pv-heading" style={{ color: th.inkText }}>{stage === 'rec' ? t('recordingNow') : t('recordSound')}</p>
            <p className="pv-caption mt-1 leading-relaxed" style={{ color: OLIVE }}>
              {stage === 'rec' ? t('recordingHint') : t('recordHint')}
            </p>
          </div>
          {desktop && (
            <div className="grid grid-cols-2 gap-2 mb-3">
              <label className="rounded-2xl px-3 py-2" style={{ background: th.cardBg }}>
                <span className="pv-micro uppercase" style={{ color: SAGE }}>{t('recInput')}</span>
                <select value={inputId} onChange={(e) => changeInput(e.target.value)}
                  className="w-full bg-transparent outline-none pv-caption mt-1" style={{ color: th.inkText }}
                  onFocus={() => void refreshDevices()}>
                  <option value="">{t('recDefault')}</option>
                  {inputs.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}
                </select>
              </label>
              <label className="rounded-2xl px-3 py-2" style={{ background: th.cardBg }}>
                <span className="pv-micro uppercase" style={{ color: SAGE }}>{t('recOutput')}</span>
                <select value={outputId} onChange={(e) => changeOutput(e.target.value)}
                  className="w-full bg-transparent outline-none pv-caption mt-1" style={{ color: th.inkText }}
                  onFocus={() => void refreshDevices()}>
                  <option value="">{t('recDefault')}</option>
                  {outputs.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}
                </select>
              </label>
              <button type="button" onClick={() => setMonitor((v) => !v)}
                className="col-span-2 rounded-2xl px-3 py-2.5 text-left pv-caption"
                style={{ background: th.cardBg, color: monitor ? ACCENT : OLIVE }}>
                {t('recMonitor')}: {monitor ? t('on') : t('off')}
              </button>
            </div>
          )}
          <div className="rounded-[24px] p-4 flex flex-col gap-4" style={{ background: th.cardBg }}>
            <p className="text-[40px] font-bold tabular-nums leading-none text-center" style={{ color: th.inkText }}>{formatClock(sec)}</p>
            <LiveTape analyser={mix} color={stage === 'rec' ? ACCENT : SAGE} h={96} />
            <div className="flex flex-col items-center gap-2">
              <motion.button whileTap={tap.cta} onClick={() => { if (stage === 'rec') stop(); else void start(); }}
                className="w-[72px] h-[72px] rounded-full flex items-center justify-center shadow-[0_8px_24px_rgba(181,97,63,0.28)]"
                style={{ background: stage === 'rec' ? ACCENT : DARK }}
                aria-label={stage === 'rec' ? t('stop') : t('startRec')}>
                {stage === 'rec' ? <span className="w-5 h-5 rounded-md bg-white" /> : <Mic size={26} color="white" />}
              </motion.button>
              <p className="pv-caption" style={{ color: SAGE }}>{stage === 'rec' ? t('stop') : t('startRec')}</p>
            </div>
            <LiveAnalyzers mix={mix} left={anL} right={anR} active={stage === 'rec'} />
          </div>
        </div>
      )}
      {stage === 'review' && draft && (
        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4">
          <div>
            <p className="pv-heading" style={{ color: th.inkText }}>{t('reviewTrim')}</p>
            <p className="pv-caption mt-1" style={{ color: OLIVE }}>{t('reviewHint')}</p>
          </div>
          <AudioEditor blob={draft.blob} durationSec={draft.durationSec}
            trimStart={draft.trimStart} trimEnd={draft.trimEnd} gain={draft.gain}
            sinkId={outputId}
            markers={draft.timeMarkers}
            onMarkers={(timeMarkers) => setDraft({ ...draft, timeMarkers })}
            onChange={(next) => setDraft({ ...draft, ...next })} />
          <div className="flex gap-2">
            <button type="button" className="flex-1 py-3 rounded-2xl pv-button" style={{ background: th.lightBg, color: OLIVE }}
              onClick={() => { setDraft(null); setStage('idle'); setSec(0); }}>{t('recordAgain')}</button>
            <button type="button" className="flex-[1.4] py-3.5 rounded-2xl pv-button text-white" style={{ background: ACCENT }}
              onClick={toPublish}>{t('toPublish')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
