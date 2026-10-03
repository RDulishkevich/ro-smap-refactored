import { Component, type ErrorInfo, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { CloudOff, RefreshCw, WifiOff } from 'lucide-react';
import { color, spring, tap } from '@polevka/design';
import BrandMark from '../brand/BrandMark';
import { useTh } from '../state/ThemeContext';
import { useT } from '../state/PrefsContext';

export type ErrorKind = 'crash' | 'offline' | 'unavailable';

export function ErrorScreen({ kind, onRetry }: { kind: ErrorKind; onRetry: () => void }) {
  const th = useTh();
  const t = useT();
  const title = kind === 'offline' ? t('errOfflineTitle') : kind === 'unavailable' ? t('errDownTitle') : t('errCrashTitle');
  const body = kind === 'offline' ? t('errOfflineBody') : kind === 'unavailable' ? t('errDownBody') : t('errCrashBody');
  const Icon = kind === 'offline' ? WifiOff : CloudOff;

  return (
    <div
      className="w-screen h-dvh flex items-center justify-center p-5"
      style={{ background: th.isDark ? '#0E1A18' : '#E8EDEA' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring.stack}
        className="w-full max-w-[420px] rounded-3xl px-7 py-8 text-center"
        style={{ background: th.cardBg, boxShadow: '0 18px 48px rgba(45,60,57,0.12)' }}
      >
        <div
          className="mx-auto mb-5 size-16 rounded-2xl overflow-hidden flex items-center justify-center"
          style={{ background: th.isDark ? '#1E2E2A' : color.cream }}
        >
          <BrandMark className="size-14" />
        </div>
        <div className="mx-auto mb-4 size-11 rounded-full flex items-center justify-center" style={{ background: `${color.accent}18` }}>
          <Icon size={22} color={color.accent} />
        </div>
        <h1 className="pv-title mb-2" style={{ color: th.inkText }}>
          {title}
        </h1>
        <p className="pv-body mb-6" style={{ color: color.olive }}>
          {body}
        </p>
        <motion.button
          type="button"
          whileTap={tap}
          onClick={onRetry}
          className="pv-button inline-flex items-center justify-center gap-2 h-12 px-5 rounded-2xl text-white w-full"
          style={{ background: color.accent }}
        >
          <RefreshCw size={16} />
          {t('errRetry')}
        </motion.button>
        <a
          href="/"
          className="pv-button mt-3 inline-flex items-center justify-center h-11 w-full rounded-2xl"
          style={{ color: color.olive }}
        >
          {t('errHome')}
        </a>
      </motion.div>
    </div>
  );
}

export function DegradedBanner({ onRetry }: { onRetry: () => void }) {
  const t = useT();
  const th = useTh();
  return (
    <button
      type="button"
      onClick={onRetry}
      className="pv-caption fixed left-1/2 z-[80] -translate-x-1/2 px-4 py-2 rounded-full max-w-[min(92vw,420px)]"
      style={{
        top: 'max(16px, env(safe-area-inset-top))',
        background: th.isDark ? '#2A3D38' : color.cream,
        color: color.olive,
        boxShadow: '0 8px 24px rgba(45,60,57,0.12)',
      }}
    >
      {t('errDegraded')}
    </button>
  );
}

type BoundaryState = { hasError: boolean };

export class ErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { hasError: false };

  static getDerivedStateFromError(): BoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('polevka_ui', error?.name || 'Error', info?.componentStack ? 'stack' : '');
  }

  render() {
    if (this.state.hasError) {
      return <ErrorScreen kind="crash" onRetry={() => window.location.reload()} />;
    }
    return this.props.children;
  }
}
