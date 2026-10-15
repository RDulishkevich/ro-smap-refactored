import { test, expect } from '@playwright/test';
import { boot, legacyBrand, namedButton } from './helpers';

test.describe('mobile chrome', () => {

  test('tabs, FAB and menu hub', async ({ page }) => {
    const { healthy } = await boot(page);
    test.skip(!healthy, 'catalog API is down');

    await expect(namedButton(page, 'Меню')).toBeVisible();
    await expect(namedButton(page, 'Карта')).toBeVisible();
    await expect(namedButton(page, 'Сообщения')).toBeVisible();
    await expect(namedButton(page, 'Вход')).toBeVisible();
    await expect(namedButton(page, 'Добавить')).toBeVisible();
    await expect(legacyBrand(page)).toHaveCount(0);

    await namedButton(page, 'Меню').click();
    await expect(page.getByRole('heading', { name: 'Меню' })).toBeVisible();
    await expect(namedButton(page, 'Лента')).toBeVisible();
    await expect(namedButton(page, 'Каталог')).toBeVisible();
    await expect(namedButton(page, 'Настройки')).toBeVisible();
    await expect(page.getByPlaceholder(/Поиск по звукам/)).toBeVisible();

    await namedButton(page, 'Карта').click();
    await namedButton(page, 'Добавить').click();
    await expect(namedButton(page, 'Добавить звук')).toBeVisible();
    await expect(namedButton(page, 'Записать')).toBeVisible();
  });

  test('map zoom cluster stays usable', async ({ page }) => {
    const { healthy } = await boot(page);
    test.skip(!healthy, 'catalog API is down');
    await namedButton(page, 'Карта').click();
    await expect(namedButton(page, 'Приблизить')).toBeVisible();
    await expect(namedButton(page, 'Отдалить')).toBeVisible();
    await expect(namedButton(page, 'Моё место')).toBeVisible();
  });

  test('guest messages are empty, not an icon card', async ({ page }) => {
    const { healthy } = await boot(page);
    test.skip(!healthy, 'catalog API is down');
    await namedButton(page, 'Сообщения').click();
    await expect(page.getByText('Чтобы писать')).toBeVisible();
    await expect(namedButton(page, 'Войти')).toBeVisible();
  });
});
