import { useEffect, useState, type ReactNode } from 'react';
import { useUi } from './state/UiContext';
import { AuthProvider, useAuth } from './state/AuthContext';
import { NavProvider } from './state/NavContext';
import { DataProvider, useData } from './state/DataContext';
import { ThemeProvider, useTh } from './state/ThemeContext';
import { PrefsProvider } from './state/PrefsContext';
import { UiProvider } from './state/UiContext';
import { useIsDesktop } from './lib/use-media';
import { useLockPageGestures } from './lib/use-lock-page-gestures';
import { MobileShell } from './layouts/MobileShell';
import { DesktopShell } from './layouts/DesktopShell';
import { Overlays } from './primitives/chrome';
import { CookieBanner } from './primitives/CookieBanner';
import { DeepLinks } from './lib/DeepLinks';
import { DegradedBanner, ErrorBoundary, ErrorScreen } from './primitives/ErrorScreen';
import { WelcomeSplash } from './primitives/WelcomeSplash';

function ServiceGate({ children }: { children: ReactNode }) {
  const { loading, catalogStatus, reload } = useData();
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  if (!loading && catalogStatus === 'down') {
    return <ErrorScreen kind={online ? 'unavailable' : 'offline'} onRetry={() => { void reload(); }} />;
  }
  return (
    <>
      {catalogStatus === 'degraded' ? <DegradedBanner onRetry={() => { void reload(); }} /> : null}
      {children}
    </>
  );
}

function Shell() {
  const desktop = useIsDesktop();
  const { isLoggedIn } = useAuth();
  const { toast } = useUi();
  const th = useTh();
  useLockPageGestures(!desktop);
  return (
    <NavProvider isLoggedIn={isLoggedIn} onNeedAuth={() => toast('Войдите в аккаунт')}>
      <DeepLinks />
      <div data-app="polevka" className="w-screen h-dvh" style={{ background: th.isDark ? '#0E1A18' : '#F3F4F6', fontFamily: '"Geist Variable", system-ui, sans-serif' }}>
        {desktop ? <DesktopShell /> : <MobileShell />}
        <Overlays />
        <CookieBanner />
        <WelcomeSplash />
      </div>
    </NavProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <PrefsProvider>
        <ErrorBoundary>
          <UiProvider>
            <AuthProvider>
              <DataProvider>
                <ServiceGate>
                  <Shell />
                </ServiceGate>
              </DataProvider>
            </AuthProvider>
          </UiProvider>
        </ErrorBoundary>
      </PrefsProvider>
    </ThemeProvider>
  );
}
