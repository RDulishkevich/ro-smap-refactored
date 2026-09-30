type Listener = () => void;

class AudioService {
  el: HTMLAudioElement | null = null;
  soundId: string | number | null = null;
  playing = false;
  volume = 1;
  muted = false;
  listeners = new Set<Listener>();

  private emit() { this.listeners.forEach((l) => l()); }

  subscribe(l: Listener) {
    this.listeners.add(l);
    return () => { this.listeners.delete(l); };
  }

  ensure() {
    if (this.el) return this.el;
    this.el = new Audio();
    this.el.volume = this.muted ? 0 : this.volume;
    this.el.addEventListener('ended', () => { this.playing = false; this.emit(); });
    this.el.addEventListener('timeupdate', () => this.emit());
    this.el.addEventListener('volumechange', () => this.emit());
    return this.el;
  }

  applyVolume() {
    const el = this.ensure();
    el.volume = this.muted ? 0 : this.volume;
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

  seek(ratio: number) {
    const el = this.ensure();
    if (!el.duration || !Number.isFinite(el.duration)) return;
    el.currentTime = Math.max(0, Math.min(1, ratio)) * el.duration;
    this.emit();
  }

  async play(id: string | number, url?: string) {
    const el = this.ensure();
    this.applyVolume();
    if (!url) {
      this.playing = !this.playing;
      if (this.playing) void el.play().catch(() => { this.playing = false; this.emit(); });
      else el.pause();
      this.emit();
      return;
    }
    if (this.soundId !== id) {
      el.src = url;
      this.soundId = id;
    }
    this.playing = true;
    this.emit();
    try {
      await el.play();
    } catch {
      this.playing = false;
      this.emit();
    }
  }

  pause() {
    this.ensure().pause();
    this.playing = false;
    this.emit();
  }

  stop() {
    this.pause();
    this.soundId = null;
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
