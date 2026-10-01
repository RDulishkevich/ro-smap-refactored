import { useCallback, useRef, useState, type PointerEvent } from 'react';
import { color } from '@polevka/design';
import { useTh } from '../state/ThemeContext';
import { audioService } from '../lib/audio-player';

export function AmbiSphere() {
  const th = useTh();
  const [yaw, setYaw] = useState(() => audioService.yaw);
  const [pitch, setPitch] = useState(() => audioService.pitchDeg);
  const padRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const apply = useCallback((clientX: number, clientY: number) => {
    const pad = padRef.current;
    if (!pad) return;
    const rect = pad.getBoundingClientRect();
    const cx = rect.width / 2, cy = rect.height / 2, r = rect.width / 2;
    let dx = clientX - rect.left - cx;
    let dy = clientY - rect.top - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > r) { dx = (dx / dist) * r; dy = (dy / dist) * r; }
    const nextYaw = (dx / r) * 180;
    const nextPitch = (-dy / r) * 90;
    setYaw(nextYaw);
    setPitch(nextPitch);
    audioService.setAmbiRotation(nextYaw, nextPitch);
  }, []);

  const onPointer = (e: PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    apply(e.clientX, e.clientY);
  };

  const x = 50 + (yaw / 180) * 50;
  const y = 50 - (pitch / 90) * 50;

  return (
    <div className="mt-2.5 flex flex-col items-center gap-1.5">
      <div className="w-full flex justify-between items-center px-0.5">
        <span className="text-[10px] uppercase font-bold tracking-widest" style={{ color: color.sage }}>Звуковая сфера</span>
        <span className="text-[10px] font-mono font-semibold" style={{ color: color.accent }}>
          Y: {Math.round(yaw)}° · P: {Math.round(pitch)}°
        </span>
      </div>
      <div
        ref={padRef}
        role="application"
        aria-label="Вращение амбисоник-сцены"
        className="relative w-[148px] h-[148px] rounded-full select-none touch-none"
        style={{
          background: th.phoneBg,
          border: `2px solid ${color.accent}`,
          boxShadow: `inset 0 0 0 1px ${th.border}`,
        }}
        onPointerDown={onPointer}
        onPointerMove={(e) => { if (dragging.current) apply(e.clientX, e.clientY); }}
        onPointerUp={() => { dragging.current = false; }}
        onPointerCancel={() => { dragging.current = false; }}
      >
        {(['W', 'X', 'Y', 'Z'] as const).map((ch, i) => {
          const pos = [
            { top: '8%', left: '50%' },
            { top: '50%', left: '88%' },
            { top: '50%', left: '12%' },
            { top: '86%', left: '50%' },
          ][i];
          return (
            <span key={ch} className="absolute text-[9px] font-bold -translate-x-1/2 -translate-y-1/2" style={{ ...pos, color: color.olive }}>{ch}</span>
          );
        })}
        <div className="absolute left-1/2 top-0 bottom-0 w-px" style={{ background: th.border }} />
        <div className="absolute top-1/2 left-0 right-0 h-px" style={{ background: th.border }} />
        <div
          className="absolute w-3.5 h-3.5 rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{ left: `${x}%`, top: `${y}%`, background: color.accent, border: '2px solid #fff' }}
        />
      </div>
      <p className="text-[9px] text-center" style={{ color: color.sage }}>Секторы W·X·Y·Z · тяните точку (Yaw & Pitch)</p>
    </div>
  );
}
