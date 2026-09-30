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
            initial={{ scale: 0, opacity: 0, x: 0, y: 0 }}
            animate={{ scale: 1, opacity: 1, x, y }}
            exit={{ scale: 0, opacity: 0, x: 0, y: 0 }}
            transition={{ ...spring.fab, delay: i * 0.07 }}
            whileTap={{ scale: 0.85 }}
            onClick={() => { onToggle(); requireAuth(screen); }}
            className="absolute left-2 top-2 w-12 h-12 rounded-full flex items-center justify-center shadow-xl pointer-events-auto z-[1]"
            style={{ background: bg }}>
            <Icon size={20} color="white" />
          </motion.button>
        ))}
      </AnimatePresence>
      <motion.button onClick={onToggle} title="Добавить" aria-label="Добавить"
        className="relative z-10 w-16 h-16 rounded-full flex items-center justify-center shadow-xl pointer-events-auto" style={{ background: color.accent }}
        whileTap={{ scale: 0.9 }} animate={{ rotate: open ? 45 : 0 }} transition={spring.fab}>
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
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
            className="fixed left-1/2 z-[300] -translate-x-1/2 bottom-24 px-4 py-2 rounded-2xl text-xs font-semibold text-white shadow-lg"
            style={{ background: color.dark }}>{toastMsg}</motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {confirmState && (
          <motion.div className="fixed inset-0 z-[9999] flex items-center justify-center p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ background: 'rgba(26,26,26,0.4)' }} onClick={() => resolveConfirm(false)}>
            <motion.div initial={{ scale: 0.92 }} animate={{ scale: 1 }} className="w-full max-w-sm rounded-3xl p-5" style={{ background: th.cardBg }} onClick={(e) => e.stopPropagation()}>
              <p className="text-sm font-bold mb-2" style={{ color: th.inkText }}>{confirmState.title}</p>
              {confirmState.body && <p className="text-xs mb-4" style={{ color: color.olive }}>{confirmState.body}</p>}
              <div className="flex gap-2">
                <button className="flex-1 py-2.5 rounded-2xl text-xs font-semibold" style={{ background: th.lightBg, color: color.olive }} onClick={() => resolveConfirm(false)}>Отмена</button>
                <button className="flex-1 py-2.5 rounded-2xl text-xs font-semibold text-white" style={{ background: color.accent }} onClick={() => resolveConfirm(true)}>{confirmState.ok || 'ОК'}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {menu && (
          <motion.div className="fixed inset-0 z-[9997]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ background: menu.at ? 'transparent' : 'rgba(26,26,26,0.25)' }} onClick={closeMenu} onContextMenu={(e) => { e.preventDefault(); closeMenu(); }}>
            <motion.div
              initial={menu.at ? { opacity: 0, scale: 0.96 } : { y: 40 }}
              animate={menu.at ? { opacity: 1, scale: 1 } : { y: 0 }}
              className={menu.at ? 'absolute w-[240px] rounded-2xl p-2 shadow-xl' : 'absolute bottom-8 left-4 right-4 rounded-3xl p-3'}
              style={{
                background: th.cardBg,
                ...(menu.at ? {
                  left: Math.max(12, Math.min(menu.at.x, (typeof window !== 'undefined' ? window.innerWidth : 400) - 252)),
                  top: Math.max(12, Math.min(menu.at.y, (typeof window !== 'undefined' ? window.innerHeight : 400) - 220)),
                } : {}),
              }}
              onClick={(e) => e.stopPropagation()}>
              {menu.title && <p className="text-[10px] uppercase tracking-wide px-3 py-2" style={{ color: color.sage }}>{menu.title}</p>}
              {menu.items.map((it) => (
                <button key={it.label} className="w-full text-left px-3 py-2.5 rounded-2xl text-sm font-semibold"
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
