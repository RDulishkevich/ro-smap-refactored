import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TOKEN_KEY, hasCookieConsentForAuth } from '@polevka/core';
import { CookieBanner } from './CookieBanner';
import { renderUi } from '../test/render';

describe('CookieBanner', () => {
  it('stores an explicit choice', async () => {
    const user = userEvent.setup();
    renderUi(<CookieBanner />);
    expect(screen.getByText('Cookies')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Принять' }));
    expect(hasCookieConsentForAuth()).toBe(true);
    expect(screen.queryByText('Cookies')).not.toBeInTheDocument();
  });

  it('necessary choice withdraws auth cookies and clears the JWT', async () => {
    const user = userEvent.setup();
    localStorage.setItem(TOKEN_KEY, 'stale-jwt');
    renderUi(<CookieBanner />);
    await user.click(screen.getByRole('button', { name: 'Только необходимые' }));
    expect(hasCookieConsentForAuth()).toBe(false);
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });
});

