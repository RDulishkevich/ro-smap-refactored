import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorScreen } from './ErrorScreen';
import { renderUi } from '../test/render';

describe('ErrorScreen', () => {
  it('shows offline copy and retries', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    renderUi(<ErrorScreen kind="offline" onRetry={onRetry} />);
    expect(screen.getByRole('heading', { name: 'Нет сети' })).toBeInTheDocument();
    expect(screen.getByText(/пропал интернет/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Попробовать снова' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('does not invent a second brand', () => {
    renderUi(<ErrorScreen kind="unavailable" onRetry={() => {}} />);
    expect(screen.getByRole('heading', { name: 'Полёвка сейчас недоступна' })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/RO·SMap/i);
  });
});
