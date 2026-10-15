import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MapFab, MapFabMenu } from './chrome';
import { renderUi } from '../test/render';

const requireAuth = vi.fn();

vi.mock('../state/NavContext', () => ({
  useNav: () => ({ requireAuth }),
}));

describe('MapFab', () => {
  it('center mode is plus-only; menu picks route via MapFabMenu', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const onClose = vi.fn();
    renderUi(
      <>
        <MapFab open onToggle={onToggle} from="center" />
        <MapFabMenu open onClose={onClose} />
      </>,
    );
    expect(screen.getByRole('button', { name: 'Добавить' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Добавить звук' }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(requireAuth).toHaveBeenCalledWith({ type: 'add-sound' });
  });
});
