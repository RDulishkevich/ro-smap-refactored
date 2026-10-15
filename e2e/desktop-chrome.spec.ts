import { test, expect } from '@playwright/test';
import { boot, legacyBrand, namedButton, openFirstCatalogSound } from './helpers';

test.describe('desktop chrome', () => {

  test('rail, search and catalog', async ({ page }) => {
    const { healthy } = await boot(page);
    test.skip(!healthy, 'catalog API is down');

    await expect(page.getByRole('button', { name: /Полёвка/ })).toBeVisible();
    await expect(namedButton(page, 'Каталог')).toBeVisible();
    await expect(namedButton(page, 'Лента')).toBeVisible();
    await expect(page.getByPlaceholder('Поиск звуков…')).toBeVisible();
    await expect(namedButton(page, 'Уведомления')).toBeVisible();
    await expect(legacyBrand(page)).toHaveCount(0);

    await namedButton(page, 'Каталог').click();
    await expect(page.getByPlaceholder(/Название, место/)).toBeVisible();
    const row = await openFirstCatalogSound(page);
    test.skip(!(await row.isVisible().catch(() => false)), 'catalog empty');
    await expect(namedButton(page, 'Слушать').first()).toBeVisible();
  });

  test('sound ⋯ dropdown has items and a caret', async ({ page }) => {
    const { healthy } = await boot(page);
    test.skip(!healthy, 'catalog API is down');

    await namedButton(page, 'Каталог').click();
    const row = await openFirstCatalogSound(page);
    test.skip(!(await row.isVisible().catch(() => false)), 'catalog empty');
    await row.click();
    const more = page.getByRole('button', { name: /^Ещё/ });
    await expect(more).toBeVisible();
    await more.hover();
    await expect(page.getByRole('menu')).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'На карте' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Пожаловаться' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Скачать WAV' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);
  });

  test('notifications popover', async ({ page }) => {
    const { healthy } = await boot(page);
    test.skip(!healthy, 'catalog API is down');
    await namedButton(page, 'Уведомления').click();
    await expect(page.getByText('Пока тихо')).toBeVisible();
  });

  test('settings keep Yandex Maps terms', async ({ page }) => {
    const { healthy } = await boot(page);
    test.skip(!healthy, 'catalog API is down');
    await namedButton(page, 'Настройки').click();
    const terms = page.getByRole('link', { name: 'Условия Яндекс Карт' });
    await expect(terms.first()).toBeVisible();
    await expect(terms.first()).toHaveAttribute('href', 'https://yandex.ru/legal/maps_termsofuse');
  });

  test('language switch flips chrome copy', async ({ page }) => {
    const { healthy } = await boot(page);
    test.skip(!healthy, 'catalog API is down');
    await namedButton(page, 'English').click();
    await expect(namedButton(page, 'Catalog')).toBeVisible();
    await namedButton(page, 'Русский').click();
    await expect(namedButton(page, 'Каталог')).toBeVisible();
  });
});
