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
import { useLeaveGuard } from '../lib/use-leave-guard';
import {
  applyCtxSink, listAudioDevices, readRecInput, readRecOutput, requestRecStream,
  unlockAudioDevices, wireRecCapture, writeRecInput, writeRecOutput,
  type AudioPick, type RecCapture,
} from '../lib/record-devices';

const SAGE = color.sage;
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
  const [stage, setStage] = useState<'idle' | 'rec' | 'review'>('idle');
  const [sec, setSec] = useState(0);
  const [analysers, setAnalysers] = useState<AnalyserNode[]>([]);
  const [mix, setMix] = useState<AnalyserNode | null>(null);
  const [anL, setAnL] = useState<AnalyserNode | null>(null);
  const [anR, setAnR] = useState<AnalyserNode | null>(null);
  const [channels, setChannels] = useState(0);
  const [inputs, setInputs] = useState<AudioPick[]>([]);
  const [outputs, setOutputs] = useState<AudioPick[]>([]);
  const [inputId, setInputId] = useState(readRecInput);
  const [outputId, setOutputId] = useState(readRecOutput);
  const [monitor, setMonitor] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [draft, setDraft] = useState<{ blob: Blob; durationSec: number; mime: string; trimStart: number; trimEnd: number; gain: number; timeMarkers: TimeMarker[] } | null>(null);

  useEffect(() => {
    if (isLoggedIn || askedAuth.current) return;
    askedAuth.current = true;
    toast('Войдите, чтобы записывать и публиковать');
    void reset({ type: 'auth' });
  }, [isLoggedIn, reset, toast]);
  useLeaveGuard(stage === 'rec' || stage === 'review' || !!draft);

  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const captureRef = useRef<RecCapture | null>(null);
  const monitorRef = useRef<GainNode | null>(null);
  const started = useRef(0);
  const commit = useRef(false);

  const refreshDevices = async (forceUnlock = false) => {
    try {
      const next = forceUnlock ? await unlockAudioDevices() : await listAudioDevices();
      setInputs(next.inputs);
      setOutputs(next.outputs);
      if (next.inputs.some((d) => d.label && !/^Микрофон \d+$/.test(d.label))) setUnlocked(true);
    } catch {
      if (forceUnlock) toast('Нет доступа к микрофону');
    }
  };

  useEffect(() => {
    void refreshDevices();
    const md = navigator.mediaDevices;
    if (!md?.addEventListener) return;
    const onChange = () => { void refreshDevices(); };
    md.addEventListener('devicechange', onChange);
    return () => md.removeEventListener('devicechange', onChange);
  }, []);

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

  const tearDown = () => {
    recRef.current?.stop();
    recRef.current = null;
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    monitorRef.current = null;
    captureRef.current = null;
    void ctxRef.current?.close();
    ctxRef.current = null;
    setMix(null);
    setAnL(null);
    setAnR(null);
    setAnalysers([]);
    setChannels(0);
  };

  const start = async (deviceId = inputId) => {
    if (!isLoggedIn) {
      toast('Войдите, чтобы записывать и публиковать');
      requireAuth({ type: 'record' });
      return;
    }
    try {
      const stream = await requestRecStream(deviceId);
      streamRef.current = stream;
      chunks.current = [];
      commit.current = false;
      const ctx = new AudioContext();
      if (ctx.state === 'suspended') await ctx.resume();
      await applyCtxSink(ctx, outputId);
      const source = ctx.createMediaStreamSource(stream);
      const capture = wireRecCapture(ctx, source, stream);
      capture.monitor.gain.value = monitor ? 0.7 : 0;
      monitorRef.current = capture.monitor;
      captureRef.current = capture;
      ctxRef.current = ctx;
      setMix(capture.mix);
      setAnL(capture.left);
      setAnR(capture.right);
      setAnalysers(capture.analysers);
      setChannels(capture.channels);
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
      try {
        const mr = new MediaRecorder(capture.dest.stream, { mimeType: mime });
        mr.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
        mr.start(80);
        recRef.current = mr;
      } catch {
        recRef.current = null;
      }
      started.current = Date.now();
      setSec(0);
      setStage('rec');
      setUnlocked(true);
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

  const finishDraft = (blob: Blob, mime: string) => {
    tearDown();
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

  const stop = () => {
    const mr = recRef.current;
    const capture = captureRef.current;
    if (!mr && !capture) { setStage('idle'); return; }
    commit.current = true;
    const wav = capture?.drainWav() ?? null;
    if (wav && wav.size > 44) {
      if (mr && mr.state !== 'inactive') {
        mr.onstop = () => { /* pcm take already committed */ };
        try { mr.stop(); } catch { /* */ }
      }
      recRef.current = null;
      finishDraft(wav, 'audio/wav');
      return;
    }
    if (!mr) {
      toast('Пустая запись — попробуйте ещё раз');
      tearDown();
      setStage('idle');
      return;
    }
    mr.onstop = () => {
      const mime = mr.mimeType || 'audio/webm';
      const blob = new Blob(chunks.current, { type: mime });
      finishDraft(blob, mime);
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
            <p className="pv-page" style={{ color: th.inkText }}>{stage === 'rec' ? t('recordingNow') : t('recordSound')}</p>
            <p className="pv-caption mt-1 leading-relaxed" style={{ color: th.muted }}>
              {stage === 'rec' ? t('recordingHint') : t('recordHint')}
            </p>
          </div>
          <div className={`grid gap-2 mb-3 ${desktop ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <label className="rounded-2xl px-3 py-2" style={{ background: th.cardBg }}>
              <span className="pv-micro" style={{ color: th.soft }}>{t('recInput')}</span>
              <select value={inputId} onChange={(e) => changeInput(e.target.value)}
                className="w-full bg-transparent outline-none pv-caption mt-1" style={{ color: th.inkText }}
                onFocus={() => void refreshDevices()}>
                <option value="">{t('recDefault')}</option>
                {inputs.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}
              </select>
            </label>
            <label className="rounded-2xl px-3 py-2" style={{ background: th.cardBg }}>
              <span className="pv-micro" style={{ color: th.soft }}>{t('recOutput')}</span>
              <select value={outputId} onChange={(e) => changeOutput(e.target.value)}
                className="w-full bg-transparent outline-none pv-caption mt-1" style={{ color: th.inkText }}
                onFocus={() => void refreshDevices()}>
                <option value="">{t('recDefault')}</option>
                {outputs.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}
              </select>
            </label>
            {!unlocked && (
              <button type="button" onClick={() => void refreshDevices(true)}
                className={`${desktop ? 'col-span-2' : ''} rounded-2xl px-3 py-2.5 text-left pv-caption`}
                style={{ background: th.cardBg, color: th.inkText }}>
                {t('recUnlock')}
              </button>
            )}
            <button type="button" onClick={() => setMonitor((v) => !v)}
              className={`${desktop ? 'col-span-2' : ''} rounded-2xl px-3 py-2.5 text-left pv-caption`}
              style={{ background: th.cardBg, color: monitor ? ACCENT : th.muted }}>
              {t('recMonitor')}: {monitor ? t('on') : t('off')}
            </button>
          </div>
          <div className="rounded-[24px] p-4 flex flex-col gap-4" style={{ background: th.cardBg }}>
            <div className="flex items-baseline justify-center gap-2">
              <p className="pv-timer text-center" style={{ color: th.inkText }}>{formatClock(sec)}</p>
              {stage === 'rec' && channels > 0 && (
                <p className="pv-micro" style={{ color: th.soft }}>{channels} {t('recTracks')}</p>
              )}
            </div>
            <LiveTape analysers={analysers} color={stage === 'rec' ? ACCENT : SAGE} />
            <div className="flex flex-col items-center gap-2">
              <motion.button whileTap={tap.cta} onClick={() => { if (stage === 'rec') stop(); else void start(); }}
                className="w-[72px] h-[72px] rounded-full flex items-center justify-center shadow-[0_8px_24px_rgba(181,97,63,0.28)]"
                style={{ background: stage === 'rec' ? ACCENT : DARK }}
                aria-label={stage === 'rec' ? t('stop') : t('startRec')}>
                {stage === 'rec' ? <span className="w-5 h-5 rounded-md bg-white" /> : <Mic size={26} color="white" />}
              </motion.button>
              <p className="pv-caption" style={{ color: th.soft }}>{stage === 'rec' ? t('stop') : t('startRec')}</p>
            </div>
            <LiveAnalyzers mix={mix} left={anL} right={anR} active={stage === 'rec'} />
          </div>
        </div>
      )}
      {stage === 'review' && draft && (
        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4">
          <div>
            <p className="pv-page" style={{ color: th.inkText }}>{t('reviewTrim')}</p>
            <p className="pv-caption mt-1" style={{ color: th.muted }}>{t('reviewHint')}</p>
          </div>
          <AudioEditor blob={draft.blob} durationSec={draft.durationSec}
            trimStart={draft.trimStart} trimEnd={draft.trimEnd} gain={draft.gain}
            sinkId={outputId}
            markers={draft.timeMarkers}
            onMarkers={(timeMarkers) => setDraft({ ...draft, timeMarkers })}
            onChange={(next) => setDraft({ ...draft, ...next })} />
          <div className="flex gap-2">
            <button type="button" className="flex-1 py-3 rounded-2xl pv-button" style={{ background: th.lightBg, color: th.muted }}
              onClick={() => { setDraft(null); setStage('idle'); setSec(0); }}>{t('recordAgain')}</button>
            <button type="button" className="flex-[1.4] py-3.5 rounded-2xl pv-button text-white" style={{ background: ACCENT }}
              onClick={toPublish}>{t('toPublish')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
