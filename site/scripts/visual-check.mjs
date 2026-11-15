import {spawn} from 'node:child_process';
import {mkdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {chromium} from 'playwright';

const origin = 'http://127.0.0.1:3200';
const base = '/mastodon-lab/';
const screenshots = 'visual-snapshots';
const server = spawn('npm', ['run', 'serve', '--', '--host', '127.0.0.1', '--port', '3200'], {
  stdio: ['ignore', 'pipe', 'pipe'],
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
    name: 'update-mobile',
    path: 'records/update-log/4-7-5-security-upgrade-2026-11-13',
    width: 390, height: 844, expected: '.lab-doc--update-log',
  },
];

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

    const response = await page.goto(origin + base + check.path, {waitUntil: 'networkidle'});
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

    if (check.name === 'runbook-mobile') {
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
  server.kill('SIGTERM');
}
