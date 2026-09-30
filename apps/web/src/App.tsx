import { useUi } from './state/UiContext';
import { AuthProvider, useAuth } from './state/AuthContext';
import { NavProvider } from './state/NavContext';
import { DataProvider } from './state/DataContext';
import { ThemeProvider, useTh } from './state/ThemeContext';
import { UiProvider } from './state/UiContext';
import { useIsDesktop } from './lib/use-media';
import { MobileShell } from './layouts/MobileShell';
import { DesktopShell } from './layouts/DesktopShell';
import { Overlays } from './primitives/chrome';
import { CookieBanner } from './primitives/CookieBanner';
import { DeepLinks } from './lib/DeepLinks';

function Shell() {
  const desktop = useIsDesktop();
  const { isLoggedIn } = useAuth();
  const { toast } = useUi();
  const th = useTh();
  return (
    <NavProvider isLoggedIn={isLoggedIn} onNeedAuth={() => toast('Войдите в аккаунт')}>
      <DeepLinks />
      <div className="w-screen h-dvh" style={{ background: th.isDark ? '#0E1A18' : '#F3F4F6', fontFamily: 'Geologica, sans-serif' }}>
        {desktop ? <DesktopShell /> : <MobileShell />}
        <Overlays />
        <CookieBanner />
      </div>
    </NavProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <UiProvider>
        <AuthProvider>
          <DataProvider>
            <Shell />
          </DataProvider>
        </AuthProvider>
      </UiProvider>
    </ThemeProvider>
  );
}
