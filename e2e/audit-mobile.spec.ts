import { test, expect } from '@playwright/test';
import { boot, namedButton } from './helpers';

test.describe('mobile audit', () => {
  test('guest FAB asks for sign-in, not a silent fail', async ({ page }) => {
    page.on('dialog', (d) => { throw new Error(`native ${d.type()}: ${d.message()}`); });
    const { healthy } = await boot(page);
    test.skip(!healthy, 'catalog API is down');
    await namedButton(page, 'Карта').click();
    await namedButton(page, 'Добавить').click();
    await namedButton(page, 'Добавить звук').click();
    await expect(page.getByRole('heading', { name: 'Вход' }).or(page.getByText('Вход', { exact: true })).first()).toBeVisible();
    await expect(namedButton(page, 'Войти')).toBeVisible();
  });

  test('Guessr is reachable as Угадайка', async ({ page }) => {
    const { healthy } = await boot(page);
    test.skip(!healthy, 'catalog API is down');
    await namedButton(page, 'Меню').click();
    await namedButton(page, 'Угадайка').click();
    await expect(page.getByRole('banner').getByText('Угадайка')).toBeVisible();
  });

  test('reduce-motion toggle sets the html class', async ({ page }) => {
    const { healthy } = await boot(page);
    test.skip(!healthy, 'catalog API is down');
    await namedButton(page, 'Меню').click();
    await namedButton(page, 'Настройки').click();
    await page.locator('div').filter({ hasText: /^Меньше анимации$/ }).getByRole('switch').click();
    await expect(page.locator('html')).toHaveClass(/pv-reduce-motion/);
  });
});
