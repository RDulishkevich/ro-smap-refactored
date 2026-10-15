import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePrefs } from './PrefsContext';
import { renderUi } from '../test/render';

function Probe() {
  const { prefs, setPref } = usePrefs();
  return (
    <button type="button" onClick={() => setPref('reduceMotion', !prefs.reduceMotion)}>
      {prefs.reduceMotion ? 'on' : 'off'}
    </button>
  );
}

describe('PrefsContext', () => {
  it('toggles the reduce-motion class on <html>', async () => {
    const user = userEvent.setup();
    renderUi(<Probe />);
    expect(document.documentElement.classList.contains('pv-reduce-motion')).toBe(false);
    await user.click(screen.getByRole('button', { name: 'off' }));
    expect(document.documentElement.classList.contains('pv-reduce-motion')).toBe(true);
  });
});
