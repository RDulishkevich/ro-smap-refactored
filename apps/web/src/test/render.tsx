import type { ReactElement, ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { MotionConfig } from 'motion/react';
import { ThemeProvider } from '../state/ThemeContext';
import { PrefsProvider } from '../state/PrefsContext';
import { UiProvider } from '../state/UiContext';

function AllProviders({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="always">
      <ThemeProvider>
        <PrefsProvider>
          <UiProvider>{children}</UiProvider>
        </PrefsProvider>
      </ThemeProvider>
    </MotionConfig>
  );
}

export function renderUi(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, { wrapper: AllProviders, ...options });
}
