/**
 * End-to-end click-through of guest mobile journeys (Pixel 7).
 * Collects timing + soft UX/security assertions for the audit canvas.
 */
import { test, expect, type Page } from '@playwright/test';
import { boot, legacyBrand, namedButton, openFirstCatalogSound } from './helpers';

type Finding = {
  id: string;
  area: 'ergonomics' | 'speed' | 'reliability' | 'security' | 'architecture' | 'ux';
  severity: 'ok' | 'info' | 'warn' | 'fail';
  scenario: string;
  detail: string;
  ms?: number;
};

const findings: Finding[] = [];

function note(f: Finding) {
  findings.push(f);
}

async function timed<T>(label: string, fn: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const t0 = Date.now();
  const value = await fn();
  return { value, ms: Date.now() - t0 };
}

async function noNativeDialogs(page: Page) {
  page.on('dialog', (d) => {
    note({
      id: 'native-dialog',
      area: 'security',
      severity: 'fail',
      scenario: 'any',
      detail: `Native ${d.type()}: ${d.message()}`,
    });
    throw new Error(`native ${d.type()}: ${d.message()}`);
  });
}

async function assertNoLegacyBrand(page: Page, scenario: string) {
  const n = await legacyBrand(page).count();
  note({
    id: `brand-${scenario}`,
    area: 'ux',
    severity: n === 0 ? 'ok' : 'fail',
    scenario,
    detail: n === 0 ? 'No RO·SMap legacy brand' : `Legacy brand visible (${n})`,
  });
  expect(n).toBe(0);
}

test.describe('mobile guest journey audit', () => {
  test.afterAll(async () => {
    // Surfaced in Playwright stdout for the agent canvas.
    // eslint-disable-next-line no-console
    console.log('\n=== MOBILE_AUDIT_FINDINGS_JSON ===');
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(findings, null, 2));
    // eslint-disable-next-line no-console
    console.log('=== END_MOBILE_AUDIT_FINDINGS ===\n');
  });

  test('full guest click-through', async ({ page }) => {
    await noNativeDialogs(page);
    const { ms: bootMs, value: { healthy } } = await timed('boot', () => boot(page));
    note({
      id: 'boot',
      area: 'speed',
      severity: bootMs < 8000 ? 'ok' : bootMs < 15000 ? 'warn' : 'fail',
      scenario: 'boot',
      detail: `Chrome visible after boot`,
      ms: bootMs,
    });
    test.skip(!healthy, 'catalog API is down');
    await assertNoLegacyBrand(page, 'boot');

    // --- Tabs ---
    for (const tab of ['Меню', 'Карта', 'Сообщения', 'Вход'] as const) {
      await expect(namedButton(page, tab)).toBeVisible();
    }
    await expect(namedButton(page, 'Добавить')).toBeVisible();
    note({
      id: 'chrome-tabs',
      area: 'architecture',
      severity: 'ok',
      scenario: 'chrome',
      detail: '4 tabs + FAB present (Меню/Карта/Сообщения/Вход)',
    });

    // --- Menu hub ---
    {
      const { ms } = await timed('menu', async () => {
        await namedButton(page, 'Меню').click();
        await expect(page.getByRole('heading', { name: 'Меню' })).toBeVisible();
      });
      note({ id: 'menu-open', area: 'speed', severity: ms < 1200 ? 'ok' : 'warn', scenario: 'menu', detail: 'Menu hub opened', ms });
      await expect(page.getByPlaceholder(/Поиск по звукам/)).toBeVisible();
      for (const tile of ['Лента', 'Каталог', 'Экспедиции', 'Настройки', 'Помощь', 'Угадайка'] as const) {
        await expect(namedButton(page, tile)).toBeVisible();
      }
    }

    // --- Catalog → sound detail / player sheet ---
    {
      await namedButton(page, 'Каталог').click();
      const { ms: catalogMs } = await timed('catalog', async () => {
        await expect(page.getByRole('banner').getByText(/Каталог|Catalog/i).or(page.getByText('Каталог').first())).toBeVisible({ timeout: 15_000 });
      });
      note({ id: 'catalog-open', area: 'speed', severity: catalogMs < 2500 ? 'ok' : 'warn', scenario: 'catalog', detail: 'Catalog screen', ms: catalogMs });

      const row = await openFirstCatalogSound(page);
      if (await row.isVisible().catch(() => false)) {
        const { ms: openMs } = await timed('sound-open', async () => {
          await row.click();
          await expect(
            page.getByText('Сейчас играет').or(page.getByRole('button', { name: /Пауза|Слушать|Play|Pause/i }).first()),
          ).toBeVisible({ timeout: 12_000 });
        });
        note({
          id: 'sound-sheet',
          area: 'ergonomics',
          severity: openMs < 2000 ? 'ok' : 'warn',
          scenario: 'sound-detail',
          detail: 'Sound player sheet opened from catalog',
          ms: openMs,
        });

        // Guest like should gate to auth (security)
        const like = page.getByRole('button', { name: 'Нравится' }).first();
        if (await like.isVisible().catch(() => false)) {
          await like.click();
          const authVisible = await page.getByRole('heading', { name: 'Вход' })
            .or(page.getByText(/Войдите/i).first())
            .or(namedButton(page, 'Войти'))
            .first()
            .isVisible()
            .catch(() => false);
          note({
            id: 'like-auth-gate',
            area: 'security',
            severity: authVisible ? 'ok' : 'warn',
            scenario: 'sound-like',
            detail: authVisible
              ? 'Guest like gated (auth/toast)'
              : 'Like click did not clearly surface auth — check toast/gate',
          });
        }

        // Dismiss sheet via chevron / back
        const close = page.getByRole('button', { name: /Закрыть|Назад/i }).first();
        if (await close.isVisible().catch(() => false)) {
          await close.click();
        } else {
          await page.goBack().catch(() => {});
        }
      } else {
        note({
          id: 'catalog-empty',
          area: 'reliability',
          severity: 'warn',
          scenario: 'catalog',
          detail: 'No «Открыть звук» rows — catalog empty or selector drift',
        });
      }
    }

    // Back to menu if still in stack
    if (await namedButton(page, 'Меню').isVisible().catch(() => false)) {
      await namedButton(page, 'Меню').click().catch(() => {});
    }

    // --- Feed ---
    {
      await namedButton(page, 'Меню').click().catch(() => {});
      if (await namedButton(page, 'Лента').isVisible().catch(() => false)) {
        const { ms } = await timed('feed', async () => {
          await namedButton(page, 'Лента').click();
          await page.waitForTimeout(600);
        });
        note({ id: 'feed-open', area: 'speed', severity: ms < 2500 ? 'ok' : 'warn', scenario: 'feed', detail: 'Feed opened', ms });
        // leave stack
        const back = page.getByRole('button', { name: /Назад|Закрыть/i }).first();
        if (await back.isVisible().catch(() => false)) await back.click();
      }
    }

    // --- Expeditions ---
    {
      await namedButton(page, 'Меню').click().catch(() => {});
      if (await namedButton(page, 'Экспедиции').isVisible().catch(() => false)) {
        await namedButton(page, 'Экспедиции').click();
        await page.waitForTimeout(500);
        const newExp = namedButton(page, 'Новая экспедиция');
        const guestSeesCreate = await newExp.isVisible().catch(() => false);
        note({
          id: 'expedition-create-gate',
          area: 'security',
          severity: guestSeesCreate ? 'info' : 'ok',
          scenario: 'expeditions',
          detail: guestSeesCreate
            ? '«Новая экспедиция» visible to guest — must auth-gate on click'
            : 'Create expedition hidden for guest',
        });
        const back = page.getByRole('button', { name: /Назад|Закрыть/i }).first();
        if (await back.isVisible().catch(() => false)) await back.click();
      }
    }

    // --- Settings + legal ---
    {
      await namedButton(page, 'Меню').click().catch(() => {});
      await namedButton(page, 'Настройки').click();
      await expect(page.getByText('Оформление').or(page.getByRole('heading', { name: 'Настройки' }))).toBeVisible();
      const yandex = page.getByRole('link', { name: 'Условия Яндекс Карт' }).first();
      await expect(yandex).toBeVisible();
      note({ id: 'settings', area: 'architecture', severity: 'ok', scenario: 'settings', detail: 'Settings + Yandex Maps terms link present' });

      const privacy = page.getByRole('button', { name: /Политика|Privacy/i }).or(page.getByText(/Политика конфиденциальности/i)).first();
      if (await privacy.isVisible().catch(() => false)) {
        await privacy.click();
        await page.waitForTimeout(400);
        const pdf = page.getByRole('button', { name: /PDF|Скачать/i }).first();
        note({
          id: 'legal-pdf',
          area: 'reliability',
          severity: (await pdf.isVisible().catch(() => false)) ? 'ok' : 'info',
          scenario: 'legal',
          detail: (await pdf.isVisible().catch(() => false)) ? 'Legal PDF action visible' : 'Legal opened without PDF button',
        });
        const back = page.getByRole('button', { name: /Назад|Закрыть/i }).first();
        if (await back.isVisible().catch(() => false)) await back.click();
      }
      const back2 = page.getByRole('button', { name: /Назад|Закрыть/i }).first();
      if (await back2.isVisible().catch(() => false)) await back2.click();
    }

    // --- Help ---
    {
      await namedButton(page, 'Меню').click().catch(() => {});
      if (await namedButton(page, 'Помощь').isVisible().catch(() => false)) {
        await namedButton(page, 'Помощь').click();
        await expect(page.getByText(/Поддержка Полёвки/i).first()).toBeVisible();
        const ticket = namedButton(page, 'Обращение').or(page.getByRole('button', { name: /обращен/i })).first();
        if (await ticket.isVisible().catch(() => false)) {
          await ticket.click();
          await page.waitForTimeout(500);
          const needsAuth = await page.getByText(/Войдите/i).or(namedButton(page, 'Войти')).first().isVisible().catch(() => false);
          note({
            id: 'help-ticket-gate',
            area: 'security',
            severity: needsAuth ? 'ok' : 'info',
            scenario: 'help',
            detail: needsAuth ? 'Ticket creation asks guest to sign in' : 'Ticket flow without clear auth prompt (may be FAQ-only)',
          });
        }
        note({ id: 'help', area: 'ux', severity: 'ok', scenario: 'help', detail: 'Help / support screen reachable' });
        const back = page.getByRole('button', { name: /Назад|Закрыть/i }).first();
        if (await back.isVisible().catch(() => false)) await back.click();
      }
    }

    // --- Guessr ---
    {
      await namedButton(page, 'Меню').click().catch(() => {});
      if (await namedButton(page, 'Угадайка').isVisible().catch(() => false)) {
        const { ms } = await timed('guessr', async () => {
          await namedButton(page, 'Угадайка').click();
          await expect(page.getByRole('banner').getByText('Угадайка').or(page.getByText('Угадайка').first())).toBeVisible();
        });
        note({ id: 'guessr', area: 'speed', severity: ms < 2000 ? 'ok' : 'warn', scenario: 'guessr', detail: 'Guessr opened', ms });
        const back = page.getByRole('button', { name: /Назад|Закрыть/i }).first();
        if (await back.isVisible().catch(() => false)) await back.click();
      }
    }

    // --- Map + FAB auth gate ---
    {
      await namedButton(page, 'Карта').click();
      await expect(namedButton(page, 'Приблизить')).toBeVisible();
      await expect(namedButton(page, 'Отдалить')).toBeVisible();
      await expect(namedButton(page, 'Моё место')).toBeVisible();
      note({ id: 'map-zoom', area: 'ergonomics', severity: 'ok', scenario: 'map', detail: 'Zoom + locate controls visible' });

      await namedButton(page, 'Добавить').click();
      await expect(namedButton(page, 'Добавить звук')).toBeVisible();
      await expect(namedButton(page, 'Записать')).toBeVisible();
      // Labels beside FAB — ergonomics check: both labeled
      note({ id: 'fab-labels', area: 'ergonomics', severity: 'ok', scenario: 'fab', detail: 'FAB menu shows labeled «Добавить звук» and «Записать»' });

      await namedButton(page, 'Добавить звук').click();
      await expect(
        page.getByRole('heading', { name: 'Вход' }).or(page.getByText('Вход', { exact: true })).first(),
      ).toBeVisible();
      await expect(namedButton(page, 'Войти')).toBeVisible();
      note({ id: 'fab-auth', area: 'security', severity: 'ok', scenario: 'fab-add', detail: 'Guest FAB → auth, not silent fail' });
      const back = page.getByRole('button', { name: /Назад|Закрыть/i }).first();
      if (await back.isVisible().catch(() => false)) await back.click();
    }

    // --- Messages guest empty ---
    {
      await namedButton(page, 'Сообщения').click();
      await expect(page.getByText(/Чтобы писать|Войдите/i).first()).toBeVisible();
      await expect(namedButton(page, 'Войти')).toBeVisible();
      note({ id: 'messages-guest', area: 'security', severity: 'ok', scenario: 'messages', detail: 'Guest messages empty + sign-in CTA' });
    }

    // --- Profile guest ---
    {
      await namedButton(page, 'Вход').click();
      await expect(namedButton(page, 'Войти в аккаунт')).toBeVisible();
      await expect(namedButton(page, 'Регистрация')).toBeVisible();
      await expect(page.getByText(/Кто вы в Полёвке|один вариант/)).toHaveCount(0);
      note({ id: 'profile-guest', area: 'ux', severity: 'ok', scenario: 'profile', detail: 'Guest profile offers sign-in/register, no quiz remnant' });

      await namedButton(page, 'Войти в аккаунт').click();
      await expect(page.getByRole('heading', { name: 'Вход' }).or(page.getByText('Вход').first())).toBeVisible();
      // OAuth buttons should exist but we don't complete OAuth in CI
      const ya = page.getByRole('button', { name: /Яндекс/i }).first();
      const vk = page.getByRole('button', { name: /VK|ВКонтакте/i }).first();
      note({
        id: 'auth-oauth-buttons',
        area: 'architecture',
        severity: ((await ya.isVisible().catch(() => false)) || (await vk.isVisible().catch(() => false))) ? 'ok' : 'warn',
        scenario: 'auth',
        detail: 'OAuth provider buttons on auth screen',
      });
    }

    // Speed summary
    const slow = findings.filter((f) => f.area === 'speed' && f.severity !== 'ok');
    note({
      id: 'speed-summary',
      area: 'speed',
      severity: slow.length ? 'warn' : 'ok',
      scenario: 'summary',
      detail: slow.length ? `${slow.length} slow transitions` : 'All timed transitions within budget',
    });
  });
});
