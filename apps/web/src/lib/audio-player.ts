import { buildMatrixFoaDecoder, padFoaBuffer, type MatrixFoa } from './foa';

type Listener = () => void;

function disc(node: AudioNode | null | undefined) {
  if (!node) return;
  try { node.disconnect(); } catch { /* already disconnected */ }
}

class AudioService {
  el: HTMLAudioElement | null = null;
  soundId: string | number | null = null;
  playing = false;
  volume = 1;
  muted = false;
  pan = 0;
  pitch = 0;
  ambisonic = false;
  yaw = 0;
  pitchDeg = 0;
  listeners = new Set<Listener>();

  analyser: AnalyserNode | null = null;
  anL: AnalyserNode | null = null;
  anR: AnalyserNode | null = null;
  ctx: AudioContext | null = null;

  private mediaSrc: MediaElementAudioSourceNode | null = null;
  private gain: GainNode | null = null;
  private panner: StereoPannerNode | null = null;
  private split: ChannelSplitterNode | null = null;
  private foa: MatrixFoa | null = null;
  private foaSrc: AudioBufferSourceNode | null = null;
  private foaBuf: AudioBuffer | null = null;
  private foaUrl: string | null = null;

  private emit() { this.listeners.forEach((l) => l()); }

  subscribe(l: Listener) {
    this.listeners.add(l);
    return () => { this.listeners.delete(l); };
  }

  ensure() {
    if (this.el) return this.el;
    this.el = new Audio();
    this.el.crossOrigin = 'anonymous';
    this.el.preload = 'auto';
    this.el.volume = this.muted ? 0 : this.volume;
    this.el.addEventListener('ended', () => {
      this.playing = false;
      this.stopFoaSrc();
      this.emit();
    });
    this.el.addEventListener('timeupdate', () => this.emit());
    this.el.addEventListener('volumechange', () => this.emit());
    this.el.addEventListener('seeked', () => { this.syncFoa(); });
    return this.el;
  }

  async ensureGraph(): Promise<boolean> {
    try {
      const el = this.ensure();
      const AC = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return false;
      if (!this.ctx) this.ctx = new AC();
      if (this.ctx.state === 'suspended') {
        try { await this.ctx.resume(); } catch { /* */ }
      }
      if (!this.mediaSrc) {
        el.crossOrigin = 'anonymous';
        this.mediaSrc = this.ctx.createMediaElementSource(el);
        this.gain = this.ctx.createGain();
        this.panner = this.ctx.createStereoPanner();
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 2048;
        this.analyser.smoothingTimeConstant = 0.65;
        this.analyser.minDecibels = -90;
        this.analyser.maxDecibels = -10;
        this.split = this.ctx.createChannelSplitter(2);
        this.anL = this.ctx.createAnalyser();
        this.anR = this.ctx.createAnalyser();
        this.anL.fftSize = 2048;
        this.anR.fftSize = 2048;
        this.foa = buildMatrixFoaDecoder(this.ctx);
        this.routeNormal();
        this.applyVolume();
        this.applyPan();
      }
      return true;
    } catch (err) {
      console.error('Web Audio graph error:', err);
      return false;
    }
  }

  private routeNormal() {
    disc(this.mediaSrc);
    disc(this.foa?.output);
    disc(this.panner);
    disc(this.gain);
    disc(this.analyser);
    disc(this.split);
    if (!this.mediaSrc || !this.panner || !this.gain || !this.ctx) return;
    this.mediaSrc.connect(this.panner);
    this.panner.connect(this.gain);
    this.gain.connect(this.ctx.destination);
    this.tapMeters(this.panner);
    if (this.el && !this.ambisonic) this.el.muted = false;
  }

  private routeAmbi() {
    disc(this.mediaSrc);
    disc(this.foa?.output);
    disc(this.panner);
    disc(this.gain);
    disc(this.analyser);
    disc(this.split);
    if (!this.foa || !this.panner || !this.gain || !this.ctx) return;
    this.foa.output.connect(this.panner);
    this.panner.connect(this.gain);
    this.gain.connect(this.ctx.destination);
    this.tapMeters(this.panner);
    if (this.el) this.el.muted = true;
  }

  private tapMeters(mix: AudioNode) {
    if (this.analyser) {
      try { mix.connect(this.analyser); } catch { /* */ }
    }
    if (this.split && this.anL && this.anR) {
      try { mix.connect(this.split); } catch { /* */ }
      try { this.split.connect(this.anL, 0); } catch { /* */ }
      try { this.split.connect(this.anR, 1); } catch { /* */ }
    }
  }

  applyVolume() {
    const el = this.ensure();
    const v = this.muted ? 0 : this.volume;
    if (this.gain) {
      this.gain.gain.value = v;
      el.volume = 1;
      if (!this.ambisonic) el.muted = false;
    } else {
      el.volume = v;
    }
    this.emit();
  }

  applyPan() {
    if (this.panner) this.panner.pan.value = this.pan;
    this.emit();
  }

  applyPitch() {
    const rate = Math.pow(2, this.pitch / 12);
    const el = this.ensure();
    try { el.preservesPitch = false; } catch { /* */ }
    el.playbackRate = rate;
    if (this.foaSrc) {
      try { this.foaSrc.playbackRate.value = rate; } catch { /* */ }
    }
    this.emit();
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.volume > 0) this.muted = false;
    this.applyVolume();
  }

  toggleMute() {
    this.muted = !this.muted;
    this.applyVolume();
  }

  setPan(v: number) {
    this.pan = Math.max(-1, Math.min(1, v));
    this.applyPan();
  }

  setPitch(st: number) {
    this.pitch = Math.max(-12, Math.min(12, Math.round(st)));
    this.applyPitch();
  }

  setAmbiRotation(yaw: number, pitch: number) {
    this.yaw = yaw;
    this.pitchDeg = pitch;
    this.foa?.setRotation(yaw, pitch);
    this.emit();
  }

  seek(ratio: number) {
    const el = this.ensure();
    if (!el.duration || !Number.isFinite(el.duration)) return;
    el.currentTime = Math.max(0, Math.min(1, ratio)) * el.duration;
    this.emit();
  }

  private stopFoaSrc() {
    if (!this.foaSrc) return;
    try { this.foaSrc.onended = null; } catch { /* */ }
    try { this.foaSrc.stop(); } catch { /* */ }
    disc(this.foaSrc);
    this.foaSrc = null;
  }

  private startFoaSrc(offsetSec: number) {
    if (!this.ambisonic || !this.foa || !this.foaBuf || !this.ctx) return;
    this.stopFoaSrc();
    const buffer = padFoaBuffer(this.ctx, this.foaBuf);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.channelCount = 4;
    src.channelCountMode = 'explicit';
    src.channelInterpretation = 'discrete';
    src.connect(this.foa.input);
    const rate = this.el ? this.el.playbackRate || 1 : 1;
    try { src.playbackRate.value = rate; } catch { /* */ }
    const offset = Math.max(0, Math.min(offsetSec || 0, Math.max(0, buffer.duration - 0.05)));
    src.onended = () => {
      if (this.foaSrc !== src) return;
      this.foaSrc = null;
    };
    try {
      src.start(0, offset);
      this.foaSrc = src;
    } catch (err) {
      console.error('FOA start error:', err);
      this.foaSrc = null;
    }
  }

  private syncFoa() {
    if (!this.ambisonic) return;
    const t = this.el ? (this.el.currentTime || 0) : 0;
    if (this.playing) this.startFoaSrc(t);
    else this.stopFoaSrc();
  }

  private async loadFoaBuffer(url: string) {
    if (!this.ctx) return null;
    if (this.foaUrl === url && this.foaBuf) return this.foaBuf;
    const res = await fetch(url, { mode: 'cors', credentials: 'omit', cache: 'force-cache' });
    if (!res.ok) throw new Error(`foa fetch ${res.status}`);
    const ab = await res.arrayBuffer();
    const buffer = await this.ctx.decodeAudioData(ab.slice(0));
    this.foaBuf = buffer;
    this.foaUrl = url;
    return buffer;
  }

  async setAmbisonic(on: boolean, url?: string): Promise<boolean> {
    const okGraph = await this.ensureGraph();
    if (!okGraph || !this.ctx || !this.foa) {
      this.ambisonic = false;
      this.emit();
      return false;
    }
    if (!on) {
      this.ambisonic = false;
      this.stopFoaSrc();
      this.routeNormal();
      this.setAmbiRotation(0, 0);
      this.applyVolume();
      this.emit();
      return true;
    }
    const el = this.ensure();
    if (url && !el.currentSrc && !el.src) el.src = url;
    const src = url || el.currentSrc || el.src;
    if (!src) {
      this.ambisonic = false;
      this.emit();
      return false;
    }
    try {
      await this.loadFoaBuffer(src);
    } catch (err) {
      console.error('FOA buffer error:', err);
      this.ambisonic = false;
      this.emit();
      return false;
    }
    this.ambisonic = true;
    this.routeAmbi();
    this.foa.setRotation(this.yaw, this.pitchDeg);
    this.syncFoa();
    this.applyVolume();
    this.emit();
    return true;
  }

  async play(id: string | number, url?: string) {
    const el = this.ensure();
    await this.ensureGraph();
    this.applyVolume();
    if (!url) {
      this.playing = !this.playing;
      if (this.playing) {
        void el.play().catch(() => { this.playing = false; this.emit(); });
        this.syncFoa();
      } else {
        el.pause();
        this.stopFoaSrc();
      }
      this.emit();
      return;
    }
    if (this.soundId !== id) {
      if (this.ambisonic) {
        this.ambisonic = false;
        this.stopFoaSrc();
        this.routeNormal();
        this.yaw = 0;
        this.pitchDeg = 0;
        this.foa?.setRotation(0, 0);
      }
      el.src = url;
      this.soundId = id;
    }
    this.playing = true;
    this.emit();
    try {
      await el.play();
      this.syncFoa();
    } catch {
      this.playing = false;
      this.stopFoaSrc();
      this.emit();
    }
  }

  pause() {
    this.ensure().pause();
    this.playing = false;
    this.stopFoaSrc();
    this.emit();
  }

  stop() {
    this.pause();
    this.soundId = null;
    if (this.ambisonic) void this.setAmbisonic(false);
    this.emit();
  }

  toggle(id: string | number, url?: string) {
    if (this.soundId === id && this.playing) this.pause();
    else void this.play(id, url);
  }

  progress() {
    const el = this.el;
    if (!el || !el.duration) return 0;
    return el.currentTime / el.duration;
  }
}

export const audioService = new AudioService();
