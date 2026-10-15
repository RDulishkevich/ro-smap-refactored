import { Component, type ErrorInfo, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { RefreshCw } from 'lucide-react';
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

  return (
    <div
      className="w-screen h-dvh flex flex-col justify-center px-8"
      style={{ background: th.isDark ? '#000000' : '#E8EDEA' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring.stack}
        className="w-full max-w-[420px]"
      >
        <div className="w-11 h-11 mb-5">
          <BrandMark className="size-11" />
        </div>
        <h1 className="pv-title mb-2" style={{ color: th.inkText }}>
          {title}
        </h1>
        <p className="pv-body mb-6 max-w-[22rem]" style={{ color: th.muted }}>
          {body}
        </p>
        <motion.button
          type="button"
          whileTap={tap.cta}
          onClick={onRetry}
          className="pv-button inline-flex items-center justify-center gap-2 h-11 px-4 rounded-2xl text-white"
          style={{ background: color.accent }}
        >
          <RefreshCw size={15} />
          {t('errRetry')}
        </motion.button>
        <div>
          <a
            href="/"
            className="pv-caption mt-4 inline-block"
            style={{ color: th.muted }}
          >
            {t('errHome')}
          </a>
        </div>
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
        background: th.isDark ? th.lightBg : color.cream,
        color: th.muted,
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
