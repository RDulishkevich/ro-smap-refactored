import { AnimatePresence, motion } from 'motion/react';
import { MapPin, Mic, Plus } from 'lucide-react';
import { color, spring } from '@polevka/design';
import { useNav } from '../state/NavContext';
import { useUi } from '../state/UiContext';
import { useTh } from '../state/ThemeContext';

export function MapFab({ open, onToggle, from = 'corner' }: { open: boolean; onToggle: () => void; from?: 'corner' | 'center' }) {
  const { requireAuth } = useNav();
  const actions = from === 'center'
    ? [
        { Icon: MapPin, bg: color.dark, screen: { type: 'add-sound' as const }, x: -78, y: -78, label: 'Добавить звук' },
        { Icon: Mic, bg: color.accent, screen: { type: 'record' as const }, x: 78, y: -78, label: 'Записать' },
      ]
    : [
        { Icon: MapPin, bg: color.dark, screen: { type: 'add-sound' as const }, x: -72, y: -72, label: 'Добавить звук' },
        { Icon: Mic, bg: color.accent, screen: { type: 'record' as const }, x: -132, y: -132, label: 'Записать' },
      ];
  return (
    <div className="relative w-16 h-16 pointer-events-none">
      <AnimatePresence>
        {open && actions.map(({ Icon, bg, screen, x, y, label }, i) => (
          <motion.button key={label} title={label} aria-label={label}
            initial={{ opacity: 0, x: x * 0.4, y: y * 0.4, scale: 0.72 }}
            animate={{ opacity: 1, x, y, scale: 1 }}
            exit={{ opacity: 0, x: x * 0.4, y: y * 0.4, scale: 0.72 }}
            transition={{ ...spring.fab, delay: i * 0.07 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => { onToggle(); requireAuth(screen); }}
            className="absolute left-2 top-2 w-12 h-12 rounded-full flex items-center justify-center shadow-xl pointer-events-auto z-[1]"
            style={{ background: bg }}>
            <Icon size={20} color="white" />
          </motion.button>
        ))}
      </AnimatePresence>
      <motion.button onClick={onToggle} title="Добавить" aria-label="Добавить"
        className="relative z-10 w-16 h-16 rounded-full flex items-center justify-center shadow-xl pointer-events-auto" style={{ background: color.accent }}
        whileTap={{ scale: 0.96 }} animate={{ rotate: open ? 45 : 0 }} transition={spring.fab}>
        <Plus size={26} color="white" strokeWidth={2.5} />
      </motion.button>
    </div>
  );
}

export function Overlays() {
  const { toastMsg, confirmState, resolveConfirm, menu, closeMenu } = useUi();
  const th = useTh();
  return (
    <>
      <AnimatePresence>
        {toastMsg && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={spring.fade}
            className="pv-caption fixed left-1/2 z-[300] -translate-x-1/2 bottom-28 md:bottom-6 px-4 py-2 rounded-2xl font-semibold text-white shadow-lg"
            style={{ background: color.dark }}>{toastMsg}</motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {confirmState && (
          <motion.div className="fixed inset-0 z-[9999] flex items-center justify-center p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ background: 'rgba(26,26,26,0.4)' }} onClick={() => resolveConfirm(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={spring.fade} className="w-full max-w-sm rounded-3xl p-5" style={{ background: th.cardBg }} onClick={(e) => e.stopPropagation()}>
              <p className="pv-heading mb-2" style={{ color: th.inkText }}>{confirmState.title}</p>
              {confirmState.body && <p className="pv-body mb-4" style={{ color: color.olive }}>{confirmState.body}</p>}
              <div className="flex gap-2">
                <button className="pv-button flex-1 py-2.5 rounded-2xl" style={{ background: th.lightBg, color: color.olive }} onClick={() => resolveConfirm(false)}>Отмена</button>
                <button className="pv-button flex-1 py-2.5 rounded-2xl text-white" style={{ background: color.accent }} onClick={() => resolveConfirm(true)}>{confirmState.ok || 'ОК'}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {menu && (
          <motion.div className="fixed inset-0 z-[9997] pointer-events-none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={spring.fade}
            onContextMenu={(e) => { e.preventDefault(); closeMenu(); }}>
            <button type="button" className="absolute inset-0 pointer-events-auto cursor-default" aria-label="Закрыть меню" onClick={closeMenu} />
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={spring.fade}
              className="absolute w-[220px] rounded-2xl p-1.5 shadow-[0_12px_32px_rgba(45,60,57,0.16)] pointer-events-auto"
              style={{
                background: th.cardBg,
                border: `1px solid ${th.border}`,
                left: Math.max(12, Math.min(menu.at?.x ?? 24, (typeof window !== 'undefined' ? window.innerWidth : 400) - 232)),
                top: Math.max(12, Math.min(menu.at?.y ?? 24, (typeof window !== 'undefined' ? window.innerHeight : 400) - 220)),
              }}
              onClick={(e) => e.stopPropagation()}>
              {menu.title && <p className="pv-micro uppercase px-2.5 py-1.5" style={{ color: color.sage }}>{menu.title}</p>}
              {menu.items.map((it) => (
                <button key={it.label} className="pv-subtitle w-full text-left px-3 py-2.5 rounded-xl"
                  style={{ color: it.danger ? color.accent : th.inkText }}
                  onClick={() => { closeMenu(); it.onClick(); }}>{it.label}</button>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
