import { expect, type Page } from '@playwright/test';

const CONSENT_KEY = 'polevka_cookie_consent';
const CONSENT_VERSION = 2;

export function namedButton(page: Page, name: string) {
  return page.getByRole('button', { name, exact: true });
}

export async function boot(page: Page) {
  await page.addInitScript(
    ({ key, version }) => {
      localStorage.setItem(key, JSON.stringify({ v: version, choice: 'all', at: new Date().toISOString() }));
    },
    { key: CONSENT_KEY, version: CONSENT_VERSION },
  );
  await page.goto('/');
  const chrome = namedButton(page, 'Карта').or(namedButton(page, 'Каталог'));
  const error = page.getByRole('heading', { name: /Нет сети|недоступна|сломалось/i });
  await expect(chrome.or(error).first()).toBeVisible({ timeout: 25_000 });
  const splash = page.getByRole('heading', { name: 'Полёвка' });
  if (await splash.isVisible().catch(() => false)) {
    await splash.waitFor({ state: 'hidden', timeout: 20_000 }).catch(() => {});
  }
  const healthy = await chrome.first().isVisible().catch(() => false);
  return { healthy };
}

export async function openFirstCatalogSound(page: Page) {
  const row = page.getByRole('button', { name: 'Открыть звук' }).first();
  await row.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});
  return row;
}

export function legacyBrand(page: Page) {
  return page.getByText(/RO·SMap|RO\.SMap/i);
}
