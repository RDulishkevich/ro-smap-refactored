import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageSwitch } from './LanguageSwitch';
import { renderUi } from '../test/render';
import { useT } from '../state/PrefsContext';

function Sample() {
  const t = useT();
  return (
    <div>
      <LanguageSwitch />
      <p>{t('settings')}</p>
    </div>
  );
}

describe('LanguageSwitch', () => {
  it('toggles RU / EN and updates copy', async () => {
    const user = userEvent.setup();
    renderUi(<Sample />);
    expect(screen.getByText('Настройки')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'English' }));
    expect(screen.getByText('Settings')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Русский' }));
    expect(screen.getByText('Настройки')).toBeInTheDocument();
  });
});
