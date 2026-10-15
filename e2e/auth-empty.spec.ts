import { test, expect } from '@playwright/test';
import { boot, namedButton } from './helpers';

test.describe('auth and empty states', () => {

  test('guest profile offers sign-in, not a quiz', async ({ page }) => {
    const { healthy } = await boot(page);
    test.skip(!healthy, 'catalog API is down');
    await namedButton(page, 'Вход').click();
    await expect(namedButton(page, 'Войти в аккаунт')).toBeVisible();
    await expect(namedButton(page, 'Регистрация')).toBeVisible();
    await expect(page.getByText(/Кто вы в Полёвке|один вариант/)).toHaveCount(0);
  });

  test('settings open from the menu hub', async ({ page }) => {
    const { healthy } = await boot(page);
    test.skip(!healthy, 'catalog API is down');
    await namedButton(page, 'Меню').click();
    await namedButton(page, 'Настройки').click();
    await expect(page.getByText('Оформление').or(page.getByRole('heading', { name: 'Настройки' }))).toBeVisible();
    await expect(page.getByRole('link', { name: 'Условия Яндекс Карт' }).first()).toBeVisible();
  });
});
