import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmptyNote } from './EmptyNote';
import { renderUi } from '../test/render';

describe('EmptyNote', () => {
  it('is typography-led: title, hint, text action — no icon chip', async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    const { container } = renderUi(
      <EmptyNote title="Пока тихо" hint="Напишите первым" actionLabel="Написать" onAction={onAction} />,
    );
    expect(screen.getByText('Пока тихо')).toHaveClass('pv-title');
    expect(screen.getByText('Напишите первым')).toHaveClass('pv-body');
    expect(container.querySelector('svg')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Написать' }));
    expect(onAction).toHaveBeenCalledOnce();
  });
});
