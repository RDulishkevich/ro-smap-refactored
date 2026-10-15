import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Overlays } from '../primitives/chrome';
import { useUi } from './UiContext';
import { renderUi } from '../test/render';

function Probe() {
  const { toast, confirm, openMenu } = useUi();
  return (
    <div>
      <button type="button" onClick={() => toast('Сохранено')}>toast</button>
      <button type="button" onClick={() => toast('Скрыто', { undo: () => {} })}>undo-toast</button>
      <button type="button" onClick={() => void confirm({ title: 'Удалить?', ok: 'Удалить' })}>confirm</button>
      <button type="button" onClick={() => openMenu([{ label: 'На карте', onClick: () => {} }], 'Карта', { x: 40, y: 40 })}>
        menu
      </button>
      <Overlays />
    </div>
  );
}

describe('UiContext overlays', () => {
  it('shows an undo action on reversible toasts', async () => {
    const user = userEvent.setup();
    renderUi(<Probe />);
    await user.click(screen.getByRole('button', { name: 'undo-toast' }));
    expect(screen.getByText('Скрыто')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Отменить' })).toBeInTheDocument();
  });

  it('shows a toast', async () => {
    const user = userEvent.setup();
    renderUi(<Probe />);
    await user.click(screen.getByRole('button', { name: 'toast' }));
    expect(screen.getByText('Сохранено')).toBeInTheDocument();
  });

  it('asks before a destructive action', async () => {
    const user = userEvent.setup();
    renderUi(<Probe />);
    await user.click(screen.getByRole('button', { name: 'confirm' }));
    expect(screen.getByText('Удалить?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Отмена' }));
    await waitFor(() => {
      expect(screen.queryByText('Удалить?')).not.toBeInTheDocument();
    });
  });

  it('opens the ⋯ menu with a caret', async () => {
    const user = userEvent.setup();
    renderUi(<Probe />);
    await user.click(screen.getByRole('button', { name: 'menu' }));
    expect(screen.getByRole('menuitem', { name: 'На карте' })).toBeInTheDocument();
  });
});
