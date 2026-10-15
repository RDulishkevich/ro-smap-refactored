import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { breakpoint } from '@polevka/design';
import { useIsDesktop } from './use-media';

function setWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
  window.dispatchEvent(new Event('resize'));
}

describe('useIsDesktop', () => {
  it(`treats ${breakpoint}px as the chrome split`, () => {
    setWidth(390);
    const { result } = renderHook(() => useIsDesktop());
    expect(result.current).toBe(false);
    act(() => setWidth(1280));
    expect(result.current).toBe(true);
    act(() => setWidth(breakpoint - 1));
    expect(result.current).toBe(false);
  });
});
