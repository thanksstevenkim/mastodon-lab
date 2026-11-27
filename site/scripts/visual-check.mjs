import {spawn} from 'node:child_process';
import {mkdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {chromium} from 'playwright';

const origin = 'http://127.0.0.1:3200';
const base = '/mastodon-lab/';
const screenshots = 'visual-snapshots';
const server = spawn('npm', ['run', 'serve', '--', '--host', '127.0.0.1', '--port', '3200'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: true, // Keep npm and its spawned Docusaurus server in one process group.
});
server.stdout.on('data', (buffer) => process.stdout.write(buffer));
server.stderr.on('data', (buffer) => process.stderr.write(buffer));

async function ready() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (server.exitCode !== null) throw new Error('Preview server exited before becoming ready');
    try {
      const response = await fetch(origin + base);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Preview server did not become ready');
}

const checks = [
  {name: 'home-desktop-en', path: '', width: 1280, height: 800, expected: '.lab-home'},
  {name: 'home-desktop-ko', path: 'ko/', width: 1280, height: 800, expected: '.lab-home'},
  {name: 'home-mobile-en', path: '', width: 390, height: 844, expected: '.lab-home'},
  {name: 'home-mobile-ko', path: 'ko/', width: 390, height: 844, expected: '.lab-home'},
  {
    name: 'incident-desktop',
    path: 'records/incidents/014-nginx-restart-dns-failure-after-glibc-update-2026-11-13',
    width: 1280, height: 800, expected: '.lab-panel--incident',
  },
  {
    name: 'incident-mobile',
    path: 'records/incidents/014-nginx-restart-dns-failure-after-glibc-update-2026-11-13',
    width: 390, height: 844, expected: '.lab-panel--incident',
  },
  {
    name: 'runbook-desktop',
    path: 'records/runbooks/upgrade',
    width: 1280, height: 800, expected: '.lab-panel--runbook',
  },
  {
    name: 'runbook-mobile',
    path: 'records/runbooks/upgrade',
    width: 390, height: 844, expected: '.lab-panel--runbook',
  },
  {
    name: 'operations-desktop',
    path: 'records/operations/moderation-fairness-and-limits-2026-10-30',
    width: 1280, height: 800, expected: '.lab-doc--operations',
  },
  {
    name: 'update-desktop',
    path: 'records/update-log/4-7-5-security-upgrade-2026-11-13',
    width: 1280, height: 800, expected: '.lab-doc--update-log',
  },
  {
    name: 'update-mobile',
    path: 'records/update-log/4-7-5-security-upgrade-2026-11-13',
    width: 390, height: 844, expected: '.lab-doc--update-log',
  },
];

// Test all four Korean category pages and their translated navigation.
const koDocs = checks.filter((check) => check.width === 1280 && check.path.startsWith('records/'));
for (const check of koDocs) checks.push({...check, name: check.name + '-ko', path: 'ko/' + check.path});
checks.push({...checks.find((check) => check.name === 'incident-mobile'), name: 'incident-mobile-ko', path: 'ko/' + checks.find((check) => check.name === 'incident-mobile').path});

checks.push({name: 'untranslated-runbook-ko', path: 'ko/records/runbooks/backup', width: 1280, height: 800, expected: '.lab-doc--runbooks'});
checks.push({...checks.find((check) => check.name === 'runbook-mobile'), name: 'runbook-mobile-ko', path: 'ko/' + checks.find((check) => check.name === 'runbook-mobile').path});

const koreanCategories = {incidents: '장애 기록', runbooks: '운영 절차서', operations: '운영 기록', 'update-log': '업데이트 기록'};

let browser;
try {
  await ready();
  await mkdir(screenshots, {recursive: true});
  browser = await chromium.launch({headless: true, args: ['--no-sandbox']});
  const results = [];
  let failures = 0;

  for (const check of checks) {
    const context = await browser.newContext({
      viewport: {width: check.width, height: check.height},
      deviceScaleFactor: 1,
      colorScheme: 'light',
      locale: check.name.endsWith('ko') ? 'ko-KR' : 'en-US',
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));

    console.log('START_VISUAL_CHECK', check.name);
    const response = await page.goto(origin + base + check.path, {waitUntil: 'domcontentloaded', timeout: 20000});
    await page.locator(check.expected).first().waitFor({state: 'visible', timeout: 8000}).catch(() => {});
    const httpStatus = response?.status() ?? 0;
    const componentVisible = await page.locator(check.expected).first().isVisible().catch(() => false);
    const metrics = await page.evaluate(() => ({
      viewport: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      heading: document.querySelector('h1')?.textContent?.trim() ?? '',
      navbarToggle: !!document.querySelector('.navbar__toggle'),
      langSwitch: !!document.querySelector('.navbar__item.dropdown'),
    }));
    const overflow = metrics.documentWidth > metrics.viewport + 2;

    // Confirm actual rendered sidebar links, not just CSS visibility.
    const category = check.path.replace(/^ko\//, '').match(/^records\/(incidents|runbooks|operations|update-log)\//)?.[1];
    if (category && check.width >= 1000) {
      const sidebar = page.locator('.theme-doc-sidebar-menu').filter({visible: true}).first();
      const hrefs = await sidebar.locator('a[href]').evaluateAll((links) => links.map((a) => new URL(a.href).pathname));
      const recordPaths = hrefs.map((href) => href.match(/\/records\/(incidents|runbooks|operations|update-log)\//)?.[1]).filter(Boolean);
      if (!recordPaths.length || recordPaths.some((name) => name !== category)) {
        errors.push('Sidebar must contain only ' + category + ' document links: ' + recordPaths.join(', '));
      }
      if (category === 'incidents') {
        const ticket = sidebar.locator('.lab-sidebar-ticket').filter({hasText: /^SUP-0001$/});
        if (await ticket.count() !== 1 || !(await ticket.isVisible())) {
          errors.push('SUP-0001 must render as a visible separate ticket badge');
        }
        if (!(await ticket.locator('..').locator('.lab-sidebar-title').isVisible().catch(() => false))) {
          errors.push('Incident title must be separate from the ticket badge');
        }
      }
    }

    if (check.path.startsWith('ko/') && check.width >= 1000) {
      const navbar = page.locator('.navbar');
      for (const label of Object.values(koreanCategories)) {
        if (!(await navbar.getByText(label, {exact: true}).first().isVisible().catch(() => false))) {
          errors.push('Missing Korean navbar label: ' + label);
        }
      }
      if (category) {
        const sidebar = page.locator('.theme-doc-sidebar-menu').filter({visible: true}).first();
        const label = koreanCategories[category];
        if (!(await sidebar.getByText(label, {exact: true}).first().isVisible().catch(() => false))) {
          errors.push('Missing Korean sidebar category: ' + label);
        }
        const links = await sidebar.locator('a[href*="/records/' + category + '/"]').allTextContents();
        if (!links.length || links.some((label) => !/[가-힣]/.test(label))) {
          errors.push('Untranslated Korean sidebar document labels: ' + links.join(' | '));
        }
        const fallback = check.name === 'untranslated-runbook-ko';
        const notice = await page.locator('.lab-doc__translation').isVisible().catch(() => false);
        if (notice !== fallback) errors.push('Incorrect translation notice visibility');
        if (!fallback) {
          const body = await page.locator('.markdown').first().innerText();
          if (!/[가-힣]{2,}/.test(body)) errors.push('Translated body lacks Korean text');
          const englishPath = origin + base + check.path.replace(/^ko\//, '');
          const switchLinks = await navbar.locator('a[href]').evaluateAll((items) => items.map((a) => a.href.replace(/\/$/, '')));
          if (!switchLinks.includes(englishPath.replace(/\/$/, ''))) errors.push('English equivalent record link is missing');
        }
      }
    }

    if (check.name.startsWith('incident-')) {
      const evidence = page.locator('.markdown h2#evidence-and-timeline');
      const evidenceLink = page.locator('.lab-panel--incident a[href="#evidence-and-timeline"]');
      if (await evidence.count() !== 1 || !(await evidence.isVisible())) {
        errors.push('Incident evidence heading anchor missing or duplicated');
      } else if (await evidenceLink.count() !== 1 || !(await evidenceLink.isVisible())) {
        errors.push('Incident timeline evidence link missing');
      } else {
        await evidenceLink.click();
        if (new URL(page.url()).hash !== '#evidence-and-timeline') {
          errors.push('Incident evidence link did not navigate to its heading');
        }
        await page.evaluate(() => {
          history.replaceState(history.state, '', location.pathname + location.search);
          window.scrollTo({top: 0, behavior: 'instant'});
        });
      }
      const labels = await page.locator('.menu__link').allTextContents();
      if (labels.some((label) => label.trim() === 'Ticket ID')) {
        errors.push('Incident sidebar still contains an uninformative Ticket ID label');
      }
      if (!(await page.locator('.lab-doc__intro--incident h1').isVisible().catch(() => false))) {
        errors.push('Incident summary heading is missing');
      }
    }

    if (check.name.startsWith('runbook-')) {
      if (!(await page.locator('.lab-doc--upgrade-preview .lab-doc__intro h1').isVisible().catch(() => false))) {
        errors.push('Runbook summary heading is missing');
      }
    }

    if (check.name === 'runbook-mobile' || check.name === 'runbook-mobile-ko') {
      const first = page.locator('.lab-checklist input[type="checkbox"]').first();
      await first.check();
      const value = await page.locator('.lab-panel--runbook progress').getAttribute('value');
      if (value !== '1') {
        errors.push('Runbook checklist did not update progress after checking an item');
      }
    }

    if (httpStatus !== 200 || !componentVisible || overflow || errors.length > 0) failures += 1;
    const imageName = check.name + '.jpg';
    await page.screenshot({path: join(screenshots, imageName), type: 'jpeg', quality: 68});
    const result = {
      ...check, httpStatus, componentVisible, overflow,
      documentWidth: metrics.documentWidth, heading: metrics.heading,
      errors, screenshot: imageName,
    };
    console.log('VISUAL_CHECK', JSON.stringify(result));
    results.push(result);
    await context.close();
  }

  await writeFile(join(screenshots, 'results.json'), JSON.stringify(results, null, 2) + '\n');
  if (failures > 0) throw new Error(failures + ' visual/browser checks failed; inspect screenshots and results.json');
} finally {
  if (browser) await browser.close();
  // npm spawns Docusaurus. Terminate the entire process group, not just npm.
  try { process.kill(-server.pid, 'SIGTERM'); } catch {}
  server.stdout.destroy();
  server.stderr.destroy();
}
