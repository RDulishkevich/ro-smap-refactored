/**
 * Smoke QA for https://polevka.art — console, network, screenshots.
 * Run: node scripts/qa-polevka-smoke.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'tmp', 'qa-polevka');
mkdirSync(OUT, { recursive: true });

const URL = process.env.QA_URL || 'https://www.polevka.art';
const IGNORE_HTTPS = process.env.QA_IGNORE_HTTPS === '1';

function isNoise(text) {
  const t = String(text || '');
  return (
    /favicon/i.test(t) ||
    /Download the React DevTools/i.test(t) ||
    /third-party cookie/i.test(t) ||
    /net::ERR_BLOCKED_BY_CLIENT/i.test(t)
  );
}

async function runViewport(browser, name, size) {
  const context = await browser.newContext({
    viewport: size,
    deviceScaleFactor: 1,
    locale: 'ru-RU',
    ignoreHTTPSErrors: IGNORE_HTTPS,
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedNet = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error' && !isNoise(msg.text())) {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', (err) => pageErrors.push(String(err)));
  page.on('response', (res) => {
    const u = res.url();
    const s = res.status();
    if (s >= 400 && !isNoise(u)) {
      // ignore analytics / optional fonts noise somewhat
      if (/google-analytics|googletagmanager|mc\.yandex|hotjar|facebook/i.test(u)) return;
      failedNet.push(`${s} ${u.slice(0, 160)}`);
    }
  });

  const result = { name, size, consoleErrors, pageErrors, failedNet, notes: [] };

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);

  // Dismiss onboarding if it blocks clicks
  const onboard = page.locator('#onboarding-overlay');
  if (await onboard.isVisible().catch(() => false)) {
    const skip = page.locator('#onboarding-skip, [data-onboarding-skip], button:has-text("Пропустить"), button:has-text("Далее"), button:has-text("Понятно")').first();
    if (await skip.count()) {
      await skip.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(500);
      // click through remaining steps
      for (let i = 0; i < 6; i++) {
        if (!(await onboard.isVisible().catch(() => false))) break;
        const next = page.locator('#onboarding-next, button:has-text("Далее"), button:has-text("Готово"), button:has-text("Начать")').first();
        if (await next.isVisible().catch(() => false)) {
          await next.click({ timeout: 2000 }).catch(() => {});
          await page.waitForTimeout(400);
        } else {
          await page.evaluate(() => {
            const el = document.getElementById('onboarding-overlay');
            if (el) el.classList.add('hidden');
            try { localStorage.setItem('polevka_onboarding_done', '1'); } catch {}
          });
          break;
        }
      }
    } else {
      await page.evaluate(() => {
        const el = document.getElementById('onboarding-overlay');
        if (el) { el.classList.add('hidden'); el.style.display = 'none'; }
      });
    }
    result.notes.push('onboarding-dismissed');
  }

  await page.screenshot({ path: join(OUT, `${name}-home.png`), fullPage: false });

  // Key chrome presence
  const rail = await page.locator('#app-rail').count();
  const map = await page.locator('#map').count();
  const mobileNav = await page.locator('#mobile-bottom-nav').count();
  result.notes.push(`#app-rail=${rail} #map=${map} #mobile-bottom-nav=${mobileNav}`);

  // Try open a sound from sidebar list if present
  const soundRow = page.locator('.sidebar-sound-row, [data-sound-id], .feed-card').first();
  if (await soundRow.count()) {
    try {
      await soundRow.click({ timeout: 4000 });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: join(OUT, `${name}-after-sound-click.png`), fullPage: false });
      const player = page.locator('#player-card');
      const playerVisible = await player.isVisible().catch(() => false);
      result.notes.push(`player-visible=${playerVisible}`);
      if (playerVisible) {
        const box = await player.boundingBox();
        result.notes.push(`player-box=${JSON.stringify(box)}`);
      }
    } catch (e) {
      result.notes.push(`sound-click-fail=${e.message}`);
    }
  } else {
    result.notes.push('no-sound-row-found');
  }

  // Details / dock if open
  const details = page.locator('#details-modal-content, #details-title');
  if (await details.count()) {
    const title = await page.locator('#details-title').textContent().catch(() => '');
    result.notes.push(`details-title="${(title || '').trim().slice(0, 80)}"`);
    await page.screenshot({ path: join(OUT, `${name}-details.png`), fullPage: false });
  }

  // Favicon check
  const icons = await page.evaluate(() =>
    [...document.querySelectorAll('link[rel*="icon"]')].map((l) => ({
      rel: l.rel,
      href: l.href,
      sizes: l.sizes?.toString?.() || '',
    }))
  );
  result.notes.push(`icons=${JSON.stringify(icons)}`);

  // Cursor CSS var presence
  const cursor = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    return {
      default: cs.getPropertyValue('--cursor-default').trim().slice(0, 120),
      bodyCursor: getComputedStyle(document.body).cursor.slice(0, 120),
    };
  });
  result.notes.push(`cursor=${JSON.stringify(cursor)}`);

  await context.close();
  return result;
}

const browser = await chromium.launch({ headless: true });
const results = [];
try {
  results.push(await runViewport(browser, 'desktop', { width: 1280, height: 800 }));
  results.push(await runViewport(browser, 'mobile', { width: 390, height: 844 }));
} finally {
  await browser.close();
}

const summary = {
  url: URL,
  out: OUT,
  results: results.map((r) => ({
    name: r.name,
    size: r.size,
    pageErrors: r.pageErrors,
    consoleErrors: [...new Set(r.consoleErrors)].slice(0, 20),
    failedNet: [...new Set(r.failedNet)].slice(0, 30),
    notes: r.notes,
  })),
};

console.log(JSON.stringify(summary, null, 2));
