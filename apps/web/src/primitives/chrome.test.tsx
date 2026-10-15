import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MapFab } from './chrome';
import { renderUi } from '../test/render';

const requireAuth = vi.fn();

vi.mock('../state/NavContext', () => ({
  useNav: () => ({ requireAuth }),
}));

describe('MapFab', () => {
  it('opens add and record actions from the plus', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    renderUi(<MapFab open onToggle={onToggle} from="center" />);
    expect(screen.getByRole('button', { name: 'Добавить' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Добавить звук' }));
    expect(onToggle).toHaveBeenCalledOnce();
    expect(requireAuth).toHaveBeenCalledWith({ type: 'add-sound' });
  });
});
