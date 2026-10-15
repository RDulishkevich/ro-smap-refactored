import { test, expect } from '@playwright/test';
import { boot, namedButton } from './helpers';

test.describe('desktop audit', () => {
  test('chrome does not leak the mobile tab bar', async ({ page }) => {
    page.on('dialog', (d) => { throw new Error(`native ${d.type()}: ${d.message()}`); });
    const { healthy } = await boot(page);
    test.skip(!healthy, 'catalog API is down');
    await expect(page.locator('.pv-mobile-nav')).toHaveCount(0);
    await expect(namedButton(page, 'Добавить')).toBeVisible();
  });

  test('notifications popover is not the shared ⋯ menu', async ({ page }) => {
    const { healthy } = await boot(page);
    test.skip(!healthy, 'catalog API is down');
    await namedButton(page, 'Уведомления').click();
    await expect(page.getByText('Пока тихо')).toBeVisible();
    await expect(page.getByRole('menu')).toHaveCount(0);
  });

  test('reduce-motion toggle sets the html class', async ({ page }) => {
    const { healthy } = await boot(page);
    test.skip(!healthy, 'catalog API is down');
    await namedButton(page, 'Настройки').click();
    await page.locator('div').filter({ hasText: /^Меньше анимации$/ }).getByRole('switch').click();
    await expect(page.locator('html')).toHaveClass(/pv-reduce-motion/);
  });
});
