import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScreenHeader } from './ui';
import { renderUi } from '../test/render';

describe('ScreenHeader', () => {
  it('uses page voice and a back control', async () => {
    const onBack = vi.fn();
    const user = userEvent.setup();
    renderUi(<ScreenHeader title="Настройки" onBack={onBack} />);
    expect(screen.getByText('Настройки')).toHaveClass('pv-page');
    await user.click(screen.getByRole('button', { name: 'Назад' }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
