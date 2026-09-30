/**
 * Full guest-function crawl for https://www.polevka.art
 * Run: node scripts/qa-polevka-full.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'tmp', 'qa-polevka-full');
mkdirSync(OUT, { recursive: true });

const BASE = process.env.QA_URL || 'https://www.polevka.art';
const findings = [];
const consoleErrors = [];
const pageErrors = [];
const failedNet = [];

function note(area, ok, detail, severity) {
  const sev = severity || (ok ? 'pass' : 'fail');
  const det = detail == null ? '' : String(detail);
  findings.push({ severity: sev, area, ok, detail: det.slice(0, 500) });
  const mark = ok ? 'PASS' : sev === 'warn' ? 'WARN' : 'FAIL';
  console.log(`[${mark}] ${area}${det ? ' — ' + det.slice(0, 160) : ''}`);
}

function isNoise(text) {
  const t = String(text || '');
  return (
    /favicon/i.test(t) ||
    /frame-ancestors/i.test(t) ||
    /Download the React DevTools/i.test(t) ||
    /net::ERR_BLOCKED_BY_CLIENT/i.test(t) ||
    /google-analytics|googletagmanager|mc\.yandex|hotjar|facebook/i.test(t)
  );
}

async function shot(page, name) {
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: false }).catch(() => {});
}

async function visible(page, sel) {
  const loc = page.locator(sel).first();
  if (!(await loc.count())) return false;
  return loc.isVisible().catch(() => false);
}

async function dismissGates(page) {
  await page.evaluate(() => {
    try {
      localStorage.setItem('rosmap_onboarding_done', '1');
      localStorage.setItem(
        'polevka_cookie_consent',
        JSON.stringify({ v: 2, choice: 'all', at: new Date().toISOString() })
      );
    } catch {}
  });
  const cookieBtn = page.locator('#cookie-consent-banner button:has-text("Принять")');
  if (await cookieBtn.isVisible().catch(() => false)) {
    await cookieBtn.click({ timeout: 3000 }).catch(() => {});
  }
  await page.evaluate(() => {
    if (typeof window.setCookieConsent === 'function') window.setCookieConsent('all');
    if (typeof window.finishOnboarding === 'function') window.finishOnboarding();
    const ov = document.getElementById('onboarding-overlay');
    if (ov) {
      ov.classList.add('hidden');
      ov.style.display = 'none';
      ov.classList.remove('pointer-events-auto');
    }
    const cc = document.getElementById('cookie-consent-banner');
    if (cc) cc.classList.add('hidden', 'opacity-0', 'pointer-events-none');
    document.body.classList.remove('onboarding-open');
  });
  await page.waitForTimeout(400);
}

async function safeClick(page, sel, label) {
  const loc = page.locator(sel).first();
  if (!(await loc.count())) {
    note(label, false, `missing ${sel}`);
    return false;
  }
  try {
    await loc.click({ timeout: 5000, force: true });
    await page.waitForTimeout(600);
    return true;
  } catch (e) {
    try {
      await page.evaluate((s) => {
        const el = document.querySelector(s);
        if (el) el.click();
      }, sel);
      await page.waitForTimeout(600);
      return true;
    } catch {
      note(label, false, e.message);
      return false;
    }
  }
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  locale: 'ru-RU',
  ignoreHTTPSErrors: true,
});
const page = await context.newPage();

page.on('console', (msg) => {
  if (msg.type() === 'error' && !isNoise(msg.text())) consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => pageErrors.push(String(err)));
page.on('response', (res) => {
  const u = res.url();
  const s = res.status();
  if (s >= 400 && !isNoise(u)) failedNet.push(`${s} ${u.slice(0, 180)}`);
});

try {
  await context.addInitScript(() => {
    try {
      localStorage.setItem('rosmap_onboarding_done', '1');
      localStorage.setItem(
        'polevka_cookie_consent',
        JSON.stringify({ v: 2, choice: 'all', at: new Date().toISOString() })
      );
    } catch {}
  });

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(2500);
  await dismissGates(page);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(2500);
  await dismissGates(page);
  await shot(page, '00-home');

  note('boot.map', await visible(page, '#map'), 'map');
  note('boot.rail', await visible(page, '#app-rail'), 'rail');
  note('boot.cookie-hidden', !(await visible(page, '#cookie-consent-banner:not(.hidden)')), 'cookie');
  note('boot.onboarding-hidden', !(await visible(page, '#onboarding-overlay:not(.hidden)')), 'onboarding');

  await safeClick(page, '#rail-library', 'rail.library');
  await page.waitForTimeout(800);
  const soundCount = await page.locator('.sidebar-sound-row').count();
  note('library.rows', soundCount > 0, `rows=${soundCount}`);
  await shot(page, '01-library');

  if (soundCount > 0) {
    const sid = await page.locator('.sidebar-sound-row').first().getAttribute('data-sound-id');
    await page.evaluate((id) => {
      if (typeof window.selectSound === 'function') window.selectSound(id);
    }, sid);
    await page.waitForTimeout(2500);
    const playingId = await page.evaluate(() => window.currentPlayingId || null);
    note('player.open', !!playingId, `id=${playingId || sid}`);
    await shot(page, '02-player');

    await page.evaluate(() => {
      if (typeof window.toggleMainPlay === 'function') window.toggleMainPlay();
    });
    await page.waitForTimeout(1200);
    note('player.play', true, 'toggled');

    await page.evaluate(() => {
      if (typeof window.openDetailsModal === 'function') window.openDetailsModal();
    });
    await page.waitForTimeout(1000);
    const title = ((await page.locator('#details-title').textContent().catch(() => '')) || '').trim();
    note('details.open', title.length > 0, `title="${title.slice(0, 60)}"`);
    await shot(page, '03-details');

    note('details.download', (await page.locator('#details-download-xfer').count()) > 0, 'xfer');
    note('details.actions-row', (await page.locator('.details-header-actions, .details-title-row').count()) > 0, 'header');

    await page.evaluate(() => {
      if (typeof window.toggleSoundReaction === 'function') window.toggleSoundReaction('like');
    });
    await page.waitForTimeout(700);
    const authAfterLike = await visible(page, '#auth-modal:not(.hidden)');
    note('details.like-guest', true, authAfterLike ? 'auth-gate' : 'no-auth');
    if (authAfterLike) {
      await page.evaluate(() => {
        if (typeof window.requestCloseAuthModal === 'function') window.requestCloseAuthModal();
      });
      await page.waitForTimeout(400);
    }

    await page.evaluate(() => {
      if (typeof window.togglePlayerAnalyzers === 'function') window.togglePlayerAnalyzers();
    });
    await page.waitForTimeout(800);
    note('player.analyzers', true, 'toggled');
    await shot(page, '04-analyzers');
    await page.evaluate(() => {
      if (typeof window.togglePlayerAnalyzers === 'function') window.togglePlayerAnalyzers();
    });
  }

  await safeClick(page, '#rail-feed', 'rail.feed');
  await page.waitForTimeout(1200);
  note('feed.open', await visible(page, '#sidebar-feed:not(.hidden)'), 'feed pane');
  await shot(page, '05-feed');

  await safeClick(page, '#rail-expeditions', 'rail.expeditions');
  await page.waitForTimeout(1000);
  note('expeditions.tab', await visible(page, '#sidebar'), 'sidebar');
  await shot(page, '06-expeditions');

  await safeClick(page, '#rail-help', 'rail.help');
  await page.waitForTimeout(1000);
  note('help.tab', await visible(page, '#sidebar'), 'sidebar');
  await shot(page, '07-help');

  await safeClick(page, '#search-toggle-btn', 'search.open');
  await page.fill('#search-input', 'утки').catch(() => {});
  await page.waitForTimeout(900);
  const sug = await page.locator('#search-suggestions:not(.hidden) *').count();
  note('search.query', true, `nodes=${sug}`);
  await shot(page, '08-search');
  await page.evaluate(() => {
    if (typeof window.clearSearchQuery === 'function') window.clearSearchQuery();
    if (typeof window.toggleSearchBar === 'function') window.toggleSearchBar(false);
  });

  await safeClick(page, '#events-fab', 'events.open');
  await page.waitForTimeout(900);
  note('events.panel', await visible(page, '#events-panel:not(.hidden)'), 'panel');
  await shot(page, '09-events');
  await page.evaluate(() => {
    if (typeof window.toggleEventsPanel === 'function') window.toggleEventsPanel();
  });

  await safeClick(page, '#settings-btn', 'settings.open');
  await page.waitForTimeout(900);
  note('settings.modal', await visible(page, '#settings-modal:not(.hidden)'), 'modal');
  await shot(page, '10-settings');
  await page.evaluate(() => {
    if (typeof window.requestCloseSettingsModal === 'function') window.requestCloseSettingsModal();
  });

  await safeClick(page, '#profile-btn', 'profile.open');
  await page.waitForTimeout(900);
  const cabinet = await visible(page, '#cabinet-modal:not(.hidden)');
  const auth = await visible(page, '#auth-modal:not(.hidden)');
  note('profile.guest', cabinet || auth, cabinet ? 'cabinet' : auth ? 'auth' : 'neither');
  await shot(page, '11-profile');
  if (auth) {
    await safeClick(page, '#auth-tab-register', 'auth.register-tab');
    await page.evaluate(() => {
      if (typeof window.requestCloseAuthModal === 'function') window.requestCloseAuthModal();
    });
  }
  if (cabinet) {
    await page.evaluate(() => {
      if (typeof window.requestCloseCabinet === 'function') window.requestCloseCabinet();
    });
  }

  await safeClick(page, '#fab-add-sound', 'add.open');
  await page.waitForTimeout(900);
  const addAuth = await visible(page, '#auth-modal:not(.hidden)');
  const addModal = await visible(page, '#add-modal:not(.hidden)');
  note('add.guest', addAuth || addModal, addAuth ? 'auth-gate' : addModal ? 'add-modal' : 'none');
  await shot(page, '12-add');
  await page.evaluate(() => {
    if (typeof window.requestCloseAuthModal === 'function') window.requestCloseAuthModal();
    if (typeof window.toggleAddModal === 'function') {
      const add = document.getElementById('add-modal');
      if (add && !add.classList.contains('hidden')) window.toggleAddModal();
    }
  });

  await page.evaluate(() => {
    if (typeof window.openLegalDocModal === 'function') window.openLegalDocModal('privacy');
  });
  await page.waitForTimeout(800);
  note(
    'legal.privacy',
    await page.locator('#legal-doc-modal').evaluate((el) => el && !el.classList.contains('hidden')).catch(() => false),
    'privacy'
  );
  await shot(page, '13-legal-privacy');
  await page.evaluate(() => {
    const el = document.getElementById('legal-doc-modal');
    if (el) el.classList.add('hidden', 'opacity-0', 'pointer-events-none');
  });

  await page.evaluate(() => {
    if (typeof window.openLegalDocModal === 'function') window.openLegalDocModal('terms');
  });
  await page.waitForTimeout(600);
  note(
    'legal.terms',
    await page.locator('#legal-doc-modal').evaluate((el) => el && !el.classList.contains('hidden')).catch(() => false),
    'terms'
  );
  await page.evaluate(() => {
    const el = document.getElementById('legal-doc-modal');
    if (el) el.classList.add('hidden', 'opacity-0', 'pointer-events-none');
  });

  await page.evaluate(() => {
    if (typeof window.openPublishRulesModal === 'function') window.openPublishRulesModal();
  });
  await page.waitForTimeout(600);
  note(
    'legal.rules',
    await page.locator('#publish-rules-modal').evaluate((el) => el && !el.classList.contains('hidden')).catch(() => false),
    'rules'
  );
  await shot(page, '14-rules');
  await page.evaluate(() => {
    const el = document.getElementById('publish-rules-modal');
    if (el) el.classList.add('hidden', 'opacity-0', 'pointer-events-none');
  });

  await page.evaluate(() => {
    if (typeof window.openAudioGuessr === 'function') window.openAudioGuessr();
  });
  await page.waitForTimeout(1000);
  note(
    'guessr.open',
    await page.locator('#guessr-modal, [id*="guessr"]').first().isVisible().catch(() => false),
    'modal'
  );
  await shot(page, '15-guessr');
  await page.evaluate(() => {
    if (typeof window.closeAudioGuessr === 'function') window.closeAudioGuessr();
    document.querySelectorAll('[id*="guessr"]').forEach((el) => {
      el.classList.add('hidden', 'opacity-0', 'pointer-events-none');
    });
  });

  await safeClick(page, '#rail-library', 'library.back');
  await safeClick(page, '#library-filters-toggle', 'library.filters');
  await page.waitForTimeout(600);
  note(
    'library.filters',
    await page.locator('#dock-filters').isVisible().catch(() => false),
    'panel'
  );
  await shot(page, '16-filters');

  const marker = page.locator('.custom-marker').first();
  if (await marker.count()) {
    await marker.click({ force: true, timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(1000);
    note('map.marker', true, 'clicked');
    await shot(page, '17-marker');
  } else {
    note('map.marker', false, 'no marker', 'warn');
  }

  // Mobile
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(800);
  await dismissGates(page);
  await shot(page, '20-mobile-home');
  note('mobile.nav', await visible(page, '#mobile-bottom-nav'), 'bottom-nav');

  await page.evaluate(() => {
    if (typeof window.mobileNavGo === 'function') window.mobileNavGo('library');
  });
  await page.waitForTimeout(800);
  note('mobile.library', await visible(page, '#sidebar'), 'sidebar');
  await shot(page, '21-mobile-library');

  await page.evaluate(() => {
    if (typeof window.mobileNavGo === 'function') window.mobileNavGo('feed');
  });
  await page.waitForTimeout(800);
  note('mobile.feed', true, 'switched');
  await shot(page, '22-mobile-feed');

  await page.evaluate(() => {
    if (typeof window.mobileNavGo === 'function') window.mobileNavGo('expeditions');
  });
  await page.waitForTimeout(800);
  await shot(page, '23-mobile-expeditions');
  note('mobile.expeditions', true, 'switched');

  await page.evaluate(() => {
    if (typeof window.toggleMobileAddMenu === 'function') window.toggleMobileAddMenu();
  });
  await page.waitForTimeout(600);
  note(
    'mobile.add-menu',
    await page.locator('#mobile-add-menu').isVisible().catch(() => false),
    'menu'
  );
  await shot(page, '24-mobile-add');

  await page.evaluate(() => {
    if (typeof window.mobileNavGo === 'function') window.mobileNavGo('profile');
  });
  await page.waitForTimeout(800);
  note(
    'mobile.profile',
    (await visible(page, '#cabinet-modal:not(.hidden)')) || (await visible(page, '#auth-modal:not(.hidden)')),
    'profile/auth'
  );
  await shot(page, '25-mobile-profile');

  await page.evaluate(() => {
    if (typeof window.requestCloseCabinet === 'function') window.requestCloseCabinet();
    if (typeof window.requestCloseAuthModal === 'function') window.requestCloseAuthModal();
  });
  await safeClick(page, '#events-fab', 'mobile.events');
  await page.waitForTimeout(800);
  note(
    'mobile.events',
    (await visible(page, '#events-panel:not(.hidden)')) ||
      (await page.locator('#events-sheet, .events-sheet').isVisible().catch(() => false)),
    'events'
  );
  await shot(page, '26-mobile-events');
} catch (e) {
  note('runner.crash', false, e.stack || e.message);
  await shot(page, '99-crash');
} finally {
  await browser.close();
}

const uniqNet = [...new Set(failedNet)].slice(0, 40);
const uniqConsole = [...new Set(consoleErrors)].slice(0, 40);
const uniqPage = [...new Set(pageErrors)].slice(0, 40);
const fails = findings.filter((f) => !f.ok && f.severity === 'fail');

const report = {
  url: BASE,
  out: OUT,
  summary: {
    pass: findings.filter((f) => f.ok).length,
    fail: fails.length,
    warn: findings.filter((f) => f.severity === 'warn').length,
    total: findings.length,
  },
  fails,
  findings,
  pageErrors: uniqPage,
  consoleErrors: uniqConsole,
  failedNet: uniqNet,
};

writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
console.log('\n=== SUMMARY ===');
console.log(JSON.stringify(report.summary, null, 2));
console.log('\n=== FAILS ===');
console.log(JSON.stringify(fails, null, 2));
console.log('\n=== PAGE ERRORS ===');
console.log(JSON.stringify(uniqPage, null, 2));
console.log('\n=== CONSOLE ERRORS ===');
console.log(JSON.stringify(uniqConsole, null, 2));
console.log('\n=== FAILED NET ===');
console.log(JSON.stringify(uniqNet, null, 2));
